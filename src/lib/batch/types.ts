export interface ProcessingJob {
  id: string
  type: 'parse' | 'analyze' | 'validate' | 'export'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority: JobPriority
  createdAt: number
  startedAt?: number
  completedAt?: number
  updatedAt: number
  
  // File information
  file: File
  fileName: string
  fileSize: number
  fileType: 'xliff-1.2' | 'xliff-2.0' | 'mxliff' | 'unknown'
  
  // Processing configuration
  config: ProcessingConfig
  
  // Progress tracking
  progress: {
    percentage: number
    stage: string
    message?: string
    estimatedTimeRemaining?: number
    bytesProcessed?: number
  }
  
  // Error handling
  error?: ProcessingError
  retryAttempt: number
  maxRetryAttempts: number
  
  // Results
  result?: ProcessingResult
  
  // Dependencies
  dependsOn?: string[]
  blockedBy?: string[]
  
  // Metadata
  metadata: Record<string, any>
  tags?: string[]
  userId?: string
  projectId?: string
}

export interface ProcessingConfig {
  parseOptions?: {
    validateSchema?: boolean
    extractMetadata?: boolean
    preserveOriginalStructure?: boolean
  }
  analysisOptions?: {
    enableMQMScoring?: boolean
    enableLinguisticAnalysis?: boolean
    generateQualityReport?: boolean
  }
  validationOptions?: {
    checkTranslationUnits?: boolean
    validateLanguageCodes?: boolean
    checkFileIntegrity?: boolean
  }
  exportOptions?: {
    format?: 'pdf' | 'excel' | 'json' | 'csv'
    includeAnalysis?: boolean
    compressOutput?: boolean
  }
}

export interface ProcessingResult {
  success: boolean
  outputFiles?: Array<{
    name: string
    path: string
    type: string
    size: number
  }>
  statistics?: {
    segmentCount: number
    wordCount: number
    translatedSegments: number
    untranslatedSegments: number
    qualityScore?: number
  }
  analysisReport?: {
    errors: Array<{
      type: string
      severity: string
      message: string
      segmentId?: string
    }>
    warnings: Array<{
      type: string
      message: string
      segmentId?: string
    }>
    suggestions: Array<{
      type: string
      message: string
      segmentId?: string
    }>
  }
  metadata: Record<string, any>
}

export interface ProcessingError {
  code: string
  message: string
  type: 'validation' | 'parsing' | 'analysis' | 'export' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  isRetriable: boolean
  details?: Record<string, any>
  stack?: string
  timestamp: number
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  IMMEDIATE = 5
}

export interface QueueConfig {
  maxConcurrentJobs: number
  maxQueueSize: number
  defaultJobTimeout: number // milliseconds
  retryDelayMultiplier: number
  maxRetryAttempts: number
  priorityScheduling: boolean
  enableJobPersistence: boolean
  cleanupCompletedJobs: boolean
  cleanupAfterHours: number
}

export interface QueueMetrics {
  totalJobs: number
  pendingJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  cancelledJobs: number
  averageProcessingTime: number
  averageWaitTime: number
  throughputPerHour: number
  errorRate: number
  currentConcurrency: number
  queueUtilization: number
}

export interface ProcessingJobFilter {
  status?: ProcessingJob['status'][]
  type?: ProcessingJob['type'][]
  priority?: JobPriority[]
  fileType?: ProcessingJob['fileType'][]
  userId?: string
  projectId?: string
  tags?: string[]
  dateRange?: {
    start: number
    end: number
  }
  hasErrors?: boolean
}

export interface BatchOperation {
  id: string
  name: string
  description?: string
  jobIds: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  startedAt?: number
  completedAt?: number
  progress: {
    totalJobs: number
    completedJobs: number
    failedJobs: number
    percentage: number
  }
  config: ProcessingConfig
  metadata: Record<string, any>
}

