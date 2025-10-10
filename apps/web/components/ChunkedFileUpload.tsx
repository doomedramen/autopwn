"use client";

import { useState, useRef, useEffect } from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import XHRUpload from '@uppy/xhr-upload';
import Compressor from '@uppy/compressor';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

interface ChunkedFileUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  uploadEndpoint: string;
  title: string;
  description: string;
  allowedFileTypes: string[];
  maxFileSize?: number; // in bytes
  note?: string;
  dropText?: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export default function ChunkedFileUpload({
  open,
  onOpenChange,
  onUploadComplete,
  uploadEndpoint,
  title,
  description,
  allowedFileTypes,
  maxFileSize = 5 * 1024 * 1024 * 1024, // Default 5GB
  note,
  dropText
}: ChunkedFileUploadProps) {
  const [uppy, setUppy] = useState<Uppy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const uppyInstanceRef = useRef<Uppy | null>(null);

  useEffect(() => {
    if (open && !uppy && dashboardRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (dashboardRef.current) {
          initializeUppy();
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (!open && uppy) {
      cleanupUppy();
    }

    return () => {
      cleanupUppy();
    };
  }, [open]);

  const initializeUppy = () => {
    if (!dashboardRef.current) {
      console.error('Dashboard ref not ready');
      return;
    }

    const newUppy = new Uppy({
      id: 'file-uploader',
      autoProceed: false,
      restrictions: {
        maxFileSize,
        minFileSize: 1,
        // Don't restrict by file type - dictionaries can have any extension
        // allowedFileTypes is passed for display purposes only
      },
      infoTimeout: 0,
    });

    // Add Dashboard UI
    newUppy.use(Dashboard, {
      inline: true,
      target: dashboardRef.current,
      proudlyDisplayPoweredByUppy: false,
      theme: 'light',
      note: note || `Files up to ${formatFileSize(maxFileSize)}`,
      locale: {
        strings: {
          dropPasteFiles: dropText || 'Drop files here or click to browse',
        },
      },
    });

    // Add compression plugin for large files
    newUppy.use(Compressor, {
      quality: 0.8,
      limit: 100 * 1024 * 1024, // Only compress files up to 100MB
    });

    // Custom chunked upload handler
    newUppy.addPreProcessor(async (fileIDs) => {
      for (const fileID of fileIDs) {
        const file = newUppy.getFile(fileID);
        if (!file) continue;

        try {
          // Initialize chunked upload
          const response = await fetch(`${uploadEndpoint}/chunked/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              filename: file.name!,
              fileSize: file.size!,
              totalChunks: Math.ceil(file.size! / CHUNK_SIZE),
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to initialize chunked upload');
          }

          const { uploadId } = await response.json();
          file.meta.uploadId = uploadId;
          file.meta.totalChunks = Math.ceil(file.size! / CHUNK_SIZE);

          // Read file and create chunks
          const arrayBuffer = await file.data.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);

          // Upload chunks
          for (let chunkIndex = 0; chunkIndex < (file.meta.totalChunks as number); chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, buffer.length);
            const chunk = buffer.slice(start, end);

            const formData = new FormData();
            const chunkFile = new File([chunk], file.name!);
            formData.append('chunk', chunkFile);

            const chunkResponse = await fetch(
              `${uploadEndpoint}/chunked/${file.meta.uploadId as string}/chunk/${chunkIndex}`,
              {
                method: 'POST',
                credentials: 'include',
                body: formData,
              }
            );

            if (!chunkResponse.ok) {
              throw new Error(`Failed to upload chunk ${chunkIndex}`);
            }

            const chunkResult = await chunkResponse.json();

            // Update progress
            const progress = ((chunkIndex + 1) / (file.meta.totalChunks as number)) * 100;
            setUploadProgress(progress);
          }

          // Complete upload
          const completeResponse = await fetch(`${uploadEndpoint}/chunked/${file.meta.uploadId as string}/complete`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!completeResponse.ok) {
            throw new Error('Failed to complete chunked upload');
          }

          const completeResult = await completeResponse.json();
          console.log('Upload completed:', completeResult);

        } catch (error) {
          console.error('Upload failed:', error);
          newUppy.setFileState(fileID, {
            error: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      }
    });

    newUppy.on('complete', (result) => {
      console.log('Upload complete! Successful files:', result.successful);
      console.log('Failed files:', result.failed);

      const successfulUploads = result.successful?.length || 0;
      const failedUploads = result.failed?.length || 0;

      if (successfulUploads > 0) {
        setSuccess(`Successfully uploaded ${successfulUploads} file(s)`);
        onUploadComplete();
      }

      if (failedUploads > 0) {
        setError(`${failedUploads} file(s) failed to upload`);
      }

      setIsUploading(false);
      setUploadProgress(0);

      setTimeout(() => {
        if (successfulUploads > 0) {
          onOpenChange(false);
        }
      }, 2000);
    });

    newUppy.on('error', (error) => {
      console.error('Uppy error:', error);
      setError(error.message || 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    });

    newUppy.on('upload-progress', (file, progress) => {
      setUploadProgress(progress.percentage || 0);
    });

    setUppy(newUppy);
    uppyInstanceRef.current = newUppy;
  };

  const cleanupUppy = () => {
    if (uppyInstanceRef.current) {
      try {
        (uppyInstanceRef.current as any).close?.();
      } catch (error) {
        console.warn('Error closing Uppy instance:', error);
      }
      uppyInstanceRef.current = null;
      setUppy(null);
    }
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleUpload = () => {
    if (!uppy) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const files = uppy.getFiles();
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    uppy.upload();
  };

  const handleCancel = () => {
    if (uppy && isUploading) {
      uppy.cancelAll();
      setIsUploading(false);
      setUploadProgress(0);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Upload Progress</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="border rounded-lg">
            <div ref={dashboardRef} />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
            >
              {isUploading ? 'Cancel' : 'Close'}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !uppy || uppy.getFiles().length === 0}
            >
              {isUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}