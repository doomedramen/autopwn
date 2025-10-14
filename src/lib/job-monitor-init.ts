import { jobMonitor } from '@/lib/job-monitor';

// Initialize the job monitor service on server startup
console.log('Initializing job monitor service...');
jobMonitor.start();

// Export a flag to indicate the monitor is running
export const jobMonitorInitialized = true;
