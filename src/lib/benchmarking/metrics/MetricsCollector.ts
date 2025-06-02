import { 
  BenchmarkMetrics, 
  BenchmarkRawData, 
  BenchmarkEnvironment,
  TestCase 
} from '../types'
import { memoryManager } from '../../chunking/MemoryManager'
import { chunkProgressTracker } from '../../chunking/ProgressTracker'
import { defaultCacheManager } from '../../chunking/cache'

export class MetricsCollector {
  private startTime: number = 0
  private endTime: number = 0
  private rawData: BenchmarkRawData = {
    chunkUploadTimes: [],
    progressUpdates: [],
    memorySnapshots: [],
    cacheOperations: [],
    errors: []
  }
  private memoryInterval: number | null = null
  private progressInterval: number | null = null
  private peakMemoryUsage: number = 0
  private memorySum: number = 0
  private memorySamples: number = 0
  private memoryPressureEvents: number = 0
  private gcEventCount: number = 0

  constructor() {
    this.setupMemoryMonitoring()
    this.setupGCMonitoring()
  }

  /**
   * Start collecting metrics for a test case
   */
  startCollection(testCase: TestCase): void {
    console.log(`📊 Starting metrics collection for ${testCase.fileConfig.name}`)
    
    this.reset()
    this.startTime = performance.now()
    
    // Start continuous monitoring
    this.startMemoryMonitoring()
    this.startProgressMonitoring(testCase)
    this.setupCacheMonitoring()
  }

  /**
   * Stop collecting metrics and return final metrics
   */
  stopCollection(): BenchmarkMetrics {
    this.endTime = performance.now()
    
    // Stop monitoring
    this.stopMemoryMonitoring()
    this.stopProgressMonitoring()
    
    console.log(`📈 Metrics collection completed in ${this.endTime - this.startTime}ms`)
    
    return this.calculateFinalMetrics()
  }

  /**
   * Record chunk upload timing
   */
  recordChunkUpload(chunkIndex: number, startTime: number, endTime: number, size: number, retries: number = 0): void {
    this.rawData.chunkUploadTimes.push({
      chunkIndex,
      startTime,
      endTime,
      size,
      retries
    })
  }

  /**
   * Record error occurrence
   */
  recordError(type: string, message: string, chunkIndex?: number): void {
    this.rawData.errors.push({
      timestamp: performance.now(),
      type,
      message,
      chunkIndex
    })
  }

  /**
   * Get current memory snapshot
   */
  private captureMemorySnapshot(): void {
    const memoryStats = memoryManager.getMemoryStats()
    const timestamp = performance.now()
    
    // Calculate estimated usage from total heap size
    const usedMB = memoryStats.usedJSHeapSize / (1024 * 1024)
    
    this.rawData.memorySnapshots.push({
      timestamp,
      used: usedMB,
      available: memoryStats.availableMemoryMB,
      pressure: memoryStats.memoryPressure
    })

    // Track peak and average memory usage
    if (usedMB > this.peakMemoryUsage) {
      this.peakMemoryUsage = usedMB
    }
    
    this.memorySum += usedMB
    this.memorySamples++

    // Count memory pressure events
    if (memoryStats.memoryPressure === 'high' || memoryStats.memoryPressure === 'critical') {
      this.memoryPressureEvents++
    }
  }

  /**
   * Setup memory monitoring
   */
  private setupMemoryMonitoring(): void {
    // Monitor memory info API if available
    if ('memory' in performance) {
      const perfMemory = (performance as any).memory
      if (perfMemory) {
        console.log('📊 Performance.memory API available for enhanced monitoring')
      }
    }
  }

