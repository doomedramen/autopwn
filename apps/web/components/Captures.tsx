'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Play, Clock } from 'lucide-react';
import { CreateJobModal } from './CreateJobModal';

interface CaptureFile {
  filename: string;
  size: number;
  uploaded_at: string;
  essids: string[];
  bssids: string[];
}

export default function Captures() {
  const [captures, setCaptures] = useState<CaptureFile[]>([]);
  const [selectedCaptures, setSelectedCaptures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCaptures = async () => {
    try {
      const response = await fetch('/api/captures');
      if (response.ok) {
        const data = await response.json();
        setCaptures(data.captures || []);
      }
    } catch (error) {
      console.error('Failed to fetch captures:', error);
      setCaptures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptures();
    const interval = setInterval(fetchCaptures, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleSelectCapture = (filename: string, checked: boolean) => {
    if (checked) {
      setSelectedCaptures(prev => [...prev, filename]);
    } else {
      setSelectedCaptures(prev => prev.filter(f => f !== filename));
    }
  };

  const handleDeleteCapture = async (filename: string) => {
    try {
      const response = await fetch(`/api/captures?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1); // Force refresh
      }
    } catch (error) {
      console.error('Failed to delete capture:', error);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCaptures(captures.map(c => c.filename));
    } else {
      setSelectedCaptures([]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Captures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading captures...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="max-h-[1024px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Captures ({captures.length})</span>
            <div className="flex items-center gap-2">
              {selectedCaptures.length > 0 && (
                <Button
                  onClick={() => setShowCreateJobModal(true)}
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Create Job ({selectedCaptures.length})
                </Button>
              )}
              <Button
                onClick={() => setRefreshKey(prev => prev + 1)}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {captures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="mb-4">
                <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
              </div>
              <p>No captures uploaded yet</p>
              <p className="text-sm">Upload .pcap files to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {captures.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedCaptures.length === captures.length && captures.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    Select All ({selectedCaptures.length}/{captures.length})
                  </label>
                </div>
              )}

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-4">
                  {captures.map((capture) => (
                  <div
                    key={capture.filename}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      selectedCaptures.includes(capture.filename)
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedCaptures.includes(capture.filename)}
                        onCheckedChange={(checked) => handleSelectCapture(capture.filename, checked as boolean)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={capture.filename}>
                          {capture.filename}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(capture.size)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(capture.uploaded_at)}
                          </span>
                        </div>
                        {(capture.essids && capture.essids.length > 0) || (capture.bssids && capture.bssids.length > 0) ? (
                          <div className="mt-2 space-y-1">
                            {capture.essids && capture.essids.length > 0 && (
                              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                                <span className="font-medium">ESSID:</span> {capture.essids.join(', ') || 'Hidden'}
                              </div>
                            )}
                            {capture.bssids && capture.bssids.length > 0 && (
                              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                                <span className="font-medium">BSSID:</span> {capture.bssids.join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground italic">
                            No network information available
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteCapture(capture.filename)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateJobModal
        open={showCreateJobModal}
        onOpenChange={setShowCreateJobModal}
        selectedCaptures={selectedCaptures}
        onSuccess={() => {
          setShowCreateJobModal(false);
          setSelectedCaptures([]);
          setRefreshKey(prev => prev + 1);
        }}
      />
    </>
  );
}