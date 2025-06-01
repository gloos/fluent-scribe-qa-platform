import { 
  ProcessingJob, 
  ProcessingResult, 
  ProcessingError, 
  JobPriority,
  ProcessingConfig 
} from './types'
import { BatchProcessingQueue, processingQueue } from './queue'
import { XLIFF12Parser, XLIFF20Parser, MXLIFFParser } from '@/lib/parsers'
import { validateFiles } from '@/lib/fileValidation'
import { 
  ParallelProcessingManager, 
  parallelProcessingManager, 
  StrategyType,
  SystemResources 
} from './parallel-strategy'
import { progressTracker } from './progress-tracker'

export interface ProcessorOptions {
  maxConcurrentJobs?: number
  enableAutoRetry?: boolean
  enableAnalytics?: boolean
  parallelStrategy?: StrategyType
  adaptiveScheduling?: boolean
  onJobProgress?: (job: ProcessingJob) => void
  onJobCompleted?: (job: ProcessingJob, result: ProcessingResult) => void
  onJobFailed?: (job: ProcessingJob, error: ProcessingError) => void
  onBatchCompleted?: (batchId: string) => void
}

export class BatchProcessor {
  private queue: BatchProcessingQueue
  private isRunning: boolean = false
  private processingInterval: NodeJS.Timeout | null = null
  private options: ProcessorOptions
  private parallelManager: ParallelProcessingManager
  private currentlyProcessing: Set<string> = new Set()

  constructor(queue?: BatchProcessingQueue, options: ProcessorOptions = {}) {
    this.queue = queue || processingQueue
    this.options = {
      maxConcurrentJobs: 3,
      enableAutoRetry: true,
      enableAnalytics: false,
      parallelStrategy: 'balanced',
      adaptiveScheduling: true,
      ...options
    }

    // Initialize parallel processing manager
    this.parallelManager = options.parallelStrategy ? 
      new ParallelProcessingManager(options.parallelStrategy) : 
      parallelProcessingManager

    // Start progress tracking
    progressTracker.start()

    // Set up event listeners
    this.setupEventListeners()
  }