export interface QueueEventListener {
  onJobAdded?: (job: ProcessingJob) => void
  onJobStarted?: (job: ProcessingJob) => void
  onJobProgress?: (job: ProcessingJob, progress: ProcessingJob['progress']) => void
  onJobCompleted?: (job: ProcessingJob, result: ProcessingResult) => void
  onJobFailed?: (job: ProcessingJob, error: ProcessingError) => void
  onJobCancelled?: (job: ProcessingJob) => void
  onJobRetry?: (job: ProcessingJob, attempt: number) => void
  onQueueEmpty?: () => void
  onQueueFull?: () => void
  onBatchCompleted?: (batch: BatchOperation) => void
}

export interface JobScheduler {
  getNextJob(): ProcessingJob | null
  canScheduleJob(job: ProcessingJob): boolean
  getPendingJobs(): ProcessingJob[]
  getJobsByPriority(priority: JobPriority): ProcessingJob[]
  estimateWaitTime(job: ProcessingJob): number
}

export interface ProcessingQueue {
  // Job management
  addJob(job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>): string
  addJobs(jobs: Array<Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>>): string[]
  removeJob(jobId: string): boolean
  cancelJob(jobId: string): boolean
  retryJob(jobId: string): boolean
  
  // Queue operations
  getJob(jobId: string): ProcessingJob | null
  getAllJobs(filter?: ProcessingJobFilter): ProcessingJob[]
  getQueueSize(): number
  clear(): void
  pause(): void
  resume(): void
  
  // Progress and status
  updateJobProgress(jobId: string, progress: Partial<ProcessingJob['progress']>): void
  updateJobStatus(jobId: string, status: ProcessingJob['status']): void
  getMetrics(): QueueMetrics
  
  // Batch operations
  createBatch(name: string, jobIds: string[], config?: ProcessingConfig): string
  getBatch(batchId: string): BatchOperation | null
  getAllBatches(): BatchOperation[]
  
  // Event handling
  addEventListener(listener: QueueEventListener): void
  removeEventListener(listener: QueueEventListener): void
  
  // Configuration
  updateConfig(config: Partial<QueueConfig>): void
  getConfig(): QueueConfig
  
  // Maintenance
  cleanup(): void
  export(): string
  import(data: string): void
}

// Utility types for processing workflows
export type ProcessingWorkflow = Array<{
  step: string
  type: ProcessingJob['type']
  config: ProcessingConfig
  dependsOn?: string[]
}>

export type JobTemplate = Omit<ProcessingJob, 'id' | 'file' | 'fileName' | 'fileSize' | 'fileType' | 'createdAt' | 'updatedAt' | 'status' | 'progress' | 'result'>

// Constants
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrentJobs: 3,
  maxQueueSize: 100,
  defaultJobTimeout: 300000, // 5 minutes
  retryDelayMultiplier: 2,
  maxRetryAttempts: 3,
  priorityScheduling: true,
  enableJobPersistence: false,
  cleanupCompletedJobs: true,
  cleanupAfterHours: 24
}

export const JOB_TEMPLATES: Record<string, JobTemplate> = {
  quickParse: {
    type: 'parse',
    priority: JobPriority.NORMAL,
    config: {
      parseOptions: {
        validateSchema: false,
        extractMetadata: true,
        preserveOriginalStructure: false
      }
    },
    retryAttempt: 0,
    maxRetryAttempts: 2,
    metadata: { template: 'quickParse' }
  },
  fullAnalysis: {
    type: 'analyze',
    priority: JobPriority.HIGH,
    config: {
      parseOptions: {
        validateSchema: true,
        extractMetadata: true,
        preserveOriginalStructure: true
      },
      analysisOptions: {
        enableMQMScoring: true,
        enableLinguisticAnalysis: true,
        generateQualityReport: true
      }
    },
    retryAttempt: 0,
    maxRetryAttempts: 3,
    metadata: { template: 'fullAnalysis' }
  },
  validation: {
    type: 'validate',
    priority: JobPriority.NORMAL,
    config: {
      validationOptions: {
        checkTranslationUnits: true,
        validateLanguageCodes: true,
        checkFileIntegrity: true
      }
    },
    retryAttempt: 0,
    maxRetryAttempts: 2,
    metadata: { template: 'validation' }
  }
}

// ===== Results Aggregation System Types =====

export interface AggregatedResult {
  id: string
  batchId?: string
  projectId?: string
  jobIds: string[]
  status: 'pending' | 'aggregating' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
  
