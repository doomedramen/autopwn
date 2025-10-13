'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Wifi, Zap } from 'lucide-react';
import { useLoading } from '@/components/loading';
import { UploadModal, JobCreationModal } from '@/components/modals';
import { JobLogsDialog } from '@/components/job-logs-dialog';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { NetworksTab } from '@/components/dashboard/networks-tab';
import { DictionariesTab } from '@/components/dashboard/dictionaries-tab';
import { JobsTab } from '@/components/dashboard/jobs-tab';
import { FloatingActions } from '@/components/dashboard/floating-actions';

interface NetworkInfo {
  essid: string;
  bssid: string;
  channel?: number;
  encryption?: string;
  hasHandshake: boolean;
  fileId?: string;
  uploadDate?: string;
}

interface DictionaryInfo {
  id: string;
  name: string;
  originalName: string;
  lineCount: number;
  size: number;
  checksum: string;
  uploadDate: string;
  isCompressed: boolean;
}

interface JobInfo {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'stopped';
  progress: number;
  speed?: string;
  eta?: string;
  cracked: number;
  total: number;
  currentDictionary?: string;
  startedAt?: string;
  networks: string[];
  createdAt: string;
}

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isJobLogsOpen, setIsJobLogsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobName, setSelectedJobName] = useState<string>('');
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [dictionaries, setDictionaries] = useState<DictionaryInfo[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [activeTab, setActiveTab] = useState('jobs');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { isLoading, startLoading, stopLoading } = useLoading({
    minLoadingTime: 300,
    maxLoadingTime: 10000
  });

  // Load data on component mount
  useEffect(() => {
    loadDashboardData(true);

    // Set up periodic refresh for real-time updates
    const interval = setInterval(() => loadDashboardData(false), 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async (showLoading = false) => {
    if (showLoading) {
      startLoading('Loading dashboard data...');
    }

    try {
      // Load networks
      const networksResponse = await fetch('/api/networks');
      if (networksResponse.ok) {
        const networksData = await networksResponse.json();
        setNetworks(networksData.data || []);
      }

      // Load dictionaries
      const dictionariesResponse = await fetch('/api/dictionaries');
      if (dictionariesResponse.ok) {
        const dictionariesData = await dictionariesResponse.json();
        // Map API response to expected interface with better error handling
        const mappedDictionaries = (dictionariesData.data || []).map((dict: Record<string, unknown>) => {
          const fileSize = typeof dict.fileSize === 'number' ? dict.fileSize : 0;
          const lineCount = typeof dict.lineCount === 'number' ? dict.lineCount : 0;
          const createdAt = dict.createdAt ? new Date(dict.createdAt as string) : new Date();

          return {
            id: dict.id,
            name: dict.filename || dict.originalName || 'Unknown Dictionary',
            originalName: dict.originalName || dict.filename || 'Unknown Dictionary',
            lineCount: lineCount,
            size: fileSize,
            checksum: dict.fileChecksum || '',
            uploadDate: createdAt.toISOString(),
            isCompressed: dict.isCompressed || false
          };
        });
        setDictionaries(mappedDictionaries);
      }

      // Load jobs
      const jobsResponse = await fetch('/api/jobs');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobs(jobsData.data || []);
      }

      setIsInitialLoad(false);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      stopLoading('Failed to load data');
    } finally {
      if (showLoading) {
        stopLoading();
      }
    }
  };

  const handleUploadComplete = (type: string, results: unknown[]) => {
    // Refresh data after upload
    loadDashboardData();
  };

  const handleCreateJob = (jobConfig: {
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
      devices?: number[];
    };
  }) => {
    // Create job via API
    fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobConfig)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        loadDashboardData();
      } else {
        console.error('Failed to create job:', data.error);
      }
    })
    .catch(error => {
      console.error('Error creating job:', error);
    });
  };

  const handleViewJobLogs = (jobId: string, jobName: string) => {
    setSelectedJobId(jobId);
    setSelectedJobName(jobName);
    setIsJobLogsOpen(true);
  };

  // Calculate derived stats
  const networksWithHandshakes = networks.filter(n => n.hasHandshake);
  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'paused');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const totalWords = dictionaries.reduce((sum, dict) => sum + dict.lineCount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <DashboardHeader
        onUploadClick={() => setIsUploadModalOpen(true)}
        onCreateJobClick={() => setIsJobModalOpen(true)}
        disabledJobButton={networksWithHandshakes.length === 0 || dictionaries.length === 0}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <DashboardStats
          networksCount={networks.length}
          dictionariesCount={dictionaries.length}
          networksWithHandshakesCount={networksWithHandshakes.length}
          activeJobsCount={activeJobs.length}
          completedJobsCount={completedJobs.length}
          totalJobsCount={jobs.length}
          totalWordsCount={totalWords}
          isLoading={isLoading}
        />

        {/* Detailed Tabs */}
        <div className="mt-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="jobs" className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Jobs</span>
              </TabsTrigger>
              <TabsTrigger value="networks" className="flex items-center space-x-2">
                <Wifi className="h-4 w-4" />
                <span className="hidden sm:inline">Networks</span>
              </TabsTrigger>
              <TabsTrigger value="dictionaries" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Dictionaries</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs">
              <JobsTab
                jobs={jobs}
                isInitialLoad={isInitialLoad}
                networksWithHandshakesCount={networksWithHandshakes.length}
                dictionariesCount={dictionaries.length}
                onViewLogs={handleViewJobLogs}
                onCreateJobClick={() => setIsJobModalOpen(true)}
              />
            </TabsContent>

            <TabsContent value="networks">
              <NetworksTab
                networks={networks}
                isInitialLoad={isInitialLoad}
                onUploadClick={() => setIsUploadModalOpen(true)}
              />
            </TabsContent>

            <TabsContent value="dictionaries">
              <DictionariesTab
                dictionaries={dictionaries}
                isInitialLoad={isInitialLoad}
                onUploadClick={() => setIsUploadModalOpen(true)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={handleUploadComplete}
      />

      <JobCreationModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        networks={networks}
        dictionaries={dictionaries}
        onCreateJob={handleCreateJob}
      />

      <JobLogsDialog
        isOpen={isJobLogsOpen}
        onClose={() => setIsJobLogsOpen(false)}
        jobId={selectedJobId || ''}
        jobName={selectedJobName}
      />

      {/* Floating Action Button for Mobile */}
      <FloatingActions
        networksWithHandshakesCount={networksWithHandshakes.length}
        dictionariesCount={dictionaries.length}
        onUploadClick={() => setIsUploadModalOpen(true)}
        onCreateJobClick={() => setIsJobModalOpen(true)}
      />
    </div>
  );
}