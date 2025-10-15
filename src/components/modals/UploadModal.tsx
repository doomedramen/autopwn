'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileUpload, UploadProgressList } from '@/components/upload';
import {
  UploadType,
  UploadResponse,
  FileUploadState,
} from '@/components/upload/types';
import {
  Upload as UploadIcon,
  Wifi,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';

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
    overallProgress: 0,
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
    const successfulUploads = results.filter(r => r.success);
    const failedUploads = results.filter(r => !r.success);

    setUploadState(prev => ({
      ...prev,
      uploads: prev.uploads.map(upload => {
        const result = results.find(r => r.data?.fileId === upload.fileId);
        if (result) {
          return {
            ...upload,
            result,
            status: result.success ? 'completed' : 'error',
          };
        }
        return upload;
      }),
    }));

    // Show appropriate toast notifications
    if (successfulUploads.length > 0) {
      if (activeTab === 'pcap') {
        const totalNetworks = successfulUploads.reduce((sum, result) => {
          const networks =
            (result.data?.networks as Array<{ hasHandshake: boolean }>) || [];
          return sum + networks.length;
        }, 0);
        const networksWithHandshakes = successfulUploads.reduce(
          (sum, result) => {
            const networks =
              (result.data?.networks as Array<{ hasHandshake: boolean }>) || [];
            return sum + networks.filter(n => n.hasHandshake).length;
          },
          0
        );

        if (networksWithHandshakes > 0) {
          toast.success(
            `✅ Successfully uploaded ${successfulUploads.length} PCAP file(s) with ${networksWithHandshakes} WiFi handshakes found!`
          );
        } else if (totalNetworks > 0) {
          toast.warning(
            `📡 Uploaded ${successfulUploads.length} PCAP file(s) with ${totalNetworks} networks found, but no handshakes. Handshakes are required for password cracking.`
          );
        } else {
          toast.error(
            `❌ No WiFi networks found in the uploaded PCAP file(s). Please check that the files contain valid WiFi captures.`
          );
        }
      } else if (activeTab === 'dictionary') {
        const totalLines = successfulUploads.reduce((sum, result) => {
          const metadata =
            (result.data?.dictionary as { lineCount?: number }) || {};
          return sum + (metadata.lineCount || 0);
        }, 0);

        if (totalLines > 0) {
          toast.success(
            `📚 Successfully uploaded ${successfulUploads.length} dictionary file(s) with ${totalLines.toLocaleString()} passwords!`
          );
        } else {
          toast.success(
            `✅ Successfully uploaded ${successfulUploads.length} dictionary file(s)!`
          );
        }
      }
    }

    if (failedUploads.length > 0) {
      const errors = failedUploads
        .map(r => r.error || r.message || 'Unknown error')
        .filter(Boolean);
      if (errors.length > 0) {
        toast.error(
          `❌ ${failedUploads.length} file(s) failed to upload: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? ` and ${errors.length - 2} more` : ''}`
        );
      }
    }

    // Call completion callback
    onComplete?.(activeTab, results);

    // Auto-close modal after successful uploads
    if (successfulUploads.length > 0 && failedUploads.length === 0) {
      setTimeout(() => {
        handleClose();
      }, 2000); // Close after 2 seconds
    }
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);

    // Show error toast notification
    toast.error(`❌ Upload failed: ${error}`);
  };

  const handleClose = () => {
    setShowProgress(false);
    setUploadState({
      files: [],
      uploads: [],
      isDragOver: false,
      isUploading: false,
      overallProgress: 0,
    });
    onClose();
  };

  const clearUploads = () => {
    setUploadState({
      files: [],
      uploads: [],
      isDragOver: false,
      isUploading: false,
      overallProgress: 0,
    });
    setShowProgress(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in"
        onPointerDownOutside={e => {
          e.preventDefault();
          handleClose();
        }}
        onEscapeKeyDown={e => {
          e.preventDefault();
          handleClose();
        }}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center space-x-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <UploadIcon className="h-5 w-5 text-primary" />
            </div>
            <span>Upload Files</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            Upload PCAP files for network analysis or dictionary files for
            password cracking.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as UploadType)}
          className="space-y-6"
        >
          <TabsList className="flex w-full h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="pcap"
              className="flex-1 flex items-center justify-center space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift"
            >
              <Wifi className="h-4 w-4" />
              <span className="font-medium">PCAP Files</span>
            </TabsTrigger>
            <TabsTrigger
              value="dictionary"
              className="flex-1 flex items-center justify-center space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift"
            >
              <FileText className="h-4 w-4" />
              <span className="font-medium">Dictionaries</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pcap" className="space-y-6 animate-slide-up">
            <Card className="bg-background">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-full group-hover:scale-110 transition-transform">
                    <Wifi className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <CardTitle className="text-xl flex items-center justify-center space-x-2">
                  <span>Network Capture Files</span>
                </CardTitle>
                <CardDescription className="text-base max-w-md mx-auto">
                  Upload PCAP files containing WiFi network captures for
                  analysis. Files will be automatically processed to extract
                  networks and handshakes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileUpload
                  type="pcap"
                  multiple={true}
                  onFileSelect={handleFileSelect}
                  onUploadStart={handleUploadStart}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                >
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="p-6 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                        <UploadIcon className="h-12 w-12 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                      Drop PCAP files here
                    </h3>
                    <p className="text-muted-foreground">
                      Drag and drop files, or click to browse
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        .pcap, .cap, .pcapng
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Max 50MB per file
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        WiFi handshakes required
                      </span>
                    </div>
                  </div>
                </FileUpload>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="dictionary"
            className="space-y-6 animate-slide-up"
          >
            <Card className="bg-background">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-full group-hover:scale-110 transition-transform">
                    <FileText className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>
                <CardTitle className="text-xl flex items-center justify-center space-x-2">
                  <span>Password Dictionaries</span>
                </CardTitle>
                <CardDescription className="text-base max-w-md mx-auto">
                  Upload password dictionaries for cracking WiFi passwords.
                  Large files will be processed in the background and compressed
                  files are supported.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileUpload
                  type="dictionary"
                  multiple={true}
                  onFileSelect={handleFileSelect}
                  onUploadStart={handleUploadStart}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                >
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="p-6 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                        <UploadIcon className="h-12 w-12 text-emerald-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                      Drop dictionary files here
                    </h3>
                    <p className="text-muted-foreground">
                      Drag and drop files, or click to browse
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        .txt, .lst, .dic, .gz, .bz2, .zip
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Max 5GB per file
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Compression supported
                      </span>
                    </div>
                  </div>
                </FileUpload>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upload Progress */}
        {showProgress && uploadState.uploads.length > 0 && (
          <Card className="border-2 animate-slide-up">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <div className="p-1.5 rounded bg-blue-500/10">
                    <UploadIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-base font-semibold">
                    Upload Progress
                  </span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearUploads}
                  className="hover-lift"
                >
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <UploadProgressList
                uploads={uploadState.uploads}
                showDetails={true}
              />
            </CardContent>
          </Card>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="hover-lift"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
