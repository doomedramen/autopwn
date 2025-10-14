// Import the job monitor initialization which starts the service on the server
import '@/lib/job-monitor-init';

export function JobMonitorProvider() {
  // This component doesn't render anything
  // The job monitor is started on the server side via the import above
  return null;
}
