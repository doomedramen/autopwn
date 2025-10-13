'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload, UploadProgressList } from '@/components/upload';
import { UploadType, UploadResponse, FileUploadState } from '@/components/upload/types';
import { Upload as UploadIcon, Wifi, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (type: UploadType, results: UploadResponse[]) => void;
}

export function UploadModal({ isOpen, onClose, onComplete }: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<UploadType>('pcap');
  const [uploadState, setUploadState] = useState<FileUploadState>({
    files: [],
    uploads: [],
    isDragOver: false,
    isUploading: false,
    overallProgress: 0
  });
  const [showProgress, setShowProgress] = useState(false);

  const handleFileSelect = () => {
    // Files are automatically uploaded by FileUpload component
  };

  const handleUploadStart = () => {
    setShowProgress(true);
  };

  const handleUploadComplete = (results: UploadResponse[]) => {
    // Update the upload state to reflect completion
    setUploadState(prev => ({
      ...prev,
      uploads: prev.uploads.map(upload => {
        const result = results.find(r => r.data?.fileId === upload.fileId);
        if (result) {
          return {
            ...upload,
            result,
            status: result.success ? 'completed' : 'error'
          };
        }
        return upload;
      })
    }));
    onComplete?.(activeTab, results);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  const handleClose = () => {
    setShowProgress(false);
    setUploadState({
      files: [],
      uploads: [],
      isDragOver: false,
      isUploading: false,
      overallProgress: 0
    });
    onClose();
  };

  const clearUploads = () => {
    setUploadState({
      files: [],
      uploads: [],
      isDragOver: false,
      isUploading: false,
      overallProgress: 0
    });
    setShowProgress(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UploadIcon className="h-5 w-5" />
            <span>Upload Files</span>
          </DialogTitle>
          <DialogDescription>
            Upload PCAP files for network analysis or dictionary files for password cracking.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UploadType)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pcap" className="flex items-center space-x-2">
              <Wifi className="h-4 w-4" />
              <span>PCAP Files</span>
            </TabsTrigger>
            <TabsTrigger value="dictionary" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Dictionaries</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pcap" className="space-y-6">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-blue-500" />
                  <span>Network Capture Files</span>
                </CardTitle>
                <CardDescription>
                  Upload PCAP files containing WiFi network captures for analysis. Files will be automatically
                  processed to extract networks and handshakes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUpload
                  type="pcap"
                  multiple={true}
                  onFileSelect={handleFileSelect}
                  onUploadStart={handleUploadStart}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                >
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-full">
                          <UploadIcon className="h-8 w-8 text-blue-500" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold">Drop PCAP files here</h3>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop files, or click to browse
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>.pcap, .cap, .pcapng</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <Info className="h-4 w-4 text-blue-500" />
                        <span>Max 50MB per file</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span>WiFi handshakes required</span>
                      </div>
                    </div>
                  </div>
                </FileUpload>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dictionary" className="space-y-6">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  <span>Password Dictionaries</span>
                </CardTitle>
                <CardDescription>
                  Upload password dictionaries for cracking WiFi passwords. Large files will be processed
                  in the background and compressed files are supported.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUpload
                  type="dictionary"
                  multiple={true}
                  onFileSelect={handleFileSelect}
                  onUploadStart={handleUploadStart}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                >
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-full">
                          <UploadIcon className="h-8 w-8 text-green-500" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold">Drop dictionary files here</h3>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop files, or click to browse
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>.txt, .lst, .dic, .gz, .bz2, .zip</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <Info className="h-4 w-4 text-blue-500" />
                        <span>Max 5GB per file</span>
                      </div>
                      <div className="flex items-center space-x-2 p-2 bg-muted rounded">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span>Compression supported</span>
                      </div>
                    </div>
                  </div>
                </FileUpload>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upload Progress */}
        {showProgress && uploadState.uploads.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Upload Progress</CardTitle>
                <Button variant="outline" size="sm" onClick={clearUploads}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <UploadProgressList uploads={uploadState.uploads} showDetails={true} />
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}