  // Aggregated statistics
  summary: {
    totalJobs: number
    successfulJobs: number
    failedJobs: number
    totalFiles: number
    totalSegments: number
    totalWordCount: number
    averageQualityScore?: number
    processingTimeMs: number
  }
  
  // Quality metrics
  qualityMetrics: {
    translatedSegments: number
    untranslatedSegments: number
    errorCount: number
    warningCount: number
    overallScore?: number
    scoresByFileType: Record<string, number>
    scoresByLanguagePair: Record<string, number>
  }
  
  // File and language analysis
  fileAnalysis: {
    byFileType: Record<string, {
      count: number
      totalSize: number
      avgSegments: number
      avgQualityScore?: number
    }>
    byLanguagePair: Record<string, {
      count: number
      totalSegments: number
      translatedSegments: number
      avgQualityScore?: number
    }>
  }
  
  // Time-based metrics
  performanceMetrics: {
    avgProcessingTimePerFile: number
    avgProcessingTimePerSegment: number
    throughputFilesPerHour: number
    throughputSegmentsPerHour: number
    peakProcessingTimes: Array<{
      timestamp: number
      concurrent: number
      throughput: number
    }>
  }
  
  // Error analysis
  errorAnalysis: {
    totalErrors: number
    errorsByType: Record<string, number>
    errorsBySeverity: Record<string, number>
    commonErrors: Array<{
      type: string
      message: string
      count: number
      affectedFiles: string[]
    }>
    errorRate: number
  }
  
  // Raw data references
  rawResults: ProcessingResult[]
  jobResults: Array<{
    jobId: string
    fileName: string
    status: 'completed' | 'failed'
    result?: ProcessingResult
    error?: ProcessingError
  }>
  
  metadata: Record<string, any>
}

export interface AggregationConfig {
  // What to aggregate
  includeRawResults: boolean
  includeDetailedErrors: boolean
  includePerformanceMetrics: boolean
  includeQualityAnalysis: boolean
  
  // Grouping options
  groupByFileType: boolean
  groupByLanguagePair: boolean
  groupByBatch: boolean
  groupByProject: boolean
  
  // Quality scoring
  enableQualityScoring: boolean
  qualityWeights: {
    errors: number
    warnings: number
    completeness: number
    consistency: number
  }
  
  // Time-based analysis
  timeWindows: number[] // in milliseconds
  performanceBaselines: {
    expectedSegmentsPerHour: number
    expectedFilesPerHour: number
    expectedErrorRate: number
  }
  
  // Storage and export
  persistResults: boolean
  exportFormats: Array<'json' | 'csv' | 'excel' | 'pdf' | 'xml'>
  compressionEnabled: boolean
  
  metadata: Record<string, any>
}

export interface ResultsQuery {
  // Time range
  dateRange?: {
    start: number
    end: number
  }
  
  // Filters
  batchIds?: string[]
  projectIds?: string[]
  fileTypes?: string[]
  languagePairs?: string[]
  statusFilter?: Array<'completed' | 'failed'>
  
  // Quality filters
  minQualityScore?: number
  maxErrorRate?: number
  hasErrors?: boolean
  
  // Sorting and pagination
  sortBy?: 'createdAt' | 'completedAt' | 'qualityScore' | 'errorRate' | 'processingTime'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
  
  // Aggregation options
  groupBy?: 'day' | 'week' | 'month' | 'fileType' | 'languagePair' | 'batch' | 'project'
  includeSubResults?: boolean
}

export interface ResultsReport {
  id: string
  type: 'summary' | 'detailed' | 'quality' | 'performance' | 'errors' | 'custom'
  title: string
  description?: string
  createdAt: number
  
  // Report data
  summary: {
    totalResults: number
    totalJobs: number
    totalFiles: number
    totalSegments: number
    timeRange: { start: number; end: number }
    averageQualityScore?: number
    overallErrorRate: number
  }
  
  // Detailed sections
  sections: Array<{
    id: string
    title: string
    type: 'chart' | 'table' | 'text' | 'metrics'
    data: any
    config?: Record<string, any>
  }>
  
