"use client";

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';

interface Dictionary {
  id: number;
  name: string;
  size: number;
}

interface Capture {
  filename: string;
  size: number;
  uploadedAt: string;
}

interface JobCreationDialogProps {
  onJobCreated: () => void;
}

export function JobCreationDialog({ onJobCreated }: JobCreationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selectedDicts, setSelectedDicts] = useState<number[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    if (open) {
      fetchDictionaries();
      fetchCaptures();
    }
  }, [open]);

  const fetchDictionaries = async () => {
    try {
      const data = await apiClient.getDictionaries();
      setDictionaries(data as Dictionary[]);
    } catch (error) {
      console.error('Failed to fetch dictionaries:', error);
    }
  };

  const fetchCaptures = async () => {
    try {
      const data = await apiClient.getCaptures();
      setCaptures(data as Capture[]);
    } catch (error) {
      console.error('Failed to fetch captures:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || selectedDicts.length === 0) {
      return;
    }

    setLoading(true);
    try {
      // Create a job for each selected PCAP file
      await Promise.all(
        selectedFiles.map(filename =>
          apiClient.createJob({
            filename,
            dictionaryIds: selectedDicts,
            priority
          })
        )
      );
      onJobCreated();
      setOpen(false);
      // Reset form
      setSelectedFiles([]);
      setSelectedDicts([]);
      setPriority(0);
    } catch (error) {
      console.error('Failed to create job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (filename: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, filename]);
    } else {
      setSelectedFiles(selectedFiles.filter(f => f !== filename));
    }
  };

  const handleSelectAllFiles = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(captures.map(c => c.filename));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleDictChange = (dictId: number, checked: boolean) => {
    if (checked) {
      setSelectedDicts([...selectedDicts, dictId]);
    } else {
      setSelectedDicts(selectedDicts.filter(id => id !== dictId));
    }
  };

  const handleSelectAllDicts = (checked: boolean) => {
    if (checked) {
      setSelectedDicts(dictionaries.map(d => d.id));
    } else {
      setSelectedDicts([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Cracking Job</DialogTitle>
          <DialogDescription>
            Create a new WiFi handshake cracking job by selecting a PCAP file and dictionaries.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select PCAP Files</Label>
              <span className="text-xs text-muted-foreground">
                {selectedFiles.length} selected
              </span>
            </div>
            <ScrollArea className="border rounded-lg h-48">
              <div className="p-4 space-y-2">
                {captures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No PCAP files available. Upload files first.</p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        id="select-all-files"
                        checked={selectedFiles.length === captures.length && captures.length > 0}
                        onCheckedChange={(checked) => handleSelectAllFiles(checked as boolean)}
                      />
                      <Label
                        htmlFor="select-all-files"
                        className="flex-1 text-sm font-medium cursor-pointer"
                      >
                        Select All
                      </Label>
                    </div>
                    {captures.map((capture) => (
                      <div key={capture.filename} className="flex items-center space-x-2">
                        <Checkbox
                          id={`file-${capture.filename}`}
                          checked={selectedFiles.includes(capture.filename)}
                          onCheckedChange={(checked) =>
                            handleFileChange(capture.filename, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`file-${capture.filename}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {capture.filename}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {(capture.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority.toString()}
              onValueChange={(value) => setPriority(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Normal (0)</SelectItem>
                <SelectItem value="1">High (1)</SelectItem>
                <SelectItem value="2">Urgent (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Dictionaries</Label>
              <span className="text-xs text-muted-foreground">
                {selectedDicts.length} selected
              </span>
            </div>
            <ScrollArea className="border rounded-lg h-48">
              <div className="p-4 space-y-2">
                {dictionaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dictionaries available</p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        id="select-all-dicts"
                        checked={selectedDicts.length === dictionaries.length && dictionaries.length > 0}
                        onCheckedChange={(checked) => handleSelectAllDicts(checked as boolean)}
                      />
                      <Label
                        htmlFor="select-all-dicts"
                        className="flex-1 text-sm font-medium cursor-pointer"
                      >
                        Select All
                      </Label>
                    </div>
                    {dictionaries.map((dict) => (
                      <div key={dict.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dict-${dict.id}`}
                          checked={selectedDicts.includes(dict.id)}
                          onCheckedChange={(checked) =>
                            handleDictChange(dict.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`dict-${dict.id}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {dict.name}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {(dict.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedFiles.length === 0 || selectedDicts.length === 0}
            >
              {loading ? 'Creating...' : `Create ${selectedFiles.length > 1 ? `${selectedFiles.length} Jobs` : 'Job'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}