  /**
   * Start the batch processor with intelligent parallel processing
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Batch processor is already running')
      return
    }

    this.isRunning = true
    console.log(`🚀 Starting batch processor with ${this.parallelManager.getCurrentStrategy().name}`)

    // Start processing loop with adaptive scheduling
    this.processingInterval = setInterval(() => {
      this.processNextJobs()
    }, 2000) // Check every 2 seconds for more responsive scheduling

    // Process immediately
    this.processNextJobs()
  }

  /**
   * Stop the batch processor
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⏹️ Batch processor is not running')
      return
    }

    this.isRunning = false
    console.log('⏹️ Stopping batch processor')

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
  }

  /**
   * Process files from uploaded files
   */
  async processFiles(
    files: File[], 
    config: ProcessingConfig = {},
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string[]> {
    const jobIds: string[] = []

    for (const file of files) {
      try {
        // Determine file type
        const fileType = this.detectFileType(file)
        
        // Create processing job
        const jobId = this.queue.addJob({
          type: 'parse',
          priority,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          config,
          progress: {
            percentage: 0,
            stage: 'queued',
            message: 'Queued for processing'
          },
          retryAttempt: 0,
          maxRetryAttempts: 3,
          metadata: {
            source: 'batch-processor',
            uploadedAt: Date.now()
          }
        })

        jobIds.push(jobId)
        console.log(`📄 Added file to processing queue: ${file.name} (${jobId})`)
      } catch (error) {
        console.error(`❌ Failed to add file to queue: ${file.name}`, error)
      }
    }

    // Start processor if not running
    if (!this.isRunning) {
      this.start()
    }

    return jobIds
  }

  /**
   * Create and process a batch operation
   */
  async processBatch(
    name: string,
    files: File[],
    config: ProcessingConfig = {},
    priority: JobPriority = JobPriority.HIGH
  ): Promise<string> {
    // Add all files as jobs
    const jobIds = await this.processFiles(files, config, priority)
    
    // Create batch operation
    const batchId = this.queue.createBatch(name, jobIds, config)
    
    // Start progress tracking for the batch
    const batch = this.queue.getBatch(batchId)
    if (batch) {
      progressTracker.trackBatch(batch)
    }
    
    console.log(`📦 Created batch: ${name} with ${jobIds.length} jobs`)
    return batchId
  }

  /**
   * Get processing statistics with parallel processing insights
   */
  getStats() {
    const metrics = this.queue.getMetrics()
    return {
      ...metrics,
      isRunning: this.isRunning,
      processorOptions: this.options,
      parallelStrategy: this.getParallelStrategy(),
      currentlyProcessing: this.currentlyProcessing.size,
      adaptiveScheduling: this.options.adaptiveScheduling
    }
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: any) {
    return this.queue.getAllJobs(filter)
  }

  /**
   * Get specific job
   */
  getJob(jobId: string) {
    return this.queue.getJob(jobId)
  }

  /**
   * Cancel specific job
   */
  cancelJob(jobId: string): boolean {
    return this.queue.cancelJob(jobId)
  }

  /**
   * Retry failed job
   */
  retryJob(jobId: string): boolean {
    return this.queue.retryJob(jobId)
  }

  /**
   * Get batch information
   */
  getBatch(batchId: string) {
    return this.queue.getBatch(batchId)
  }

  /**
   * Get all batches
   */
  getBatches() {
    return this.queue.getAllBatches()
  }

  /**
   * Main processing loop - uses intelligent parallel processing strategies
   */
  private async processNextJobs(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Get current metrics and pending jobs
      const metrics = this.queue.getMetrics()
      const pendingJobs = this.queue.getPendingJobs()
      
      if (pendingJobs.length === 0) {
        return // No jobs to process
      }

      // Use parallel processing manager to determine optimal job batch
      const currentlyProcessingJobs = Array.from(this.currentlyProcessing)
        .map(id => this.queue.getJob(id))
        .filter(Boolean) as ProcessingJob[]

      let optimalBatch: ProcessingJob[] = []

      if (this.options.adaptiveScheduling) {
        // Use intelligent parallel processing strategy
        optimalBatch = await this.parallelManager.selectOptimalJobBatch(
          pendingJobs,
          this.options.maxConcurrentJobs
        )

        // Filter out jobs that can't be accepted due to resource constraints
        const acceptableJobs: ProcessingJob[] = []
        for (const job of optimalBatch) {
          const canAccept = await this.parallelManager.canAcceptNewJob(job, currentlyProcessingJobs)
          if (canAccept) {
            acceptableJobs.push(job)
          }
        }
        optimalBatch = acceptableJobs
      } else {
        // Fallback to simple queue-based selection
        const maxConcurrent = this.options.maxConcurrentJobs || 3
        const availableSlots = maxConcurrent - this.currentlyProcessing.size
        
        for (let i = 0; i < Math.min(availableSlots, pendingJobs.length); i++) {
          const nextJob = this.queue.getNextJob()
          if (nextJob && !this.currentlyProcessing.has(nextJob.id)) {
            optimalBatch.push(nextJob)
          }
        }
      }

      // Process selected jobs in parallel
      const processingPromises = optimalBatch.map(async (job) => {
        if (!this.currentlyProcessing.has(job.id)) {
          this.currentlyProcessing.add(job.id)
          try {
            await this.processJob(job)
          } finally {
            this.currentlyProcessing.delete(job.id)
          }
        }
      })

      // Wait for batch to complete (non-blocking for main loop)
      if (processingPromises.length > 0) {
        Promise.allSettled(processingPromises).then((results) => {
          const successful = results.filter(r => r.status === 'fulfilled').length
          const failed = results.filter(r => r.status === 'rejected').length
          
          if (this.options.enableAnalytics) {
            console.log(`📊 Batch completed: ${successful} successful, ${failed} failed`)
          }
        })
      }

    } catch (error) {
      console.error('❌ Error in intelligent processing loop:', error)
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    console.log(`🔄 Processing job: ${job.fileName} (${job.type})`)
    
    // Start progress tracking for this job
    progressTracker.trackJob(job)
    
    // Update job status to processing
    this.queue.updateJobStatus(job.id, 'processing')
    this.queue.updateJobProgress(job.id, {
      stage: 'starting',
      message: 'Initializing processing...',
      percentage: 0
    })

    // Update progress tracker
    progressTracker.updateJobProgress(job)

    try {
      let result: ProcessingResult

      switch (job.type) {
        case 'parse':
          result = await this.parseFile(job)
          break
        case 'analyze':
          result = await this.analyzeFile(job)
          break
        case 'validate':
          result = await this.validateFile(job)
          break
        case 'export':
          result = await this.exportFile(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      // Update job with results
      job.result = result
      this.queue.updateJobStatus(job.id, 'completed')
      this.queue.updateJobProgress(job.id, {
        stage: 'completed',
        message: 'Processing completed successfully',
        percentage: 100
      })

      // Update progress tracker
      progressTracker.updateJobProgress(job)

      console.log(`✅ Job completed: ${job.fileName}`)

    } catch (error) {
      const processingError = this.createProcessingError(error, job)
      job.error = processingError

      this.queue.updateJobStatus(job.id, 'failed')
      this.queue.updateJobProgress(job.id, {
        stage: 'error',
        message: processingError.message,
        percentage: 0
      })

      // Update progress tracker
      progressTracker.updateJobProgress(job)

      console.error(`❌ Job failed: ${job.fileName}`, processingError)

      // Auto-retry if enabled and retries remaining
      if (this.options.enableAutoRetry && 
          processingError.isRetriable && 
          job.retryAttempt < job.maxRetryAttempts) {
        
        setTimeout(() => {
          this.queue.retryJob(job.id)
        }, this.calculateRetryDelay(job.retryAttempt))
      }
    }
  }

  /**
   * Parse XLIFF file based on detected type
   */
  private async parseFile(job: ProcessingJob): Promise<ProcessingResult> {
    this.queue.updateJobProgress(job.id, {
      stage: 'parsing',
      message: 'Parsing XLIFF file...',
      percentage: 25
    })

    const fileContent = await this.readFileContent(job.file)
    let parseResult: any

    try {
      switch (job.fileType) {
        case 'xliff-1.2':
          parseResult = new XLIFF12Parser().parse(fileContent)
          break
        case 'xliff-2.0':
          parseResult = new XLIFF20Parser().parse(fileContent)
          break
        case 'mxliff':
          parseResult = new MXLIFFParser().parse(fileContent)
          break
        default:
          // Try to auto-detect
          if (fileContent.includes('xliff version="1.2"')) {
            parseResult = new XLIFF12Parser().parse(fileContent)
          } else if (fileContent.includes('xliff version="2.0"') || fileContent.includes('xliff version="2.1"')) {
            parseResult = new XLIFF20Parser().parse(fileContent)
          } else if (fileContent.includes('<mxliff:')) {
            parseResult = new MXLIFFParser().parse(fileContent)
          } else {
            throw new Error('Unable to determine XLIFF format')
          }
      }

      this.queue.updateJobProgress(job.id, {
        stage: 'analyzing',
        message: 'Analyzing parsed content...',
        percentage: 75
      })

      // Generate statistics
      const statistics = this.generateStatistics(parseResult)

      return {
        success: true,
        statistics,
        metadata: {
          fileName: job.fileName,
          fileSize: job.fileSize,
          fileType: job.fileType,
          parseTime: Date.now() - (job.startedAt || Date.now()),
          parser: `${job.fileType}-parser`
        }
      }

    } catch (parseError) {
      throw new Error(`Failed to parse ${job.fileType} file: ${parseError}`)
    }
  }

  /**
   * Analyze parsed XLIFF content
   */
  private async analyzeFile(job: ProcessingJob): Promise<ProcessingResult> {
    this.queue.updateJobProgress(job.id, {
      stage: 'analyzing',
      message: 'Performing quality analysis...',
      percentage: 50
    })

    // This would integrate with quality analysis modules
    // For now, return a basic analysis structure
    return {
      success: true,
      analysisReport: {
        errors: [],
        warnings: [],
        suggestions: []
      },
      statistics: {
        segmentCount: 0,
        wordCount: 0,
        translatedSegments: 0,
        untranslatedSegments: 0,
        qualityScore: 85
      },
      metadata: {
        analysisType: 'quality-check',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate XLIFF file
   */
  private async validateFile(job: ProcessingJob): Promise<ProcessingResult> {
    this.queue.updateJobProgress(job.id, {
      stage: 'validating',
      message: 'Validating file structure...',
      percentage: 50
    })

    try {
      const { validFiles, invalidFiles } = await validateFiles([job.file], {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['xliff', 'xlf', 'mxliff'],
        validateContent: true
      })

      const isValid = validFiles.length > 0
      const errors = invalidFiles.length > 0 ? invalidFiles[0].validation.errors : []
      const warnings = invalidFiles.length > 0 ? invalidFiles[0].validation.warnings : []

      return {
        success: isValid,
        analysisReport: {
          errors: errors.map(error => ({
            type: 'validation',
            severity: 'high',
            message: error
          })),
          warnings: warnings.map(warning => ({
            type: 'validation',
            message: warning
          })),
          suggestions: []
        },
        metadata: {
          validationResult: isValid ? 'passed' : 'failed',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      throw new Error(`Validation failed: ${error}`)
    }
  }

  /**
   * Export processed data
   */
  private async exportFile(job: ProcessingJob): Promise<ProcessingResult> {
    this.queue.updateJobProgress(job.id, {
      stage: 'exporting',
      message: 'Generating export...',
      percentage: 50
    })

    // This would implement actual export functionality
    // For now, return a placeholder
    return {
      success: true,
      outputFiles: [
        {
          name: `${job.fileName}_export.json`,
          path: `/exports/${job.id}.json`,
          type: 'application/json',
          size: 1024
        }
      ],
      metadata: {
        exportFormat: job.config.exportOptions?.format || 'json',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Detect XLIFF file type from file name and content
   */
  private detectFileType(file: File): ProcessingJob['fileType'] {
    const fileName = file.name.toLowerCase()
    
    if (fileName.endsWith('.mxliff')) {
      return 'mxliff'
    } else if (fileName.endsWith('.xliff') || fileName.endsWith('.xlf')) {
      // Would need to read content to determine version
      // For now, default to v2.0
      return 'xliff-2.0'
    }
    
    return 'unknown'
  }

  /**
   * Read file content as text
   */
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  /**
   * Generate statistics from parsed XLIFF data
   */
  private generateStatistics(parseResult: any): ProcessingResult['statistics'] {
    // This would analyze the parsed XLIFF structure
    // For now, return placeholder statistics
    return {
      segmentCount: 0,
      wordCount: 0,
      translatedSegments: 0,
      untranslatedSegments: 0
    }
  }

  /**
   * Create standardized processing error
   */
  private createProcessingError(error: any, job: ProcessingJob): ProcessingError {
    return {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'An error occurred during processing',
      type: 'parsing',
      severity: 'high',
      isRetriable: true,
      timestamp: Date.now(),
      details: {
        jobId: job.id,
        fileName: job.fileName,
        jobType: job.type,
        stack: error.stack
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
  }

  /**
   * Set up event listeners for queue events
   */
  private setupEventListeners(): void {
    this.queue.addEventListener({
      onJobCompleted: (job, result) => {
        // Update progress tracking
        progressTracker.updateJobProgress(job)
        
        if (this.options.onJobCompleted) {
          this.options.onJobCompleted(job, result)
        }
      },
      onJobFailed: (job, error) => {
        // Update progress tracking
        progressTracker.updateJobProgress(job)
        
        if (this.options.onJobFailed) {
          this.options.onJobFailed(job, error)
        }
      },
      onJobProgress: (job, progress) => {
        // Update progress tracking
        progressTracker.updateJobProgress(job)
        
        if (this.options.onJobProgress) {
          this.options.onJobProgress(job)
        }
      },
      onBatchCompleted: (batch) => {
        console.log(`📦 Batch completed: ${batch.name}`)
        
        // Update progress tracking
        progressTracker.updateBatchProgress(batch)
        
        if (this.options.onBatchCompleted) {
          this.options.onBatchCompleted(batch.id)
        }
      }
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop()
    console.log('🔥 Batch processor destroyed')
  }

  /**
   * Set parallel processing strategy
   */
  setParallelStrategy(strategy: StrategyType): void {
    this.parallelManager.setStrategy(strategy)
    this.options.parallelStrategy = strategy
    console.log(`🔄 Switched to ${strategy} parallel processing strategy`)
  }

  /**
   * Get current parallel processing strategy
   */
  getParallelStrategy(): StrategyType {
    return this.options.parallelStrategy || 'balanced'
  }

  /**
   * Get system resources information
   */
  async getSystemResources(): Promise<SystemResources> {
    return await this.parallelManager.getSystemResources()
  }

  /**
   * Get performance impact analysis for current workload
   */
  async getPerformanceAnalysis(): Promise<{
    systemResources: SystemResources
    currentWorkload: any
    projectedPerformance?: any
  }> {
    const systemResources = await this.parallelManager.getSystemResources()
    const currentJobs = Array.from(this.currentlyProcessing)
      .map(id => this.queue.getJob(id))
      .filter(Boolean) as ProcessingJob[]

    let projectedPerformance = undefined
    if (currentJobs.length > 0) {
      projectedPerformance = await this.parallelManager.analyzePerformanceImpact(currentJobs)
    }

    return {
      systemResources,
      currentWorkload: {
        activeJobs: currentJobs.length,
        jobTypes: currentJobs.reduce((acc, job) => {
          acc[job.type] = (acc[job.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        totalMemoryEstimate: currentJobs.reduce((sum, job) => {
          // This would use getJobResourceRequirements but avoiding circular import
          return sum + Math.max(50, job.fileSize / (1024 * 1024) * 2)
        }, 0)
      },
      projectedPerformance
    }
  }

  /**
   * Optimize current processing strategy based on workload
   */
  async optimizeStrategy(): Promise<{
    currentStrategy: string
    recommendedStrategy?: string
    reason?: string
  }> {
    const analysis = await this.getPerformanceAnalysis()
    const metrics = this.queue.getMetrics()
    const currentStrategy = this.getParallelStrategy()

    // Strategy optimization logic
    let recommendedStrategy: string | undefined = undefined
    let reason: string | undefined = undefined

    // High error rate - switch to conservative
    if (metrics.errorRate > 0.15) {
      recommendedStrategy = 'conservative'
      reason = 'High error rate detected, switching to conservative strategy for stability'
    }
    // Low resource utilization and good performance - try aggressive
    else if (
      analysis.systemResources.cpuUsage < 50 && 
      analysis.systemResources.memoryUsage < 60 &&
      metrics.errorRate < 0.05 &&
      currentStrategy !== 'aggressive'
    ) {
      recommendedStrategy = 'aggressive'
      reason = 'System resources underutilized with good performance, can push harder'
    }
    // High resource usage or moderate error rate - use balanced
    else if (
      (analysis.systemResources.cpuUsage > 80 || analysis.systemResources.memoryUsage > 80) &&
      currentStrategy === 'aggressive'
    ) {
      recommendedStrategy = 'balanced'
      reason = 'High resource usage detected, switching to balanced strategy'
    }

    // Auto-apply recommendation if different from current
    if (recommendedStrategy && recommendedStrategy !== currentStrategy) {
      console.log(`🔄 Auto-optimizing strategy: ${reason}`)
      this.setParallelStrategy(recommendedStrategy as StrategyType)
    }

    return {
      currentStrategy,
      recommendedStrategy,
      reason
    }
  }
}

// Export singleton instance
export const batchProcessor = new BatchProcessor()

export default BatchProcessor 