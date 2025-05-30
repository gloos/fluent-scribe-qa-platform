import { 
  ProcessingJob, 
  ProcessingQueue, 
  QueueConfig, 
  QueueMetrics, 
  QueueEventListener, 
  ProcessingJobFilter, 
  BatchOperation, 
  JobPriority,
  ProcessingConfig,
  DEFAULT_QUEUE_CONFIG,
  ProcessingError,
  ProcessingResult
} from './types'

export class BatchProcessingQueue implements ProcessingQueue {
  private jobs: Map<string, ProcessingJob> = new Map()
  private batches: Map<string, BatchOperation> = new Map()
  private listeners: Set<QueueEventListener> = new Set()
  private config: QueueConfig = { ...DEFAULT_QUEUE_CONFIG }
  private isPaused: boolean = false
  private processingJobs: Set<string> = new Set()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<QueueConfig>) {
    if (config) {
      this.updateConfig(config)
    }
    this.startCleanupTimer()
  }

  // Job Management
  addJob(jobData: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>): string {
    if (this.jobs.size >= this.config.maxQueueSize) {
      this.notifyListeners('onQueueFull')
      throw new Error(`Queue is full. Maximum size: ${this.config.maxQueueSize}`)
    }

    const job: ProcessingJob = {
      ...jobData,
      id: this.generateJobId(),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: {
        percentage: 0,
        stage: 'queued',
        message: 'Job queued for processing'
      }
    }

    this.jobs.set(job.id, job)
    this.notifyListeners('onJobAdded', job)

    console.log(`📋 Job added to queue: ${job.fileName} (${job.type})`)
    return job.id
  }

  addJobs(jobsData: Array<Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>>): string[] {
    const jobIds: string[] = []
    
    for (const jobData of jobsData) {
      if (this.jobs.size >= this.config.maxQueueSize) {
        console.warn(`⚠️ Queue full after adding ${jobIds.length} jobs. Remaining jobs skipped.`)
        break
      }
      jobIds.push(this.addJob(jobData))
    }

    return jobIds
  }

  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    // Cancel if currently processing
    if (job.status === 'processing') {
      this.cancelJob(jobId)
    }

    this.jobs.delete(jobId)
    this.processingJobs.delete(jobId)

    // Remove from any batches
    this.batches.forEach(batch => {
      const index = batch.jobIds.indexOf(jobId)
      if (index > -1) {
        batch.jobIds.splice(index, 1)
        this.updateBatchProgress(batch.id)
      }
    })

    console.log(`🗑️ Job removed: ${job.fileName}`)
    return true
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'completed' || job.status === 'cancelled') {
      return false
    }

    job.status = 'cancelled'
    job.updatedAt = Date.now()
    this.processingJobs.delete(jobId)

    this.notifyListeners('onJobCancelled', job)
    console.log(`❌ Job cancelled: ${job.fileName}`)
    return true
  }

  retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'failed') return false

    if (job.retryAttempt >= job.maxRetryAttempts) {
      console.warn(`⚠️ Job ${job.fileName} has exceeded max retry attempts`)
      return false
    }

    job.status = 'pending'
    job.retryAttempt += 1
    job.updatedAt = Date.now()
    job.error = undefined
    job.progress = {
      percentage: 0,
      stage: 'queued',
      message: `Retry attempt ${job.retryAttempt}/${job.maxRetryAttempts}`
    }

    this.notifyListeners('onJobRetry', job, job.retryAttempt)
    console.log(`🔄 Job retry scheduled: ${job.fileName} (attempt ${job.retryAttempt})`)
    return true
  }

  // Queue Operations
  getJob(jobId: string): ProcessingJob | null {
    return this.jobs.get(jobId) || null
  }

  getAllJobs(filter?: ProcessingJobFilter): ProcessingJob[] {
    let jobs = Array.from(this.jobs.values())

    if (!filter) return jobs

    // Apply filters
    if (filter.status) {
      jobs = jobs.filter(job => filter.status!.includes(job.status))
    }

    if (filter.type) {
      jobs = jobs.filter(job => filter.type!.includes(job.type))
    }

    if (filter.priority) {
      jobs = jobs.filter(job => filter.priority!.includes(job.priority))
    }

    if (filter.fileType) {
      jobs = jobs.filter(job => filter.fileType!.includes(job.fileType))
    }

    if (filter.userId) {
      jobs = jobs.filter(job => job.userId === filter.userId)
    }

    if (filter.projectId) {
      jobs = jobs.filter(job => job.projectId === filter.projectId)
    }

    if (filter.tags && filter.tags.length > 0) {
      jobs = jobs.filter(job => 
        job.tags && filter.tags!.some(tag => job.tags!.includes(tag))
      )
    }

    if (filter.dateRange) {
      jobs = jobs.filter(job => 
        job.createdAt >= filter.dateRange!.start && 
        job.createdAt <= filter.dateRange!.end
      )
    }

    if (filter.hasErrors !== undefined) {
      jobs = jobs.filter(job => filter.hasErrors ? !!job.error : !job.error)
    }

    return jobs
  }

  getQueueSize(): number {
    return this.jobs.size
  }

  clear(): void {
    // Cancel all processing jobs
    this.processingJobs.forEach(jobId => {
      this.cancelJob(jobId)
    })

    this.jobs.clear()
    this.batches.clear()
    this.processingJobs.clear()

    console.log('🧹 Queue cleared')
  }

  pause(): void {
    this.isPaused = true
    console.log('⏸️ Queue paused')
  }

  resume(): void {
    this.isPaused = false
    console.log('▶️ Queue resumed')
  }

  // Progress and Status
  updateJobProgress(jobId: string, progress: Partial<ProcessingJob['progress']>): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.progress = { ...job.progress, ...progress }
    job.updatedAt = Date.now()

    this.notifyListeners('onJobProgress', job, job.progress)
  }

  updateJobStatus(jobId: string, status: ProcessingJob['status']): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const previousStatus = job.status
    job.status = status
    job.updatedAt = Date.now()

    if (status === 'processing') {
      job.startedAt = Date.now()
      this.processingJobs.add(jobId)
      this.notifyListeners('onJobStarted', job)
    } else if (status === 'completed') {
      job.completedAt = Date.now()
      this.processingJobs.delete(jobId)
      this.notifyListeners('onJobCompleted', job, job.result!)
    } else if (status === 'failed') {
      this.processingJobs.delete(jobId)
      this.notifyListeners('onJobFailed', job, job.error!)
    } else if (status === 'cancelled') {
      this.processingJobs.delete(jobId)
      this.notifyListeners('onJobCancelled', job)
    }

    // Update batch progress if job is part of a batch
    this.batches.forEach(batch => {
      if (batch.jobIds.includes(jobId)) {
        this.updateBatchProgress(batch.id)
      }
    })

    // Check if queue is empty
    if (this.jobs.size === 0) {
      this.notifyListeners('onQueueEmpty')
    }
  }

  getMetrics(): QueueMetrics {
    const jobs = Array.from(this.jobs.values())
    const now = Date.now()

    const metrics: QueueMetrics = {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === 'pending').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      cancelledJobs: jobs.filter(j => j.status === 'cancelled').length,
      currentConcurrency: this.processingJobs.size,
      queueUtilization: this.processingJobs.size / this.config.maxConcurrentJobs,
      averageProcessingTime: 0,
      averageWaitTime: 0,
      throughputPerHour: 0,
      errorRate: 0
    }

    // Calculate processing times
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt)
    if (completedJobs.length > 0) {
      const totalProcessingTime = completedJobs.reduce((sum, job) => 
        sum + (job.completedAt! - job.startedAt!), 0
      )
      metrics.averageProcessingTime = totalProcessingTime / completedJobs.length
    }

    // Calculate wait times
    const processedJobs = jobs.filter(j => j.startedAt)
    if (processedJobs.length > 0) {
      const totalWaitTime = processedJobs.reduce((sum, job) => 
        sum + (job.startedAt! - job.createdAt), 0
      )
      metrics.averageWaitTime = totalWaitTime / processedJobs.length
    }

    // Calculate error rate
    if (metrics.totalJobs > 0) {
      metrics.errorRate = metrics.failedJobs / metrics.totalJobs
    }

    // Calculate throughput (jobs completed in last hour)
    const oneHourAgo = now - (60 * 60 * 1000)
    const recentlyCompleted = jobs.filter(j => 
      j.status === 'completed' && j.completedAt && j.completedAt > oneHourAgo
    )
    metrics.throughputPerHour = recentlyCompleted.length

    return metrics
  }

  // Batch Operations
  createBatch(name: string, jobIds: string[], config?: ProcessingConfig): string {
    const batchId = this.generateBatchId()
    const validJobIds = jobIds.filter(id => this.jobs.has(id))

    if (validJobIds.length === 0) {
      throw new Error('No valid job IDs provided for batch')
    }

    const batch: BatchOperation = {
      id: batchId,
      name,
      jobIds: validJobIds,
      status: 'pending',
      createdAt: Date.now(),
      progress: {
        totalJobs: validJobIds.length,
        completedJobs: 0,
        failedJobs: 0,
        percentage: 0
      },
      config: config || {},
      metadata: {}
    }

    this.batches.set(batchId, batch)
    this.updateBatchProgress(batchId)

    console.log(`📦 Batch created: ${name} (${validJobIds.length} jobs)`)
    return batchId
  }

  getBatch(batchId: string): BatchOperation | null {
    return this.batches.get(batchId) || null
  }

  getAllBatches(): BatchOperation[] {
    return Array.from(this.batches.values())
  }

  private updateBatchProgress(batchId: string): void {
    const batch = this.batches.get(batchId)
    if (!batch) return

    const jobs = batch.jobIds.map(id => this.jobs.get(id)).filter(Boolean) as ProcessingJob[]
    const completedJobs = jobs.filter(j => j.status === 'completed').length
    const failedJobs = jobs.filter(j => j.status === 'failed').length
    const processingJobs = jobs.filter(j => j.status === 'processing').length

    batch.progress = {
      totalJobs: jobs.length,
      completedJobs,
      failedJobs,
      percentage: jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0
    }

    // Update batch status
    if (completedJobs === jobs.length) {
      batch.status = 'completed'
      batch.completedAt = Date.now()
      this.notifyListeners('onBatchCompleted', batch)
    } else if (processingJobs > 0) {
      batch.status = 'processing'
      if (!batch.startedAt) batch.startedAt = Date.now()
    } else if (failedJobs === jobs.length) {
      batch.status = 'failed'
    }
  }

  // Event Handling
  addEventListener(listener: QueueEventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: QueueEventListener): void {
    this.listeners.delete(listener)
  }

  private notifyListeners(event: keyof QueueEventListener, ...args: any[]): void {
    this.listeners.forEach(listener => {
      const handler = listener[event] as Function | undefined
      if (handler && typeof handler === 'function') {
        try {
          handler.apply(listener, args)
        } catch (error) {
          console.error(`Error in queue event listener:`, error)
        }
      }
    })
  }

  // Configuration
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('⚙️ Queue configuration updated')
  }

  getConfig(): QueueConfig {
    return { ...this.config }
  }

  // Maintenance
  cleanup(): void {
    if (!this.config.cleanupCompletedJobs) return

    const cutoffTime = Date.now() - (this.config.cleanupAfterHours * 60 * 60 * 1000)
    let cleanedCount = 0

    this.jobs.forEach((job, jobId) => {
      if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && 
          job.updatedAt < cutoffTime) {
        this.jobs.delete(jobId)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old jobs`)
    }
  }

  export(): string {
    const data = {
      jobs: Array.from(this.jobs.entries()),
      batches: Array.from(this.batches.entries()),
      config: this.config,
      timestamp: Date.now()
    }
    return JSON.stringify(data, null, 2)
  }

  import(data: string): void {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.jobs) {
        this.jobs = new Map(parsed.jobs)
      }
      
      if (parsed.batches) {
        this.batches = new Map(parsed.batches)
      }
      
      if (parsed.config) {
        this.config = { ...DEFAULT_QUEUE_CONFIG, ...parsed.config }
      }

      console.log('📥 Queue data imported successfully')
    } catch (error) {
      console.error('❌ Failed to import queue data:', error)
      throw new Error('Invalid queue data format')
    }
  }

  // Scheduler Methods
  getNextJob(): ProcessingJob | null {
    if (this.isPaused || this.processingJobs.size >= this.config.maxConcurrentJobs) {
      return null
    }

    const pendingJobs = this.getAllJobs({ status: ['pending'] })
    
    if (pendingJobs.length === 0) {
      return null
    }

    // Sort by priority if enabled, then by creation time
    pendingJobs.sort((a, b) => {
      if (this.config.priorityScheduling) {
        if (a.priority !== b.priority) {
          return b.priority - a.priority // Higher priority first
        }
      }
      return a.createdAt - b.createdAt // FIFO for same priority
    })

    // Check dependencies
    for (const job of pendingJobs) {
      if (this.canScheduleJob(job)) {
        return job
      }
    }

    return null
  }

  canScheduleJob(job: ProcessingJob): boolean {
    if (job.status !== 'pending') return false

    // Check dependencies
    if (job.dependsOn && job.dependsOn.length > 0) {
      const dependencies = job.dependsOn.map(id => this.jobs.get(id)).filter(Boolean) as ProcessingJob[]
      const hasUncompletedDependencies = dependencies.some(dep => dep.status !== 'completed')
      
      if (hasUncompletedDependencies) {
        return false
      }
    }

    return true
  }

  getPendingJobs(): ProcessingJob[] {
    return this.getAllJobs({ status: ['pending'] })
  }

  getJobsByPriority(priority: JobPriority): ProcessingJob[] {
    return this.getAllJobs({ priority: [priority] })
  }

  estimateWaitTime(job: ProcessingJob): number {
    const position = this.getPendingJobs()
      .filter(j => this.canScheduleJob(j))
      .sort((a, b) => {
        if (this.config.priorityScheduling && a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.createdAt - b.createdAt
      })
      .findIndex(j => j.id === job.id)

    if (position === -1) return 0

    const metrics = this.getMetrics()
    const avgProcessingTime = metrics.averageProcessingTime || 60000 // Default 1 minute
    const availableSlots = this.config.maxConcurrentJobs - this.processingJobs.size

    if (position < availableSlots) {
      return 0 // Can start immediately
    }

    const jobsAhead = position - availableSlots
    return (jobsAhead / this.config.maxConcurrentJobs) * avgProcessingTime
  }

  // Utility Methods
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000)
  }

  // Cleanup on destruction
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.listeners.clear()
  }
}

// Export singleton instance
export const processingQueue = new BatchProcessingQueue()

// Export class for custom instances
export default BatchProcessingQueue 