"use client";

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { getApiUrl } from '@/lib/runtime-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Trash2, FileText, Plus, AlertCircle, Rocket } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import ChunkedFileUpload from '@/components/ChunkedFileUpload';

interface Dictionary {
  id: number;
  name: string;
  size: number;
  path?: string;
}

export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadEndpoint, setUploadEndpoint] = useState<string>('');

  const [newDictName, setNewDictName] = useState('');
  const [newDictContent, setNewDictContent] = useState('');

  // Define hashcat-compatible dictionary file types
  const dictionaryFileTypes = [
    '.txt', '.dict', '.wordlist', '.rule', '.rule2', '.hcchr2', '.hcmask', '.hcmask2',
    '.gz', '.bz2', '.zip', '.7z', '.rar', '.cap', '.hccapx', '.pcapng', '.16800', '.22000',
    '.pmkid', '.ehc', '.john', '.pot', '.log', '.out', '.diz', '.list'
  ];

  useEffect(() => {
    fetchDictionaries();

    // Load upload endpoint at runtime
    getApiUrl().then(apiUrl => {
      setUploadEndpoint(`${apiUrl}/api/dictionaries`);
    });
  }, []);

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
    } catch (error) {
      console.error('Failed to delete dictionary:', error);
      setError('Failed to delete dictionary');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dictionary Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your password dictionaries for WiFi cracking
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
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

          {uploadEndpoint && (
            <ChunkedFileUpload
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
              onUploadComplete={() => {
                fetchDictionaries();
                setSuccess('Dictionary uploaded successfully');
              }}
              uploadEndpoint={uploadEndpoint}
              title="Upload Dictionaries"
              description="Upload large dictionary files with chunked, resumable uploads. Supports all hashcat-compatible formats including compressed files up to 5GB."
              allowedFileTypes={dictionaryFileTypes}
              maxFileSize={5 * 1024 * 1024 * 1024} // 5GB
              note={`Hashcat-compatible dictionaries up to 5GB. Formats: ${dictionaryFileTypes.join(', ')}`}
              dropText="Drop dictionary files here or click to browse"
            />
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Dictionaries</CardTitle>
          <CardDescription>
            Total dictionaries: {dictionaries.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Dictionary
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {dictionaries.map((dict) => (
                <div
                  key={dict.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <h4 className="font-medium">{dict.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(dict.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
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
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}