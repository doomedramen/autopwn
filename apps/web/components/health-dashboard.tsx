"use client";

import { useEffect } from "react";
import {
  useDetailedHealthCheck,
  useHealthSummary,
  useDatabaseHealth,
  useRedisHealth,
  useDiskHealth,
  useWorkersHealth,
} from "@/lib/api-hooks";
import { Button } from "@workspace/ui/components/button";
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface HealthDashboardProps {
  className?: string;
}

export function HealthDashboard({ className }: HealthDashboardProps) {
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useDetailedHealthCheck();

  const { data: summaryData, refetch: refetchSummary } = useHealthSummary();

  const { data: dbData, refetch: refetchDB } = useDatabaseHealth();

  const { data: redisData, refetch: refetchRedis } = useRedisHealth();

  const { data: diskData, refetch: refetchDisk } = useDiskHealth();

  const { data: workersData, refetch: refetchWorkers } = useWorkersHealth();

  useEffect(() => {
    const interval = setInterval(() => {
      refetchHealth();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [refetchHealth]);

  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refetchHealth(),
        refetchSummary(),
        refetchDB(),
        refetchRedis(),
        refetchDisk(),
        refetchWorkers(),
      ]);
      toast.success("Health data refreshed");
    } catch (error: any) {
      toast.error(error?.message || "Failed to refresh health data");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "unhealthy":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h2 className="text-lg font-semibold uppercase">System Health</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          className="font-mono"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Overall Status */}
      <div className="bg-card rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {getStatusIcon(healthData?.status)}
            <div>
              <div className="text-xs text-muted-foreground font-mono">
                SYSTEM STATUS
              </div>
              <div
                className={`text-2xl font-bold font-mono ${getStatusColor(healthData?.status)}`}
              >
                {healthData?.status?.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground font-mono">
              UPTIME
            </div>
            <div className="text-lg font-mono flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatUptime(healthData?.uptime || 0)}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono mb-4">
          Last Updated: {new Date(healthData?.timestamp || "").toLocaleString()}
        </div>

        {/* System Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono">
                DATABASE
              </div>
              {getStatusIcon(dbData?.status)}
            </div>
            <div className="text-sm font-mono mb-1">{dbData?.message}</div>
            {dbData?.latency && (
              <div className="text-xs text-muted-foreground font-mono">
                Latency: {dbData.latency}ms
              </div>
            )}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono">
                REDIS
              </div>
              {getStatusIcon(redisData?.status)}
            </div>
            <div className="text-sm font-mono mb-1">{redisData?.message}</div>
            {redisData?.latency && (
              <div className="text-xs text-muted-foreground font-mono">
                Latency: {redisData.latency}ms
              </div>
            )}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono">
                WORKERS
              </div>
              {getStatusIcon(workersData?.status)}
            </div>
            <div className="text-sm font-mono mb-1">{workersData?.message}</div>
            {workersData?.details?.activeJobs !== undefined && (
              <div className="text-xs text-muted-foreground font-mono">
                Active: {workersData.details.activeJobs}
              </div>
            )}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono">
                DISK
              </div>
              {getStatusIcon(diskData?.status)}
            </div>
            <div className="text-sm font-mono mb-1">{diskData?.message}</div>
            {diskData?.usedPercentage !== undefined && (
              <div className="text-xs text-muted-foreground font-mono">
                Usage: {diskData.usedPercentage.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Health Checks */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Database Details */}
        <div className="bg-card rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">
              Database
            </h3>
            {getStatusIcon(dbData?.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Status
              </span>
              <span
                className={`text-sm font-mono font-semibold ${getStatusColor(dbData?.status)}`}
              >
                {dbData?.status?.toUpperCase()}
              </span>
            </div>
            {dbData?.latency && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground font-mono">
                  Latency
                </span>
                <span className="text-sm font-mono">{dbData.latency}ms</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Message
              </span>
              <span className="text-sm font-mono text-right flex-1 ml-4">
                {dbData?.message}
              </span>
            </div>
          </div>
        </div>

        {/* Redis Details */}
        <div className="bg-card rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">
              Redis / Queues
            </h3>
            {getStatusIcon(redisData?.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Status
              </span>
              <span
                className={`text-sm font-mono font-semibold ${getStatusColor(redisData?.status)}`}
              >
                {redisData?.status?.toUpperCase()}
              </span>
            </div>
            {redisData?.latency && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground font-mono">
                  Latency
                </span>
                <span className="text-sm font-mono">{redisData.latency}ms</span>
              </div>
            )}
            {redisData?.queueStats && (
              <div className="space-y-2 pt-2 border-t">
                <div className="text-xs text-muted-foreground font-mono mb-2">
                  Queue Statistics
                </div>
                {Object.entries(redisData.queueStats).map(
                  ([queue, stats]: [string, any]) => (
                    <div key={queue} className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-muted-foreground font-mono">
                        {queue}
                      </div>
                      <div className="font-mono text-center">
                        Active: {stats.active || 0}
                      </div>
                      <div className="font-mono text-right">
                        Waiting: {stats.waiting || 0}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workers Details */}
        <div className="bg-card rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">
              Workers
            </h3>
            {getStatusIcon(workersData?.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Status
              </span>
              <span
                className={`text-sm font-mono font-semibold ${getStatusColor(workersData?.status)}`}
              >
                {workersData?.status?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Message
              </span>
              <span className="text-sm font-mono text-right flex-1 ml-4">
                {workersData?.message}
              </span>
            </div>
            {workersData?.details && (
              <div className="space-y-2 pt-2 border-t">
                {workersData.details.activeJobs !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground font-mono">
                      Active Jobs
                    </span>
                    <span className="text-sm font-mono">
                      {workersData.details.activeJobs}
                    </span>
                  </div>
                )}
                {workersData.details.waitingJobs !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground font-mono">
                      Waiting Jobs
                    </span>
                    <span className="text-sm font-mono">
                      {workersData.details.waitingJobs}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Disk Details */}
        <div className="bg-card rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">
              Disk Storage
            </h3>
            {getStatusIcon(diskData?.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Status
              </span>
              <span
                className={`text-sm font-mono font-semibold ${getStatusColor(diskData?.status)}`}
              >
                {diskData?.status?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Used
              </span>
              <span className="text-sm font-mono">
                {diskData?.usedBytes ? formatBytes(diskData.usedBytes) : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                Total
              </span>
              <span className="text-sm font-mono">
                {diskData?.totalBytes ? formatBytes(diskData.totalBytes) : "-"}
              </span>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-muted-foreground font-mono">
                  Usage
                </span>
                <span
                  className={`text-sm font-mono font-semibold ${getStatusColor(diskData?.status)}`}
                >
                  {diskData?.usedPercentage
                    ? diskData.usedPercentage.toFixed(1)
                    : "-"}
                  %
                </span>
              </div>
              {diskData?.usedPercentage !== undefined && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      diskData.usedPercentage >= 95
                        ? "bg-red-500"
                        : diskData.usedPercentage >= 90
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${diskData.usedPercentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Uptime Summary */}
      {summaryData && (
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5" />
            <h3 className="text-base font-semibold font-mono uppercase">
              Uptime Summary
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground font-mono mb-1">
                Started At
              </div>
              <div className="text-sm font-mono">
                {new Date(summaryData.startTime).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-mono mb-1">
                Total Uptime
              </div>
              <div className="text-sm font-mono flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {formatUptime(summaryData.uptime)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
