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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Plus } from 'lucide-react';

interface Dictionary {
  id: number;
  name: string;
  size: number;
}

interface JobCreationDialogProps {
  onJobCreated: () => void;
}

export function JobCreationDialog({ onJobCreated }: JobCreationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDicts, setSelectedDicts] = useState<number[]>([]);
  const [jobData, setJobData] = useState({
    filename: '',
    priority: 0
  });

  useEffect(() => {
    if (open) {
      fetchDictionaries();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobData.filename || selectedDicts.length === 0) {
      return;
    }

    setLoading(true);
    try {
      await apiClient.createJob({
        filename: jobData.filename,
        dictionaryIds: selectedDicts,
        priority: jobData.priority
      });
      onJobCreated();
      setOpen(false);
      // Reset form
      setJobData({ filename: '', priority: 0 });
      setSelectedDicts([]);
    } catch (error) {
      console.error('Failed to create job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDictChange = (dictId: number, checked: boolean) => {
    if (checked) {
      setSelectedDicts([...selectedDicts, dictId]);
    } else {
      setSelectedDicts(selectedDicts.filter(id => id !== dictId));
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
            <Label htmlFor="filename">PCAP Filename</Label>
            <Input
              id="filename"
              placeholder="e.g., captured_handshakes.pcap"
              value={jobData.filename}
              onChange={(e) => setJobData({ ...jobData, filename: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={jobData.priority.toString()}
              onValueChange={(value) => setJobData({ ...jobData, priority: parseInt(value) })}
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
            <Label>Select Dictionaries</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
              {dictionaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dictionaries available</p>
              ) : (
                dictionaries.map((dict) => (
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
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !jobData.filename || selectedDicts.length === 0}
            >
              {loading ? 'Creating...' : 'Create Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}