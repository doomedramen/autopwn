'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Terminal, RefreshCw } from 'lucide-react';


interface JobLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobName: string;
}

export function JobLogsDialog({ isOpen, onClose, jobId, jobName }: JobLogsDialogProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/logs`);
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setLogs(data.data.logs || []);
      } else {
        setError(data.error || 'Failed to load logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Load logs when dialog opens
  useEffect(() => {
    if (isOpen && jobId) {
      loadLogs();
    }
  }, [isOpen, jobId]);

  // Auto-refresh logs every 5 seconds if job is still running
  useEffect(() => {
    if (!isOpen || !jobId) return;

    const interval = setInterval(() => {
      loadLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, jobId, loadLogs]);

  const getLogType = (message: string): 'info' | 'error' | 'success' | 'warning' => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('exception')) {
      return 'error';
    }
    if (lowerMessage.includes('completed') || lowerMessage.includes('success') || lowerMessage.includes('cracked')) {
      return 'success';
    }
    if (lowerMessage.includes('warning') || lowerMessage.includes('deprecated')) {
      return 'warning';
    }
    return 'info';
  };

  const getLogColor = (type: 'info' | 'error' | 'success' | 'warning') => {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Terminal className="h-5 w-5" />
            <span>Job Logs: {jobName}</span>
          </DialogTitle>
          <DialogDescription>
            Real-time logs and status updates for this job
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 min-h-0">
          {error ? (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <p className="text-red-600 font-medium">Error loading logs:</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading logs...</span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">No logs available for this job</p>
            </div>
          ) : (
            <div className="h-[400px] w-full border rounded-lg p-4 overflow-y-auto overflow-x-hidden">
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log, index) => {
                  const logType = getLogType(log);
                  return (
                    <div key={index} className="flex items-start space-x-2">
                      <span className={`text-xs ${getLogColor(logType)} mt-1`}>
                        {'>'}
                      </span>
                      <pre className={`flex-1 whitespace-pre-wrap break-words ${getLogColor(logType)}`}>
                        {log}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              {logs.length} log entries
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}