  // Export info
  exportedFormats: Array<{
    format: string
    path: string
    size: number
    createdAt: number
  }>
  
  metadata: Record<string, any>
}

export interface DistributionChannel {
  id: string
  name: string
  type: 'email' | 'webhook' | 'api' | 'filesystem' | 'database' | 'custom'
  enabled: boolean
  
  // Configuration by type
  config: {
    // Email
    recipients?: string[]
    subject?: string
    template?: string
    
    // Webhook  
    url?: string
    method?: 'POST' | 'PUT' | 'PATCH'
    headers?: Record<string, string>
    authentication?: {
      type: 'bearer' | 'basic' | 'apikey'
      credentials: Record<string, string>
    }
    
    // API
    endpoint?: string
    apiKey?: string
    
    // Filesystem
    basePath?: string
    fileNaming?: string
    compression?: boolean
    
    // Database
    connectionString?: string
    table?: string
    
    // Custom
    handler?: string
    customConfig?: Record<string, any>
  }
  
  // Filters - when to distribute
  filters: {
    resultTypes?: string[]
    qualityThresholds?: {
      minScore?: number
      maxErrorRate?: number
    }
    batchFilters?: {
      batchIds?: string[]
      projectIds?: string[]
    }
    schedules?: Array<{
      type: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'custom'
      cron?: string
    }>
  }
  
  // Status tracking
  lastDelivery?: {
    timestamp: number
    success: boolean
    error?: string
    resultId: string
  }
  
  metadata: Record<string, any>
}

export interface ResultsStorage {
  // Storage operations
  store(result: AggregatedResult): Promise<string>
  retrieve(id: string): Promise<AggregatedResult | null>
  query(query: ResultsQuery): Promise<AggregatedResult[]>
  update(id: string, updates: Partial<AggregatedResult>): Promise<boolean>
  delete(id: string): Promise<boolean>
  
  // Bulk operations
  storeBatch(results: AggregatedResult[]): Promise<string[]>
  queryCount(query: ResultsQuery): Promise<number>
  
  // Maintenance
  cleanup(olderThan: number): Promise<number>
  export(query: ResultsQuery): Promise<string>
  import(data: string): Promise<number>
  
  // Configuration
  configure(config: ResultsStorageConfig): void
  getConfig(): ResultsStorageConfig
}

export interface ResultsStorageConfig {
  adapter: 'memory' | 'localStorage' | 'indexedDB' | 'custom'
  maxStorageSize: number // in MB
  compressionEnabled: boolean
  encryptionEnabled: boolean
  autoCleanup: boolean
  retentionDays: number
  backupEnabled: boolean
  
  // Custom adapter
  customAdapter?: {
    store: (result: AggregatedResult) => Promise<string>
    retrieve: (id: string) => Promise<AggregatedResult | null>
    query: (query: ResultsQuery) => Promise<AggregatedResult[]>
    delete: (id: string) => Promise<boolean>
  }
  
  metadata: Record<string, any>
}

export interface ResultsAggregator {
  // Core aggregation
  aggregate(jobs: ProcessingJob[]): Promise<AggregatedResult>
  aggregateBatch(batchId: string): Promise<AggregatedResult>
  aggregateByQuery(query: ResultsQuery): Promise<AggregatedResult[]>
  
  // Real-time aggregation
  startRealTimeAggregation(config?: AggregationConfig): void
  stopRealTimeAggregation(): void
  onResultAggregated(callback: (result: AggregatedResult) => void): void
  
  // Configuration
  configure(config: AggregationConfig): void
  getConfig(): AggregationConfig
  
  // Utilities
  validateResult(result: AggregatedResult): boolean
  calculateQualityScore(result: AggregatedResult): number
  generateInsights(result: AggregatedResult): string[]
}

export interface ResultsAnalytics {
  // Trend analysis
  analyzeTrends(results: AggregatedResult[], timeWindow: number): Promise<{
    qualityTrends: Array<{ timestamp: number; score: number }>
    performanceTrends: Array<{ timestamp: number; throughput: number }>
    errorTrends: Array<{ timestamp: number; errorRate: number }>
    volumeTrends: Array<{ timestamp: number; fileCount: number; segmentCount: number }>
  }>
  
