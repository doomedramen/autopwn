'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wifi, BookOpen, Activity, Zap } from 'lucide-react';
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
  isLoading,
}: DashboardStatsProps) {
  const successRate =
    totalJobsCount > 0
      ? Math.round((completedJobsCount / totalJobsCount) * 100)
      : 0;

  return (
    <LoadingOverlay
      isLoading={isLoading || false}
      message={isLoading ? 'Updating dashboard...' : undefined}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Networks Card */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover-lift group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Wifi className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-sm font-semibold">Networks</CardTitle>
            </div>
            {networksWithHandshakesCount > 0 && (
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600 font-medium">
                  Active
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              {networksCount}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {networksWithHandshakesCount} with handshakes
              </p>
              <div className="text-xs text-blue-600 bg-blue-500/10 px-2 py-1 rounded-full">
                {networksCount > 0
                  ? Math.round(
                      (networksWithHandshakesCount / networksCount) * 100
                    )
                  : 0}
                %
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dictionaries Card */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover-lift group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <BookOpen className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-semibold">
                Dictionaries
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
              {dictionariesCount}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {(totalWordsCount / 1000000).toFixed(1)}M words
              </p>
              <div className="text-xs text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full">
                {dictionariesCount > 0 ? 'Ready' : 'None'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Jobs Card */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover-lift group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                <Activity className="h-4 w-4 text-orange-600" />
              </div>
              <CardTitle className="text-sm font-semibold">
                Active Jobs
              </CardTitle>
            </div>
            {activeJobsCount > 0 && (
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                <span className="text-xs text-orange-600 font-medium">
                  Running
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
              {activeJobsCount}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {completedJobsCount} completed
              </p>
              <div
                className={`text-xs px-2 py-1 rounded-full ${
                  activeJobsCount > 0
                    ? 'text-orange-600 bg-orange-500/10'
                    : 'text-gray-600 bg-gray-500/10'
                }`}
              >
                {activeJobsCount > 0 ? 'Processing' : 'Idle'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate Card */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover-lift group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <Zap className="h-4 w-4 text-green-600" />
              </div>
              <CardTitle className="text-sm font-semibold">
                Success Rate
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
              {successRate}%
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {completedJobsCount} of {totalJobsCount} jobs
              </p>
              <div
                className={`text-xs px-2 py-1 rounded-full ${
                  successRate >= 70
                    ? 'text-green-600 bg-green-500/10'
                    : successRate >= 40
                      ? 'text-yellow-600 bg-yellow-500/10'
                      : 'text-red-600 bg-red-500/10'
                }`}
              >
                {successRate >= 70
                  ? 'Excellent'
                  : successRate >= 40
                    ? 'Good'
                    : totalJobsCount > 0
                      ? 'Poor'
                      : 'No Data'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </LoadingOverlay>
  );
}
