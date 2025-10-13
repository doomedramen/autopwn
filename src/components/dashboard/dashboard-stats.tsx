'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wifi,
  BookOpen,
  Activity,
  Zap
} from 'lucide-react';
import { LoadingOverlay } from '@/components/loading';

interface DashboardStatsProps {
  networksCount: number;
  dictionariesCount: number;
  networksWithHandshakesCount: number;
  activeJobsCount: number;
  completedJobsCount: number;
  totalJobsCount: number;
  totalWordsCount: number;
  isLoading?: boolean;
}

export function DashboardStats({
  networksCount,
  dictionariesCount,
  networksWithHandshakesCount,
  activeJobsCount,
  completedJobsCount,
  totalJobsCount,
  totalWordsCount,
  isLoading
}: DashboardStatsProps) {
  return (
    <LoadingOverlay isLoading={isLoading || false} message={isLoading ? 'Updating dashboard...' : undefined}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="relative overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Networks</CardTitle>
            <div className="flex items-center space-x-1">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              {networksWithHandshakesCount > 0 && (
                <div className="h-2 w-2 bg-green-500 rounded-full" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{networksCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {networksWithHandshakesCount} with handshakes
            </p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        </Card>

        <Card className="relative overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dictionaries</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{dictionariesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(totalWordsCount / 1000000).toFixed(1)}M words
            </p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        </Card>

        <Card className="relative overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <div className="flex items-center space-x-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {activeJobsCount > 0 && (
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{activeJobsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedJobsCount} completed
            </p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        </Card>

        <Card className="relative overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">
              {totalJobsCount > 0
                ? Math.round((completedJobsCount / totalJobsCount) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedJobsCount} of {totalJobsCount} jobs
            </p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        </Card>
      </div>
    </LoadingOverlay>
  );
}