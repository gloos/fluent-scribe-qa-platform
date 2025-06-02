/**
 * Worker Pool for Parallel Chunk Processing
 * 
 * This module integrates chunk processing with the existing parallel processing framework,
 * providing intelligent worker management for chunk upload operations.
 */

import { 
  ChunkMetadata, 
  ChunkUploadOptions, 
  ChunkUploadResult, 
  ChunkProgressTracker 
} from './types'
import { 
  ParallelProcessingManager,
  StrategyType,
  SystemResources,
  detectSystemResources
} from '../batch/parallel-strategy'
import { uploadChunk } from '../storage'
import { calculateChunkChecksum, validateChunk } from './utils'

export interface ChunkWorkerJob {
  id: string
  chunkMetadata: ChunkMetadata
  chunkBlob: Blob
  options: ChunkUploadOptions
  priority: 'low' | 'normal' | 'high' | 'urgent'
  retryCount: number
  maxRetries: number
  createdAt: number
}

export interface WorkerPoolConfig {
  maxWorkers?: number
  strategy?: StrategyType
  enableAdaptiveScheduling?: boolean
  enableResourceMonitoring?: boolean
  workerTimeoutMs?: number
  retryDelayMs?: number
  maxRetries?: number
}

export interface WorkerStats {
  totalWorkers: number
  activeWorkers: number
  idleWorkers: number
  completedJobs: number
  failedJobs: number
  averageJobTime: number
  systemResources: SystemResources
  currentStrategy: string
}

export class ChunkWorkerPool {
  private parallelManager: ParallelProcessingManager
  private config: Required<WorkerPoolConfig>
  private workerQueue: ChunkWorkerJob[] = []
  private activeJobs: Map<string, ChunkWorkerJob> = new Map()
  private completedJobs: Map<string, ChunkUploadResult> = new Map()
  private progressTrackers: Map<string, ChunkProgressTracker> = new Map()
  
  private isRunning: boolean = false
  private processingInterval: NodeJS.Timeout | null = null
  private workerPromises: Map<string, Promise<ChunkUploadResult>> = new Map()
  
  private stats = {
    completedJobs: 0,
    failedJobs: 0,
    totalJobTime: 0,
    jobStartTimes: new Map<string, number>()
  }

  constructor(config: WorkerPoolConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers || 6,
      strategy: config.strategy || 'balanced',
      enableAdaptiveScheduling: config.enableAdaptiveScheduling ?? true,
      enableResourceMonitoring: config.enableResourceMonitoring ?? true,
      workerTimeoutMs: config.workerTimeoutMs || 30000, // 30 seconds
      retryDelayMs: config.retryDelayMs || 1000,
      maxRetries: config.maxRetries || 3
    }

    this.parallelManager = new ParallelProcessingManager(this.config.strategy)
    
