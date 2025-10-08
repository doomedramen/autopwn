import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { db, jobs, jobItems, jobDictionaries, dictionaries, results } from '@autopwn/shared';
import { eq, and, desc } from 'drizzle-orm';
import { env } from '../config/env';
import { webSocketService } from './websocket';

interface JobStatus {
  id: number;
  status: string;
  progress?: number;
  speed?: string;
  eta?: string;
  error?: string;
  logs?: string;
}

export class WorkerService {
  private isRunning = false;
  private currentJob: any = null;

  async start() {
    console.log('🔧 AutoPWN Worker Service starting...');

    // Ensure directories exist
    this.ensureDirectories();

    // Start processing loop
    this.processLoop();
  }

  private ensureDirectories() {
    const dirs = [env.PCAPS_PATH, env.DICTIONARIES_PATH, env.JOBS_PATH];
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  private async processLoop() {
    while (true) {
      try {
        if (!this.isRunning) {
          const nextJob = await this.getNextJob();
          if (nextJob) {
            await this.processJob(nextJob);
          }
        }

        // Wait before checking for next job
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error('Worker loop error:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  private async getNextJob() {
    const nextJob = await db.select()
      .from(jobs)
      .where(eq(jobs.status, 'pending'))
      .orderBy(desc(jobs.priority), jobs.createdAt)
      .limit(1);

    return nextJob[0] || null;
  }

  private async processJob(job: any) {
    console.log(`🚀 Processing job: ${job.id} (${job.filename})`);
    this.isRunning = true;
    this.currentJob = job;

    try {
      // Update job status to processing
      await this.updateJobStatus(job.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      // Process the job based on type
      if (job.filename.includes('.pcap') || job.filename.includes('.cap')) {
        await this.processPcapJob(job);
      } else {
        throw new Error(`Unknown job type for file: ${job.filename}`);
      }

      // Mark job as completed
      await this.updateJobStatus(job.id, {
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
      });

      console.log(`✅ Job completed: ${job.id}`);
    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error);
      await this.updateJobStatus(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    } finally {
      this.isRunning = false;
      this.currentJob = null;
    }
  }

  private async processPcapJob(job: any) {
    // Get job items (ESSIDs to crack)
    const jobItemsData = await db.select()
      .from(jobItems)
      .where(eq(jobItems.jobId, job.id));

    if (jobItemsData.length === 0) {
      // Extract ESSIDs from PCAP first
      await this.extractEssidsFromPcap(job);
      // Reload job items
      const updatedItems = await db.select()
        .from(jobItems)
        .where(eq(jobItems.jobId, job.id));

      if (updatedItems.length === 0) {
        throw new Error('No ESSIDs found in PCAP file');
      }
    }

    // Get dictionaries for this job
    const jobDicts = await db.select()
      .from(jobDictionaries)
      .where(eq(jobDictionaries.jobId, job.id));

    if (jobDicts.length === 0) {
      throw new Error('No dictionaries assigned to job');
    }

    // Process with hashcat
    await this.runHashcat(job, jobDicts);
  }

  private async extractEssidsFromPcap(job: any) {
    const pcapPath = join(env.PCAPS_PATH, `user-${job.userId}`, job.filename);
    const hashFile = join(env.JOBS_PATH, `job-${job.id}.hc22000`);
    const essidFile = join(env.JOBS_PATH, `job-${job.id}.essids`);

    try {
      // Extract hashes and ESSIDs using hcxpcapngtool
      const { stdout, stderr } = await this.execAsync(
        `hcxpcapngtool -o "${hashFile}" -E "${essidFile}" "${pcapPath}"`,
        { timeout: 60000 }
      );

      console.log(`hcxpcapngtool output:`, stdout);
      if (stderr) {
        console.log(`hcxpcapngtool stderr:`, stderr);
      }

      // Parse ESSID file and create job items
      if (existsSync(essidFile)) {
        const essidData = readFileSync(essidFile, 'utf8');
        const lines = essidData.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            const match = line.match(/^([a-f0-9:]+)\s+(.+)$/);
            if (match) {
              const bssid = match[1];
              const essid = match[2].trim();

              await db.insert(jobItems).values({
                jobId: job.id,
                userId: job.userId,
                filename: job.filename,
                essid,
                bssid,
                status: 'pending',
              });
            }
          }
        }
      }

      // Clean up ESSID file (keep hash file for hashcat)
      try {
        unlinkSync(essidFile);
      } catch (error) {
        // Ignore cleanup errors
      }

    } catch (error) {
      throw new Error(`Failed to extract ESSIDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runHashcat(job: any, jobDicts: any[]) {
    const hashFile = join(env.JOBS_PATH, `job-${job.id}.hc22000`);

    for (const jobDict of jobDicts) {
      try {
        const dictionary = await db.select()
          .from(dictionaries)
          .where(eq(dictionaries.id, jobDict.dictionaryId))
          .limit(1);

        if (dictionary.length === 0) {
          console.warn(`Dictionary ${jobDict.dictionaryId} not found, skipping`);
          continue;
        }

        const dictPath = join(env.DICTIONARIES_PATH, `user-${job.userId}`, dictionary[0].name);
        const potFile = join(env.JOBS_PATH, `job-${job.id}.potfile`);

        console.log(`🔑 Running hashcat with dictionary: ${dictionary[0].name}`);

        // Hashcat command
        const hashcatCmd = [
          'hashcat',
          '-m', '22000', // WPA-PBKDF2 PMKID mode
          '-a', '0',    // Straight attack mode
          '-o', potFile, // Output file
          hashFile,     // Hash file
          dictPath,     // Dictionary file
          '--force'
        ];

        // Run hashcat
        const { stdout, stderr } = await this.execAsync(hashcatCmd.join(' '), {
          timeout: 3600000, // 1 hour timeout
        });

        console.log(`Hashcat output:`, stdout);
        if (stderr) {
          console.log(`Hashcat stderr:`, stderr);
        }

        // Process results if potfile was created
        if (existsSync(potFile)) {
          await this.processHashcatResults(job.id, potFile, job.userId);
        }

        // Update job dictionary status
        await db.update(jobDictionaries)
          .set({ status: 'completed' })
          .where(and(
            eq(jobDictionaries.jobId, job.id),
            eq(jobDictionaries.dictionaryId, jobDict.dictionaryId)
          ));

      } catch (error) {
        console.error(`Hashcat failed for dictionary ${jobDict.dictionaryId}:`, error);

        // Mark dictionary as failed
        await db.update(jobDictionaries)
          .set({ status: 'failed' })
          .where(and(
            eq(jobDictionaries.jobId, job.id),
            eq(jobDictionaries.dictionaryId, jobDict.dictionaryId)
          ));
      }
    }
  }

  private async processHashcatResults(jobId: number, potFile: string, userId: number) {
    try {
      const potData = readFileSync(potFile, 'utf8');
      const lines = potData.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          // Parse hashcat potfile format: *essid*password
          const match = line.match(/^\*([^*]+)\*([^*]+)$/);
          if (match) {
            const essid = match[1];
            const password = match[2];

            // Store result
            const newResult = await db.insert(results).values({
              jobId: jobId,
              userId: userId.toString(),
              essid,
              password,
            }).onConflictDoNothing().returning();

            // Update job item status
            await db.update(jobItems)
              .set({
                status: 'completed',
                password,
                crackedAt: new Date()
              })
              .where(and(
                eq(jobItems.jobId, jobId),
                eq(jobItems.essid, essid)
              ));

            console.log(`💯 Cracked: ${essid} -> ${password}`);

            // Broadcast WebSocket updates
            if (newResult.length > 0) {
              webSocketService.broadcastResultUpdate({
                type: 'new_result',
                data: {
                  jobId,
                  essid,
                  password,
                  crackedAt: new Date()
                }
              });

              webSocketService.broadcastJobUpdate(jobId, {
                type: 'item_cracked',
                data: {
                  essid,
                  password,
                  crackedAt: new Date()
                }
              });
            }
          }
        }
      }

      // Clean up potfile
      try {
        unlinkSync(potFile);
      } catch (error) {
        // Ignore cleanup errors
      }

    } catch (error) {
      console.error('Failed to process hashcat results:', error);
    }
  }

  private async updateJobStatus(jobId: number, updates: any) {
    await db.update(jobs)
      .set(updates)
      .where(eq(jobs.id, jobId));
  }

  private execAsync(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error('Command timeout'));
        }, options.timeout);
      }
    });
  }

  // Public methods for external control
  getCurrentJob() {
    return this.currentJob;
  }

  isProcessing() {
    return this.isRunning;
  }
}

export const workerService = new WorkerService();