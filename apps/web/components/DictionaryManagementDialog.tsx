"use client";

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Trash2, FileText, Plus, AlertCircle, BookOpen } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface Dictionary {
  id: number;
  name: string;
  size: number;
  path?: string;
}

interface DictionaryManagementDialogProps {
  children: React.ReactNode;
  onDictionaryChange?: () => void;
}

export function DictionaryManagementDialog({ children, onDictionaryChange }: DictionaryManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newDictName, setNewDictName] = useState('');
  const [newDictContent, setNewDictContent] = useState('');

  useEffect(() => {
    if (open) {
      fetchDictionaries();
    }
  }, [open]);

  const fetchDictionaries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDictionaries();
      setDictionaries(data as Dictionary[]);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dictionaries:', error);
      setError('Failed to load dictionaries');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiClient.uploadDictionaries(files);
      setSuccess(`Successfully uploaded ${(result as any).dictionaries.length} dictionary(ies)`);
      await fetchDictionaries();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onDictionaryChange?.();
    } catch (error) {
      console.error('Failed to upload dictionaries:', error);
      setError('Failed to upload dictionaries');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDictionary = async () => {
    if (!newDictName.trim() || !newDictContent.trim()) {
      setError('Name and content are required');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.createSimpleDictionary(newDictName.trim(), newDictContent.trim());
      setSuccess('Dictionary created successfully');
      await fetchDictionaries();
      setCreateDialogOpen(false);
      setNewDictName('');
      setNewDictContent('');
      onDictionaryChange?.();
    } catch (error) {
      console.error('Failed to create dictionary:', error);
      setError('Failed to create dictionary');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDictionary = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setDeleting(id);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.deleteDictionary(id);
      setSuccess('Dictionary deleted successfully');
      await fetchDictionaries();
      onDictionaryChange?.();
    } catch (error) {
      console.error('Failed to delete dictionary:', error);
      setError('Failed to delete dictionary');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Dictionary Management
          </DialogTitle>
          <DialogDescription>
            Upload, create, and manage your password dictionaries for WiFi cracking.
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
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Dictionary
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Dictionary</DialogTitle>
                  <DialogDescription>
                    Create a simple dictionary by entering words manually.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dict-name">Dictionary Name</Label>
                    <Input
                      id="dict-name"
                      placeholder="e.g., custom_passwords"
                      value={newDictName}
                      onChange={(e) => setNewDictName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dict-content">Content (one password per line)</Label>
                    <textarea
                      id="dict-content"
                      className="w-full h-32 px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none rounded-md"
                      placeholder="password123&#10;admin123&#10;123456&#10;..."
                      value={newDictContent}
                      onChange={(e) => setNewDictContent(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false);
                        setNewDictName('');
                        setNewDictContent('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateDictionary}
                      disabled={uploading || !newDictName.trim() || !newDictContent.trim()}
                    >
                      {uploading ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex-1">
              <Input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".txt,.dict,.wordlist"
                onChange={handleFileUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Total dictionaries: {dictionaries.length} | Supported formats: .txt, .dict, .wordlist
          </div>

          <ScrollArea className="h-[300px] border rounded-lg p-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading dictionaries...
              </div>
            ) : dictionaries.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No dictionaries yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload dictionary files or create a custom dictionary to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dictionaries.map((dict) => (
                  <div
                    key={dict.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate">{dict.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(dict.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Badge variant="secondary">Dictionary</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDictionary(dict.id, dict.name)}
                        disabled={deleting === dict.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleting === dict.id ? (
                          "Deleting..."
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}