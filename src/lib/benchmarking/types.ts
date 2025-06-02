export interface BenchmarkConfig {
  name: string
  description: string
  iterations: number
  testFiles: TestFileConfig[]
  networkConditions: NetworkCondition[]
  memoryConditions: MemoryCondition[]
  cacheConditions: CacheCondition[]
  enableBaseline?: boolean
  outputPath?: string
}

export interface TestFileConfig {
  name: string
  sizeInMB: number
  type: 'synthetic' | 'xliff' | 'custom'
  content?: string
  contentPattern?: 'random' | 'repeating' | 'structured'
}

export interface NetworkCondition {
  name: string
  bandwidthMbps: number
  latencyMs?: number
  packetLoss?: number
  jitter?: number
  description: string
}

export interface MemoryCondition {
  name: string
  pressureLevel: 'low' | 'medium' | 'high' | 'critical'
  availableMemoryMB: number
  simulateOOM?: boolean
  description: string
}

export interface CacheCondition {
  name: string
  state: 'cold' | 'warm' | 'hot' | 'resumable'
  preloadChunks?: number
  preloadPercentage?: number
  description: string
}

export interface BenchmarkMetrics {
  // Performance metrics
  startTime: number
  endTime: number
  totalDurationMs: number
  
  // Upload metrics
  uploadThroughputMBps: number
  chunkProcessingLatencyMs: number[]
  networkEfficiencyPercent: number
  
  // Memory metrics
  peakMemoryUsageMB: number
  averageMemoryUsageMB: number
  memoryPressureEvents: number
  gcEvents?: number
  
  // Cache metrics
  cacheHitRatio: number
  cacheMissRatio: number
  cacheLookupTimeMs: number[]
  
  // Chunking metrics
  totalChunks: number
  chunkSize: number
  chunksPerSecond: number
  parallelism: number
  
  // Error metrics
  failedChunks: number
  retryAttempts: number
  errorRate: number
  
  // Resource utilization
  cpuUsagePercent?: number
  networkUtilizationPercent: number
  
  // User experience metrics
  timeToFirstByte: number
  progressUpdateFrequency: number
  resumabilityTime?: number
}

export interface BenchmarkResult {
  config: BenchmarkConfig
  testCase: TestCase
  metrics: BenchmarkMetrics
  rawData: BenchmarkRawData
  timestamp: string
  environment: BenchmarkEnvironment
  success: boolean
  error?: string
}

export interface TestCase {
  fileConfig: TestFileConfig
  networkCondition: NetworkCondition
  memoryCondition: MemoryCondition
  cacheCondition: CacheCondition
  iteration: number
}

export interface BenchmarkRawData {
  chunkUploadTimes: Array<{
    chunkIndex: number
    startTime: number
    endTime: number
    size: number
    retries: number
  }>
  progressUpdates: Array<{
    timestamp: number
    progress: number
    throughput: number
    memoryUsage: number
  }>
  memorySnapshots: Array<{
    timestamp: number
    used: number
    available: number
    pressure: string
  }>
  cacheOperations: Array<{
    timestamp: number
    operation: 'hit' | 'miss' | 'eviction' | 'store'
    key: string
    duration: number
  }>
  errors: Array<{
    timestamp: number
    type: string
    message: string
    chunkIndex?: number
  }>
}

export interface BenchmarkEnvironment {
  userAgent: string
  browserName: string
  browserVersion: string
  platform: string
  cores: number
  totalMemoryMB: number
  connectionType: string
  storageQuotaMB?: number
  webWorkerSupport: boolean
  serviceWorkerSupport: boolean
  indexedDBSupport: boolean
}

export interface PerformanceComparison {
  baselineMetrics: BenchmarkMetrics
  optimizedMetrics: BenchmarkMetrics
  improvements: {
    throughputImprovement: number // percentage
    latencyImprovement: number
    memoryImprovement: number
    cacheEfficiencyImprovement: number
    errorRateImprovement: number
  }
  summary: string
}

export interface BenchmarkReport {
  title: string
  description: string
  executionTime: string
  totalTests: number
  passedTests: number
  failedTests: number
  environment: BenchmarkEnvironment
  results: BenchmarkResult[]
  comparisons: PerformanceComparison[]
  recommendations: string[]
  summary: {
    bestPerformingScenario: TestCase
    worstPerformingScenario: TestCase
    averageMetrics: BenchmarkMetrics
    keyFindings: string[]
  }
}

// Simulation utilities
export interface NetworkThrottler {
  applyThrottling(condition: NetworkCondition): Promise<void>
  removeThrottling(): Promise<void>
  getCurrentCondition(): NetworkCondition | null
}

export interface MemoryPressureSimulator {
  simulateMemoryPressure(condition: MemoryCondition): Promise<void>
  releaseMemoryPressure(): Promise<void>
  getCurrentMemoryStats(): {
    used: number
    available: number
    pressure: string
  }
}

export interface CacheStateManager {
  setupCacheState(condition: CacheCondition): Promise<void>
  clearCacheState(): Promise<void>
  getCacheStats(): {
    memorySize: number
    persistentSize: number
    hitRatio: number
  }
}

// Event handlers for real-time monitoring
export interface BenchmarkEventHandlers {
  onTestStart?: (testCase: TestCase) => void
  onTestComplete?: (result: BenchmarkResult) => void
  onProgressUpdate?: (testCase: TestCase, progress: number) => void
  onMetricsUpdate?: (testCase: TestCase, metrics: Partial<BenchmarkMetrics>) => void
  onError?: (testCase: TestCase, error: Error) => void
} 