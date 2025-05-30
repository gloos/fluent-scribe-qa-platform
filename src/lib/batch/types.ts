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