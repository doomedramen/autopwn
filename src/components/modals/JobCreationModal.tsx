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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HashcatDeviceInfo } from '@/types';
import { formatFileSize } from '@/lib/utils/file-size';
import {
  Zap,
  Wifi,
  FileText,
  AlertCircle,
  CheckCircle,
  Monitor,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { useLogo } from '@/components/logo';
import { logError } from '@/lib/logger';

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
  isCompressed: boolean;
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
  onCreateJob,
}: JobCreationModalProps) {
  const { setFace, setTemporaryFace } = useLogo();
  const [jobName, setJobName] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>(
    []
  );
  const [attackMode, setAttackMode] = useState('0');
  const [workloadProfile, setWorkloadProfile] = useState('1');
  const [gpuTempAbort, setGpuTempAbort] = useState(false);
  const [gpuTempDisable, setGpuTempAbortTemp] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<HashcatDeviceInfo[]>(
    []
  );
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);

  // Reset form when modal opens and load devices
  useEffect(() => {
    if (isOpen) {
      setFace('SMART', 'Reading last session logs ...');

      // Generate default job name with timestamp
      const timestamp = new Date()
        .toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(',', '');

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
      setDeviceWarning(null);

      // Load available devices
      loadAvailableDevices();
    } else {
      // Reset face when modal closes
      setFace('COOL', 'I pwn therefore I am.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, setFace]);

  // Load available devices from hashcat via API
  const loadAvailableDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await fetch('/api/hardware/devices');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableDevices(result.data);
        setDeviceWarning(result.warning || null);

        // Auto-select GPU devices if available, otherwise CPU
        const gpuDevices = result.data.filter(
          (d: HashcatDeviceInfo) => d.type === 'gpu'
        );
        const cpuDevices = result.data.filter(
          (d: HashcatDeviceInfo) => d.type === 'cpu'
        );

        if (gpuDevices.length > 0) {
          setSelectedDevices(
            gpuDevices.map((d: HashcatDeviceInfo) => d.deviceId)
          );
          setTemporaryFace('GRATEFUL', 2000, "I'm living the life!");
        } else if (cpuDevices.length > 0) {
          setSelectedDevices([cpuDevices[0].deviceId]);
          setTemporaryFace('BORED', 2000, "I'm extremely bored ...");
        } else {
          setFace('BROKEN', "I'm very sad ...");
        }
      }
    } catch (error) {
      logError('Failed to load devices:', error);
      setFace('ANGRY', "I'm mad at you!");
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleCreateJob = () => {
    if (!jobName.trim()) {
      setFace('SAD', "I'm sad");
      alert('Please enter a job name');
      return;
    }

    if (selectedNetworks.length === 0) {
      setFace('SAD', "I'm sad");
      alert('Please select at least one network');
      return;
    }

    if (selectedDictionaries.length === 0) {
      setFace('SAD', "I'm sad");
      alert('Please select at least one dictionary');
      return;
    }

    setFace('EXCITED', 'No more mister Wi-Fi!!');

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
        devices: selectedDevices.length > 0 ? selectedDevices : undefined,
      },
    };

    onCreateJob?.(jobConfig);
    setTemporaryFace('HAPPY', 3000, 'This is the best day of my life!');
    onClose();
  };

  const toggleNetwork = (bssid: string) => {
    setSelectedNetworks(prev => {
      const newSelection = prev.includes(bssid)
        ? prev.filter(id => id !== bssid)
        : [...prev, bssid];

      // Update face based on selection
      if (newSelection.length > prev.length) {
        // Network added
        if (newSelection.length === 1) {
          setTemporaryFace('HAPPY', 1500, 'Good friends are a blessing!');
        } else if (newSelection.length === networksWithHandshakes.length) {
          setTemporaryFace('GRATEFUL', 2000, 'I love my friends!');
        } else {
          setTemporaryFace('HAPPY', 1500, 'So many networks!!!');
        }
      }

      return newSelection;
    });
  };

  const toggleDictionary = (dictId: string) => {
    setSelectedDictionaries(prev => {
      const newSelection = prev.includes(dictId)
        ? prev.filter(id => id !== dictId)
        : [...prev, dictId];

      // Update face based on selection
      if (newSelection.length > prev.length) {
        // Dictionary added
        const dict = dictionaries.find(d => d.id === dictId);
        if (dict) {
          if (dict.lineCount > 1000000) {
            setTemporaryFace('MOTIVATED', 2000, "I'm living the life!");
          } else {
            setTemporaryFace('HAPPY', 1500, 'New day, new hunt, new pwns!');
          }
        }
      }

      return newSelection;
    });
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
        return <Monitor className="h-5 w-5 text-blue-600" />;
      case 'cpu':
        return <Cpu className="h-5 w-5 text-green-600" />;
      case 'accelerator':
        return <HardDrive className="h-5 w-5 text-purple-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb > 1
      ? `${gb.toFixed(1)}GB`
      : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  };

  const getAttackModeDescription = (mode: string) => {
    switch (mode) {
      case '0':
        return 'Straight (dictionary attack)';
      case '1':
        return 'Combination';
      case '3':
        return 'Brute-force';
      case '6':
        return 'Hybrid Wordlist + Mask';
      case '7':
        return 'Hybrid Mask + Wordlist';
      default:
        return 'Unknown';
    }
  };

  const getWorkloadProfileDescription = (profile: string) => {
    switch (profile) {
      case '1':
        return 'Desktop (low performance)';
      case '2':
        return 'Laptop (medium performance)';
      case '3':
        return 'High Performance Desktop';
      case '4':
        return 'Fanless/Embedded';
      default:
        return 'Unknown';
    }
  };

  const networksWithHandshakes = networks.filter(n => n.hasHandshake);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center space-x-3 text-xl">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Zap className="h-6 w-6 text-orange-600" />
            </div>
            <span>Create Cracking Job</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            Configure a new password cracking job using uploaded PCAP files and
            dictionaries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {/* Job Configuration */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <span>Job Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="jobName" className="text-base font-medium">
                    Job Name
                  </Label>
                  <Input
                    id="jobName"
                    value={jobName}
                    onChange={e => setJobName(e.target.value)}
                    placeholder="Enter job name..."
                    className="text-base h-11 focus-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Attack Mode</Label>
                  <Select value={attackMode} onValueChange={setAttackMode}>
                    <SelectTrigger className="h-11 focus-ring">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">
                        0 - Straight (Dictionary)
                      </SelectItem>
                      <SelectItem value="1">1 - Combination</SelectItem>
                      <SelectItem value="3">3 - Brute-force</SelectItem>
                      <SelectItem value="6">
                        6 - Hybrid Wordlist + Mask
                      </SelectItem>
                      <SelectItem value="7">
                        7 - Hybrid Mask + Wordlist
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {getAttackModeDescription(attackMode)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  Workload Profile
                </Label>
                <Select
                  value={workloadProfile}
                  onValueChange={setWorkloadProfile}
                >
                  <SelectTrigger className="h-11 focus-ring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Desktop</SelectItem>
                    <SelectItem value="2">2 - Laptop</SelectItem>
                    <SelectItem value="3">
                      3 - High Performance Desktop
                    </SelectItem>
                    <SelectItem value="4">4 - Fanless/Embedded</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {getWorkloadProfileDescription(workloadProfile)}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Hardware Devices
                </Label>
                {isLoadingDevices ? (
                  <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        Loading available devices...
                      </p>
                    </div>
                  </div>
                ) : availableDevices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableDevices.map(device => (
                      <div
                        key={device.deviceId}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover-lift ${
                          selectedDevices.includes(device.deviceId)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleDevice(device.deviceId)}
                      >
                        <Checkbox
                          checked={selectedDevices.includes(device.deviceId)}
                          onCheckedChange={() => toggleDevice(device.deviceId)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex items-center space-x-3 flex-1">
                          {getDeviceIcon(device.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {device.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {device.type.toUpperCase()} • ID:{' '}
                              {device.deviceId} • {formatMemory(device.memory)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 border-2 border-dashed border-red-200 rounded-lg">
                    <div className="text-center">
                      <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <p className="text-sm text-red-600">
                        No hashcat-compatible devices found
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Make sure hashcat is properly installed
                      </p>
                    </div>
                  </div>
                )}
                {deviceWarning && (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      {deviceWarning}
                    </span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Select which hardware devices to use for cracking. GPU devices
                  are recommended for best performance.
                </p>
              </div>

              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="text-base font-semibold">Advanced Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg border">
                    <Checkbox
                      id="gpuTempAbort"
                      checked={gpuTempAbort}
                      onCheckedChange={checked =>
                        setGpuTempAbort(checked === true)
                      }
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="gpuTempAbort"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Stop if GPU temperature exceeds 80°C
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Prevent overheating by pausing jobs
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg border">
                    <Checkbox
                      id="gpuTempDisable"
                      checked={gpuTempDisable}
                      onCheckedChange={checked =>
                        setGpuTempAbortTemp(checked === true)
                      }
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="gpuTempDisable"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Disable GPU temperature monitoring
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Run without temperature limits
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Selection */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-lg">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Wifi className="h-5 w-5 text-blue-600" />
                  </div>
                  <span>Select Networks</span>
                </div>
                {selectedNetworks.length > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {selectedNetworks.length} selected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                Choose networks with handshakes to crack
                {networksWithHandshakes.length === 0 && (
                  <div className="flex items-center space-x-2 text-red-500 mt-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      No networks with handshakes available. Upload PCAP files
                      first.
                    </span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent
              className={
                networksWithHandshakes.length > 3
                  ? 'max-h-64 overflow-y-auto'
                  : ''
              }
            >
              {networksWithHandshakes.length > 0 ? (
                <div className="grid gap-3">
                  {networksWithHandshakes.map(network => (
                    <div
                      key={network.bssid}
                      className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover-lift ${
                        selectedNetworks.includes(network.bssid)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-border hover:border-blue-300'
                      }`}
                      onClick={() => toggleNetwork(network.bssid)}
                    >
                      <Checkbox
                        checked={selectedNetworks.includes(network.bssid)}
                        onCheckedChange={() => toggleNetwork(network.bssid)}
                        onClick={e => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <p className="text-base font-semibold truncate">
                            {network.essid || 'Unknown Network'}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-1"
                          >
                            {network.encryption}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {network.bssid} • Channel {network.channel} •{' '}
                          {network.encryption}
                        </p>
                      </div>
                      {selectedNetworks.includes(network.bssid) && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Wifi className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base text-muted-foreground">
                    No networks with handshakes available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dictionary Selection */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-lg">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span>Select Dictionaries</span>
                </div>
                {selectedDictionaries.length > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {selectedDictionaries.length} selected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                Choose password dictionaries to use
                {dictionaries.length === 0 && (
                  <div className="flex items-center space-x-2 text-red-500 mt-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      No dictionaries available. Upload dictionary files first.
                    </span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent
              className={
                dictionaries.length > 3 ? 'max-h-64 overflow-y-auto' : ''
              }
            >
              {dictionaries.length > 0 ? (
                <div className="grid gap-3">
                  {dictionaries.map(dictionary => (
                    <div
                      key={dictionary.id}
                      className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover-lift ${
                        selectedDictionaries.includes(dictionary.id)
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-border hover:border-emerald-300'
                      }`}
                      onClick={() => toggleDictionary(dictionary.id)}
                    >
                      <Checkbox
                        checked={selectedDictionaries.includes(dictionary.id)}
                        onCheckedChange={() => toggleDictionary(dictionary.id)}
                        onClick={e => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <p className="text-base font-semibold truncate">
                            {dictionary.name}
                          </p>
                          {dictionary.isCompressed && (
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-1"
                            >
                              Compressed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {(dictionary.lineCount / 1000000).toFixed(1)}M words •{' '}
                          {formatFileSize(dictionary.size)}
                        </p>
                      </div>
                      {selectedDictionaries.includes(dictionary.id) && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base text-muted-foreground">
                    No dictionaries available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-3 pt-6">
          <Button variant="outline" onClick={onClose} className="hover-lift">
            Cancel
          </Button>
          <Button
            onClick={handleCreateJob}
            disabled={
              selectedNetworks.length === 0 ||
              selectedDictionaries.length === 0 ||
              !jobName.trim()
            }
            className="hover-lift glow-primary min-w-[120px]"
          >
            Create Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
