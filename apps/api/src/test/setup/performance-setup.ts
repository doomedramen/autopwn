import { beforeAll, afterAll, describe, expect } from 'vitest'
import { performance } from 'perf_hooks'

// Performance tracking utilities
export class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map()
  private startTimes: Map<string, number> = new Map()

  startMeasurement(name: string) {
    this.startTimes.set(name, performance.now())
  }

  endMeasurement(name: string): number {
    const startTime = this.startTimes.get(name)
    if (!startTime) {
      throw new Error(`Measurement "${name}" was not started`)
    }

    const duration = performance.now() - startTime
    const measurements = this.measurements.get(name) || []
    measurements.push(duration)
    this.measurements.set(name, measurements)

    return duration
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || []
    if (measurements.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, median: 0 }
    }

    const sorted = [...measurements].sort((a, b) => a - b)
    const sum = measurements.reduce((a, b) => a + b, 0)

    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name)
    }
    return stats
  }

  reset() {
    this.measurements.clear()
    this.startTimes.clear()
  }
}

// Global performance tracker
export const perfTracker = new PerformanceTracker()

// Memory usage tracking
export const getMemoryUsage = () => {
  const usage = process.memoryUsage()
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100 // MB
  }
}

// Performance assertion helpers
export const assertPerformance = (name: string, maxDuration: number) => {
  const stats = perfTracker.getStats(name)
  expect(stats.avg).toBeLessThan(maxDuration)
  expect(stats.p95).toBeLessThan(maxDuration * 1.5) // Allow some variance
}

export const assertMemoryUsage = (maxMemoryMB: number) => {
  const usage = getMemoryUsage()
  expect(usage.heapUsed).toBeLessThan(maxMemoryMB)
}

// Benchmark helper
export const benchmark = async (name: string, fn: () => Promise<any>, iterations = 100) => {
  console.log(`🏃 Running benchmark: ${name} (${iterations} iterations)`)

  const measurements: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const duration = performance.now() - start
    measurements.push(duration)

    if (i % 10 === 0) {
      console.log(`  Progress: ${i}/${iterations}`)
    }
  }

  const sorted = measurements.sort((a, b) => a - b)
  const stats = {
    count: measurements.length,
    min: Math.min(...measurements),
    max: Math.max(...measurements),
    avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  }

  console.log(`📊 Benchmark results for ${name}:`)
  console.log(`  Count: ${stats.count}`)
  console.log(`  Min: ${stats.min.toFixed(2)}ms`)
  console.log(`  Max: ${stats.max.toFixed(2)}ms`)
  console.log(`  Avg: ${stats.avg.toFixed(2)}ms`)
  console.log(`  Median: ${stats.median.toFixed(2)}ms`)
  console.log(`  P95: ${stats.p95.toFixed(2)}ms`)
  console.log(`  P99: ${stats.p99.toFixed(2)}ms`)

  return stats
}

// Set up performance monitoring
beforeAll(() => {
  console.log('🚀 Initializing performance test environment...')

  // Enable detailed timing
  process.env.NODE_ENV = 'test'

  // Log initial memory usage
  const initialMemory = getMemoryUsage()
  console.log(`💾 Initial memory usage:`, initialMemory)
})

afterAll(() => {
  // Log final memory usage
  const finalMemory = getMemoryUsage()
  console.log(`💾 Final memory usage:`, finalMemory)

  // Log all performance stats
  const allStats = perfTracker.getAllStats()
  if (Object.keys(allStats).length > 0) {
    console.log('📊 Performance test summary:')
    for (const [name, stats] of Object.entries(allStats)) {
      console.log(`  ${name}:`)
      console.log(`    Avg: ${stats.avg.toFixed(2)}ms`)
      console.log(`    P95: ${stats.p95.toFixed(2)}ms`)
      console.log(`    Count: ${stats.count}`)
    }
  }
})

// Global performance test utilities
global.PerformanceTracker = PerformanceTracker
global.perfTracker = perfTracker
global.getMemoryUsage = getMemoryUsage
global.assertPerformance = assertPerformance
global.assertMemoryUsage = assertMemoryUsage
global.benchmark = benchmark