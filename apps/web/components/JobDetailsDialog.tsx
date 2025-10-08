"use client";

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2,
  Clock,
  Zap,
  FileText,
  Activity,
} from 'lucide-react';

interface Job {
  id: number;
  filename: string;
  status: string;
  progress: number | null;
  speed: string | null;
  eta: string | null;
  itemsTotal: number | null;
  itemsCracked: number | null;
  hashCount: number | null;
  totalHashes: number | null;
  currentDictionary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  error: string | null;
}

interface JobItem {
  id: number;
  essid: string;
  bssid: string;
  status: string;
  password: string | null;
  crackedAt: string | null;
}

interface JobDetailsDialogProps {
  jobId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdated: () => void;
}

export function JobDetailsDialog({ jobId, open, onOpenChange, onJobUpdated }: JobDetailsDialogProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (open && jobId) {
      fetchJobDetails();
    }
  }, [open, jobId]);

  const fetchJobDetails = async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const [jobData, itemsData, logsData] = await Promise.all([
        apiClient.getJob(jobId),
        apiClient.getJobItems(jobId),
        apiClient.getJobLogs(jobId)
      ]);
      setJob(jobData as Job);
      setItems(itemsData as JobItem[]);
      setLogs((logsData as any).logs || '');
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, actionFn: () => Promise<void>) => {
    if (!jobId) return;

    setActionLoading(action);
    try {
      await actionFn();
      onJobUpdated();
      await fetchJobDetails(); // Refresh the data
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      case 'pending': return 'bg-gray-500';
      case 'stopped': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`} />
            Job Details: {job.filename}
          </DialogTitle>
          <DialogDescription>
            ID: {job.id} • Created: {new Date(job.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Status</h4>
                <Badge variant="outline">{job.status}</Badge>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Priority</h4>
                <span>{(job as any).priority || 0}</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Progress</h4>
                {job.progress !== null ? (
                  <div className="space-y-2">
                    <Progress value={job.progress} className="w-full" />
                    <span className="text-sm text-muted-foreground">{job.progress.toFixed(1)}%</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">N/A</span>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Speed</h4>
                <span className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {job.speed || 'N/A'}
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">ETA</h4>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {job.eta || 'N/A'}
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Current Dictionary</h4>
                <span className="text-sm">{job.currentDictionary || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Items</h4>
                <span>{job.itemsCracked || 0} / {job.itemsTotal || 0}</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Hashes</h4>
                <span>{job.hashCount?.toLocaleString() || 0} / {job.totalHashes?.toLocaleString() || 0}</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Duration</h4>
                <span>{job.startedAt ? formatDuration(job.startedAt, job.completedAt || undefined) : 'N/A'}</span>
              </div>
            </div>

            {job.error && (
              <Alert>
                <AlertDescription className="text-red-600">
                  <strong>Error:</strong> {job.error}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No items found</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <p className="font-medium">{item.essid}</p>
                        <p className="text-sm text-muted-foreground">{item.bssid}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={item.status === 'cracked' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                        {item.password && (
                          <p className="text-sm font-mono mt-1">{item.password}</p>
                        )}
                        {item.crackedAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.crackedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {logs || 'No logs available'}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {job.status === 'processing' && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('pause', async () => await apiClient.pauseJob(job.id!) as void)}
                  disabled={actionLoading === 'pause'}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
                </Button>
              )}

              {(job.status === 'paused' || job.status === 'failed') && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('resume', async () => await apiClient.resumeJob(job.id!) as void)}
                  disabled={actionLoading === 'resume'}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
                </Button>
              )}

              {(job.status === 'processing' || job.status === 'paused') && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('stop', async () => await apiClient.stopJob(job.id!) as void)}
                  disabled={actionLoading === 'stop'}
                >
                  <Square className="mr-2 h-4 w-4" />
                  {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
                </Button>
              )}

              {(job.status === 'failed' || job.status === 'completed' || job.status === 'stopped') && (
                <Button
                  variant="outline"
                  onClick={() => handleAction('restart', async () => await apiClient.restartJob(job.id!) as void)}
                  disabled={actionLoading === 'restart'}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
                </Button>
              )}

              {(job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this job?')) {
                      handleAction('delete', async () => await apiClient.deleteJob(job.id!) as void);
                      onOpenChange(false);
                    }
                  }}
                  disabled={actionLoading === 'delete'}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}