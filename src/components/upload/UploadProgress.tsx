'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  UploadProgressProps,
  UploadItem,
  formatFileSize,
  formatSpeed,
  formatDuration,
} from './types';

export function UploadProgress({
  progress,
  fileName,
  showDetails = true,
  className,
  onCancel,
}: UploadProgressProps) {
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'uploading':
        return 'text-blue-600';
      case 'validating':
        return 'text-yellow-600';
      case 'processing':
        return 'text-purple-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'uploading':
        return (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      case 'validating':
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'processing':
        return (
          <svg
            className="animate-pulse h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case 'completed':
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getProgressBarColor = (stage: string) => {
    switch (stage) {
      case 'uploading':
        return 'bg-blue-500';
      case 'validating':
        return 'bg-yellow-500';
      case 'processing':
        return 'bg-purple-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={cn('border rounded-lg p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={getStageColor(progress.stage)}>
            {getStageIcon(progress.stage)}
          </div>
          <div>
            {fileName && (
              <p className="font-medium text-sm truncate max-w-xs">
                {fileName}
              </p>
            )}
            <p className="text-xs text-muted-foreground capitalize">
              {progress.stage}
              {progress.message && ` - ${progress.message}`}
            </p>
          </div>
        </div>

        {progress.stage !== 'completed' &&
          progress.stage !== 'error' &&
          onCancel && (
            <button
              onClick={onCancel}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              Cancel
            </button>
          )}
      </div>

      {/* Progress bar */}
      {progress.stage !== 'completed' && progress.stage !== 'error' && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                getProgressBarColor(progress.stage)
              )}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.percentage}%</span>
            <span>
              {formatFileSize(progress.bytesUploaded)} /{' '}
              {formatFileSize(progress.totalBytes)}
            </span>
          </div>
        </div>
      )}

      {/* Detailed information */}
      {showDetails &&
        (progress.stage === 'uploading' || progress.stage === 'processing') && (
          <div className="text-xs text-muted-foreground space-y-1">
            {progress.speed > 0 && (
              <div className="flex justify-between">
                <span>Speed:</span>
                <span>{formatSpeed(progress.speed)}</span>
              </div>
            )}
            {progress.eta > 0 && (
              <div className="flex justify-between">
                <span>ETA:</span>
                <span>{formatDuration(progress.eta)}</span>
              </div>
            )}
          </div>
        )}

      {/* Completed state */}
      {progress.stage === 'completed' && (
        <div className="text-xs text-green-600">
          <p>Upload completed successfully!</p>
          <p className="text-muted-foreground">
            {formatFileSize(progress.totalBytes)} transferred
          </p>
        </div>
      )}

      {/* Error state */}
      {progress.stage === 'error' && (
        <div className="text-xs text-red-600">
          <p>Upload failed</p>
          {progress.message && (
            <p className="text-muted-foreground">{progress.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function UploadProgressList({
  uploads,
  showDetails = true,
  onCancel,
  className,
}: {
  uploads: UploadItem[];
  showDetails?: boolean;
  onCancel?: (fileId: string) => void;
  className?: string;
}) {
  if (uploads.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No uploads in progress</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {uploads.map((upload, index) => {
        // Create a mock progress object for pending uploads
        const progress = upload.progress || {
          bytesUploaded: 0,
          totalBytes: upload.file.size,
          percentage: 0,
          speed: 0,
          eta: 0,
          stage: upload.status === 'pending' ? 'uploading' : upload.status,
          message: upload.error,
        };

        return (
          <UploadProgress
            key={`${upload.file.name}-${index}`}
            progress={progress}
            fileName={upload.file.name}
            showDetails={showDetails}
            onCancel={() => upload.fileId && onCancel?.(upload.fileId)}
          />
        );
      })}
    </div>
  );
}
