import { EventEmitter } from 'events';
import { UploadProgress } from './index';

export type ProgressResult = Record<string, unknown>;

export interface ProgressUpdate {
  fileId: string;
  progress: UploadProgress;
  timestamp: number;
}

export interface ProgressOptions {
  updateInterval?: number; // milliseconds
  maxHistory?: number; // Maximum progress updates to keep in history
  enableEvents?: boolean; // Enable event emission
}

export class ProgressTracker extends EventEmitter {
  private progress: Map<string, UploadProgress> = new Map();
  private history: Map<string, ProgressUpdate[]> = new Map();
  private options: ProgressOptions;
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: ProgressOptions = {}) {
    super();
    this.options = {
      updateInterval: 100, // 100ms default
      maxHistory: 100,
      enableEvents: true,
      ...options,
    };
  }

  /**
   * Start tracking progress for a file upload
   */
  startTracking(fileId: string, totalBytes: number): void {
    const progress: UploadProgress = {
      bytesUploaded: 0,
      totalBytes,
      percentage: 0,
      speed: 0,
      eta: 0,
      stage: 'uploading',
    };

    this.progress.set(fileId, progress);
    this.history.set(fileId, []);

    if (this.options.enableEvents) {
      this.emit('started', { fileId, progress });
    }
  }

  /**
   * Update progress for a file upload
   */
  updateProgress(fileId: string, update: Partial<UploadProgress>): void {
    const current = this.progress.get(fileId);
    if (!current) {
      return;
    }

    const previous = { ...current };
    const updated: UploadProgress = { ...current, ...update };

    // Calculate derived values
    if (update.bytesUploaded !== undefined) {
      updated.percentage = Math.round(
        (updated.bytesUploaded / updated.totalBytes) * 100
      );

      // Calculate speed and ETA if bytes have increased
      if (updated.bytesUploaded > previous.bytesUploaded) {
        const now = Date.now();
        const timeDiff = (now - (previous.timestamp || now)) / 1000; // seconds

        if (timeDiff > 0) {
          const bytesDiff = updated.bytesUploaded - previous.bytesUploaded;
          updated.speed = bytesDiff / timeDiff; // bytes per second
          updated.eta =
            updated.speed > 0
              ? Math.round(
                  (updated.totalBytes - updated.bytesUploaded) / updated.speed
                )
              : 0;
        }
      }
    }

    updated.timestamp = Date.now();

    this.progress.set(fileId, updated);

    // Add to history
    const history = this.history.get(fileId) || [];
    history.push({
      fileId,
      progress: updated,
      timestamp: updated.timestamp,
    });

    // Limit history size
    if (history.length > (this.options.maxHistory || 100)) {
      history.shift();
    }
    this.history.set(fileId, history);

    // Emit event
    if (this.options.enableEvents) {
      this.emit('progress', { fileId, progress: updated, previous });
    }
  }

  /**
   * Get current progress for a file
   */
  getProgress(fileId: string): UploadProgress | null {
    return this.progress.get(fileId) || null;
  }

  /**
   * Get all active progress tracking
   */
  getAllProgress(): Map<string, UploadProgress> {
    return new Map(this.progress);
  }

  /**
   * Get progress history for a file
   */
  getHistory(fileId: string): ProgressUpdate[] {
    return this.history.get(fileId) || [];
  }

  /**
   * Complete progress tracking for a file
   */
  completeTracking(fileId: string, result?: ProgressResult): void {
    this.updateProgress(fileId, {
      stage: 'completed',
      percentage: 100,
      message: 'Upload completed successfully',
    });

    if (this.options.enableEvents) {
      this.emit('completed', {
        fileId,
        progress: this.progress.get(fileId),
        result,
      });
    }

    // Stop any periodic updates
    this.stopPeriodicUpdate(fileId);

    // Schedule cleanup
    this.scheduleCleanup(fileId);
  }

  /**
   * Mark progress as failed
   */
  failTracking(fileId: string, error: string): void {
    this.updateProgress(fileId, {
      stage: 'error',
      message: error,
    });

    if (this.options.enableEvents) {
      this.emit('failed', {
        fileId,
        progress: this.progress.get(fileId),
        error,
      });
    }

    // Stop any periodic updates
    this.stopPeriodicUpdate(fileId);

    // Schedule cleanup
    this.scheduleCleanup(fileId);
  }

  /**
   * Cancel progress tracking
   */
  cancelTracking(fileId: string): void {
    this.updateProgress(fileId, {
      stage: 'error',
      message: 'Upload cancelled',
    });

    if (this.options.enableEvents) {
      this.emit('cancelled', { fileId, progress: this.progress.get(fileId) });
    }

    // Stop any periodic updates
    this.stopPeriodicUpdate(fileId);

    // Schedule cleanup
    this.scheduleCleanup(fileId);
  }

  /**
   * Start periodic progress updates (for streaming uploads)
   */
  startPeriodicUpdate(
    fileId: string,
    updateFn: () => Partial<UploadProgress>
  ): void {
    this.stopPeriodicUpdate(fileId); // Clear any existing timer

    const timer = setInterval(() => {
      const progress = this.progress.get(fileId);
      if (
        !progress ||
        (progress.stage !== 'uploading' && progress.stage !== 'processing')
      ) {
        this.stopPeriodicUpdate(fileId);
        return;
      }

      this.updateProgress(fileId, updateFn());
    }, this.options.updateInterval);

    this.updateTimers.set(fileId, timer);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdate(fileId: string): void {
    const timer = this.updateTimers.get(fileId);
    if (timer) {
      clearInterval(timer);
      this.updateTimers.delete(fileId);
    }
  }

  /**
   * Get statistics for all uploads
   */
  getStats(): {
    active: number;
    completed: number;
    failed: number;
    totalBytes: number;
    uploadedBytes: number;
    averageSpeed: number;
  } {
    let active = 0;
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;
    let uploadedBytes = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    for (const progress of this.progress.values()) {
      totalBytes += progress.totalBytes;
      uploadedBytes += progress.bytesUploaded;

      switch (progress.stage) {
        case 'uploading':
        case 'validating':
        case 'processing':
          active++;
          if (progress.speed > 0) {
            totalSpeed += progress.speed;
            speedCount++;
          }
          break;
        case 'completed':
          completed++;
          break;
        case 'error':
          failed++;
          break;
      }
    }

    return {
      active,
      completed,
      failed,
      totalBytes,
      uploadedBytes,
      averageSpeed: speedCount > 0 ? totalSpeed / speedCount : 0,
    };
  }

  /**
   * Get files that have been active for too long (stalled uploads)
   */
  getStalledUploads(timeoutMs: number = 30000): string[] {
    const now = Date.now();
    const stalled: string[] = [];

    for (const [fileId, progress] of this.progress) {
      if (
        (progress.stage === 'uploading' || progress.stage === 'processing') &&
        progress.timestamp &&
        now - progress.timestamp > timeoutMs
      ) {
        stalled.push(fileId);
      }
    }

    return stalled;
  }

  /**
   * Clean up completed/failed uploads after delay
   */
  private scheduleCleanup(fileId: string, delayMs: number = 30000): void {
    setTimeout(() => {
      this.progress.delete(fileId);
      this.history.delete(fileId);
      this.stopPeriodicUpdate(fileId);

      if (this.options.enableEvents) {
        this.emit('cleaned', { fileId });
      }
    }, delayMs);
  }

  /**
   * Force cleanup for a file
   */
  forceCleanup(fileId: string): void {
    this.progress.delete(fileId);
    this.history.delete(fileId);
    this.stopPeriodicUpdate(fileId);

    if (this.options.enableEvents) {
      this.emit('cleaned', { fileId });
    }
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    // Stop all timers
    for (const timer of this.updateTimers.values()) {
      clearInterval(timer);
    }
    this.updateTimers.clear();

    // Clear all data
    this.progress.clear();
    this.history.clear();

    if (this.options.enableEvents) {
      this.emit('cleared');
    }
  }

  /**
   * Get progress formatted for API responses
   */
  getProgressForAPI(fileId: string): {
    fileId: string;
    progress: UploadProgress;
    history?: ProgressUpdate[];
  } | null {
    const progress = this.progress.get(fileId);
    if (!progress) {
      return null;
    }

    return {
      fileId,
      progress,
      history: this.history.get(fileId),
    };
  }
}

// Create default instance
export const progressTracker = new ProgressTracker();