  // Comparative analysis
  compareResults(result1: AggregatedResult, result2: AggregatedResult): {
    qualityComparison: {
      scoreDiff: number
      errorRateDiff: number
      improvements: string[]
      regressions: string[]
    }
    performanceComparison: {
      throughputDiff: number
      processingTimeDiff: number
      efficiencyChange: number
    }
  }
  
  // Predictive analysis
  predictPerformance(historicalResults: AggregatedResult[]): {
    predictedThroughput: number
    predictedQualityScore: number
    predictedErrorRate: number
    confidence: number
    recommendations: string[]
  }
  
  // Anomaly detection
  detectAnomalies(results: AggregatedResult[]): Array<{
    resultId: string
    anomalyType: 'quality' | 'performance' | 'errors' | 'volume'
    severity: 'low' | 'medium' | 'high'
    description: string
    value: number
    expectedRange: { min: number; max: number }
  }>
  
  // Benchmarking
  generateBenchmarks(results: AggregatedResult[]): {
    qualityBenchmarks: {
      averageScore: number
      p95Score: number
      p99Score: number
    }
    performanceBenchmarks: {
      averageThroughput: number
      peakThroughput: number
      averageProcessingTime: number
    }
    reliabilityBenchmarks: {
      averageErrorRate: number
      maxErrorRate: number
      uptime: number
    }
  }
}

export interface ExportFormat {
  name: string
  extension: string
  mimeType: string
  supportsStreaming: boolean
  maxSize?: number // in MB
  
  // Format-specific options
  options?: {
    // PDF options
    pageSize?: 'A4' | 'Letter' | 'Legal'
    orientation?: 'portrait' | 'landscape'
    includeCharts?: boolean
    
    // Excel options
    worksheets?: string[]
    includeFormulas?: boolean
    formatting?: boolean
    
    // CSV options
    delimiter?: ',' | ';' | '\t'
    encoding?: 'utf-8' | 'latin1'
    headers?: boolean
    
    // JSON options
    pretty?: boolean
    compression?: boolean
    
    // Custom options
    customConfig?: Record<string, any>
  }
}

// Default configurations
export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  includeRawResults: true,
  includeDetailedErrors: true,
  includePerformanceMetrics: true,
  includeQualityAnalysis: true,
  groupByFileType: true,
  groupByLanguagePair: true,
  groupByBatch: true,
  groupByProject: false,
  enableQualityScoring: true,
  qualityWeights: {
    errors: 0.4,
    warnings: 0.2,
    completeness: 0.3,
    consistency: 0.1
  },
  timeWindows: [3600000, 86400000, 604800000], // 1 hour, 1 day, 1 week
  performanceBaselines: {
    expectedSegmentsPerHour: 1000,
    expectedFilesPerHour: 50,
    expectedErrorRate: 0.05
  },
  persistResults: true,
  exportFormats: ['json', 'csv'],
  compressionEnabled: true,
  metadata: {}
}

export const DEFAULT_RESULTS_STORAGE_CONFIG: ResultsStorageConfig = {
  adapter: 'localStorage',
  maxStorageSize: 100, // 100MB
  compressionEnabled: true,
  encryptionEnabled: false,
  autoCleanup: true,
  retentionDays: 30,
  backupEnabled: true,
  metadata: {}
}

export const SUPPORTED_EXPORT_FORMATS: Record<string, ExportFormat> = {
  json: {
    name: 'JSON',
    extension: 'json',
    mimeType: 'application/json',
    supportsStreaming: true,
    options: {
      pretty: true,
      compression: true
    }
  },
  csv: {
    name: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
    supportsStreaming: true,
    options: {
      delimiter: ',',
      encoding: 'utf-8',
      headers: true
    }
  },
  excel: {
    name: 'Excel',
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    supportsStreaming: false,
    maxSize: 50,
    options: {
      worksheets: ['Summary', 'Details', 'Analytics'],
      includeFormulas: true,
      formatting: true
    }
  },
  pdf: {
    name: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
    supportsStreaming: false,
    maxSize: 25,
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      includeCharts: true
    }
  }
} 