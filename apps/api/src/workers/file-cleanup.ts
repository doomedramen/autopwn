import { promises as fs } from "fs";
import path from "path";
import { env } from "../config/env";
import { db } from "../db/index";
import { networks, dictionaries, jobs, captures } from "../db/schema";
import { eq, lt, and } from "drizzle-orm";
import { logger } from "../lib/logger";

interface CleanupFilesOptions {
  filePaths: string[];
  olderThan?: Date;
  userId?: string;
}

export async function cleanupFiles({
  filePaths,
  olderThan,
  userId,
}: CleanupFilesOptions) {
  try {
    logger.info("Starting file cleanup", "file-cleanup", {
      initialFileCount: filePaths.length,
      olderThan: olderThan?.toISOString(),
      userId,
    });

    let filesToDelete = [...filePaths];

    // If olderThan is specified, find old files
    if (olderThan) {
      const oldFiles = await findOldFiles(olderThan, userId);
      filesToDelete = [...filesToDelete, ...oldFiles];
      logger.info("Found old files for cleanup", "file-cleanup", {
        oldFilesFound: oldFiles.length,
        cutoffDate: olderThan.toISOString(),
      });
    }

    // Remove duplicates and filter out empty paths
    const uniqueFiles = [...new Set(filesToDelete)].filter(Boolean);

    if (uniqueFiles.length === 0) {
      logger.info("No files to clean up", "file-cleanup");
      return {
        success: true,
        deletedFiles: 0,
        failedFiles: 0,
        files: [],
        errors: [],
      };
    }

    logger.info("Starting file deletion", "file-cleanup", {
      uniqueFilesToDelete: uniqueFiles.length,
    });

    // Performance optimization: Batch file deletion with controlled concurrency
    const deletedFiles: string[] = [];
    const failedFiles: Array<{ path: string; error: string }> = [];

    // Process files in batches to avoid overwhelming the filesystem
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < uniqueFiles.length; i += batchSize) {
      batches.push(uniqueFiles.slice(i, i + batchSize));
    }

    logger.debug("Processing files in batches", "file-cleanup", {
      totalFiles: uniqueFiles.length,
      batchSize,
      batchCount: batches.length,
    });

    for (const [batchIndex, batch] of batches.entries()) {
      logger.debug("Processing batch", "file-cleanup", {
        batchIndex: batchIndex + 1,
        batchSize: batch.length,
      });

      // Performance optimization: Process batch files in parallel with limited concurrency
      const deletionPromises = batch.map(async (filePath) => {
        try {
          // Check if file exists before attempting deletion
          await fs.access(filePath);

          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            await fs.unlink(filePath);
            logger.debug("File deleted successfully", "file-cleanup", {
              filePath,
              fileSize: stats.size,
            });
            return { success: true, filePath, fileSize: stats.size };
          } else {
            logger.debug("Skipping non-file path", "file-cleanup", {
              filePath,
            });
            return { success: false, filePath, error: "Not a file" };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.debug("Failed to delete file", "file-cleanup", {
            filePath,
            error: errorMessage,
          });
          return { success: false, filePath, error: errorMessage };
        }
      });

      const batchResults = await Promise.allSettled(deletionPromises);

      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          const { success, filePath, fileSize, error } = result.value;
          if (success) {
            deletedFiles.push(filePath);
          } else {
            failedFiles.push({
              path: filePath,
              error: error || "Unknown deletion error",
            });
          }
        } else {
          // Promise rejected - this shouldn't happen with our structure, but handle it gracefully
          failedFiles.push({
            path: "unknown",
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Batch processing error",
          });
        }
      });

      // Performance optimization: Small delay between batches to reduce filesystem stress
      if (batchIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
      }
    }

    // Clean up empty directories
    await cleanupEmptyDirectories();

    // Update database records for deleted files
    await updateDatabaseForDeletedFiles(deletedFiles);

    logger.info("File cleanup completed", "file-cleanup", {
      deletedFiles: deletedFiles.length,
      failedFiles: failedFiles.length,
      totalAttempted: uniqueFiles.length,
    });

    return {
      success: true,
      deletedFiles: deletedFiles.length,
      failedFiles: failedFiles.length,
      files: deletedFiles,
      errors: failedFiles,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("File cleanup operation failed", "file-cleanup", {
      error: errorMessage,
      filePaths,
      userId,
    });
    throw new Error(`File cleanup failed: ${errorMessage}`);
  }
}

