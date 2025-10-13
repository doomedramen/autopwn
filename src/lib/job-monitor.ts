import { hashcat } from '@/tools/hashcat';
import { db } from '@/lib/db';
import { jobs, crackedPasswords, networks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface JobStatusUpdate {
  progress: number;
  cracked: number;
  speedCurrent: number;
  speedAverage: number;
  speedUnit: string;
  eta: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  completedAt?: Date;
  errorMessage?: string;
}

export class JobMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL_MS = 5000; // Check every 5 seconds
  private readonly SESSION_TIMEOUT_MS = 30000; // Consider session failed if no update for 30 seconds
  private activeSessions = new Map<string, Date>(); // sessionId -> last update time

  /**
   * Start the job monitoring service
   */
  start() {
    if (this.monitoringInterval) {
      console.log('Job monitor is already running');
      return;
    }

    console.log('Starting job monitor service...');
    this.monitoringInterval = setInterval(
      () => this.checkActiveJobs(),
      this.MONITOR_INTERVAL_MS
    );

    // Check immediately on start
    this.checkActiveJobs();
  }

  /**
   * Stop the job monitoring service
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Job monitor service stopped');
    }
  }

  /**
   * Check all active jobs and update their status
   */
  private async checkActiveJobs() {
    try {
      // Get all jobs that are currently processing and have a hashcat session
      const activeJobs = await db.query.jobs.findMany({
        where: eq(jobs.status, 'processing')
      });

      // Filter to only include jobs with a hashcat session
      const jobsWithSession = activeJobs.filter(job => job.hashcatSession != null);

      if (jobsWithSession.length === 0) {
        return;
      }

      console.log(`Checking ${jobsWithSession.length} active jobs with sessions...`);

      // Check each job's status
      for (const job of jobsWithSession) {
        await this.updateJobStatus(job.id, job.hashcatSession!);
      }

      // Clean up stale sessions
      this.cleanupStaleSessions();

    } catch (error) {
      console.error('Error checking active jobs:', error);
    }
  }

  /**
   * Update the status of a specific job
   */
  private async updateJobStatus(jobId: string, sessionName: string): Promise<void> {
    try {
      console.log(`Checking status for job ${jobId} (session: ${sessionName})`);

      // Get current status from hashcat
      const statusResult = await hashcat.getJobStatus(sessionName);

      if (!statusResult.success) {
        console.error(`Failed to get status for session ${sessionName}:`, statusResult.stderr);

        // If we can't get status, the session might have failed
        await this.handleJobFailure(jobId, 'Failed to get job status from hashcat');
        return;
      }

      const session = statusResult.data;
      if (!session) {
        console.error(`No session data returned for session ${sessionName}`);
        await this.handleJobFailure(jobId, 'No session data available');
        return;
      }

      // Update our tracking of this session
      this.activeSessions.set(sessionName, new Date());

      // Prepare update data
      const updateData: JobStatusUpdate = {
        progress: session.progress || 0,
        cracked: session.cracked || 0,
        speedCurrent: session.speed.current || 0,
        speedAverage: session.speed.average || 0,
        speedUnit: session.speed.unit || 'H/s',
        eta: session.eta || '',
        status: this.mapHashcatStatusToJobStatus(session.status)
      };

      // Check if job is completed or failed
      if (session.status === 'completed') {
        updateData.completedAt = new Date();
        console.log(`Job ${jobId} completed with ${session.cracked} passwords cracked`);
      } else if (session.status === 'failed' || session.status === 'stopped') {
        updateData.status = 'failed';
        updateData.completedAt = new Date();
        updateData.errorMessage = session.error || 'Hashcat session was aborted';
        console.log(`Job ${jobId} failed: ${updateData.errorMessage}`);
      }

      // Update the database
      await db.update(jobs)
        .set({
          progress: updateData.progress,
          cracked: updateData.cracked,
          speedCurrent: updateData.speedCurrent.toString(),
          speedAverage: updateData.speedAverage.toString(),
          speedUnit: updateData.speedUnit,
          eta: updateData.eta,
          status: updateData.status,
          completedAt: updateData.completedAt,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId));

      console.log(`Updated job ${jobId}: ${updateData.cracked}/${updateData.progress}% complete at ${updateData.speedCurrent} ${updateData.speedUnit}`);

      // Extract and save cracked passwords
      await this.saveCrackedPasswords(jobId, sessionName);

    } catch (error) {
      console.error(`Error updating job status for ${jobId}:`, error);
      await this.handleJobFailure(jobId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Extract and save cracked passwords from hashcat output
   */
  private async saveCrackedPasswords(jobId: string, sessionName: string): Promise<void> {
    try {
      // Get cracked passwords from hashcat buffer
      const crackedPasswordsData = hashcat.getCrackedPasswords(sessionName);

      if (crackedPasswordsData.length === 0) {
        return;
      }

      console.log(`Found ${crackedPasswordsData.length} cracked passwords for job ${jobId}`);

      // Process each cracked password
      for (const crackedPwd of crackedPasswordsData) {
        // Format BSSID to match database format (with colons: 50:0f:80:70:18:d0)
        const formattedBssid = crackedPwd.bssid.match(/.{1,2}/g)?.join(':') || crackedPwd.bssid;

        // Find the network by BSSID
        const network = await db.query.networks.findFirst({
          where: eq(networks.bssid, formattedBssid)
        });

        if (!network) {
          console.warn(`Network not found for BSSID: ${formattedBssid}`);
          continue;
        }

        // Check if this password was already saved (avoid duplicates)
        const existing = await db.query.crackedPasswords.findFirst({
          where: and(
            eq(crackedPasswords.jobId, jobId),
            eq(crackedPasswords.hash, crackedPwd.hash)
          )
        });

        if (existing) {
          continue; // Skip if already saved
        }

        // Save the cracked password
        await db.insert(crackedPasswords).values({
          jobId: jobId,
          networkId: network.id,
          hash: crackedPwd.hash,
          plainPassword: crackedPwd.password,
          crackedAt: new Date()
        });

        console.log(`Saved cracked password for network ${network.essid} (${formattedBssid}): ${crackedPwd.password}`);
      }
    } catch (error) {
      console.error(`Error saving cracked passwords for job ${jobId}:`, error);
      // Don't fail the job update if we can't save passwords
    }
  }

  /**
   * Handle job failure by updating status and cleaning up
   */
  private async handleJobFailure(jobId: string, errorMessage: string): Promise<void> {
    try {
      await db.update(jobs)
        .set({
          status: 'failed',
          errorMessage: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId));

      console.log(`Marked job ${jobId} as failed: ${errorMessage}`);
    } catch (dbError) {
      console.error(`Failed to update job ${jobId} as failed:`, dbError);
    }
  }

  /**
   * Map hashcat session status to job status
   */
  private mapHashcatStatusToJobStatus(sessionStatus: string): JobStatusUpdate['status'] {
    switch (sessionStatus) {
      case 'pending':
      case 'queued':
        return 'pending';
      case 'processing':
      case 'paused':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'stopped':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        console.warn(`Unknown session status: ${sessionStatus}, mapping to processing`);
        return 'processing';
    }
  }

  /**
   * Clean up stale sessions that haven't been updated recently
   */
  private cleanupStaleSessions(): void {
    const now = new Date();
    const staleSessions: string[] = [];

    for (const [sessionName, lastUpdate] of this.activeSessions.entries()) {
      const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
      if (timeSinceUpdate > this.SESSION_TIMEOUT_MS) {
        staleSessions.push(sessionName);
      }
    }

    if (staleSessions.length > 0) {
      console.log(`Found ${staleSessions.length} stale sessions: ${staleSessions.join(', ')}`);

      // Mark jobs with stale sessions as failed
      staleSessions.forEach(async (sessionName) => {
        try {
          const job = await db.query.jobs.findFirst({
            where: eq(jobs.hashcatSession, sessionName)
          });

          if (job && job.status === 'processing') {
            await this.handleJobFailure(job.id, 'Session timed out - no updates received for 30 seconds');
          }
        } catch (error) {
          console.error(`Error handling stale session ${sessionName}:`, error);
        } finally {
          this.activeSessions.delete(sessionName);
        }
      });
    }
  }

  /**
   * Add a session to track
   */
  trackSession(sessionName: string): void {
    this.activeSessions.set(sessionName, new Date());
    console.log(`Started tracking session: ${sessionName}`);
  }

  /**
   * Remove a session from tracking
   */
  untrackSession(sessionName: string): void {
    this.activeSessions.delete(sessionName);
    console.log(`Stopped tracking session: ${sessionName}`);
  }

  /**
   * Get list of currently tracked sessions
   */
  getTrackedSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Force an immediate status check for all active jobs
   */
  async checkNow(): Promise<void> {
    await this.checkActiveJobs();
  }
}

// Create a singleton instance
export const jobMonitor = new JobMonitor();