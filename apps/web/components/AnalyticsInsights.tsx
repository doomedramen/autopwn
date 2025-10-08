"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

interface AnalyticsInsightsProps {
  data: {
    successRate: number;
    avgCompletionTime: number;
    jobsOverTime: { date: string; count: number }[];
    cracksOverTime: { date: string; count: number }[];
    statusDistribution: { status: string; count: number }[];
  };
}

export function AnalyticsInsights({ data }: AnalyticsInsightsProps) {
  const calculateJobGrowth = () => {
    if (data.jobsOverTime.length < 2) return 0;
    const recent = data.jobsOverTime.slice(-7).reduce((sum, day) => sum + day.count, 0);
    const previous = data.jobsOverTime.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  };

  const calculateCrackGrowth = () => {
    if (data.cracksOverTime.length < 2) return 0;
    const recent = data.cracksOverTime.slice(-7).reduce((sum, day) => sum + day.count, 0);
    const previous = data.cracksOverTime.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  };

  const getSuccessRateStatus = () => {
    if (data.successRate >= 80) return { status: 'excellent', color: 'bg-green-500', text: 'Excellent' };
    if (data.successRate >= 60) return { status: 'good', color: 'bg-blue-500', text: 'Good' };
    if (data.successRate >= 40) return { status: 'fair', color: 'bg-yellow-500', text: 'Fair' };
    return { status: 'poor', color: 'bg-red-500', text: 'Needs Improvement' };
  };

  const getCompletionTimeStatus = () => {
    const minutes = data.avgCompletionTime / 60;
    if (minutes <= 10) return { status: 'fast', color: 'bg-green-500', text: 'Fast' };
    if (minutes <= 30) return { status: 'normal', color: 'bg-blue-500', text: 'Normal' };
    if (minutes <= 60) return { status: 'slow', color: 'bg-yellow-500', text: 'Slow' };
    return { status: 'very-slow', color: 'bg-red-500', text: 'Very Slow' };
  };

  const jobGrowth = calculateJobGrowth();
  const crackGrowth = calculateCrackGrowth();
  const successRateStatus = getSuccessRateStatus();
  const completionTimeStatus = getCompletionTimeStatus();

  const totalJobs = data.statusDistribution.reduce((sum, status) => sum + status.count, 0);
  const completedJobs = data.statusDistribution.find(s => s.status === 'completed')?.count || 0;
  const failedJobs = data.statusDistribution.find(s => s.status === 'failed')?.count || 0;
  const processingJobs = data.statusDistribution.find(s => s.status === 'processing')?.count || 0;

  const insights = [
    {
      title: "Job Volume Trend",
      value: `${jobGrowth >= 0 ? '+' : ''}${jobGrowth.toFixed(1)}%`,
      icon: jobGrowth >= 0 ? TrendingUp : TrendingDown,
      color: jobGrowth >= 0 ? "text-green-600" : "text-red-600",
      bgColor: jobGrowth >= 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950",
      description: `vs last week`
    },
    {
      title: "Success Rate",
      value: `${data.successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      description: successRateStatus.text
    },
    {
      title: "Active Jobs",
      value: processingJobs.toString(),
      icon: AlertTriangle,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      description: "currently running"
    },
    {
      title: "Avg Completion",
      value: formatDuration(data.avgCompletionTime),
      icon: completionTimeStatus.status === 'fast' ? TrendingUp : AlertTriangle,
      color: completionTimeStatus.status === 'fast' ? "text-green-600" : "text-yellow-600",
      bgColor: completionTimeStatus.status === 'fast' ? "bg-green-50 dark:bg-green-950" : "bg-yellow-50 dark:bg-yellow-950",
      description: completionTimeStatus.text
    }
  ];

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {insights.map((insight, index) => {
        const IconComponent = insight.icon;
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {insight.title}
                </p>
                <div className={`p-2 rounded-lg ${insight.bgColor}`}>
                  <IconComponent className={`h-4 w-4 ${insight.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{insight.value}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Summary Card */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-lg">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedJobs}</div>
              <div className="text-sm text-muted-foreground">Completed Jobs</div>
              <Badge variant="secondary" className="mt-2">
                {totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0}% success rate
              </Badge>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{failedJobs}</div>
              <div className="text-sm text-muted-foreground">Failed Jobs</div>
              <Badge variant="destructive" className="mt-2">
                {totalJobs > 0 ? ((failedJobs / totalJobs) * 100).toFixed(1) : 0}% failure rate
              </Badge>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{crackGrowth >= 0 ? '+' : ''}{crackGrowth.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Crack Growth</div>
              <Badge variant={crackGrowth >= 0 ? "default" : "secondary"} className="mt-2">
                {crackGrowth >= 0 ? 'Increasing' : 'Decreasing'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}