"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useJobUpdates, useResultUpdates, useStatsUpdates } from '@/lib/use-websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Activity, Clock, Zap, FileText, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { JobCreationDialog } from './JobCreationDialog';
import { JobDetailsDialog } from './JobDetailsDialog';
import { FileUploadDialog } from './FileUploadDialog';

interface Job {
  id: number;
  filename: string;
  status: string;
  progress: number | null;
  speed: string | null;
  eta: string | null;
  itemsCracked: number | null;
  itemsTotal: number | null;
  hashCount: number | null;
  totalHashes: number | null;
  currentDictionary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  priority: number;
  paused: number;
}

interface Stats {
  totalJobs: number;
  completedJobs: number;
  processingJobs: number;
  failedJobs: number;
  totalCracked: number;
  recentCracked: number;
  uniqueEssids: number;
}

interface Result {
  id: number;
  essid: string;
  password: string;
  crackedAt: string;
  jobFilename: string;
}

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentResults, setRecentResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);

  // WebSocket hooks for real-time updates
  const { jobUpdate, isConnected: wsConnected } = useJobUpdates();
  const { resultUpdate } = useResultUpdates();
  const { statsUpdate } = useStatsUpdates();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Handle real-time job updates
  useEffect(() => {
    if (jobUpdate) {
      console.log('Job update received:', jobUpdate);

      // Update jobs list with new data
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobUpdate.jobId
            ? { ...job, ...jobUpdate.data }
            : job
        )
      );

      // If a new result was cracked, refresh results
      if (jobUpdate.type === 'item_cracked') {
        setRecentResults(prevResults => [
          {
            id: Date.now(), // Temporary ID
            essid: jobUpdate.data.essid,
            password: jobUpdate.data.password,
            crackedAt: jobUpdate.data.crackedAt,
            jobFilename: jobs.find(j => j.id === jobUpdate.jobId)?.filename || 'Unknown'
          },
          ...prevResults.slice(0, 4) // Keep only 5 most recent
        ]);

        // Refresh stats when new result is found
        fetchStats();
      }
    }
  }, [jobUpdate]);

  // Handle real-time result updates
  useEffect(() => {
    if (resultUpdate) {
      console.log('Result update received:', resultUpdate);

      // Add new result to recent results
      if (resultUpdate.type === 'new_result') {
        setRecentResults(prevResults => [
          {
            id: Date.now(), // Temporary ID
            essid: resultUpdate.data.essid,
            password: resultUpdate.data.password,
            crackedAt: resultUpdate.data.crackedAt,
            jobFilename: jobs.find(j => j.id === resultUpdate.data.jobId)?.filename || 'Unknown'
          },
          ...prevResults.slice(0, 4) // Keep only 5 most recent
        ]);

        // Refresh stats when new result is found
        fetchStats();
      }
    }
  }, [resultUpdate, jobs]);

  // Handle real-time stats updates
  useEffect(() => {
    if (statsUpdate) {
      console.log('Stats update received:', statsUpdate);
      setStats(statsUpdate);
    }
  }, [statsUpdate]);

  const fetchStats = async () => {
    try {
      const statsData = await apiClient.getStats();
      setStats(statsData as Stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [jobsData, statsData, resultsData] = await Promise.all([
        apiClient.getJobs(),
        apiClient.getStats(),
        apiClient.getResults({ limit: 5 })
      ]);
      setJobs(jobsData as Job[]);
      setStats(statsData as Stats);
      setRecentResults((resultsData as any).results || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      case 'pending': return 'bg-gray-500';
      case 'stopped': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'default';
      case 'failed': return 'destructive';
      case 'paused': return 'secondary';
      case 'pending': return 'outline';
      case 'stopped': return 'outline';
      default: return 'outline';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    if (!start) return 'N/A';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If no user, middleware should have redirected already
  if (!user) {
    return (
      <div className="text-center">
        <p>Authentication required...</p>
      </div>
    );
  }

  const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'paused' || job.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {user.name || user.email}!</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Manage your WiFi handshake cracking jobs and results</p>
          </div>
          <div className="flex items-center gap-1 text-sm">
            {wsConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Live updates</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Offline</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
          <FileUploadDialog onUploadComplete={fetchData} />
          <JobCreationDialog onJobCreated={fetchData} />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeJobs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cracked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalCracked}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unique Networks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.uniqueEssids}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="results">Recent Results</TabsTrigger>
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Jobs</CardTitle>
              <CardDescription>
                All your WiFi handshake cracking jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="text-muted-foreground mt-4">No jobs yet</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <FileUploadDialog onUploadComplete={fetchData} />
                    <JobCreationDialog onJobCreated={fetchData} />
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Filename</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Progress</TableHead>
                        <TableHead className="min-w-[80px]">Speed</TableHead>
                        <TableHead className="min-w-[100px]">Duration</TableHead>
                        <TableHead className="min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">
                            <div className="max-w-[150px] truncate" title={job.filename}>
                              {job.filename}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(job.status)} className="whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(job.status)}`} />
                                {job.status}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {job.progress !== null ? (
                              <div className="space-y-1 min-w-[120px]">
                                <Progress value={job.progress} className="w-full sm:w-20" />
                                <span className="text-xs text-muted-foreground">
                                  {job.progress.toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {job.speed ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Zap className="h-3 w-3" />
                                <span className="text-xs">{job.speed}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">
                                {job.startedAt ? formatDuration(job.startedAt, job.completedAt || undefined) : 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedJob(job.id)}
                              className="whitespace-nowrap"
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Results</CardTitle>
              <CardDescription>
                Your most recently cracked WiFi passwords
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentResults.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="text-muted-foreground mt-4">No results yet</p>
                  <p className="text-sm text-muted-foreground">
                    Start by uploading PCAP files and creating cracking jobs
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ESSID</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Cracked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.essid}</TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {result.password}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {result.jobFilename}
                        </TableCell>
                        <TableCell>
                          {new Date(result.crackedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Jobs</CardTitle>
              <CardDescription>
                Jobs that are currently running, paused, or pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="text-muted-foreground mt-4">No active jobs</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`} />
                          <div>
                            <h4 className="font-medium">{job.filename}</h4>
                            <p className="text-sm text-muted-foreground">
                              Priority: {job.priority} • Created: {new Date(job.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob(job.id)}
                        >
                          Details
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Progress:</span>
                          <div className="mt-1">
                            {job.progress !== null ? (
                              <div className="space-y-1">
                                <Progress value={job.progress} className="w-full" />
                                <span>{job.progress.toFixed(1)}%</span>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Speed:</span>
                          <div className="mt-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {job.speed || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Items:</span>
                          <div className="mt-1">
                            {job.itemsCracked !== null && job.itemsTotal !== null
                              ? `${job.itemsCracked} / ${job.itemsTotal}`
                              : 'N/A'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <JobDetailsDialog
        jobId={selectedJob}
        open={selectedJob !== null}
        onOpenChange={(open) => !open && setSelectedJob(null)}
        onJobUpdated={fetchData}
      />
    </div>
  );
}