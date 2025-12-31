import { db } from "../db/index";
import { checkQueueHealth } from "../lib/queue";
import { logger } from "../lib/logger";
import * as fs from "fs/promises";
import * as os from "os";
import path from "path";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "healthy" | "degraded" | "unhealthy";
      message: string;
      latency?: number;
    };
    redis: {
      status: "healthy" | "degraded" | "unhealthy";
      message: string;
      latency?: number;
      queueStats?: any;
    };
    workers: {
      status: "healthy" | "degraded" | "unhealthy";
      message: string;
      details: any;
    };
    disk: {
      status: "healthy" | "degraded" | "unhealthy";
      message: string;
      usedBytes: number;
      totalBytes: number;
      usedPercentage: number;
      thresholdPercentage: number;
    };
  };
}

const startTime = Date.now();
const HEALTHY_THRESHOLD = 95; // 95% of uptime considered healthy
const DEGRADED_THRESHOLD = 80; // Below 80% considered degraded

class HealthCheckService {
  /**
   * Check database connectivity
   */
  private async checkDatabase() {
    const dbStart = Date.now();

    try {
      await db.execute(sql`SELECT 1`);

      const latency = Date.now() - dbStart;

      return {
        status: "healthy",
        message: "Database connection successful",
        latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check Redis connectivity and queue health
   */
  private async checkRedis() {
    const redisStart = Date.now();

    try {
      const queueHealth = await checkQueueHealth();

      const latency = Date.now() - redisStart;

      if (queueHealth.status === "healthy") {
        return {
          status: "healthy",
          message: "Redis and queues healthy",
          latency,
          queueStats: queueHealth.queues,
        };
      } else {
        return {
          status: "degraded",
          message: `Redis connection issue: ${queueHealth.error || "Unknown error"}`,
          latency,
          queueStats: queueHealth.queues,
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Redis connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check worker status
   */
  private async checkWorkers() {
    try {
      const queueHealth = await checkQueueHealth();

      if (queueHealth.status === "healthy") {
        const activeJobs = queueHealth.queues?.pcap_processing || 0;
        const waitingJobs = queueHealth.queues?.pcap_processing || 0;

        return {
          status: "healthy",
          message: "Workers operational",
          details: {
            activeJobs,
            waitingJobs,
            queues: queueHealth.queues,
          },
        };
      } else {
        return {
          status: "degraded",
          message: "Workers may be degraded due to queue issues",
          details: {
            queueHealth,
          },
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Worker check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: error,
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDisk() {
    try {
      const dataPaths = [
        path.join(process.cwd(), "data"),
        path.join(process.cwd(), "uploads"),
        "/data",
      ];

      let totalBytes = 0;
      let usedBytes = 0;

      for (const dataPath of dataPaths) {
        try {
          const stats = await fs.statfs(dataPath);
          totalBytes += stats.total;
          usedBytes += stats.total - stats.free;
        } catch (error) {
          // Path doesn't exist or can't be accessed, skip it
        }
      }

      // If no data paths found, check system-wide disk usage
      if (totalBytes === 0) {
        const rootStats = await fs.statfs("/");
        totalBytes = rootStats.total;
        usedBytes = rootStats.total - rootStats.free;
      }

      const usedPercentage = (usedBytes / totalBytes) * 100;
      const thresholdPercentage = 90; // Alert at 90% disk usage

      let status: "healthy" | "degraded" | "unhealthy";
      let message: string;

      if (usedPercentage >= 95) {
        status = "unhealthy";
        message = `Critical: Disk usage at ${usedPercentage.toFixed(1)}% (${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB used of ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)}GB)`;
      } else if (usedPercentage >= thresholdPercentage) {
        status = "degraded";
        message = `Warning: Disk usage at ${usedPercentage.toFixed(1)}% (${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB used of ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)}GB)`;
      } else {
        status = "healthy";
        message = `Disk usage at ${usedPercentage.toFixed(1)}% (${(usedBytes / 1024 / 1024 / 1024).toFixed(2)}GB used of ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)}GB)`;
      }

      return {
        status,
        message,
        usedBytes,
        totalBytes,
        usedPercentage,
        thresholdPercentage,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Disk check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        usedBytes: 0,
        totalBytes: 0,
        usedPercentage: 0,
        thresholdPercentage: 90,
      };
    }
  }

  /**
   * Check system resources (CPU, memory)
   */
  private checkSystemResources() {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const usedMemoryPercentage = (usedMemory / totalMemory) * 100;

      return {
        cpuCount: cpus.length,
        memoryUsage: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          percentage: usedMemoryPercentage,
        },
        uptime: Math.floor(process.uptime()),
      };
    } catch (error) {
      return {
        error: `System resource check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Perform complete health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    logger.info("Performing health check", "health-check");

    const [database, redis, workers, disk, systemResources] = await Promise.all(
      [
        this.checkDatabase(),
        this.checkRedis(),
        this.checkWorkers(),
        this.checkDisk(),
      ],
    );

    const systemResourcesResult = this.checkSystemResources();

    const uptime = Date.now() - startTime;

    // Determine overall health status
    let status: "healthy" | "degraded" | "unhealthy";
    const unhealthyChecks = [];
    const degradedChecks = [];

    if (database.status !== "healthy") {
      unhealthyChecks.push("database");
    } else if (database.status === "degraded") {
      degradedChecks.push("database");
    }

    if (redis.status !== "healthy") {
      unhealthyChecks.push("redis");
    } else if (redis.status === "degraded") {
      degradedChecks.push("redis");
    }

    if (workers.status !== "healthy") {
      unhealthyChecks.push("workers");
    } else if (workers.status === "degraded") {
      degradedChecks.push("workers");
    }

    if (disk.status !== "healthy") {
      unhealthyChecks.push("disk");
    } else if (disk.status === "degraded") {
      degradedChecks.push("disk");
    }

    if (unhealthyChecks.length > 0) {
      status = "unhealthy";
    } else if (degradedChecks.length > 0) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      checks: {
        database,
        redis,
        workers,
        disk,
      },
    };

    logger.info("Health check completed", "health-check", {
      status,
      uptime,
      unhealthyChecks: unhealthyChecks.length,
      degradedChecks: degradedChecks.length,
      diskUsage: disk.usedPercentage,
      databaseLatency: database.latency,
      redisLatency: redis.latency,
    });

    return result;
  }

  /**
   * Get health check summary
   */
  getSummary(): {
    startTime: Date;
    uptime: number;
    uptimeFormatted: string;
  } {
    const uptime = Date.now() - startTime;
    const uptimeFormatted = this.formatUptime(uptime);

    return {
      startTime: new Date(startTime),
      uptime,
      uptimeFormatted,
    };
  }

  /**
   * Format uptime for display
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}

export const healthCheckService = new HealthCheckService();
