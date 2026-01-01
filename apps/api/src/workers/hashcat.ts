import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../db";
import { jobs, jobResults, networks, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";
import {
  validateFilePath,
  quotePathForShell,
  createSafePath,
} from "../lib/file-path-validator";
import { logger } from "../lib/logger";
import { extractHandshake, extractPMKID } from "./pcap-processing";
import { getWebSocketServer } from "../lib/websocket";
import { configService } from "../services/config.service";
import { emailQueue } from "../lib/email-queue";

const execAsync = promisify(exec);

interface BuildHashcatCommandOptions {
  attackMode: "pmkid" | "handshake";
  handshakePath: string;
  dictionaryPath: string;
  jobId: string;
  optimized?: boolean;
  force?: boolean;
  runtime?: number;
}

export async function buildHashcatCommand({
  attackMode,
  handshakePath,
  dictionaryPath,
  jobId,
  optimized = true,
  force = true,
  runtime = 3600,
}: BuildHashcatCommandOptions): Promise<string> {
  const workDir = path.join(process.cwd(), "temp", "hashcat", jobId);
  const outputFile = path.join(workDir, "hashcat_output.txt");
  const potfilePath = path.join(workDir, "hashcat.pot");

  const mode = attackMode === "pmkid" ? 16800 : 22000;

  const parts = [
    "hashcat",
    `-m ${mode}`,
    "-a 0",
    "--quiet",
    force ? "--force" : "",
    optimized ? "-O" : "",
    optimized ? "-w 4" : "",
    `--runtime=${runtime}`,
    `--session=${jobId}`,
    `-o ${outputFile}`,
    `--potfile-path=${potfilePath}`,
    handshakePath,
    dictionaryPath,
  ].filter(Boolean);

  return parts.join(" ");
}

interface RunHashcatAttackOptions {
  jobId: string;
  networkId: string;
  dictionaryId: string;
  handshakePath: string;
  dictionaryPath: string;
  attackMode: "pmkid" | "handshake";
  userId: string;
}

export async function runHashcatAttack({
  jobId,
  networkId,
  dictionaryId,
  handshakePath,
  dictionaryPath,
  attackMode,
  userId,
}: RunHashcatAttackOptions) {
  const startTime = new Date();

  try {
    logger.info("Starting Hashcat attack", "hashcat", {
      jobId,
      networkId,
      dictionaryId,
      attackMode,
      userId,
      startTime: startTime.toISOString(),
    });

    // Validate job and network ownership
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found or access denied`);
    }

    // Check if job is already cancelled
    if (job.status === "cancelled") {
      logger.info("Job is already cancelled, skipping execution", "hashcat", {
        jobId,
      });

      await db
        .update(networks)
        .set({
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(networks.id, networkId));

      return {
        success: false,
        cancelled: true,
        message: "Job was cancelled before execution",
      };
    }

    const network = await db.query.networks.findFirst({
      where: and(eq(networks.id, networkId), eq(networks.userId, userId)),
    });

    if (!network) {
      throw new Error(`Network ${networkId} not found or access denied`);
    }

    // Check if job is already cancelled
    if (job.status === "cancelled") {
      logger.info("Job is already cancelled, skipping execution", "hashcat", {
        jobId,
      });

      await db
        .update(networks)
        .set({
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(networks.id, networkId));

      return {
        success: false,
        cancelled: true,
        message: "Job was cancelled before execution",
      };
    }

    // Check job dependencies
    if (job.dependsOn && job.dependsOn.length > 0) {
      const dependencyIds = job.dependsOn;

      for (const depId of dependencyIds) {
        const depJob = await db.query.jobs.findFirst({
          where: eq(jobs.id, depId),
        });

        if (!depJob || depJob.status !== "completed") {
          logger.info(
            "Job dependencies not met, skipping execution",
            "hashcat",
            {
              jobId,
              dependencies: dependencyIds,
            },
          );

          return {
            success: false,
            skipped: true,
            message:
              "Job dependencies not met, job will be queued again when dependencies complete",
            dependencies: dependencyIds,
          };
        }
      }

      logger.info("Job dependencies verified", "hashcat", {
        jobId,
        dependencies: dependencyIds,
      });
    }

    // Check if job is scheduled for later
    if (job.scheduledAt && new Date(job.scheduledAt) > new Date()) {
      logger.info("Job scheduled for later, skipping execution", "hashcat", {
        jobId,
        scheduledAt: job.scheduledAt,
      });

      return {
        success: false,
        scheduled: true,
        message: "Job is scheduled for future execution",
        scheduledAt: job.scheduledAt,
      };
    }

    logger.info("Job and network validation passed", "hashcat", {
      jobId,
      networkId,
      networkSSID: network.ssid,
      networkBSSID: network.bssid,
    });

    // Update job status to running or scheduled
    const targetStatus = job.scheduledAt ? "scheduled" : "running";

    await db
      .update(jobs)
      .set({
        status: targetStatus,
        startTime: job.scheduledAt ? null : new Date(),
        scheduledAt: job.scheduledAt || null,
        updatedAt: new Date(),
        progress: 0,
      })
      .where(eq(jobs.id, jobId));

    logger.info(`Job status updated to ${targetStatus}`, "hashcat", {
      jobId,
      status: targetStatus,
    });

    // Ensure handshake/PMKID files exist and are properly extracted
    const validatedAttackFile = await ensureAttackFileExists(
      handshakePath,
      attackMode,
      network.bssid!,
    );

    // SECURITY: Validate file paths before using them
    logger.info("Validating file paths for hashcat attack", "hashcat", {
      jobId,
      userId,
      originalHandshakePath: handshakePath,
      validatedAttackFile,
      dictionaryPath,
    });

    // Validate attack file path
    const validatedHandshakePath = await validateFilePath(validatedAttackFile, {
      allowedBasePaths: [
        "temp/handshakes",
        "data/handshakes",
        "uploads/handshakes",
        "temp/pmkids",
      ],
      allowedExtensions: [".hc22000", ".cap", ".pcap", ".pmkid"],
      mustExist: true,
      allowSymlinks: false,
    });

    // Validate dictionary file path
    const validatedDictionaryPath = await validateFilePath(dictionaryPath, {
      allowedBasePaths: [
        "temp/dictionaries",
        "data/dictionaries",
        "uploads/dictionaries",
      ],
      allowedExtensions: [".txt", ".lst", ".dict"],
      mustExist: true,
      allowSymlinks: false,
    });

    logger.info("File paths validated successfully", "hashcat", {
      jobId,
      validatedHandshakePath,
      validatedDictionaryPath,
    });

    // Update job status to running
    await db
      .update(jobs)
      .set({
        status: "running",
        startTime,
        updatedAt: new Date(),
        progress: 0,
      })
      .where(eq(jobs.id, jobId));

    // Update network status
    await db
      .update(networks)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(networks.id, networkId));

    logger.info("Job status updated to running", "hashcat", {
      jobId,
      networkId,
    });

    // Prepare hashcat command with validated paths
    const hashcatCommand = await buildHashcatCommand({
      attackMode,
      handshakePath: validatedHandshakePath,
      dictionaryPath: validatedDictionaryPath,
      jobId,
    });

    logger.info("Executing hashcat command", "hashcat", {
      jobId,
      command: hashcatCommand.replace(/\s+/g, " "),
    });

    // Execute hashcat command
    let result;
    try {
      const { stdout, stderr } = await execAsync(hashcatCommand);
      result = { stdout, stderr };
    } catch (execError) {
      logger.error("Hashcat execution failed", "hashcat", {
        jobId,
        error:
          execError instanceof Error ? execError : new Error(String(execError)),
      });

      // Check if job was cancelled during execution
      const currentJob = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (currentJob?.status === "cancelled") {
        logger.info("Job was cancelled during execution", "hashcat", { jobId });
        return {
          success: false,
          cancelled: true,
          message: "Job was cancelled during execution",
        };
      }

      throw execError;
    }

    // Process results
    const crackedPasswords = await parseHashcatOutput(result, jobId);

    logger.info("Processing hashcat results", "hashcat", {
      jobId,
      passwordsFound: crackedPasswords.length,
    });

    // Save results to database
    if (crackedPasswords.length > 0) {
      for (const password of crackedPasswords) {
        await db.insert(jobResults).values({
          jobId,
          type: "password",
          data: {
            password: password.password,
            plaintext: password.plaintext,
            attackMode,
            hashType: getHashType(attackMode),
            processingTime: password.processingTime,
            networkId,
            dictionaryId,
            userId,
          },
          createdAt: new Date(),
        });
      }

      // Update network status with cracked password
      const mainPassword = crackedPasswords[0];
      await db
        .update(networks)
        .set({
          status: "cracked" as any,
          password: mainPassword.plaintext,
          notes: `Cracked password: ${mainPassword.plaintext}`,
          updatedAt: new Date(),
        })
        .where(eq(networks.id, networkId));

      // Update job status to completed
      await db
        .update(jobs)
        .set({
          status: "completed",
          endTime: new Date(),
          progress: 100,
          result: {
            passwordsFound: crackedPasswords.length,
            passwords: crackedPasswords.map((p) => ({
              password: p.password,
              plaintext: p.plaintext,
            })),
          },
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      logger.info("Hashcat attack completed successfully", "hashcat", {
        jobId,
        passwordsFound: crackedPasswords.length,
        mainPassword: mainPassword.plaintext,
      });

      // Send email notification if enabled
      try {
        const emailEnabled = await configService.getBoolean(
          "email-enabled",
          false,
        );
        const emailNotifyJobComplete = await configService.getBoolean(
          "email-notify-job-complete",
          true,
        );

        if (emailEnabled && emailNotifyJobComplete) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { email: true, name: true },
          });

          if (user) {
            await emailQueue.sendJobEmail({
              type:
                crackedPasswords.length > 0 ? "job_completed" : "job_failed",
              to: user.email,
              data: {
                name: job.name,
                jobId,
                status: crackedPasswords.length > 0 ? "completed" : "failed",
                passwordsFound: crackedPasswords.length,
                totalHashes: crackedPasswords.length,
                duration: Date.now() - new Date(job.startTime).getTime(),
              },
            });
          }
        }
      } catch (emailError) {
        logger.error("Failed to send job completion email", "hashcat", {
          jobId,
          error:
            emailError instanceof Error
              ? emailError
              : new Error(String(emailError)),
        });
      }

      return {
        success: true,
        passwordsFound: crackedPasswords.length,
        passwords: crackedPasswords.map((p) => ({
          password: p.password,
          plaintext: p.plaintext,
        })),
      };
    } else {
      // No passwords found
      await db
        .update(jobs)
        .set({
          status: "completed",
          endTime: new Date(),
          progress: 100,
          result: {
            passwordsFound: 0,
            message: "No passwords found with the provided dictionary",
          },
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      await db
        .update(networks)
        .set({
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(networks.id, networkId));

      logger.info("Hashcat attack completed - no passwords found", "hashcat", {
        jobId,
        message: "No passwords found with the provided dictionary",
      });

      return {
        success: true,
        passwordsFound: 0,
        message: "No passwords found with the provided dictionary",
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Hashcat attack failed", "hashcat", {
      jobId,
      networkId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update job status to failed
    await db
      .update(jobs)
      .set({
        status: "failed",
        endTime: new Date(),
        errorMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    // Reset network status
    await db
      .update(networks)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(networks.id, networkId));

    // Send email notification if enabled
    try {
      const emailEnabled = await configService.getBoolean(
        "email-enabled",
        false,
      );
      const emailNotifyJobFailed = await configService.getBoolean(
        "email-notify-job-failed",
        true,
      );

      if (emailEnabled && emailNotifyJobFailed) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true, name: true },
        });

        if (user) {
          await emailQueue.sendJobEmail({
            type: "job_failed",
            to: user.email,
            data: {
              name: job.name,
              jobId,
              status: "failed",
              errorMessage,
            },
          });
        }
      }
    } catch (emailError) {
      logger.error("Failed to send job failure email", "hashcat", {
        jobId,
        error:
          emailError instanceof Error
            ? emailError
            : new Error(String(emailError)),
      });
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function parseHashcatOutput(result: any, jobId: string) {
  const workDir = path.join(process.cwd(), "temp", "hashcat", jobId);
  const outputFile = path.join(workDir, "hashcat_output.txt");

  logger.info("Parsing hashcat output", "hashcat", {
    jobId,
    outputFile,
  });

  try {
    // Check if output file exists and has content
    const outputExists = await fs
      .access(outputFile)
      .then(() => true)
      .catch(() => false);

    if (!outputExists) {
      logger.warn("Hashcat output file not found", "hashcat", {
        jobId,
        outputFile,
      });
      return [];
    }

    const outputContent = await fs.readFile(outputFile, "utf-8");
    const lines = outputContent
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    logger.debug("Hashcat output file content", "hashcat", {
      jobId,
      totalLines: lines.length,
      contentPreview: outputContent.substring(0, 200),
    });

    const crackedPasswords = [];

    for (const line of lines) {
      // Parse hashcat output format
      // Format for WPA: WPA*01*AP_MAC*CLIENT_MAC*CLIENT_NONCE*SERVER_NONCE*EAPOL*MIC:password
      // Format for PMKID: BSSID*CLIENT_MAC*PMKID:password
      const parts = line.split(":");
      if (parts.length >= 2) {
        const hash = parts[0];
        const plaintext = parts.slice(1).join(":");

        // Validate that we have both hash and plaintext
        if (hash && plaintext) {
          crackedPasswords.push({
            password: hash,
            plaintext: plaintext,
            processingTime: result.processingTime,
          });

          logger.debug("Parsed cracked password", "hashcat", {
            jobId,
            hashType: hash.includes("WPA*") ? "handshake" : "pmkid",
            passwordLength: plaintext.length,
          });
        }
      }
    }

    logger.info("Hashcat output parsing completed", "hashcat", {
      jobId,
      passwordsFound: crackedPasswords.length,
    });

    return crackedPasswords;
  } catch (error) {
    logger.error("Error parsing hashcat output", "hashcat", {
      jobId,
      outputFile,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

function getHashType(attackMode: "pmkid" | "handshake"): string {
  return attackMode === "pmkid" ? "WPA-PMKID-PBKDF2" : "WPA-PBKDF2-PMKID+EAPOL";
}

// Cleanup temporary files with improved logging
export async function cleanupHashcatTemp(jobId: string) {
  const workDir = path.join(process.cwd(), "temp", "hashcat", jobId);

  logger.info("Cleaning up hashcat temporary files", "hashcat", {
    jobId,
    workDir,
  });

  try {
    await fs.rm(workDir, { recursive: true, force: true });
    logger.info("Hashcat temporary files cleaned up successfully", "hashcat", {
      jobId,
      workDir,
    });
  } catch (error) {
    logger.error("Error cleaning up hashcat temp files", "hashcat", {
      jobId,
      workDir,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Check hashcat availability with detailed information
export async function checkHashcatAvailability() {
  logger.info("Checking hashcat availability", "hashcat");

  try {
    const { stdout, stderr } = await execAsync("hashcat --version");
    const version = stdout.trim();

    // Also check for supported hash modes
    const { stdout: modesOutput } = await execAsync(
      'hashcat --help | grep -E "(16800|22000)" || true',
    );
    const supportedModes =
      modesOutput.includes("16800") && modesOutput.includes("22000");

    logger.info("Hashcat availability check completed", "hashcat", {
      available: true,
      version,
      supportedModes,
    });

    return {
      available: true,
      version,
      supportedModes,
      supportedAttackModes: {
        pmkid: modesOutput.includes("16800"),
        handshake: modesOutput.includes("22000"),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "hashcat: command not found";

    logger.error("Hashcat availability check failed", "hashcat", {
      available: false,
      error: errorMessage,
    });

    return {
      available: false,
      error: errorMessage,
      supportedModes: false,
      supportedAttackModes: {
        pmkid: false,
        handshake: false,
      },
    };
  }
}

/**
 * Ensure attack file exists and is properly extracted
 */
async function ensureAttackFileExists(
  handshakePath: string,
  attackMode: "pmkid" | "handshake",
  bssid: string,
): Promise<string> {
  logger.info("Ensuring attack file exists", "hashcat", {
    handshakePath,
    attackMode,
    bssid,
  });

  try {
    // Check if the file already exists
    await fs.access(handshakePath);
    logger.info("Attack file already exists", "hashcat", {
      handshakePath,
      attackMode,
    });
    return handshakePath;
  } catch (error) {
    logger.info(
      "Attack file does not exist, attempting extraction",
      "hashcat",
      {
        handshakePath,
        attackMode,
        bssid,
      },
    );

    // File doesn't exist, try to extract it from the original PCAP
    const pcapPath = handshakePath.replace(
      /\/(handshakes|pmkids)\/.*$/,
      "/original.pcap",
    );

    try {
      let extractedPath: string;

      if (attackMode === "pmkid") {
        extractedPath = await extractPMKID(pcapPath, bssid);
      } else {
        extractedPath = await extractHandshake(pcapPath, bssid);
      }

      logger.info("Attack file extracted successfully", "hashcat", {
        pcapPath,
        extractedPath,
        attackMode,
        bssid,
      });

      return extractedPath;
    } catch (extractError) {
      logger.error("Failed to extract attack file", "hashcat", {
        pcapPath,
        attackMode,
        bssid,
        error:
          extractError instanceof Error
            ? extractError.message
            : "Unknown error",
      });
      throw new Error(
        `Attack file not found and extraction failed: ${extractError instanceof Error ? extractError.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Update job progress in database and broadcast via WebSocket
 */
async function updateJobProgress(
  jobId: string,
  progress: number,
  metadata?: any,
): Promise<void> {
  try {
    const updateData: any = {
      progress: Math.max(0, Math.min(100, progress)),
      updatedAt: new Date(),
    };

    // Only update startTime if it's not already set
    if (progress > 0) {
      updateData.startTime = new Date();
    }

    await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));

    logger.debug("Job progress updated", "hashcat", {
      jobId,
      progress,
    });

    // Broadcast progress update via WebSocket
    try {
      const wsServer = getWebSocketServer();

      // Get current job data for the broadcast
      const currentJob = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
        columns: {
          id: true,
          status: true,
          progress: true,
          startTime: true,
          endTime: true,
          errorMessage: true,
          userId: true,
        },
      });

      if (currentJob) {
        wsServer.broadcastJobUpdate({
          id: currentJob.id,
          status: currentJob.status,
          progress: currentJob.progress,
          startTime: currentJob.startTime?.toISOString(),
          endTime: currentJob.endTime?.toISOString(),
          errorMessage: currentJob.errorMessage || undefined,
          metadata: {
            ...metadata,
            userId: currentJob.userId,
          },
        });
      }
    } catch (wsError) {
      logger.warn("Failed to broadcast progress update", "hashcat", {
        jobId,
        progress,
        error: wsError instanceof Error ? wsError.message : "Unknown error",
      });
    }
  } catch (error) {
    logger.error("Failed to update job progress", "hashcat", {
      jobId,
      progress,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Security audit for Hashcat operations
 */
export async function performHashcatSecurityAudit(jobId: string): Promise<{
  passed: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  logger.info("Starting Hashcat security audit", "hashcat", { jobId });

  try {
    // Check if jobId is a valid UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      issues.push("Invalid jobId format - must be UUID");
    }

    // Check work directory permissions
    const workDir = path.join(process.cwd(), "temp", "hashcat", jobId);
    try {
      await fs.access(workDir, fs.constants.W_OK);
    } catch (error) {
      issues.push("Cannot access work directory");
    }

    // Check if hashcat is available and not running as root
    const hashcatCheck = await checkHashcatAvailability();
    if (!hashcatCheck.available) {
      issues.push("Hashcat is not available");
    }

    // Security recommendations
    if (process.getuid && process.getuid() === 0) {
      recommendations.push("Consider running as non-root user");
    }

    if (process.env.NODE_ENV !== "production") {
      recommendations.push("Enable production mode for enhanced security");
    }

    // Check file permissions in temp directory
    try {
      const tempDir = path.join(process.cwd(), "temp");
      const stats = await fs.stat(tempDir);
      // Check if directory has appropriate permissions (not world-writable)
      if ((stats.mode & 0o002) !== 0) {
        issues.push("Temp directory is world-writable");
        recommendations.push(
          "Remove world-write permissions from temp directory",
        );
      }
    } catch (error) {
      issues.push("Cannot check temp directory permissions");
    }

    logger.info("Hashcat security audit completed", "hashcat", {
      jobId,
      issuesFound: issues.length,
      recommendations: recommendations.length,
    });

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  } catch (error) {
    logger.error("Hashcat security audit failed", "hashcat", {
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      passed: false,
      issues: ["Security audit failed to complete"],
      recommendations: ["Review system configuration and try again"],
    };
  }
}
