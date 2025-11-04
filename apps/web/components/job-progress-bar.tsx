'use client';

import React from 'react';
import { useJobUpdates } from '@/lib/use-websocket';
import { Progress } from '@workspace/ui/components/progress';
import { Badge } from '@workspace/ui/components/badge';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Zap
} from 'lucide-react';

interface JobProgressBarProps {
  jobId: string;
  initialStatus?: string;
  initialProgress?: number;
  showDetails?: boolean;
  className?: string;
}

export function JobProgressBar({
  jobId,
  initialStatus = 'pending',
  initialProgress = 0,
  showDetails = false,
  className = ''
}: JobProgressBarProps) {
  const jobUpdate = useJobUpdates(jobId);

  // Use real-time updates if available, otherwise fall back to initial values
  const status = jobUpdate?.status || initialStatus;
  const progress = jobUpdate?.progress !== undefined ? jobUpdate.progress : initialProgress;
  const metadata = jobUpdate?.metadata;

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressColor = () => {
    if (status === 'failed' || status === 'cancelled') {
      return 'bg-destructive';
    }
    if (status === 'completed') {
      return 'bg-green-500';
    }
    return 'bg-primary';
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return null;

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium capitalize">{status}</span>
          {showDetails && metadata?.type && (
            <Badge variant="outline" className="text-xs">
              {metadata.type === 'dictionary_generation' ? 'Dictionary' : 'Cracking'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{progress}%</span>
          {showDetails && (
            <>
              {jobUpdate?.startTime && (
                <>
                  <Clock className="h-3 w-3" />
                  {formatDuration(jobUpdate.startTime, jobUpdate.endTime)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress
          value={progress}
          className="h-2"
          // Override the progress bar color based on status
          style={
            {
              '--progress-background': getProgressColor()
            } as React.CSSProperties
          }
        />
      </div>

      {/* Additional Details */}
      {showDetails && (
        <div className="space-y-1">
          {/* Current Stage */}
          {metadata?.stage && status === 'running' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span className="capitalize">
                {metadata.stage.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Error Message */}
          {jobUpdate?.errorMessage && status === 'failed' && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              <strong>Error:</strong> {jobUpdate.errorMessage}
            </div>
          )}

          {/* Metadata for Dictionary Generation */}
          {metadata?.type === 'dictionary_generation' && metadata?.baseWordsCount && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Base words: {metadata.baseWordsCount}</div>
              {metadata.rulesCount !== undefined && (
                <div>Rules: {metadata.rulesCount}</div>
              )}
              {metadata.transformationsCount !== undefined && (
                <div>Transformations: {metadata.transformationsCount}</div>
              )}
              {metadata.wordCount && (
                <div className="text-green-600">Generated {metadata.wordCount} words</div>
              )}
            </div>
          )}

          {/* Metadata for Hashcat */}
          {metadata?.type === 'hashcat_execution' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Attack mode: {metadata.attackMode}</div>
              {metadata.wordCount && (
                <div className="text-green-600">
                  {status === 'completed'
                    ? `Found ${metadata.wordCount} passwords`
                    : 'Processing...'}
                </div>
              )}
            </div>
          )}

          {/* Success Result */}
          {jobUpdate?.result && status === 'completed' && (
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
              <strong>Success:</strong> {
                typeof jobUpdate.result === 'string'
                  ? jobUpdate.result
                  : JSON.stringify(jobUpdate.result, null, 2)
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}