'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HashcatDeviceInfo } from '@/types';
import { formatFileSize } from '@/lib/utils/file-size';
import { Zap, Wifi, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface NetworkInfo {
  essid: string;
  bssid: string;
  channel?: number;
  encryption?: string;
  hasHandshake: boolean;
}

interface DictionaryInfo {
  id: string;
  name: string;
  lineCount: number;
  size: number;
}

interface JobConfig {
  name: string;
  networks: string[];
  dictionaries: string[];
  options: {
    attackMode: number;
    hashType: number;
    workloadProfile: number;
    gpuTempAbort?: number;
    gpuTempDisable?: boolean;
    optimizedKernelEnable?: boolean;
    potfileDisable?: boolean;
    devices?: number[]; // Device IDs to use
  };
}

interface JobCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  networks: NetworkInfo[];
  dictionaries: DictionaryInfo[];
  onCreateJob?: (jobConfig: JobConfig) => void;
}

export function JobCreationModal({
  isOpen,
  onClose,
  networks,
  dictionaries,
  onCreateJob
}: JobCreationModalProps) {
  const [jobName, setJobName] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>([]);
  const [attackMode, setAttackMode] = useState('0');
  const [workloadProfile, setWorkloadProfile] = useState('1');
  const [gpuTempAbort, setGpuTempAbort] = useState(false);
  const [gpuTempDisable, setGpuTempAbortTemp] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<HashcatDeviceInfo[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // Reset form when modal opens and load devices
  useEffect(() => {
    if (isOpen) {
      // Generate default job name with timestamp
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', '');

      const networkCount = networksWithHandshakes.length;
      const networkLabel = networkCount === 1 ? 'network' : 'networks';
      const defaultName = `Crack ${networkCount} ${networkLabel} - ${timestamp}`;

      setJobName(defaultName);
      setSelectedNetworks([]);
      setSelectedDictionaries([]);
      setAttackMode('0');
      setWorkloadProfile('1');
      setGpuTempAbort(false);
      setGpuTempAbortTemp(false);
      setSelectedDevices([]);

      // Load available devices
      loadAvailableDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load available devices from hashcat via API
  const loadAvailableDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await fetch('/api/hardware/devices');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableDevices(result.data);
        // Auto-select GPU devices if available, otherwise CPU
        const gpuDevices = result.data.filter((d: HashcatDeviceInfo) => d.type === 'gpu');
        const cpuDevices = result.data.filter((d: HashcatDeviceInfo) => d.type === 'cpu');

        if (gpuDevices.length > 0) {
          setSelectedDevices(gpuDevices.map((d: HashcatDeviceInfo) => d.deviceId));
        } else if (cpuDevices.length > 0) {
          setSelectedDevices([cpuDevices[0].deviceId]);
        }
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleCreateJob = () => {
    if (!jobName.trim()) {
      alert('Please enter a job name');
      return;
    }

    if (selectedNetworks.length === 0) {
      alert('Please select at least one network');
      return;
    }

    if (selectedDictionaries.length === 0) {
      alert('Please select at least one dictionary');
      return;
    }

    const jobConfig = {
      name: jobName.trim(),
      networks: selectedNetworks,
      dictionaries: selectedDictionaries,
      options: {
        attackMode: parseInt(attackMode),
        hashType: 2500, // WPA/WPA2
        workloadProfile: parseInt(workloadProfile),
        gpuTempAbort: gpuTempAbort ? 80 : undefined,
        gpuTempDisable: gpuTempDisable,
        optimizedKernelEnable: true,
        potfileDisable: false,
        devices: selectedDevices.length > 0 ? selectedDevices : undefined
      }
    };

    onCreateJob?.(jobConfig);
    onClose();
  };

  const toggleNetwork = (bssid: string) => {
    setSelectedNetworks(prev =>
      prev.includes(bssid)
        ? prev.filter(id => id !== bssid)
        : [...prev, bssid]
    );
  };

  const toggleDictionary = (dictId: string) => {
    setSelectedDictionaries(prev =>
      prev.includes(dictId)
        ? prev.filter(id => id !== dictId)
        : [...prev, dictId]
    );
  };

  const toggleDevice = (deviceId: number) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'gpu':
        return '🎮';
      case 'cpu':
        return '🖥️';
      case 'accelerator':
        return '⚡';
      default:
        return '❓';
    }
  };

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb > 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  };

  const getAttackModeDescription = (mode: string) => {
    switch (mode) {
      case '0': return 'Straight (dictionary attack)';
      case '1': return 'Combination';
      case '3': return 'Brute-force';
      case '6': return 'Hybrid Wordlist + Mask';
      case '7': return 'Hybrid Mask + Wordlist';
      default: return 'Unknown';
    }
  };

  const getWorkloadProfileDescription = (profile: string) => {
    switch (profile) {
      case '1': return 'Desktop (low performance)';
      case '2': return 'Laptop (medium performance)';
      case '3': return 'High Performance Desktop';
      case '4': return 'Fanless/Embedded';
      default: return 'Unknown';
    }
  };

  const networksWithHandshakes = networks.filter(n => n.hasHandshake);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <span>Create Cracking Job</span>
          </DialogTitle>
          <DialogDescription>
            Configure a new password cracking job using uploaded PCAP files and dictionaries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="jobName">Job Name</Label>
              <Input
                id="jobName"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Enter job name..."
              />
            </div>

            <div>
              <Label>Attack Mode</Label>
              <Select value={attackMode} onValueChange={setAttackMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Straight (Dictionary)</SelectItem>
                  <SelectItem value="1">1 - Combination</SelectItem>
                  <SelectItem value="3">3 - Brute-force</SelectItem>
                  <SelectItem value="6">6 - Hybrid Wordlist + Mask</SelectItem>
                  <SelectItem value="7">7 - Hybrid Mask + Wordlist</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {getAttackModeDescription(attackMode)}
              </p>
            </div>

            <div>
              <Label>Workload Profile</Label>
              <Select value={workloadProfile} onValueChange={setWorkloadProfile}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Desktop</SelectItem>
                  <SelectItem value="2">2 - Laptop</SelectItem>
                  <SelectItem value="3">3 - High Performance Desktop</SelectItem>
                  <SelectItem value="4">4 - Fanless/Embedded</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {getWorkloadProfileDescription(workloadProfile)}
              </p>
            </div>

            <div>
              <Label>Hardware Devices</Label>
              {isLoadingDevices ? (
                <div className="text-sm text-muted-foreground mt-2">
                  Loading available devices...
                </div>
              ) : availableDevices.length > 0 ? (
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {availableDevices.map((device) => (
                    <div
                      key={device.deviceId}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleDevice(device.deviceId)}
                    >
                      <Checkbox
                        checked={selectedDevices.includes(device.deviceId)}
                        onCheckedChange={() => toggleDevice(device.deviceId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="text-lg">{getDeviceIcon(device.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {device.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {device.type.toUpperCase()} • ID: {device.deviceId} • {formatMemory(device.memory)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-red-500 mt-2">
                  No hashcat-compatible devices found. Make sure hashcat is properly installed.
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Select which hardware devices to use for cracking. GPU devices are recommended for best performance.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Advanced Options</h4>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gpuTempAbort"
                  checked={gpuTempAbort}
                  onCheckedChange={(checked) => setGpuTempAbort(checked === true)}
                />
                <Label htmlFor="gpuTempAbort" className="text-sm">
                  Stop if GPU temperature exceeds 80°C
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gpuTempDisable"
                  checked={gpuTempDisable}
                  onCheckedChange={(checked) => setGpuTempAbortTemp(checked === true)}
                />
                <Label htmlFor="gpuTempDisable" className="text-sm">
                  Disable GPU temperature monitoring
                </Label>
              </div>
            </div>
          </div>

          {/* Network Selection */}
          <Card className="transition-all hover:shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <Wifi className="h-4 w-4 text-blue-500" />
                <span>Select Networks</span>
                {selectedNetworks.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedNetworks.length} selected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Choose networks with handshakes to crack
                {networksWithHandshakes.length === 0 && (
                  <div className="flex items-center space-x-1 text-red-500 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>No networks with handshakes available. Upload PCAP files first.</span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto">
              {networksWithHandshakes.length > 0 ? (
                <div className="space-y-2">
                  {networksWithHandshakes.map((network) => (
                    <div
                      key={network.bssid}
                      className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedNetworks.includes(network.bssid)
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => toggleNetwork(network.bssid)}
                    >
                      <Checkbox
                        checked={selectedNetworks.includes(network.bssid)}
                        onCheckedChange={() => toggleNetwork(network.bssid)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium truncate">
                            {network.essid || 'Unknown Network'}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {network.encryption}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {network.bssid} • Channel {network.channel} • {network.encryption}
                        </p>
                      </div>
                      {selectedNetworks.includes(network.bssid) && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Wifi className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No networks with handshakes available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dictionary Selection */}
          <Card className="transition-all hover:shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-sm">
                <FileText className="h-4 w-4 text-green-500" />
                <span>Select Dictionaries</span>
                {selectedDictionaries.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedDictionaries.length} selected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Choose password dictionaries to use
                {dictionaries.length === 0 && (
                  <div className="flex items-center space-x-1 text-red-500 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>No dictionaries available. Upload dictionary files first.</span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto">
              {dictionaries.length > 0 ? (
                <div className="space-y-2">
                  {dictionaries.map((dictionary) => (
                    <div
                      key={dictionary.id}
                      className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDictionaries.includes(dictionary.id)
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => toggleDictionary(dictionary.id)}
                    >
                      <Checkbox
                        checked={selectedDictionaries.includes(dictionary.id)}
                        onCheckedChange={() => toggleDictionary(dictionary.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium truncate">
                            {dictionary.name}
                          </p>
                          {dictionary.isCompressed && (
                            <Badge variant="outline" className="text-xs">
                              Compressed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {(dictionary.lineCount / 1000000).toFixed(1)}M words • {formatFileSize(dictionary.size)}
                        </p>
                      </div>
                      {selectedDictionaries.includes(dictionary.id) && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No dictionaries available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateJob}
            disabled={selectedNetworks.length === 0 || selectedDictionaries.length === 0 || !jobName.trim()}
          >
            Create Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}