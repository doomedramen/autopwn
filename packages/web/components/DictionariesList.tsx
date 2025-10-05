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

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('/api/dictionaries/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadMessage({ type: 'success', text: data.message });
        // Refresh dictionary list
        const dictRes = await fetch('/api/dictionaries');
        const dictData = await dictRes.json();
        setDictionaries(dictData);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (error) {
      setUploadMessage({ type: 'error', text: 'Failed to upload dictionaries' });
    } finally {
      setUploading(false);
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

        {/* Upload message */}
        {uploadMessage && (
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
