'use client';

import { useState } from 'react';
import { useAuthSession } from '@/lib/api-hooks';
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
  Settings,
  Shield,
  Cpu,
  Zap,
  Clock,
  Server,
  Save,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface AdminTabProps {
  className?: string;
}

export function AdminTab({ className }: AdminTabProps) {
  const { data: authData } = useAuthSession();
  const [isSaving, setIsSaving] = useState(false);

  // Global Hashcat Settings
  const [globalWorkloadProfile, setGlobalWorkloadProfile] = useState('2');
  const [globalRuntimeLimit, setGlobalRuntimeLimit] = useState('3600');
  const [enableRuntimeLimit, setEnableRuntimeLimit] = useState(true);
  const [globalOptimizedKernels, setGlobalOptimizedKernels] = useState(false);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState('3');
  const [defaultHashType, setDefaultHashType] = useState('22000');

  // Resource Limits
  const [maxCpuUsage, setMaxCpuUsage] = useState('80');
  const [maxGpuTemp, setMaxGpuTemp] = useState('85');
  const [enableTempMonitoring, setEnableTempMonitoring] = useState(true);
  const [enableAutoShutdown, setEnableAutoShutdown] = useState(false);

  // Check if user is admin
  const isAdmin = authData?.user?.role === 'admin';

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Saving admin settings:', {
      globalWorkloadProfile,
      globalRuntimeLimit: enableRuntimeLimit ? globalRuntimeLimit : null,
      globalOptimizedKernels,
      maxConcurrentJobs,
      defaultHashType,
      maxCpuUsage,
      maxGpuTemp: enableTempMonitoring ? maxGpuTemp : null,
      enableTempMonitoring,
      enableAutoShutdown,
    });

    setIsSaving(false);
  };

  if (!isAdmin) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h3 className="text-lg font-semibold font-mono uppercase">Access Denied</h3>
          </div>
          <p className="text-muted-foreground font-mono">
            You do not have permission to access admin settings. This area is restricted to administrators only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold uppercase">Global Settings</h2>
        </div>
        <div></div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* Global Hashcat Settings */}
        <div className="bg-card rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">Hashcat Configuration</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Default Workload Profile */}
            <div className="grid gap-2">
              <Label className="font-mono text-sm">Default Workload Profile</Label>
              <Select value={globalWorkloadProfile} onValueChange={setGlobalWorkloadProfile}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="font-mono">1 - Low</SelectItem>
                  <SelectItem value="2" className="font-mono">2 - Default</SelectItem>
                  <SelectItem value="3" className="font-mono">3 - High</SelectItem>
                  <SelectItem value="4" className="font-mono">4 - Nightmare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Hash Type */}
            <div className="grid gap-2">
              <Label className="font-mono text-sm">Default Hash Type</Label>
              <Select value={defaultHashType} onValueChange={setDefaultHashType}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="22000" className="font-mono">22000 - PMKID/EAPOL</SelectItem>
                  <SelectItem value="2500" className="font-mono">2500 - WPA/WPA2-EAPOL</SelectItem>
                  <SelectItem value="2501" className="font-mono">2501 - WPA/WPA2-PMKID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Concurrent Jobs */}
            <div className="grid gap-2">
              <Label htmlFor="maxConcurrentJobs" className="font-mono text-sm">Max Concurrent Jobs</Label>
              <Input
                id="maxConcurrentJobs"
                type="number"
                value={maxConcurrentJobs}
                onChange={(e) => setMaxConcurrentJobs(e.target.value)}
                className="font-mono"
                min="1"
                max="10"
              />
            </div>

            {/* Default Optimized Kernels */}
            <div className="flex items-center space-x-2 mt-6">
              <Checkbox
                id="globalOptimizedKernels"
                checked={globalOptimizedKernels}
                onCheckedChange={(checked) => setGlobalOptimizedKernels(checked as boolean)}
              />
              <Label
                htmlFor="globalOptimizedKernels"
                className="text-sm font-mono cursor-pointer"
              >
                Enable Optimized Kernels by Default (-O)
              </Label>
            </div>
          </div>

          {/* Global Runtime Limit */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableRuntimeLimit"
                checked={enableRuntimeLimit}
                onCheckedChange={(checked) => setEnableRuntimeLimit(checked as boolean)}
              />
              <Label
                htmlFor="enableRuntimeLimit"
                className="text-sm font-mono cursor-pointer"
              >
                Enable Global Runtime Limit
              </Label>
            </div>
            {enableRuntimeLimit && (
              <div className="grid gap-2">
                <Label htmlFor="globalRuntimeLimit" className="font-mono text-sm">Default Runtime Limit (seconds)</Label>
                <Input
                  id="globalRuntimeLimit"
                  type="number"
                  value={globalRuntimeLimit}
                  onChange={(e) => setGlobalRuntimeLimit(e.target.value)}
                  className="font-mono"
                  min="60"
                  placeholder="3600"
                />
              </div>
            )}
          </div>
        </div>

        {/* Resource Limits */}
        <div className="bg-card rounded-lg shadow p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">Resource Management</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Max CPU Usage */}
            <div className="grid gap-2">
              <Label htmlFor="maxCpuUsage" className="font-mono text-sm">Max CPU Usage (%)</Label>
              <Input
                id="maxCpuUsage"
                type="number"
                value={maxCpuUsage}
                onChange={(e) => setMaxCpuUsage(e.target.value)}
                className="font-mono"
                min="10"
                max="100"
              />
            </div>

            {/* Max GPU Temperature */}
            <div className="grid gap-2">
              <Label htmlFor="maxGpuTemp" className="font-mono text-sm">
                Max GPU Temperature (°C)
                {!enableTempMonitoring && " - Monitoring Disabled"}
              </Label>
              <Input
                id="maxGpuTemp"
                type="number"
                value={maxGpuTemp}
                onChange={(e) => setMaxGpuTemp(e.target.value)}
                className="font-mono"
                min="60"
                max="100"
                disabled={!enableTempMonitoring}
              />
            </div>
          </div>

          {/* Resource Monitoring Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableTempMonitoring"
                checked={enableTempMonitoring}
                onCheckedChange={(checked) => setEnableTempMonitoring(checked as boolean)}
              />
              <Label
                htmlFor="enableTempMonitoring"
                className="text-sm font-mono cursor-pointer"
              >
                Enable GPU Temperature Monitoring
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableAutoShutdown"
                checked={enableAutoShutdown}
                onCheckedChange={(checked) => setEnableAutoShutdown(checked as boolean)}
              />
              <Label
                htmlFor="enableAutoShutdown"
                className="text-sm font-mono cursor-pointer"
              >
                Enable Auto-Shutdown on Temperature Overload
              </Label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            className="font-mono"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}