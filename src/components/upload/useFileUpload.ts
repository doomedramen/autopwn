'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  UploadResponse,
  UseFileUploadOptions,
  FileUploadState,
  UPLOAD_CONFIGS,
  getUploadEndpoint,
} from './types';

export function useFileUpload(options: UseFileUploadOptions) {
  const [state, setState] = useState<FileUploadState>({
    files: [],
    uploads: [],
    isDragOver: false,
    isUploading: false,
    overallProgress: 0,
  });

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const progressIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const config = UPLOAD_CONFIGS[options.type];

  // Cleanup intervals on unmount
  useEffect(() => {
    const progressIntervals = progressIntervalsRef.current;
    const abortControllers = abortControllersRef.current;

    return () => {
      // Clear all progress intervals
      progressIntervals.forEach(interval => clearInterval(interval));
      progressIntervals.clear();

      // Abort all active uploads
      abortControllers.forEach(controller => controller.abort());
      abortControllers.clear();
    };
  }, []);

  // Calculate overall progress
  const calculateOverallProgress = useCallback(
    (uploads: FileUploadState['uploads']) => {
      const activeUploads = uploads.filter(
        u => u.status === 'uploading' || u.status === 'processing'
      );
      if (activeUploads.length === 0) return 0;

      const totalPercentage = activeUploads.reduce((sum, upload) => {
        return sum + (upload.progress?.percentage || 0);
      }, 0);

      return Math.round(totalPercentage / activeUploads.length);
    },
    []
  );

  // Poll progress for an upload
  const pollProgress = useCallback(
    async (fileId: string) => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/upload/progress/${fileId}`);
          const result = await response.json();

          if (result.success && result.data) {
            const progress = result.data.progress;

            setState(prev => ({
              ...prev,
              uploads: prev.uploads.map(upload =>
                upload.fileId === fileId ? { ...upload, progress } : upload
              ),
              overallProgress: calculateOverallProgress(
                prev.uploads.map(u =>
                  u.fileId === fileId ? { ...u, progress } : u
                )
              ),
            }));

            // Call progress callback
            options.onProgress?.(fileId, progress);

            // Stop polling if upload is completed or failed
            if (progress.stage === 'completed' || progress.stage === 'error') {
              clearInterval(interval);
              progressIntervalsRef.current.delete(fileId);

              // Get final result if completed
              if (progress.stage === 'completed') {
                try {
                  const uploadResponse = await fetch(
                    `${getUploadEndpoint(options.type)}?fileId=${fileId}`,
                    {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                  );

                  const result: UploadResponse = await uploadResponse.json();

                  setState(prev => ({
                    ...prev,
                    uploads: prev.uploads.map(upload =>
                      upload.fileId === fileId
                        ? {
                            ...upload,
                            result,
                            status: result.success ? 'completed' : 'error',
                          }
                        : upload
                    ),
                    isUploading: prev.uploads.some(
                      u =>
                        u.fileId !== fileId &&
                        (u.status === 'uploading' || u.status === 'processing')
                    ),
                  }));

                  if (result.success) {
                    options.onComplete?.(fileId, result);
                    options.onSuccess?.(fileId, result);
                  } else {
                    options.onError?.(fileId, result.error || 'Upload failed');
                  }
                } catch (error) {
                  console.error('Error getting final result:', error);
                  options.onError?.(fileId, 'Failed to get upload result');
                }
              } else {
                options.onError?.(fileId, progress.message || 'Upload failed');
              }
            }
          }
        } catch (error) {
          console.error('Error polling progress:', error);
          clearInterval(interval);
          progressIntervalsRef.current.delete(fileId);
          options.onError?.(fileId, 'Failed to track progress');
        }
      }, 1000); // Poll every second

      progressIntervalsRef.current.set(fileId, interval);
    },
    [options, calculateOverallProgress]
  );

  // Handle file selection
  const selectFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const errors: string[] = [];

      // Validate files
      fileArray.forEach(file => {
        const validation = validateFileSize(file, config);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${validation.error}`);
        }
      });

      // Check max files limit
      if (
        options.maxFiles &&
        state.files.length + validFiles.length > options.maxFiles
      ) {
        errors.push(`Maximum ${options.maxFiles} files allowed`);
        return;
      }

      if (errors.length > 0) {
        options.onError?.('invalid_files', errors.join('; '));
        return;
      }

      setState(prev => ({
        ...prev,
        files: [...prev.files, ...validFiles],
        uploads: [
          ...prev.uploads,
          ...validFiles.map(file => ({
            file,
            status: 'pending' as const,
          })),
        ],
      }));
    },
    [state.files.length, config, options]
  );

  // Upload files
  const uploadFiles = useCallback(
    async (files?: File[]) => {
      const filesToUpload =
        files ||
        state.files.filter(
          f => !state.uploads.some(u => u.file === f && u.status !== 'pending')
        );

      if (filesToUpload.length === 0) {
        return [];
      }

      setState(prev => ({ ...prev, isUploading: true }));

      // Mark files as uploading
      setState(prev => ({
        ...prev,
        uploads: prev.uploads.map(upload =>
          filesToUpload.includes(upload.file) && upload.status === 'pending'
            ? { ...upload, status: 'uploading' as const }
            : upload
        ),
      }));

      const uploadPromises = filesToUpload.map(async file => {
        const controller = new AbortController();
        abortControllersRef.current.set(file.name + Date.now(), controller);

        try {
          const formData = new FormData();
          formData.append('file', file);

          // Add type-specific form data
          if (options.type === 'dictionary') {
            // Add name field for dictionaries
            formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
          }

          const response = await fetch(getUploadEndpoint(options.type), {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          const result: UploadResponse = await response.json();

          if (result.success && result.data?.fileId) {
            // Start polling progress
            pollProgress(result.data.fileId);

            // Update upload state
            setState(prev => ({
              ...prev,
              uploads: prev.uploads.map(upload =>
                upload.file === file
                  ? {
                      ...upload,
                      fileId: result.data!.fileId,
                      status: 'processing' as const,
                      result,
                    }
                  : upload
              ),
            }));

            return { file, result, success: true };
          } else {
            // Upload failed immediately
            setState(prev => ({
              ...prev,
              uploads: prev.uploads.map(upload =>
                upload.file === file
                  ? {
                      ...upload,
                      status: 'error' as const,
                      error: result.error || result.message,
                    }
                  : upload
              ),
              isUploading: prev.uploads.some(
                u => u.status === 'uploading' || u.status === 'processing'
              ),
            }));

            options.onError?.(
              file.name,
              result.error || result.message || 'Upload failed'
            );
            return { file, result, success: false };
          }
        } catch (error) {
          // Upload failed due to network error
          const errorMessage =
            error instanceof Error ? error.message : 'Upload failed';

          setState(prev => ({
            ...prev,
            uploads: prev.uploads.map(upload =>
              upload.file === file
                ? { ...upload, status: 'error' as const, error: errorMessage }
                : upload
            ),
            isUploading: prev.uploads.some(
              u => u.status === 'uploading' || u.status === 'processing'
            ),
          }));

          options.onError?.(file.name, errorMessage);
          return { file, error: errorMessage, success: false };
        }
      });

      const results = await Promise.all(uploadPromises);

      // Check if all uploads are complete
      const allComplete = state.uploads.every(
        u =>
          u.status === 'completed' ||
          u.status === 'error' ||
          (!filesToUpload.includes(u.file) && u.status !== 'pending')
      );

      if (allComplete) {
        setState(prev => ({ ...prev, isUploading: false }));
      }

      return results;
    },
    [state.files, state.uploads, options, pollProgress]
  );

  // Cancel upload
  const cancelUpload = useCallback(async (fileId: string) => {
    try {
      // Cancel progress polling
      const interval = progressIntervalsRef.current.get(fileId);
      if (interval) {
        clearInterval(interval);
        progressIntervalsRef.current.delete(fileId);
      }

      // Cancel the upload via API
      const response = await fetch(`/api/upload/progress/${fileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          uploads: prev.uploads.map(upload =>
            upload.fileId === fileId
              ? {
                  ...upload,
                  status: 'error' as const,
                  error: 'Upload cancelled',
                }
              : upload
          ),
          isUploading: prev.uploads.some(
            u => u.status === 'uploading' || u.status === 'processing'
          ),
        }));
      }
    } catch (error) {
      console.error('Error cancelling upload:', error);
    }
  }, []);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(
        file =>
          !prev.uploads.some(
            upload =>
              upload.file === file &&
              (upload.status === 'completed' || upload.status === 'error')
          )
      ),
      uploads: prev.uploads.filter(
        upload => upload.status !== 'completed' && upload.status !== 'error'
      ),
    }));
  }, []);

  // Clear all uploads
  const clearAll = useCallback(() => {
    // Cancel all active uploads
    state.uploads.forEach(upload => {
      if (
        upload.fileId &&
        (upload.status === 'uploading' || upload.status === 'processing')
      ) {
        cancelUpload(upload.fileId);
      }
    });

    setState({
      files: [],
      uploads: [],
      isDragOver: false,
      isUploading: false,
      overallProgress: 0,
    });
  }, [state.uploads, cancelUpload]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: false }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState(prev => ({ ...prev, isDragOver: false }));

      if (e.dataTransfer.files) {
        const files = Array.from(e.dataTransfer.files);
        selectFiles(e.dataTransfer.files);
        options.onFileSelect?.(files);

        // Auto-upload if files are selected
        if (files.length > 0) {
          setTimeout(() => {
            options.onUploadStart?.(files);
            uploadFiles(files);
          }, 100);
        }
      }
    },
    [selectFiles, uploadFiles, options]
  );

  // File input handler
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        selectFiles(e.target.files);
        options.onFileSelect?.(files);

        // Auto-upload if files are selected
        if (files.length > 0) {
          setTimeout(() => {
            options.onUploadStart?.(files);
            uploadFiles(files);
          }, 100);
        }
      }
    },
    [selectFiles, uploadFiles, options]
  );

  return {
    // State
    state,
    files: state.files,
    uploads: state.uploads,
    isDragOver: state.isDragOver,
    isUploading: state.isUploading,
    overallProgress: state.overallProgress,

    // Actions
    selectFiles,
    uploadFiles,
    cancelUpload,
    clearCompleted,
    clearAll,

    // Handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,

    // Config
    config,
  };
}

// Helper function to validate file size
function validateFileSize(
  file: File,
  config: {
    maxSize: number;
    allowedExtensions: string[];
  }
): { valid: boolean; error?: string } {
  if (file.size > config.maxSize) {
    const maxSizeMB =
      config.maxSize < 1024 * 1024 * 1024
        ? `${(config.maxSize / 1024 / 1024).toFixed(1)}MB`
        : `${(config.maxSize / 1024 / 1024 / 1024).toFixed(1)}GB`;

    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}`,
    };
  }

  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${config.allowedExtensions.join(', ')}`,
    };
  }

  return { valid: true };
}
