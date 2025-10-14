'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Wifi, Zap, Users } from 'lucide-react';
import { useLoading } from '@/components/loading';
import { useAuth } from '@/components/auth-provider';
import { UploadModal, JobCreationModal } from '@/components/modals';
import { JobLogsDialog } from '@/components/job-logs-dialog';
import { UniversalHeader } from '@/components/universal-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { NetworksTab } from '@/components/dashboard/networks-tab';
import { DictionariesTab } from '@/components/dashboard/dictionaries-tab';
import { JobsTab } from '@/components/dashboard/jobs-tab';
import { UsersTab } from '@/components/dashboard/users-tab';
import { FloatingActions } from '@/components/dashboard/floating-actions';

interface NetworkInfo {
  id: string;
  essid: string;
  bssid: string;
  channel?: number;
  encryption?: string;
  hasHandshake: boolean;
  firstSeen: Date;
  lastSeen: Date;
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
  status:
    | 'pending'
    | 'processing'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'stopped';
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
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';

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
  const [isSystemInitialized, setIsSystemInitialized] = useState<
    boolean | null
  >(null);

  const { isLoading, startLoading, stopLoading } = useLoading({
    minLoadingTime: 300,
    maxLoadingTime: 10000,
  });

  const checkSystemInitialization = async () => {
    try {
      const response = await fetch('/api/init');
      const data = await response.json();
      setIsSystemInitialized(data.initialized);
    } catch (error) {
      console.error('Failed to check system initialization:', error);
      setIsSystemInitialized(false);
    }
  };

  // Check if system is initialized
  useEffect(() => {
    checkSystemInitialization();
  }, []);

  // Redirect to setup if system is not initialized
  useEffect(() => {
    if (isSystemInitialized === false && !authLoading) {
      window.location.href = '/setup';
    }
  }, [isSystemInitialized, authLoading]);

  // Load data on component mount
  useEffect(() => {
    if (isSystemInitialized === true) {
      loadDashboardData(true);

      // Set up periodic refresh for real-time updates
      const interval = setInterval(() => loadDashboardData(false), 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemInitialized]);

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
        const mappedDictionaries = (dictionariesData.data || []).map(
          (dict: Record<string, unknown>) => {
            const fileSize =
              typeof dict.fileSize === 'number' ? dict.fileSize : 0;
            const lineCount =
              typeof dict.lineCount === 'number' ? dict.lineCount : 0;
            const createdAt = dict.createdAt
              ? new Date(dict.createdAt as string)
              : new Date();

            return {
              id: dict.id,
              name: dict.filename || dict.originalName || 'Unknown Dictionary',
              originalName:
                dict.originalName || dict.filename || 'Unknown Dictionary',
              lineCount: lineCount,
              size: fileSize,
              checksum: dict.fileChecksum || '',
              uploadDate: createdAt.toISOString(),
              isCompressed: dict.isCompressed || false,
            };
          }
        );
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUploadComplete = (_type: string, _results: unknown[]) => {
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
      body: JSON.stringify(jobConfig),
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
  const activeJobs = jobs.filter(
    j => j.status === 'processing' || j.status === 'paused'
  );
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const totalWords = dictionaries.reduce(
    (sum, dict) => sum + dict.lineCount,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <UniversalHeader
        showActions={true}
        onUploadClick={() => setIsUploadModalOpen(true)}
        onCreateJobClick={() => setIsJobModalOpen(true)}
        disabledJobButton={
          networksWithHandshakes.length === 0 || dictionaries.length === 0
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
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
        <div className="mt-6 sm:mt-8 animate-fade-in">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList
              className={`grid w-full h-12 sm:h-12 p-1 bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/30 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} rounded-xl border`}
            >
              <TabsTrigger
                value="jobs"
                className="flex items-center justify-center space-x-1 sm:space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift text-xs sm:text-sm"
              >
                <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Jobs</span>
                <span className="text-xs bg-primary/10 text-primary px-1 sm:px-1.5 py-0.5 rounded-full">
                  {jobs.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="networks"
                className="flex items-center justify-center space-x-1 sm:space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift text-xs sm:text-sm"
              >
                <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Networks</span>
                <span className="text-xs bg-blue-500/10 text-blue-600 px-1 sm:px-1.5 py-0.5 rounded-full">
                  {networks.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="dictionaries"
                className="flex items-center justify-center space-x-1 sm:space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift text-xs sm:text-sm"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Dicts</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-600 px-1 sm:px-1.5 py-0.5 rounded-full">
                  {dictionaries.length}
                </span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="users"
                  className="flex items-center justify-center space-x-1 sm:space-x-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg hover-lift text-xs sm:text-sm"
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium">Users</span>
                </TabsTrigger>
              )}
            </TabsList>

            <div className="min-h-[400px]">
              <TabsContent value="jobs" className="mt-0 animate-slide-up">
                <JobsTab
                  jobs={jobs}
                  isInitialLoad={isInitialLoad}
                  networksWithHandshakesCount={networksWithHandshakes.length}
                  dictionariesCount={dictionaries.length}
                  onViewLogs={handleViewJobLogs}
                  onCreateJobClick={() => setIsJobModalOpen(true)}
                />
              </TabsContent>

              <TabsContent value="networks" className="mt-0 animate-slide-up">
                <NetworksTab
                  networks={networks}
                  isInitialLoad={isInitialLoad}
                  onUploadClick={() => setIsUploadModalOpen(true)}
                />
              </TabsContent>

              <TabsContent
                value="dictionaries"
                className="mt-0 animate-slide-up"
              >
                <DictionariesTab
                  dictionaries={dictionaries}
                  isInitialLoad={isInitialLoad}
                  onUploadClick={() => setIsUploadModalOpen(true)}
                />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="users" className="mt-0 animate-slide-up">
                  <UsersTab isInitialLoad={isInitialLoad} />
                </TabsContent>
              )}
            </div>
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
