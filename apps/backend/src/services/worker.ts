import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { db, jobs, jobItems, jobDictionaries, dictionaries, results } from '../db';
import { eq, and, desc, inArray } from 'drizzle-orm';
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
  private currentProcess: ChildProcess | null = null;
  private shouldStop = false;

  async start() {
    console.log('🔧 AutoPWN Worker Service starting...');

    // Ensure directories exist
    this.ensureDirectories();

    // Clean up orphaned jobs
    await this.cleanupOrphanedJobs();

    // Start processing loop
    this.processLoop();
  }

  /**
   * Clean up jobs that were left in 'processing' state from previous server crashes
   */
  private async cleanupOrphanedJobs() {
    try {
      const orphanedJobs = await db.select()
        .from(jobs)
        .where(eq(jobs.status, 'processing'));

      if (orphanedJobs.length > 0) {
        console.log(`🧹 Cleaning up ${orphanedJobs.length} orphaned job(s)...`);

        for (const job of orphanedJobs) {
          await db.update(jobs)
            .set({
              status: 'pending',
              startedAt: null,
            })
            .where(eq(jobs.id, job.id));
        }
      }
    } catch (error) {
      console.error('Failed to clean up orphaned jobs:', error);
    }
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

  /**
   * Check if the current job should continue running
   * Returns the current job status from database
   */
  private async checkJobStatus(jobId: number): Promise<string | null> {
    try {
      const jobStatus = await db.select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      return jobStatus[0]?.status || null;
    } catch (error) {
      console.error('Failed to check job status:', error);
      return null;
    }
  }

  /**
   * Check if a job has exceeded its timeout
   * Returns true if the job should be killed due to timeout
   */
  private hasJobTimedOut(startTime: number): boolean {
    const timeoutMs = env.JOB_TIMEOUT_HOURS * 60 * 60 * 1000;
    const elapsed = Date.now() - startTime;
    return elapsed > timeoutMs;
  }

  /**
   * Kill the current running process (hashcat or hcxpcapngtool)
   */
  private killCurrentProcess() {
    if (this.currentProcess) {
      console.log(`🔪 Killing current process (PID: ${this.currentProcess.pid})...`);
      try {
        this.currentProcess.kill('SIGTERM');
        // Give it a second, then force kill if still running
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            this.currentProcess.kill('SIGKILL');
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to kill process:', error);
      }
    }
  }

  private async processJob(job: any) {
    console.log(`🚀 Processing job: ${job.id} (${job.filename})`);
    this.isRunning = true;
    this.currentJob = job;
    this.shouldStop = false;

    const jobStartTime = Date.now();
    const timeoutMs = env.JOB_TIMEOUT_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds

    try {
      // Update job status to processing
      await this.updateJobStatus(job.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      // Process the job based on type
      if (job.filename.includes('.pcap') || job.filename.includes('.cap')) {
        await this.processPcapJob(job, jobStartTime);
      } else {
        throw new Error(`Unknown job type for file: ${job.filename}`);
      }

      // Check if job was stopped/paused during processing
      const finalStatus = await this.checkJobStatus(job.id);
      if (finalStatus === 'stopped' || finalStatus === 'paused') {
        console.log(`⏸️  Job ${job.id} ${finalStatus} by user`);
        return;
      }

      // Mark job as completed only if it wasn't stopped/paused
      await this.updateJobStatus(job.id, {
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
      });

      console.log(`✅ Job completed: ${job.id}`);
    } catch (error) {
      // Check if error was due to job being stopped/paused
      const currentStatus = await this.checkJobStatus(job.id);
      if (currentStatus === 'stopped' || currentStatus === 'paused') {
        console.log(`⏸️  Job ${job.id} ${currentStatus} during processing`);
        return;
      }

      console.error(`❌ Job failed: ${job.id}`, error);
      await this.updateJobStatus(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    } finally {
      this.isRunning = false;
      this.currentJob = null;
      this.currentProcess = null;
      this.shouldStop = false;
    }
  }

  private async processPcapJob(job: any, jobStartTime: number) {
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
    await this.runHashcat(job, jobDicts, jobStartTime);
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

  private async runHashcat(job: any, jobDicts: any[], jobStartTime: number) {
    const hashFile = join(env.JOBS_PATH, `job-${job.id}.hc22000`);

    for (const jobDict of jobDicts) {
      // Check if job was paused/stopped before processing this dictionary
      const jobStatus = await this.checkJobStatus(job.id);
      if (jobStatus === 'paused' || jobStatus === 'stopped') {
        console.log(`⏸️  Job ${job.id} ${jobStatus}, stopping hashcat loop`);
        this.killCurrentProcess();
        return;
      }

      // Check if job has already exceeded timeout
      if (this.hasJobTimedOut(jobStartTime)) {
        const timeoutHours = env.JOB_TIMEOUT_HOURS;
        throw new Error(`Job exceeded maximum runtime of ${timeoutHours} hours`);
      }

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

        // Run hashcat with status checking and timeout monitoring
        const { stdout, stderr } = await this.execAsyncWithStatusCheck(
          hashcatCmd.join(' '),
          job.id,
          jobStartTime,
          {
            timeout: 3600000, // 1 hour timeout per dictionary
          }
        );

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
        // Check if error was due to job being stopped/paused
        const currentStatus = await this.checkJobStatus(job.id);
        if (currentStatus === 'stopped' || currentStatus === 'paused') {
          console.log(`⏸️  Job ${job.id} ${currentStatus} during hashcat`);
          return;
        }

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

  /**
   * Execute command with periodic job status checking and timeout monitoring
   * Kills the process if job is paused/stopped or exceeds timeout
   */
  private execAsyncWithStatusCheck(
    command: string,
    jobId: number,
    jobStartTime: number,
    options: any = {}
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        ...options
      });

      this.currentProcess = child;
      let stdout = '';
      let stderr = '';
      let statusCheckInterval: NodeJS.Timeout | null = null;

      // Periodically check job status and timeout every 2 seconds
      statusCheckInterval = setInterval(async () => {
        // Check if job was paused or stopped
        const status = await this.checkJobStatus(jobId);
        if (status === 'paused' || status === 'stopped') {
          console.log(`⏸️  Job ${jobId} ${status}, killing process...`);
          this.killCurrentProcess();
          if (statusCheckInterval) clearInterval(statusCheckInterval);
          reject(new Error(`Job ${status} by user`));
          return;
        }

        // Check if job has exceeded timeout
        if (this.hasJobTimedOut(jobStartTime)) {
          const timeoutHours = env.JOB_TIMEOUT_HOURS;
          console.log(`⏱️  Job ${jobId} exceeded ${timeoutHours} hour timeout, killing process...`);
          this.killCurrentProcess();
          if (statusCheckInterval) clearInterval(statusCheckInterval);
          reject(new Error(`Job exceeded maximum runtime of ${timeoutHours} hours`));
          return;
        }
      }, 2000);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        this.currentProcess = null;

        if (code === 0 || code === null) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        this.currentProcess = null;
        reject(error);
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          if (statusCheckInterval) clearInterval(statusCheckInterval);
          child.kill();
          reject(new Error('Command timeout'));
        }, options.timeout);
      }
    });
  }

  private execAsync(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        ...options
      });

      this.currentProcess = child;
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        this.currentProcess = null;
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        this.currentProcess = null;
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