async function findOldFiles(
  olderThan: Date,
  userId?: string,
): Promise<string[]> {
  const oldFiles: string[] = [];

  logger.info("Finding old files for cleanup", "file-cleanup", {
    olderThan: olderThan.toISOString(),
    userId,
  });

  const startTime = Date.now();

  // Performance optimization: Run database queries in parallel
  const [oldNetworks, oldDictionaries] = await Promise.all([
    // Find old completed networks for potential cleanup
    db
      .select({
        id: networks.id,
        notes: networks.notes,
        updatedAt: networks.updatedAt,
      })
      .from(networks)
      .where(
        and(
          lt(networks.updatedAt, olderThan),
          userId ? eq(networks.userId, userId) : undefined,
          eq(networks.status, "ready"), // Only clean up completed networks
        ),
      ),
    // Find old dictionaries with files
    db
      .select({
        filePath: dictionaries.filePath,
        id: dictionaries.id,
        updatedAt: dictionaries.updatedAt,
      })
      .from(dictionaries)
      .where(
        and(
          lt(dictionaries.updatedAt, olderThan),
          userId ? eq(dictionaries.userId, userId) : undefined,
          eq(dictionaries.status, "ready"), // Only clean up ready dictionaries
        ),
      ),
  ]);

  logger.debug("Found old records in database", "file-cleanup", {
    networkCount: oldNetworks.length,
    dictionaryCount: oldDictionaries.length,
  });

  const dictionaryFiles = oldDictionaries
    .map((d) => d.filePath)
    .filter(Boolean);
  oldFiles.push(...dictionaryFiles);

  // Performance optimization: Parallel directory scanning
  const tempDirs = [
    path.join(process.cwd(), env.UPLOAD_DIR, "pcap"),
    path.join(process.cwd(), env.UPLOAD_DIR, "dictionaries"),
    path.join(process.cwd(), "temp", "hashcat"),
    path.join(process.cwd(), "temp", "dict-generation"),
    path.join(process.cwd(), "uploads"),
  ];

  // Performance optimization: Scan directories in parallel with limited concurrency
  const directoryScanPromises = tempDirs.map(async (dir) => {
    try {
      const files = await fs.readdir(dir, { recursive: true });
      const tempFiles: string[] = [];

      // Performance optimization: Batch file stat checks
      const statPromises = files.map(async (file) => {
        const filePath = path.join(dir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile() && stats.mtime < olderThan) {
            return filePath;
          }
        } catch (error) {
          // Skip files that can't be accessed
          logger.debug("Skipping inaccessible file", "file-cleanup", {
            filePath,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        return null;
      });

      const results = await Promise.allSettled(statPromises);
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          tempFiles.push(result.value);
        }
      });

      logger.debug("Scanned temp directory", "file-cleanup", {
        directory: dir,
        totalFiles: files.length,
        oldFilesFound: tempFiles.length,
      });

      return tempFiles;
    } catch (error) {
      // Directory doesn't exist or can't be accessed
      logger.debug("Skipping inaccessible directory", "file-cleanup", {
        directory: dir,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  });

  const directoryResults = await Promise.allSettled(directoryScanPromises);
  directoryResults.forEach((result) => {
    if (result.status === "fulfilled") {
      oldFiles.push(...result.value);
    }
  });

  const processingTime = Date.now() - startTime;

  logger.debug("Completed file discovery", "file-cleanup", {
    tempFilesFound: oldFiles.length - dictionaryFiles.length,
    dictionaryFilesFound: dictionaryFiles.length,
    totalOldFiles: oldFiles.length,
    processingTime,
  });

  return oldFiles.filter(Boolean);
}

async function cleanupEmptyDirectories() {
  const dirsToClean = [
    path.join(process.cwd(), env.UPLOAD_DIR, "pcap"),
    path.join(process.cwd(), env.UPLOAD_DIR, "dictionaries"),
    path.join(process.cwd(), "temp", "hashcat"),
    path.join(process.cwd(), "temp", "dict-generation"),
    path.join(process.cwd(), "uploads"),
  ];

  logger.info("Starting empty directory cleanup", "file-cleanup", {
    directories: dirsToClean,
  });

  let cleanedDirs = 0;
  for (const dir of dirsToClean) {
    try {
      const wasCleaned = await cleanEmptyDirectory(dir);
      if (wasCleaned) {
        cleanedDirs++;
      }
    } catch (error) {
      logger.error("Error cleaning directory", "file-cleanup", {
        directory: dir,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  logger.info("Empty directory cleanup completed", "file-cleanup", {
    directoriesAttempted: dirsToClean.length,
    directoriesCleaned: cleanedDirs,
  });
}

async function cleanEmptyDirectory(dir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(dir);
    logger.debug("Cleaning directory", "file-cleanup", {
      directory: dir,
      fileCount: files.length,
    });

    if (files.length === 0) {
      // Directory is empty, try to remove it
      await fs.rmdir(dir);
      logger.debug("Removed empty directory", "file-cleanup", {
        directory: dir,
      });
      return true;
    }

    let subdirsCleaned = 0;
    // Recursively clean subdirectories
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        const wasCleaned = await cleanEmptyDirectory(filePath);
        if (wasCleaned) {
          subdirsCleaned++;
        }
      }
    }

    // Check if directory is now empty after cleaning subdirectories
    const remainingFiles = await fs.readdir(dir);
    if (remainingFiles.length === 0) {
      await fs.rmdir(dir);
      logger.debug(
        "Removed directory after cleaning subdirectories",
        "file-cleanup",
        {
          directory: dir,
          subdirsCleaned,
        },
      );
      return true;
    }

    logger.debug("Directory cleanup completed", "file-cleanup", {
      directory: dir,
      remainingFiles: remainingFiles.length,
      subdirsCleaned,
    });

    return subdirsCleaned > 0;
  } catch (error) {
    // Directory might not exist or can't be accessed
    logger.debug("Could not clean directory", "file-cleanup", {
      directory: dir,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

async function updateDatabaseForDeletedFiles(deletedFiles: string[]) {
  logger.info("Updating database records for deleted files", "file-cleanup", {
    fileCount: deletedFiles.length,
  });

  let updatedRecords = 0;
  let failedUpdates = 0;

  for (const filePath of deletedFiles) {
    try {
      // Update dictionaries that had this file
      const updateResult = await db
        .update(dictionaries)
        .set({
          filePath: null,
          status: "failed",
          notes: `File was cleaned up: ${filePath}`,
          updatedAt: new Date(),
        })
        .where(eq(dictionaries.filePath, filePath))
        .returning({ id: dictionaries.id });

      if (updateResult.length > 0) {
        updatedRecords += updateResult.length;
        logger.debug(
          "Updated dictionary records for deleted file",
          "file-cleanup",
          {
            filePath,
            updatedCount: updateResult.length,
            dictionaryIds: updateResult.map((d) => d.id),
          },
        );
      }

      // Update captures that had this PCAP file
      const captureUpdateResult = await db
        .update(captures)
        .set({
          filePath: null,
          status: "failed",
          errorMessage: `PCAP file was cleaned up: ${filePath}`,
          updatedAt: new Date(),
        })
        .where(eq(captures.filePath, filePath))
        .returning({ id: captures.id, userId: captures.userId });

      if (captureUpdateResult.length > 0) {
        updatedRecords += captureUpdateResult.length;
        logger.debug(
          "Updated capture records for deleted file",
          "file-cleanup",
          {
            filePath,
            updatedCount: captureUpdateResult.length,
            captureIds: captureUpdateResult.map((c) => c.id),
          },
        );
      }
    } catch (error) {
      failedUpdates++;
      logger.error("Error updating database for deleted file", "file-cleanup", {
        filePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  logger.info("Database update completed for deleted files", "file-cleanup", {
    totalFiles: deletedFiles.length,
    updatedRecords,
    failedUpdates,
  });
}

// Cleanup strategy functions with improved logging and error handling
export const cleanupStrategies = {
  // Clean up deleted captures and their files
  async cleanupDeletedCaptures(userId?: string) {
    try {
      logger.info(
        "Starting deleted captures cleanup strategy",
        "file-cleanup",
        { userId },
      );

      // Find deleted captures that still have filePath (meaning files not cleaned up yet)
      const deletedCaptures = await db
        .select({
          id: captures.id,
          filePath: captures.filePath,
          userId: captures.userId,
        })
        .from(captures)
        .where(
          and(
            userId ? eq(captures.userId, userId) : undefined,
            eq(captures.status, "failed"), // Assume failed captures marked for deletion
          ),
        );

      logger.debug("Found deleted captures for cleanup", "file-cleanup", {
        userId,
        captureCount: deletedCaptures.length,
      });

      const filePathsToDelete = deletedCaptures
        .map((c) => c.filePath)
        .filter(Boolean) as string[];

      if (filePathsToDelete.length === 0) {
        logger.info("No capture files to delete", "file-cleanup", { userId });
        return {
          success: true,
          deletedFiles: 0,
          failedFiles: 0,
        };
      }

      const result = await cleanupFiles({
        filePaths: filePathsToDelete,
        userId,
      });

      logger.info("Deleted captures cleanup completed", "file-cleanup", {
        userId,
        capturesProcessed: deletedCaptures.length,
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles,
      });

      return result;
    } catch (error) {
      logger.error("Deleted captures cleanup strategy failed", "file-cleanup", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },

  // Clean up files older than 30 days
  async cleanupOldFiles(userId?: string) {
    try {
      logger.info("Starting old files cleanup strategy", "file-cleanup", {
        userId,
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await cleanupFiles({
        filePaths: [],
        olderThan: thirtyDaysAgo,
        userId,
      });

      logger.info("Old files cleanup completed", "file-cleanup", {
        userId,
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles,
      });

      return result;
    } catch (error) {
      logger.error("Old files cleanup strategy failed", "file-cleanup", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },

  // Clean up failed job files
  async cleanupFailedJobs(userId?: string) {
    try {
      logger.info("Starting failed jobs cleanup strategy", "file-cleanup", {
        userId,
      });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const failedJobs = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "failed"),
            userId ? eq(jobs.userId, userId) : undefined,
            lt(jobs.updatedAt, sevenDaysAgo),
          ),
        );

      logger.debug("Found failed jobs for cleanup", "file-cleanup", {
        userId,
        failedJobCount: failedJobs.length,
        cutoffDate: sevenDaysAgo.toISOString(),
      });

      const tempDirs = failedJobs.map((job) =>
        path.join(process.cwd(), "temp", "hashcat", job.id),
      );

      const result = await cleanupFiles({
        filePaths: tempDirs,
        userId,
      });

      logger.info("Failed jobs cleanup completed", "file-cleanup", {
        userId,
        jobsProcessed: failedJobs.length,
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles,
      });

      return result;
    } catch (error) {
      logger.error("Failed jobs cleanup strategy failed", "file-cleanup", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },

  // Clean up completed jobs older than 7 days
  async cleanupCompletedJobs(userId?: string) {
    try {
      logger.info("Starting completed jobs cleanup strategy", "file-cleanup", {
        userId,
      });

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const completedJobs = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "completed"),
            userId ? eq(jobs.userId, userId) : undefined,
            lt(jobs.completedAt!, sevenDaysAgo),
          ),
        );

      logger.debug("Found completed jobs for cleanup", "file-cleanup", {
        userId,
        completedJobCount: completedJobs.length,
        cutoffDate: sevenDaysAgo.toISOString(),
      });

      const tempDirs = completedJobs.map((job) =>
        path.join(process.cwd(), "temp", "hashcat", job.id),
      );

      const result = await cleanupFiles({
        filePaths: tempDirs,
        userId,
      });

      logger.info("Completed jobs cleanup finished", "file-cleanup", {
        userId,
        jobsProcessed: completedJobs.length,
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles,
      });

      return result;
    } catch (error) {
      logger.error("Completed jobs cleanup strategy failed", "file-cleanup", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },

  // Clean up temporary files
  async cleanupTempFiles() {
    try {
      logger.info("Starting temporary files cleanup strategy", "file-cleanup");

      const tempDirs = [
        path.join(process.cwd(), "temp", "hashcat"),
        path.join(process.cwd(), "temp", "dict-generation"),
      ];

      const filesToDelete: string[] = [];
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const dir of tempDirs) {
        try {
          const files = await fs.readdir(dir, { recursive: true });
          logger.debug("Scanning temp directory for cleanup", "file-cleanup", {
            directory: dir,
            fileCount: files.length,
          });

          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            // Clean up temp files older than 24 hours
            if (stats.isFile() && stats.mtime < oneDayAgo) {
              filesToDelete.push(filePath);
            }
          }
        } catch (error) {
          logger.debug("Temp directory not accessible", "file-cleanup", {
            directory: dir,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.debug("Found temp files for cleanup", "file-cleanup", {
        totalFiles: filesToDelete.length,
        cutoffDate: oneDayAgo.toISOString(),
      });

      const result = await cleanupFiles({
        filePaths: filesToDelete,
      });

      logger.info("Temporary files cleanup completed", "file-cleanup", {
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles,
      });

      return result;
    } catch (error) {
      logger.error("Temporary files cleanup strategy failed", "file-cleanup", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
};
