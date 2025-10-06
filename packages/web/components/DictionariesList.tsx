'use client';

import { useEffect, useState, useRef } from 'react';
import { Dictionary } from '@autopwn/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function DictionariesList() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDictionaries = async () => {
      const res = await fetch('/api/dictionaries');
      const data = await res.json();
      setDictionaries(data);
    };

    fetchDictionaries();
    const interval = setInterval(fetchDictionaries, 10000);
    return () => clearInterval(interval);
  }, []);

  const uploadLargeFile = async (file: File) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setUploadingFileName(file.name);
    console.log(`[Upload] Starting chunked upload: ${file.name} (${file.size} bytes, ${totalChunks} chunks)`);

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', file.name);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());

        const response = await fetch('/api/dictionaries/upload-chunk', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Chunk upload failed');
        }

        // Update progress
        const progress = ((chunkIndex + 1) / totalChunks) * 100;
        setUploadProgress(progress);
        console.log(`[Upload] Progress: ${progress.toFixed(1)}% (chunk ${chunkIndex + 1}/${totalChunks})`);
      }

      return { success: true };
    } catch (error) {
      // Cleanup incomplete upload
      await fetch(`/api/dictionaries/upload-chunk?filename=${encodeURIComponent(file.name)}`, {
        method: 'DELETE',
      });
      throw error;
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (const file of Array.from(files)) {
        try {
          setUploadingFileName(file.name);

          // Use chunked upload for large files
          if (file.size > LARGE_FILE_THRESHOLD) {
            console.log(`[Upload] Large file detected (${(file.size / 1024 / 1024).toFixed(2)}MB), using chunked upload`);
            await uploadLargeFile(file);
            successCount++;
          } else {
            // Use regular FormData upload for small files
            const formData = new FormData();
            formData.append('files', file);

            const response = await fetch('/api/dictionaries/upload', {
              method: 'POST',
              body: formData,
            });

            const result = await response.json();

            if (result.success) {
              successCount++;
            } else {
              errorCount++;
              errors.push(...(result.errors?.map((e: any) => e.error) || ['Upload failed']));
            }
          }
        } catch (error) {
          errorCount++;
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
        }
      }

      // Show results
      if (successCount > 0) {
        setUploadMessage({
          type: errorCount > 0 ? 'error' : 'success',
          text: `Successfully uploaded ${successCount} file(s)${errorCount > 0 ? `. ${errorCount} failed: ${errors.join(', ')}` : ''}`,
        });

        // Refresh dictionary list
        const dictRes = await fetch('/api/dictionaries');
        const dictData = await dictRes.json();
        setDictionaries(dictData);
      } else {
        setUploadMessage({
          type: 'error',
          text: `All uploads failed: ${errors.join(', ')}`,
        });
      }
    } catch (error) {
      setUploadMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Dictionaries</CardTitle>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="sm"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden file input */}
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.dic,.lst,.gz,.bz2,.lzma,.xz,.7z,.zip"
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />

        {/* Upload progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate max-w-[70%]">
                Uploading: {uploadingFileName}
              </span>
              <span className="text-muted-foreground font-mono">
                {uploadProgress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload message */}
        {uploadMessage && !uploading && (
          <div className={cn(
            "p-3 rounded text-sm",
            uploadMessage.type === 'success'
              ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          )}>
            {uploadMessage.text}
          </div>
        )}

        {/* Drag and drop area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/10"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          <p className="text-muted-foreground text-sm">
            Drag & drop dictionary files here, or click Upload
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Supported: .txt, .gz, .bz2, .xz, .7z, .zip
          </p>
        </div>

        {/* Dictionary list */}
        <div className="space-y-2">
          {dictionaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No dictionaries found. Upload dictionaries or generate custom wordlists.
            </p>
          ) : (
            dictionaries.map((dict) => (
              <div
                key={dict.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="font-mono text-sm">{dict.name}</span>
                </div>
                <span className="text-muted-foreground text-sm">{formatFileSize(dict.size)}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
