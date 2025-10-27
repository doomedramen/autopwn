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
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import { useNetworks, useDictionaries } from '@/lib/api-hooks';
import { Package, Plus, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface CreateJobModalProps {
  children: React.ReactNode;
}

export function CreateJobModal({ children }: CreateJobModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [attackMode, setAttackMode] = useState('');
  const [hashType, setHashType] = useState('22000');
  const [workloadProfile, setWorkloadProfile] = useState('2');
  const [runtimeLimit, setRuntimeLimit] = useState('');
  const [optimizedKernels, setOptimizedKernels] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { data: networksData } = useNetworks();
  const { data: dictionariesData } = useDictionaries();

  const networks = networksData?.data || [];
  const dictionaries = dictionariesData?.data || [];

  const generateDefaultJobName = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const networkNames = selectedNetworks
      .map(id => networks.find(n => n.id === id)?.ssid || '<Hidden>')
      .slice(0, 2)
      .join('-');
    const dictNames = selectedDictionaries
      .map(id => dictionaries.find(d => d.id === id)?.name)
      .slice(0, 1)
      .join('-');

    if (networkNames && dictNames) {
      return `${networkNames}_${dictNames}_${timestamp}`;
    } else if (networkNames) {
      return `${networkNames}_job_${timestamp}`;
    } else {
      return `cracking_job_${timestamp}`;
    }
  };

  
  const handleNetworkToggle = (networkId: string, checked: boolean) => {
    const newSelectedNetworks = checked
      ? [...selectedNetworks, networkId]
      : selectedNetworks.filter(id => id !== networkId);

    setSelectedNetworks(newSelectedNetworks);

    // Auto-generate job name if user hasn't entered one yet
    if (!name.trim()) {
      setName(generateDefaultJobName());
    }
  };

  const handleDictionaryToggle = (dictionaryId: string, checked: boolean) => {
    const newSelectedDictionaries = checked
      ? [...selectedDictionaries, dictionaryId]
      : selectedDictionaries.filter(id => id !== dictionaryId);

    setSelectedDictionaries(newSelectedDictionaries);

    // Auto-generate job name if user hasn't entered one yet
    if (!name.trim()) {
      setName(generateDefaultJobName());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !attackMode || !hashType || !workloadProfile || selectedNetworks.length === 0 || selectedDictionaries.length === 0) {
      return;
    }

    setIsCreating(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    const jobData = {
      name,
      attackMode,
      hashType,
      workloadProfile,
      runtimeLimit: runtimeLimit || null,
      optimizedKernels,
      networks: selectedNetworks,
      dictionaries: selectedDictionaries,
    };

    // Reset form
    setName('');
    setAttackMode('');
    setHashType('22000');
    setWorkloadProfile('2');
    setRuntimeLimit('');
    setOptimizedKernels(false);
    setSelectedNetworks([]);
    setSelectedDictionaries([]);
    setOpen(false);
    setIsCreating(false);
  };

  const isValid = name && attackMode && hashType && workloadProfile && selectedNetworks.length > 0 && selectedDictionaries.length > 0;

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
              Configure a new password cracking job by selecting networks, dictionaries, and attack parameters.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="flex-1 py-4">
            <ScrollArea className="h-[400px] w-full rounded-md border">
              <div className="p-4">
                <div className="grid gap-6">
              {/* Basic Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold font-mono uppercase text-muted-foreground">Basic Configuration</h3>

                {/* Job Name */}
                <div className="grid gap-2">
                  <Label htmlFor="name" className="font-mono text-sm">Job Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter custom name or use auto-generated"
                    className="font-mono"
                    autoComplete="off"
                    required
                  />
                </div>

                {/* Networks Selection */}
                <div className="grid gap-2">
                  <Label className="font-mono text-sm">Networks ({selectedNetworks.length} selected)</Label>
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                    {networks.length === 0 ? (
                      <p className="text-sm text-muted-foreground font-mono">No networks available</p>
                    ) : (
                      <div className="space-y-2">
                        {networks.map((network) => (
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
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                    {dictionaries.length === 0 ? (
                      <p className="text-sm text-muted-foreground font-mono">No dictionaries available</p>
                    ) : (
                      <div className="space-y-2">
                        {dictionaries.map((dictionary) => (
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
              </div>

              {/* Advanced Options */}
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-semibold font-mono uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Advanced Options
                    {isAdvancedOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-4 mt-4">
                  <div className="border-t pt-4 space-y-4">
                    {/* Attack Mode */}
                    <div className="grid gap-2">
                      <Label className="font-mono text-sm">Attack Mode</Label>
                      <Select value={attackMode} onValueChange={setAttackMode} required>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select attack mode..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="straight" className="font-mono">Straight</SelectItem>
                          <SelectItem value="combination" className="font-mono">Combination</SelectItem>
                          <SelectItem value="brute-force" className="font-mono">Brute Force</SelectItem>
                          <SelectItem value="mask" className="font-mono">Mask</SelectItem>
                          <SelectItem value="hybrid" className="font-mono">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Hash Type */}
                    <div className="grid gap-2">
                      <Label className="font-mono text-sm">Hash Type</Label>
                      <Select value={hashType} onValueChange={setHashType} required>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select hash type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="22000" className="font-mono">22000 - PMKID/EAPOL</SelectItem>
                          <SelectItem value="2500" className="font-mono">2500 - WPA/WPA2-EAPOL</SelectItem>
                          <SelectItem value="2501" className="font-mono">2501 - WPA/WPA2-PMKID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Workload Profile */}
                    <div className="grid gap-2">
                      <Label className="font-mono text-sm">Workload Profile</Label>
                      <Select value={workloadProfile} onValueChange={setWorkloadProfile} required>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select workload profile..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1" className="font-mono">1 - Low (Minimal impact, slower)</SelectItem>
                          <SelectItem value="2" className="font-mono">2 - Default (Balanced)</SelectItem>
                          <SelectItem value="3" className="font-mono">3 - High (Maximum performance)</SelectItem>
                          <SelectItem value="4" className="font-mono">4 - Nightmare (Insane performance, headless)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Runtime Limit */}
                    <div className="grid gap-2">
                      <Label htmlFor="runtimeLimit" className="font-mono text-sm">Runtime Limit (seconds, optional)</Label>
                      <Input
                        id="runtimeLimit"
                        type="number"
                        value={runtimeLimit}
                        onChange={(e) => setRuntimeLimit(e.target.value)}
                        placeholder="Leave empty for unlimited..."
                        className="font-mono"
                        min="1"
                      />
                    </div>

                    {/* Optimized Kernels */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="optimizedKernels"
                        checked={optimizedKernels}
                        onCheckedChange={(checked) => setOptimizedKernels(checked as boolean)}
                      />
                      <Label
                        htmlFor="optimizedKernels"
                        className="text-sm font-mono cursor-pointer"
                      >
                        Enable Optimized Kernels (-O) - Faster but limits password length
                      </Label>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
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
                  Create Job
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}