  /**
   * Setup GC monitoring if available
   */
  private setupGCMonitoring(): void {
    // Monitor GC events if performance observer is available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && entry.name.includes('gc')) {
              this.gcEventCount++
            }
          })
        })
        observer.observe({ entryTypes: ['measure'] })
      } catch (error) {
        console.warn('⚠️ Performance observer not fully supported', error)
      }
    }
  }

  /**
   * Start continuous memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryInterval = window.setInterval(() => {
      this.captureMemorySnapshot()
    }, 100) // Every 100ms
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval)
      this.memoryInterval = null
    }
  }

  /**
   * Start progress monitoring
   */
  private startProgressMonitoring(testCase: TestCase): void {
    const fileId = testCase.fileConfig.name
    
    this.progressInterval = window.setInterval(() => {
      const fileProgress = chunkProgressTracker.getFileProgress(fileId)
      if (fileProgress) {
        this.rawData.progressUpdates.push({
          timestamp: performance.now(),
          progress: fileProgress.overallProgress,
          throughput: fileProgress.uploadSpeed,
          memoryUsage: this.peakMemoryUsage
        })
      }
    }, 250) // Every 250ms
  }

  /**
   * Stop progress monitoring
   */
  private stopProgressMonitoring(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  /**
   * Setup cache operation monitoring
   */
  private setupCacheMonitoring(): void {
    // Hook into cache stats for monitoring
    const cacheStats = defaultCacheManager.getStats()
    
    // Monitor cache operations by hooking into the methods we know exist
    const originalGetChunk = defaultCacheManager.getCachedChunk.bind(defaultCacheManager)
    const originalSetChunk = defaultCacheManager.cacheChunk.bind(defaultCacheManager)
    
    // Monkey patch to capture cache operations
    defaultCacheManager.getCachedChunk = async (key: string) => {
      const startTime = performance.now()
      const result = await originalGetChunk(key)
      const endTime = performance.now()
      
      this.rawData.cacheOperations.push({
        timestamp: startTime,
        operation: result ? 'hit' : 'miss',
        key,
        duration: endTime - startTime
      })
      
      return result
    }

    defaultCacheManager.cacheChunk = async (chunkId: string, chunkBlob: Blob, metadata: any) => {
      const startTime = performance.now()
      const result = await originalSetChunk(chunkId, chunkBlob, metadata)
      const endTime = performance.now()
      
      this.rawData.cacheOperations.push({
        timestamp: startTime,
        operation: 'store',
        key: chunkId,
        duration: endTime - startTime
      })
      
      return result
    }
  }

  /**
   * Calculate final metrics from collected data
   */
  private calculateFinalMetrics(): BenchmarkMetrics {
    const totalDurationMs = this.endTime - this.startTime
    
    // Calculate upload metrics
    const { uploadThroughputMBps, chunkProcessingLatencyMs, networkEfficiencyPercent } = this.calculateUploadMetrics(totalDurationMs)
    
    // Calculate memory metrics
    const averageMemoryUsageMB = this.memorySamples > 0 ? this.memorySum / this.memorySamples : 0
    
    // Calculate cache metrics
    const { cacheHitRatio, cacheMissRatio, cacheLookupTimeMs } = this.calculateCacheMetrics()
    
    // Calculate chunking metrics
    const { totalChunks, chunkSize, chunksPerSecond, parallelism } = this.calculateChunkingMetrics(totalDurationMs)
    
    // Calculate error metrics
    const { failedChunks, retryAttempts, errorRate } = this.calculateErrorMetrics()
    
    // Calculate UX metrics
    const { timeToFirstByte, progressUpdateFrequency } = this.calculateUXMetrics()

    return {
      startTime: this.startTime,
      endTime: this.endTime,
      totalDurationMs,
      
      uploadThroughputMBps,
      chunkProcessingLatencyMs,
      networkEfficiencyPercent,
      
      peakMemoryUsageMB: this.peakMemoryUsage,
      averageMemoryUsageMB,
      memoryPressureEvents: this.memoryPressureEvents,
      gcEvents: this.gcEventCount,
      
      cacheHitRatio,
      cacheMissRatio,
      cacheLookupTimeMs,
      
      totalChunks,
      chunkSize,
      chunksPerSecond,
      parallelism,
      
      failedChunks,
      retryAttempts,
      errorRate,
      
      networkUtilizationPercent: this.calculateNetworkUtilization(),
      
      timeToFirstByte,
      progressUpdateFrequency
    }
  }

  /**
   * Calculate upload-related metrics
   */
  private calculateUploadMetrics(totalDurationMs: number): {
    uploadThroughputMBps: number
    chunkProcessingLatencyMs: number[]
    networkEfficiencyPercent: number
  } {
    const chunkTimes = this.rawData.chunkUploadTimes
    const totalBytes = chunkTimes.reduce((sum, chunk) => sum + chunk.size, 0)
    const totalMB = totalBytes / (1024 * 1024)
    const totalSeconds = totalDurationMs / 1000
    
    const uploadThroughputMBps = totalSeconds > 0 ? totalMB / totalSeconds : 0
    
    const chunkProcessingLatencyMs = chunkTimes.map(chunk => chunk.endTime - chunk.startTime)
    
    // Calculate network efficiency (simplified)
    const averageLatency = chunkProcessingLatencyMs.length > 0 
      ? chunkProcessingLatencyMs.reduce((sum, latency) => sum + latency, 0) / chunkProcessingLatencyMs.length
      : 0
    
    const theoreticalMinTime = totalBytes / (100 * 1024 * 1024 / 8 * 1000) // Assume 100Mbps theoretical max
    const actualTime = totalDurationMs
    const networkEfficiencyPercent = actualTime > 0 ? Math.min(100, (theoreticalMinTime / actualTime) * 100) : 0
    
    return {
      uploadThroughputMBps,
      chunkProcessingLatencyMs,
      networkEfficiencyPercent
    }
  }

  /**
   * Calculate cache-related metrics
   */
  private calculateCacheMetrics(): {
    cacheHitRatio: number
    cacheMissRatio: number
    cacheLookupTimeMs: number[]
  } {
    const cacheOps = this.rawData.cacheOperations
    const hits = cacheOps.filter(op => op.operation === 'hit').length
    const misses = cacheOps.filter(op => op.operation === 'miss').length
    const total = hits + misses
    
    const cacheHitRatio = total > 0 ? hits / total : 0
    const cacheMissRatio = total > 0 ? misses / total : 0
    const cacheLookupTimeMs = cacheOps.map(op => op.duration)
    
    return { cacheHitRatio, cacheMissRatio, cacheLookupTimeMs }
  }

  /**
   * Calculate chunking-related metrics
   */
  private calculateChunkingMetrics(totalDurationMs: number): {
    totalChunks: number
    chunkSize: number
    chunksPerSecond: number
    parallelism: number
  } {
    const chunkTimes = this.rawData.chunkUploadTimes
    const totalChunks = chunkTimes.length
    const averageChunkSize = totalChunks > 0 
      ? chunkTimes.reduce((sum, chunk) => sum + chunk.size, 0) / totalChunks
      : 0
    
    const totalSeconds = totalDurationMs / 1000
    const chunksPerSecond = totalSeconds > 0 ? totalChunks / totalSeconds : 0
    
    // Estimate parallelism by checking overlapping upload times
    const parallelism = this.estimateParallelism(chunkTimes)
    
    return {
      totalChunks,
      chunkSize: averageChunkSize,
      chunksPerSecond,
      parallelism
    }
  }

  /**
   * Calculate error-related metrics
   */
  private calculateErrorMetrics(): {
    failedChunks: number
    retryAttempts: number
    errorRate: number
  } {
    const chunkTimes = this.rawData.chunkUploadTimes
    const errors = this.rawData.errors
    
    const failedChunks = errors.filter(error => error.chunkIndex !== undefined).length
    const retryAttempts = chunkTimes.reduce((sum, chunk) => sum + chunk.retries, 0)
    const errorRate = chunkTimes.length > 0 ? failedChunks / chunkTimes.length : 0
    
    return { failedChunks, retryAttempts, errorRate }
  }

  /**
   * Calculate user experience metrics
   */
  private calculateUXMetrics(): {
    timeToFirstByte: number
    progressUpdateFrequency: number
  } {
    const firstChunk = this.rawData.chunkUploadTimes[0]
    const timeToFirstByte = firstChunk ? firstChunk.startTime - this.startTime : 0
    
    const progressUpdates = this.rawData.progressUpdates.length
    const totalTime = this.endTime - this.startTime
    const progressUpdateFrequency = totalTime > 0 ? progressUpdates / (totalTime / 1000) : 0
    
    return { timeToFirstByte, progressUpdateFrequency }
  }

  /**
   * Calculate network utilization percentage
   */
  private calculateNetworkUtilization(): number {
    // Simplified calculation - in real scenario would need actual network monitoring
    const progressUpdates = this.rawData.progressUpdates
    if (progressUpdates.length === 0) return 0
    
    const averageThroughput = progressUpdates.reduce((sum, update) => sum + update.throughput, 0) / progressUpdates.length
    const estimatedMaxThroughput = 100 * 1024 * 1024 / 8 // 100Mbps in bytes/sec
    
    return Math.min(100, (averageThroughput / estimatedMaxThroughput) * 100)
  }

  /**
   * Estimate parallelism from overlapping upload times
   */
  private estimateParallelism(chunkTimes: Array<{ startTime: number; endTime: number }>): number {
    if (chunkTimes.length === 0) return 0
    
    // Create timeline of concurrent uploads
    const events: Array<{ time: number; type: 'start' | 'end' }> = []
    
    chunkTimes.forEach(chunk => {
      events.push({ time: chunk.startTime, type: 'start' })
      events.push({ time: chunk.endTime, type: 'end' })
    })
    
    events.sort((a, b) => a.time - b.time)
    
    let maxConcurrent = 0
    let currentConcurrent = 0
    
    events.forEach(event => {
      if (event.type === 'start') {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      } else {
        currentConcurrent--
      }
    })
    
    return maxConcurrent
  }

  /**
   * Reset all metrics for new test
   */
  private reset(): void {
    this.startTime = 0
    this.endTime = 0
    this.rawData = {
      chunkUploadTimes: [],
      progressUpdates: [],
      memorySnapshots: [],
      cacheOperations: [],
      errors: []
    }
    this.peakMemoryUsage = 0
    this.memorySum = 0
    this.memorySamples = 0
    this.memoryPressureEvents = 0
    this.gcEventCount = 0
  }

  /**
   * Get raw data for detailed analysis
   */
  getRawData(): BenchmarkRawData {
    return { ...this.rawData }
  }

  /**
   * Get current environment information
   */
  static getBenchmarkEnvironment(): BenchmarkEnvironment {
    const nav = navigator as any
    
    return {
      userAgent: navigator.userAgent,
      browserName: this.getBrowserName(),
      browserVersion: this.getBrowserVersion(),
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency || 1,
      totalMemoryMB: nav.deviceMemory ? nav.deviceMemory * 1024 : 0,
      connectionType: nav.connection?.effectiveType || 'unknown',
      storageQuotaMB: undefined, // Will be filled by async call if needed
      webWorkerSupport: typeof Worker !== 'undefined',
      serviceWorkerSupport: 'serviceWorker' in navigator,
      indexedDBSupport: 'indexedDB' in window
    }
  }

  private static getBrowserName(): string {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
  }

  private static getBrowserVersion(): string {
    const userAgent = navigator.userAgent
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)
    return match ? match[2] : 'Unknown'
  }
} 