    console.log(`🏭 ChunkWorkerPool initialized with ${this.config.strategy} strategy`)
  }

  /**
   * Start the worker pool
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Worker pool is already running')
      return
    }

    this.isRunning = true
    console.log(`🚀 Starting chunk worker pool with max ${this.config.maxWorkers} workers`)

    // Start the job processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs()
    }, 1000) // Check every second

    // Start immediate processing
    this.processJobs()
  }

  /**
   * Stop the worker pool
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Worker pool is not running')
      return
    }

    this.isRunning = false
    console.log('⏹️ Stopping chunk worker pool...')

    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    // Wait for active jobs to complete
    if (this.workerPromises.size > 0) {
      console.log(`⏳ Waiting for ${this.workerPromises.size} active jobs to complete...`)
      await Promise.allSettled(Array.from(this.workerPromises.values()))
    }

    this.parallelManager.destroy()
    console.log('✅ Worker pool stopped')
  }

  /**
   * Add chunk upload job to the queue
   */
  addJob(
    chunkMetadata: ChunkMetadata,
    chunkBlob: Blob,
    options: ChunkUploadOptions = {},
    priority: ChunkWorkerJob['priority'] = 'normal'
  ): string {
    const job: ChunkWorkerJob = {
      id: chunkMetadata.chunkId,
      chunkMetadata,
      chunkBlob,
      options,
      priority,
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      createdAt: Date.now()
    }

    // Insert job based on priority
    this.insertJobByPriority(job)
    
    console.log(`📋 Added chunk job to queue: ${chunkMetadata.chunkId} (priority: ${priority})`)
    
    // Start processing if not running
    if (!this.isRunning) {
      this.start()
    }

    return job.id
  }

  /**
   * Add multiple chunk jobs efficiently
   */
  addJobs(
    chunks: { metadata: ChunkMetadata; blob: Blob; options?: ChunkUploadOptions }[],
    priority: ChunkWorkerJob['priority'] = 'normal'
  ): string[] {
    const jobIds: string[] = []

    for (const chunk of chunks) {
      const jobId = this.addJob(chunk.metadata, chunk.blob, chunk.options, priority)
      jobIds.push(jobId)
    }

    console.log(`📋 Added ${chunks.length} chunk jobs to queue`)
    return jobIds
  }

  /**
   * Get job result
   */
  getResult(jobId: string): ChunkUploadResult | null {
    return this.completedJobs.get(jobId) || null
  }

  /**
   * Get all results for a file
   */
  getFileResults(fileId: string): ChunkUploadResult[] {
    const results: ChunkUploadResult[] = []
    
    for (const [jobId, result] of this.completedJobs.entries()) {
      if (jobId.startsWith(fileId)) {
        results.push(result)
      }
    }

    return results.sort((a, b) => {
      // Sort by chunk index if available in chunk ID
      const aIndex = this.extractChunkIndex(a.chunkId)
      const bIndex = this.extractChunkIndex(b.chunkId)
      return aIndex - bIndex
    })
  }

  /**
   * Get worker pool statistics
   */
  async getStats(): Promise<WorkerStats> {
    const systemResources = await this.parallelManager.getSystemResources()
    
    return {
      totalWorkers: this.config.maxWorkers,
      activeWorkers: this.activeJobs.size,
      idleWorkers: this.config.maxWorkers - this.activeJobs.size,
      completedJobs: this.stats.completedJobs,
      failedJobs: this.stats.failedJobs,
      averageJobTime: this.stats.completedJobs > 0 
        ? this.stats.totalJobTime / this.stats.completedJobs 
        : 0,
      systemResources,
      currentStrategy: this.parallelManager.getCurrentStrategy().name
    }
  }

  /**
   * Cancel a specific job
   */
  cancelJob(jobId: string): boolean {
    // Remove from queue if not started
    const queueIndex = this.workerQueue.findIndex(job => job.id === jobId)
    if (queueIndex !== -1) {
      this.workerQueue.splice(queueIndex, 1)
      console.log(`🚫 Cancelled queued job: ${jobId}`)
      return true
    }

    // Cancel active job if possible
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId)
      this.workerPromises.delete(jobId)
      console.log(`🚫 Cancelled active job: ${jobId}`)
      return true
    }

    return false
  }

  /**
   * Cancel all jobs for a specific file
   */
  cancelFileJobs(fileId: string): number {
    let cancelledCount = 0

    // Cancel queued jobs
    this.workerQueue = this.workerQueue.filter(job => {
      if (job.chunkMetadata.fileId === fileId) {
        cancelledCount++
        return false
      }
      return true
    })

    // Cancel active jobs
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.chunkMetadata.fileId === fileId) {
        this.activeJobs.delete(jobId)
        this.workerPromises.delete(jobId)
        cancelledCount++
      }
    }

    console.log(`🚫 Cancelled ${cancelledCount} jobs for file: ${fileId}`)
    return cancelledCount
  }

  /**
   * Update worker pool strategy
   */
  setStrategy(strategy: StrategyType): void {
    this.parallelManager.setStrategy(strategy)
    this.config.strategy = strategy
    console.log(`🔄 Updated worker pool strategy to: ${strategy}`)
  }

  /**
   * Main job processing loop
   */
  private async processJobs(): Promise<void> {
    if (!this.isRunning || this.workerQueue.length === 0) {
      return
    }

    try {
      // Get system resources for intelligent scheduling
      const systemResources = await this.parallelManager.getSystemResources()
      
      // Determine optimal concurrency based on system resources and current load
      const optimalConcurrency = await this.calculateOptimalConcurrency(systemResources)
      const availableWorkers = Math.max(0, optimalConcurrency - this.activeJobs.size)
      
      if (availableWorkers === 0) {
        return // No workers available
      }

      // Select jobs to process
      const jobsToProcess = this.selectJobsToProcess(availableWorkers)
      
      // Start processing selected jobs
      for (const job of jobsToProcess) {
        this.startJobProcessing(job)
      }

    } catch (error) {
      console.error('❌ Error in worker pool job processing:', error)
    }
  }

  /**
   * Calculate optimal concurrency based on system resources
   */
  private async calculateOptimalConcurrency(systemResources: SystemResources): Promise<number> {
    if (!this.config.enableAdaptiveScheduling) {
      return this.config.maxWorkers
    }

    // Use parallel processing manager to calculate optimal concurrency
    // For chunk uploads, we consider them as lightweight IO jobs
    
    // Create a mock File object for the parallel processing calculation
    const mockFileContent = new ArrayBuffer(8)
    const mockFile = new File([mockFileContent], 'chunk', { type: 'application/octet-stream' })

    const mockJobs = [{
      id: 'chunk-upload',
      type: 'export' as const, // Closest to chunk upload (IO intensive)
      status: 'pending' as const,
      priority: 2, // Normal priority
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileSize: 5 * 1024 * 1024, // 5MB average chunk
      progress: { percentage: 0, stage: 'pending', message: '' },
      file: mockFile,
      fileName: 'chunk',
      fileType: 'xliff-2.0' as const,
      config: {},
      retryAttempt: 0,
      maxRetryAttempts: 3,
      metadata: {}
    }]

    const mockMetrics = {
      totalJobs: this.workerQueue.length,
      completedJobs: this.stats.completedJobs,
      failedJobs: this.stats.failedJobs,
      processingJobs: this.activeJobs.size,
      pendingJobs: this.workerQueue.length,
      cancelledJobs: 0,
      avgProcessingTime: this.stats.completedJobs > 0 
        ? this.stats.totalJobTime / this.stats.completedJobs 
        : 5000,
      averageProcessingTime: this.stats.completedJobs > 0 
        ? this.stats.totalJobTime / this.stats.completedJobs 
        : 5000,
      averageWaitTime: 0,
      throughputPerHour: 0,
      errorRate: this.stats.failedJobs / Math.max(1, this.stats.completedJobs + this.stats.failedJobs),
      currentConcurrency: this.activeJobs.size,
      queueUtilization: this.activeJobs.size / this.config.maxWorkers,
      systemResources
    }

    const optimalConcurrency = this.parallelManager.getCurrentStrategy()
      .calculateOptimalConcurrency(systemResources, mockJobs, mockMetrics)

    return Math.min(optimalConcurrency, this.config.maxWorkers)
  }

  /**
   * Select jobs to process based on priority and resources
   */
  private selectJobsToProcess(maxJobs: number): ChunkWorkerJob[] {
    const jobs: ChunkWorkerJob[] = []
    const priorityOrder = ['urgent', 'high', 'normal', 'low']
    
    for (const priority of priorityOrder) {
      const priorityJobs = this.workerQueue
        .filter(job => job.priority === priority)
        .slice(0, maxJobs - jobs.length)
      
      jobs.push(...priorityJobs)
      
      if (jobs.length >= maxJobs) {
        break
      }
    }

    // Remove selected jobs from queue
    for (const job of jobs) {
      const index = this.workerQueue.findIndex(queueJob => queueJob.id === job.id)
      if (index !== -1) {
        this.workerQueue.splice(index, 1)
      }
    }

    return jobs
  }

  /**
   * Start processing a single job
   */
  private startJobProcessing(job: ChunkWorkerJob): void {
    this.activeJobs.set(job.id, job)
    this.stats.jobStartTimes.set(job.id, Date.now())
    
    const jobPromise = this.processChunkJob(job)
      .finally(() => {
        this.activeJobs.delete(job.id)
        this.workerPromises.delete(job.id)
        
        const startTime = this.stats.jobStartTimes.get(job.id)
        if (startTime) {
          const jobTime = Date.now() - startTime
          this.stats.totalJobTime += jobTime
          this.stats.jobStartTimes.delete(job.id)
        }
      })

    this.workerPromises.set(job.id, jobPromise)
  }

  /**
   * Process a single chunk upload job
   */
  private async processChunkJob(job: ChunkWorkerJob): Promise<ChunkUploadResult> {
    const { chunkMetadata, chunkBlob, options } = job

    try {
      console.log(`🔄 Processing chunk: ${chunkMetadata.chunkId}`)

      // Validate chunk
      if (!validateChunk(chunkBlob, {
        expectedSize: chunkMetadata.actualSize,
        startByte: chunkMetadata.startByte,
        endByte: chunkMetadata.endByte
      })) {
        throw new Error('Chunk validation failed')
      }

      // Calculate checksum if not already set
      if (!chunkMetadata.checksum) {
        chunkMetadata.checksum = await calculateChunkChecksum(chunkBlob)
      }

      // Upload chunk
      const bucket = options.bucket || 'qa-files'
      const folder = options.folder ? `${options.folder}/chunks` : 'chunks'
      
      const uploadResult = await uploadChunk(chunkBlob, chunkMetadata.chunkId, bucket, folder)

      if (uploadResult.error || !uploadResult.data) {
        throw uploadResult.error || new Error('Upload failed - no data returned')
      }

      // Update chunk metadata with upload path
      chunkMetadata.uploadPath = uploadResult.data.path

      const result: ChunkUploadResult = {
        success: true,
        chunkId: chunkMetadata.chunkId,
        uploadPath: uploadResult.data.path
      }

      this.completedJobs.set(job.id, result)
      this.stats.completedJobs++

      // Call progress callback if provided
      if (options.onChunkComplete) {
        options.onChunkComplete(chunkMetadata)
      }

      console.log(`✅ Chunk processed successfully: ${chunkMetadata.chunkId}`)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'
      
      const result: ChunkUploadResult = {
        success: false,
        chunkId: chunkMetadata.chunkId,
        error: errorMessage,
        retryCount: job.retryCount
      }

      console.error(`❌ Chunk processing failed: ${chunkMetadata.chunkId}`, error)

      // Retry logic
      if (job.retryCount < job.maxRetries) {
        console.log(`🔄 Retrying chunk ${chunkMetadata.chunkId}, attempt ${job.retryCount + 1}/${job.maxRetries}`)
        
        // Add job back to queue with increased retry count
        const retryJob: ChunkWorkerJob = {
          ...job,
          retryCount: job.retryCount + 1
        }

        // Add delay before retry
        setTimeout(() => {
          this.insertJobByPriority(retryJob)
        }, this.config.retryDelayMs * (job.retryCount + 1))

        return result
      }

      // Max retries exceeded
      this.completedJobs.set(job.id, result)
      this.stats.failedJobs++

      return result
    }
  }

  /**
   * Insert job into queue based on priority
   */
  private insertJobByPriority(job: ChunkWorkerJob): void {
    const priorityValues = { urgent: 4, high: 3, normal: 2, low: 1 }
    const jobPriority = priorityValues[job.priority] || 2

    let insertIndex = this.workerQueue.length
    
    for (let i = 0; i < this.workerQueue.length; i++) {
      const queueJobPriority = priorityValues[this.workerQueue[i].priority] || 2
      if (jobPriority > queueJobPriority) {
        insertIndex = i
        break
      }
    }

    this.workerQueue.splice(insertIndex, 0, job)
  }

  /**
   * Extract chunk index from chunk ID for sorting
   */
  private extractChunkIndex(chunkId: string): number {
    const match = chunkId.match(/chunk_(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }
}

// Export singleton instance for convenience
export const defaultChunkWorkerPool = new ChunkWorkerPool() 