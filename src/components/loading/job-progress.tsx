'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, CheckCircle, XCircle, Clock, Pause } from 'lucide-react';

interface JobProgressProps {
  job: {
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
  };
  showDetails?: boolean;
}

export function JobProgress({ job, showDetails = false }: JobProgressProps) {
  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
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

  const progressPercentage = Math.max(0, Math.min(100, job.progress || 0));

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          {getJobStatusIcon(job.status)}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{job.name}</h4>
            <div className="flex items-center space-x-2">
              <Badge variant={getStatusBadgeVariant(job.status)}>
                {job.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {job.cracked.toLocaleString()} / {job.total.toLocaleString()}{' '}
                passwords
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {showDetails && (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            {job.currentDictionary && (
              <div className="flex justify-between">
                <span>Dictionary:</span>
                <span className="truncate max-w-[200px]">
                  {job.currentDictionary}
                </span>
              </div>
            )}
            {job.speed && (
              <div className="flex justify-between">
                <span>Speed:</span>
                <span>{job.speed}</span>
              </div>
            )}
            {job.eta && (
              <div className="flex justify-between">
                <span>ETA:</span>
                <span>{job.eta}</span>
              </div>
            )}
            {job.startedAt && (
              <div className="flex justify-between">
                <span>Started:</span>
                <span>{new Date(job.startedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
