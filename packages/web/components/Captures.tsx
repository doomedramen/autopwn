'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Play, Clock } from 'lucide-react';
import { CreateJobModal } from './CreateJobModal';

interface CaptureFile {
  name: string;
  size: number;
  uploadedAt: number;
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
        setCaptures(data);
      }
    } catch (error) {
      console.error('Failed to fetch captures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptures();
    const interval = setInterval(fetchCaptures, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [refreshKey]);

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

  const handleSelectCapture = (filename: string, checked: boolean) => {
    if (checked) {
      setSelectedCaptures(prev => [...prev, filename]);
    } else {
      setSelectedCaptures(prev => prev.filter(f => f !== filename));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCaptures(captures.map(c => c.name));
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

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
      <Card>
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
        <CardContent>
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

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {captures.map((capture) => (
                  <div
                    key={capture.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      selectedCaptures.includes(capture.name)
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedCaptures.includes(capture.name)}
                        onCheckedChange={(checked) => handleSelectCapture(capture.name, checked as boolean)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={capture.name}>
                          {capture.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(capture.size)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(capture.uploadedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteCapture(capture.name)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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