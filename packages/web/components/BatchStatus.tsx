'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PendingFile {
  name: string;
  size: number;
  modifiedAt: number;
}

interface BatchConfig {
  enabled: boolean;
  quietPeriod: number;
  maxWait: number;
  minFiles: number;
}

interface BatchStatus {
  pending: number;
  files: PendingFile[];
  batchMode: BatchConfig;
}

export default function BatchStatus() {
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/pending');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch batch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!status || status.pending === 0) {
    return null;
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const newestFile = status.files[0];
  const timeSinceNewest = newestFile ? Date.now() - newestFile.modifiedAt : 0;
  const quietPeriodMs = status.batchMode.quietPeriod * 1000;
  const timeUntilBatch = Math.max(0, quietPeriodMs - timeSinceNewest);
  const secondsUntilBatch = Math.ceil(timeUntilBatch / 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Batch Processing Status
          {status.batchMode.enabled && (
            <Badge variant="secondary">Batch Mode</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">
            {status.pending} file{status.pending !== 1 ? 's' : ''} pending
          </span>
          {status.batchMode.enabled && secondsUntilBatch > 0 && (
            <span className="text-sm text-muted-foreground">
              Processing in {secondsUntilBatch}s
            </span>
          )}
        </div>

        {status.batchMode.enabled && (
          <div className="text-sm text-muted-foreground">
            <p>• Files are processed in batches for efficiency</p>
            <p>• Processing begins {status.batchMode.quietPeriod}s after the last upload</p>
            <p>• Maximum wait time: {status.batchMode.maxWait}s</p>
          </div>
        )}

        {status.files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent uploads:</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {status.files.slice(0, 5).map((file) => (
                <div key={file.name} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[200px]" title={file.name}>
                    {file.name}
                  </span>
                  <span className="flex items-center gap-2">
                    {formatFileSize(file.size)}
                    <span>({formatTimeAgo(file.modifiedAt)})</span>
                  </span>
                </div>
              ))}
              {status.files.length > 5 && (
                <div className="text-xs text-muted-foreground">
                  ... and {status.files.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {status.batchMode.enabled && secondsUntilBatch > 0 && (
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-1000"
              style={{
                width: `${((status.batchMode.quietPeriod * 1000 - timeUntilBatch) / (status.batchMode.quietPeriod * 1000)) * 100}%`
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}