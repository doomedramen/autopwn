'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Dictionary {
  id: number;
  name: string;
  size: number;
}

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCaptures: string[];
  onSuccess: () => void;
}

export function CreateJobModal({ open, onOpenChange, selectedCaptures, onSuccess }: CreateJobModalProps) {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<number[]>([]);
  const [jobName, setJobName] = useState('');
  const [loading, setLoading] = useState(false);
  const [dictionariesLoading, setDictionariesLoading] = useState(true);

  useEffect(() => {
    const fetchDictionaries = async () => {
      try {
        const response = await fetch('/api/dictionaries');
        if (response.ok) {
          const data = await response.json();
          setDictionaries(data);
        }
      } catch (error) {
        console.error('Failed to fetch dictionaries:', error);
      } finally {
        setDictionariesLoading(false);
      }
    };

    if (open) {
      fetchDictionaries();
    }
  }, [open]);

  useEffect(() => {
    if (open && selectedCaptures.length > 0) {
      setJobName(`job-${Date.now()}`);
    }
  }, [open, selectedCaptures]);

  const handleCreateJob = async () => {
    if (selectedDictionaries.length === 0) {
      toast.error('Please select at least one dictionary');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          captures: selectedCaptures,
          dictionaryIds: selectedDictionaries,
          name: jobName.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        onSuccess();
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDictionaryToggle = (dictId: number) => {
    setSelectedDictionaries(prev =>
      prev.includes(dictId)
        ? prev.filter(id => id !== dictId)
        : [...prev, dictId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Job Name (optional)</Label>
            <Input
              id="job-name"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="job-timestamp"
            />
          </div>

          {/* Selected Captures */}
          <div className="space-y-2">
            <Label>Selected Captures ({selectedCaptures.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2">
              <div className="space-y-1">
                {selectedCaptures.map((capture) => (
                  <div key={capture} className="flex items-center">
                    <Badge variant="secondary" className="w-full justify-start">
                      {capture}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dictionary Selection */}
          <div className="space-y-2">
            <Label>Select Dictionaries</Label>
            {dictionariesLoading ? (
              <div className="animate-pulse">Loading dictionaries...</div>
            ) : dictionaries.length === 0 ? (
              <p className="text-muted-foreground">No dictionaries available</p>
            ) : (
              <div className="max-h-48 border rounded-md p-2 overflow-y-auto">
                <div className="space-y-2">
                  {dictionaries.map((dict) => (
                    <div key={dict.id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded">
                      <input
                        type="checkbox"
                        id={`dict-${dict.id}`}
                        checked={selectedDictionaries.includes(dict.id)}
                        onChange={() => handleDictionaryToggle(dict.id)}
                        className="rounded"
                      />
                      <label htmlFor={`dict-${dict.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{dict.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(dict.size)}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedDictionaries.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Selected {selectedDictionaries.length} dictionary{selectedDictionaries.length !== 1 ? 'ies' : ''}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateJob}
            disabled={loading || selectedDictionaries.length === 0}
          >
            {loading ? 'Creating...' : `Create Batch Job (${selectedCaptures.length} captures)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}