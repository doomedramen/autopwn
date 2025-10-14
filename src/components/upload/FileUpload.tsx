'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { FileUploadProps, UPLOAD_CONFIGS } from './types';
import { useFileUpload } from './useFileUpload';

export function FileUpload({
  type,
  multiple = false,
  maxFiles,
  className,
  disabled = false,
  onUploadComplete,
  onUploadError,
  children,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = UPLOAD_CONFIGS[type];

  const {
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    isDragOver,
    isUploading,
    overallProgress,
  } = useFileUpload({
    type,
    multiple,
    maxFiles,
    onProgress: () => {
      // Progress updates are handled by the hook state
    },
    onComplete: (_fileId, result) => {
      onUploadComplete?.([result]);
    },
    onError: (_fileId, error) => {
      onUploadError?.(error);
    },
  });

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        multiple={multiple}
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
      />

      {/* Upload area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragOver && 'border-primary bg-primary/10',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'border-primary/30'
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {children || (
          <DefaultUploadContent
            type={type}
            config={config}
            isDragOver={isDragOver}
            isUploading={isUploading}
            overallProgress={overallProgress}
            disabled={disabled}
          />
        )}
      </div>

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
            <p className="text-sm font-medium">Uploading files...</p>
            <p className="text-xs text-muted-foreground">{overallProgress}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultUploadContent({
  type,
  config,
  isDragOver,
  isUploading,
  overallProgress,
  disabled,
}: {
  type: string;
  config: {
    maxSize: number;
    allowedExtensions: string[];
    accept: string;
  };
  isDragOver: boolean;
  isUploading: boolean;
  overallProgress: number;
  disabled: boolean;
}) {
  const formatMaxSize = () => {
    if (config.maxSize < 1024 * 1024 * 1024) {
      return `${(config.maxSize / 1024 / 1024).toFixed(1)}MB`;
    } else {
      return `${(config.maxSize / 1024 / 1024 / 1024).toFixed(1)}GB`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload icon */}
      <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      {/* Upload text */}
      <div>
        <h3 className="text-lg font-semibold">
          {isUploading
            ? 'Uploading...'
            : `Upload ${type === 'pcap' ? 'PCAP' : type === 'dictionary' ? 'Dictionary' : 'Files'}`}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isDragOver
            ? 'Drop files here'
            : `Drag and drop files here, or click to select`}
        </p>
      </div>

      {/* File requirements */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>File types:</strong> {config.allowedExtensions.join(', ')}
        </p>
        <p>
          <strong>Max size:</strong> {formatMaxSize()}
        </p>
        {type === 'pcap' && (
          <p className="text-amber-600">
            <strong>Note:</strong> PCAP files should contain WiFi handshakes for
            analysis
          </p>
        )}
        {type === 'dictionary' && (
          <p className="text-blue-600">
            <strong>Note:</strong> Large dictionary files will be processed in
            the background
          </p>
        )}
      </div>

      {/* Progress bar (when uploading) */}
      {isUploading && (
        <div className="w-full">
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {overallProgress}% complete
          </p>
        </div>
      )}

      {/* Disabled state */}
      {disabled && (
        <p className="text-xs text-red-500">Upload is currently disabled</p>
      )}
    </div>
  );
}
