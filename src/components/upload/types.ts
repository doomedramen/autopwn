export type UploadType = 'pcap' | 'dictionary';

export interface UploadConfig {
  type: UploadType;
  maxSize: number;
  allowedExtensions: string[];
  accept: string; // HTML accept attribute
  multiple?: boolean;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  eta: number;
  stage: 'uploading' | 'validating' | 'processing' | 'completed' | 'error';
  message?: string;
  timestamp?: number;
}

export interface UploadResult {
  fileId: string;
  originalName: string;
  savedPath: string;
  size: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
  processingResult?: Record<string, unknown>;
  uploadTime: number;
}

export interface UploadResponse {
  success: boolean;
  data?: {
    upload: UploadResult;
    networks?: Record<string, unknown>[];
    handshakes?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    dictionary?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    fileType?: string;
    fileId: string;
    progressUrl: string;
    isLargeFile?: boolean;
    processingTime?: number;
    detectedType?: string;
    originalType?: string;
  };
  error?: string;
  message?: string;
}

export interface FileUploadState {
  files: File[];
  uploads: Array<{
    file: File;
    fileId?: string;
    progress?: UploadProgress;
    result?: UploadResponse;
    error?: string;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  }>;
  isDragOver: boolean;
  isUploading: boolean;
  overallProgress: number;
}

export interface UploadItem {
  file: File;
  fileId?: string;
  progress?: UploadProgress;
  result?: UploadResponse;
  error?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
}

export interface UseFileUploadOptions {
  type: UploadType;
  multiple?: boolean;
  onProgress?: (fileId: string, progress: UploadProgress) => void;
  onComplete?: (fileId: string, result: UploadResponse) => void;
  onError?: (fileId: string, error: string) => void;
  onSuccess?: (fileId: string, result: UploadResponse) => void;
  onUploadStart?: (files: File[]) => void;
  onFileSelect?: (files: File[]) => void;
  maxFiles?: number;
}

export interface FileUploadProps {
  type: UploadType;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
  onFileSelect?: (files: File[]) => void;
  onUploadStart?: (files: File[]) => void;
  onUploadComplete?: (results: UploadResponse[]) => void;
  onUploadError?: (error: string) => void;
  children?: React.ReactNode;
}

export interface UploadProgressProps {
  progress: UploadProgress;
  fileName?: string;
  showDetails?: boolean;
  className?: string;
  onCancel?: () => void;
}

// Upload configurations for different types
export const UPLOAD_CONFIGS: Record<UploadType, UploadConfig> = {
  pcap: {
    type: 'pcap',
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['.pcap', '.cap', '.pcapng'],
    accept: '.pcap,.cap,.pcapng',
    multiple: true
  },
  dictionary: {
    type: 'dictionary',
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    allowedExtensions: ['.txt', '.lst', '.dic', '.gz', '.bz2', '.zip'],
    accept: '.txt,.lst,.dic,.gz,.bz2,.zip',
    multiple: true
  }
};

// Helper functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s';
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

export function validateFile(file: File, config: UploadConfig): { valid: boolean; error?: string } {
  // Check file extension
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed extensions: ${config.allowedExtensions.join(', ')}`
    };
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxSizeMB = config.maxSize < 1024 * 1024 * 1024
      ? `${(config.maxSize / 1024 / 1024).toFixed(1)}MB`
      : `${(config.maxSize / 1024 / 1024 / 1024).toFixed(1)}GB`;

    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}`
    };
  }

  return { valid: true };
}

export function getUploadEndpoint(type: UploadType): string {
  return `/api/upload/${type}`;
}