'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import { useNetworks, useDictionaries, useStartCrackingJob } from '@/lib/api-hooks';
import { Package, Plus } from 'lucide-react';

interface CreateJobModalProps {
  children: React.ReactNode;
}

export function CreateJobModal({ children }: CreateJobModalProps) {
  const [open, setOpen] = useState(false);
  const [attackMode, setAttackMode] = useState<'pmkid' | 'handshake'>('handshake');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: networksData } = useNetworks();
  const { data: dictionariesData } = useDictionaries();
  const startJob = useStartCrackingJob();

  const networks = networksData?.data || [];
  const dictionaries = dictionariesData?.data || [];

  const handleNetworkToggle = (networkId: string, checked: boolean) => {
    const newSelectedNetworks = checked
      ? [...selectedNetworks, networkId]
      : selectedNetworks.filter(id => id !== networkId);
    setSelectedNetworks(newSelectedNetworks);
    setError(null);
  };

  const handleDictionaryToggle = (dictionaryId: string, checked: boolean) => {
    const newSelectedDictionaries = checked
      ? [...selectedDictionaries, dictionaryId]
      : selectedDictionaries.filter(id => id !== dictionaryId);
    setSelectedDictionaries(newSelectedDictionaries);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedNetworks.length === 0 || selectedDictionaries.length === 0) {
      setError('Please select at least one network and one dictionary.');
      return;
    }

    setIsCreating(true);

    try {
      // Create a single consolidated job with all networks and dictionaries
      // The backend will concatenate dictionaries and combine PCAPs
      await startJob.mutateAsync({
        networkIds: selectedNetworks,
        dictionaryIds: selectedDictionaries,
        attackMode,
      });

      // Reset form and close
      setAttackMode('handshake');
      setSelectedNetworks([]);
      setSelectedDictionaries([]);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsCreating(false);
    }
  };

  const isValid = selectedNetworks.length > 0 && selectedDictionaries.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col" data-testid="create-job-modal">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono uppercase">
              <Package className="h-5 w-5" />
              Create New Job
            </DialogTitle>
            <DialogDescription className="font-mono">
              Select networks and dictionaries to create a consolidated cracking job. All dictionaries will be concatenated into a single wordlist.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="flex-1 py-4">
            <ScrollArea className="h-[400px] w-full rounded-md border">
              <div className="p-4">
                <div className="grid gap-6">
                  {/* Error Message */}
                  {error && (
                    <div className="bg-destructive/15 text-destructive text-sm font-mono p-3 rounded-md border border-destructive/20">
                      {error}
                    </div>
                  )}

                  {/* Attack Mode */}
                  <div className="grid gap-2">
                    <Label className="font-mono text-sm">Attack Mode</Label>
                    <Select value={attackMode} onValueChange={(v) => setAttackMode(v as 'pmkid' | 'handshake')}>
                      <SelectTrigger className="font-mono">
                        <SelectValue placeholder="Select attack mode..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="handshake" className="font-mono">Handshake (EAPOL)</SelectItem>
                        <SelectItem value="pmkid" className="font-mono">PMKID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Networks Selection */}
                  <div className="grid gap-2">
                    <Label className="font-mono text-sm">Networks ({selectedNetworks.length} selected)</Label>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                      {networks.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-mono">No networks available. Upload a PCAP file first.</p>
                      ) : (
                        <div className="space-y-2">
                          {networks.map((network: any) => (
                            <div key={network.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`network-${network.id}`}
                                checked={selectedNetworks.includes(network.id)}
                                onCheckedChange={(checked) => handleNetworkToggle(network.id, checked as boolean)}
                              />
                              <Label
                                htmlFor={`network-${network.id}`}
                                className="text-sm font-mono cursor-pointer flex-1"
                              >
                                {network.ssid || '<Hidden>'} ({network.bssid})
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dictionaries Selection */}
                  <div className="grid gap-2">
                    <Label className="font-mono text-sm">Dictionaries ({selectedDictionaries.length} selected)</Label>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                      {dictionaries.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-mono">No dictionaries available. Upload a dictionary file first.</p>
                      ) : (
                        <div className="space-y-2">
                          {dictionaries.map((dictionary: any) => (
                            <div key={dictionary.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`dictionary-${dictionary.id}`}
                                checked={selectedDictionaries.includes(dictionary.id)}
                                onCheckedChange={(checked) => handleDictionaryToggle(dictionary.id, checked as boolean)}
                              />
                              <Label
                                htmlFor={`dictionary-${dictionary.id}`}
                                className="text-sm font-mono cursor-pointer flex-1"
                              >
                                {dictionary.name} ({dictionary.wordCount?.toLocaleString() || 0} words)
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info message about consolidated job */}
                  {(selectedNetworks.length > 1 || selectedDictionaries.length > 1) && (
                    <p className="text-xs text-muted-foreground font-mono">
                      1 consolidated job will be created with {selectedNetworks.length} network{selectedNetworks.length > 1 ? 's' : ''} and {selectedDictionaries.length} dictionary{selectedDictionaries.length > 1 ? 's' : ''} combined.
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="font-mono"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isCreating}
              className="font-mono"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Consolidated Job
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}