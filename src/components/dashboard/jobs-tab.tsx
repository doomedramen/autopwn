'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription
} from '@/components/ui/item';
import {
  Activity,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Terminal
} from 'lucide-react';
import {
  EmptyState,
  JobSkeleton
} from '@/components/loading';

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

interface JobsTabProps {
  jobs: JobInfo[];
  isInitialLoad: boolean;
  networksWithHandshakesCount: number;
  dictionariesCount: number;
  onViewLogs: (jobId: string, jobName: string) => void;
  onCreateJobClick: () => void;
}

export function JobsTab({
  jobs,
  isInitialLoad,
  networksWithHandshakesCount,
  dictionariesCount,
  onViewLogs,
  onCreateJobClick
}: JobsTabProps) {
  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'stopped':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'paused':
        return 'outline';
      case 'completed':
        return 'default';
      case 'failed':
      case 'stopped':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cracking Jobs</CardTitle>
        <CardDescription>
          All password cracking jobs and their progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoad ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <JobSkeleton key={i} />
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <ItemGroup className="gap-3">
            {jobs.map((job) => (
              <Item key={job.id} variant="outline">
                <ItemMedia variant="icon" className="!self-center !translate-y-0">
                  {React.cloneElement(getJobStatusIcon(job.status), { className: 'size-4' })}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{job.name}</ItemTitle>
                  <ItemDescription>
                    Created {new Date(job.createdAt).toLocaleDateString()}
                    {job.currentDictionary && ` • Using: ${job.currentDictionary}`}
                    {job.progress > 0 && ` • ${job.progress}% complete`}
                  </ItemDescription>
                  {job.progress > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div>{job.cracked}/{job.total} passwords cracked</div>
                      {job.speed && <div>{job.speed}</div>}
                      {job.eta && <div>ETA: {job.eta}</div>}
                    </div>
                  )}
                </ItemContent>
                <ItemActions>
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {job.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewLogs(job.id, job.name)}
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    Logs
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <EmptyState
            title="No jobs created yet"
            description="Create your first password cracking job to start testing network security. Upload networks and dictionaries first."
            icon={<Activity className="h-12 w-12" />}
            action={
              <Button
                onClick={onCreateJobClick}
                disabled={networksWithHandshakesCount === 0 || dictionariesCount === 0}
              >
                <Play className="h-4 w-4 mr-2" />
                Create First Job
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}