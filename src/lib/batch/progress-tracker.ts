/**
 * Progress Tracking System
 * 
 * Comprehensive progress monitoring, analytics, and visualization system
 * for batch processing operations. Provides real-time tracking, historical
 * analysis, and performance insights.
 */

import { 
  ProcessingJob, 
  BatchOperation, 
  QueueMetrics, 
  QueueEventListener,
  ProcessingResult,
  ProcessingError
} from './types'

// Progress Tracking Types
export interface ProgressSnapshot {
  id: string
  timestamp: number
  jobId?: string
  batchId?: string
  type: 'job' | 'batch' | 'queue'
  
  // Progress data
  progress: {
    percentage: number
    stage: string
    message?: string
    estimatedTimeRemaining?: number
    bytesProcessed?: number
    totalBytes?: number
  }
  
  // Performance metrics
  metrics: {
    processingSpeed?: number // bytes/second or jobs/second
    throughput?: number
    errorRate?: number
    resourceUsage?: {
      cpu: number
      memory: number
      io: number
    }
  }
  
  // Context information
  context: {
    totalJobs?: number
    completedJobs?: number
    failedJobs?: number
    queueSize?: number
    concurrentJobs?: number
  }
}

export interface ProgressTimeline {
  jobId?: string
  batchId?: string
  type: 'job' | 'batch'
  snapshots: ProgressSnapshot[]
  startTime: number
  endTime?: number
  duration?: number
  
  // Calculated metrics
  averageSpeed?: number
  peakSpeed?: number
  bottlenecks?: Array<{
    timestamp: number
    stage: string
    duration: number
    reason: string
  }>
}

export interface ProgressInsights {
  // Performance analysis
  performance: {
    averageProcessingTime: number
    medianProcessingTime: number
    throughputTrend: 'increasing' | 'decreasing' | 'stable'
    efficiencyScore: number // 0-100
    bottleneckStages: string[]
  }
  
  // Predictions
  predictions: {
    estimatedCompletionTime?: number
    expectedThroughput: number
    resourceRequirements: {
      cpu: number
      memory: number
      io: number
    }
  }
  
  // Recommendations
  recommendations: Array<{
    type: 'performance' | 'resource' | 'strategy'
    priority: 'low' | 'medium' | 'high'
    message: string
    action?: string
  }>
}

export interface ProgressMonitorConfig {
  snapshotInterval: number // milliseconds
  retentionPeriod: number // milliseconds
  enablePersistence: boolean
  enableAnalytics: boolean
  enablePredictions: boolean
  maxSnapshots: number
}

export class ProgressTracker {
  private snapshots: Map<string, ProgressSnapshot[]> = new Map()
  private timelines: Map<string, ProgressTimeline> = new Map()
  private activeJobs: Set<string> = new Set()
  private activeBatches: Set<string> = new Set()
  private listeners: Set<ProgressListener> = new Set()
  private config: ProgressMonitorConfig
  private snapshotInterval: NodeJS.Timeout | null = null
  private isTracking: boolean = false

  constructor(config: Partial<ProgressMonitorConfig> = {}) {
    this.config = {
      snapshotInterval: 5000, // 5 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      enablePersistence: true,
      enableAnalytics: true,
      enablePredictions: true,
      maxSnapshots: 1000,
      ...config
    }
  }

  /**
   * Start progress tracking
   */
  start(): void {
    if (this.isTracking) return

    this.isTracking = true
    console.log('📊 Starting progress tracking system')

    // Start periodic snapshot collection
    this.snapshotInterval = setInterval(() => {
      this.collectSnapshots()
    }, this.config.snapshotInterval)

    // Start cleanup timer
    this.startCleanupTimer()
  }

  /**
   * Stop progress tracking
   */
  stop(): void {
    if (!this.isTracking) return

    this.isTracking = false
    console.log('⏹️ Stopping progress tracking system')

    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval)
      this.snapshotInterval = null
    }
  }

  /**
   * Track a job's progress
   */
  trackJob(job: ProcessingJob): void {
    this.activeJobs.add(job.id)
    
    if (!this.timelines.has(job.id)) {
      this.timelines.set(job.id, {
        jobId: job.id,
        type: 'job',
        snapshots: [],
        startTime: job.startedAt || Date.now()
      })
    }

    this.captureJobSnapshot(job)
    this.notifyListeners('onJobTracked', job)
  }

  /**
   * Track a batch's progress
   */
  trackBatch(batch: BatchOperation): void {
    this.activeBatches.add(batch.id)
    
    if (!this.timelines.has(batch.id)) {
      this.timelines.set(batch.id, {
        batchId: batch.id,
        type: 'batch',
        snapshots: [],
        startTime: batch.startedAt || Date.now()
      })
    }

    this.captureBatchSnapshot(batch)
    this.notifyListeners('onBatchTracked', batch)
  }

  /**
   * Update job progress
   */
  updateJobProgress(job: ProcessingJob): void {
    if (!this.activeJobs.has(job.id)) return

    this.captureJobSnapshot(job)
    this.notifyListeners('onJobProgressUpdated', job)

    // Check if job completed
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      this.completeJobTracking(job)
    }
  }

  /**
   * Update batch progress
   */
  updateBatchProgress(batch: BatchOperation): void {
    if (!this.activeBatches.has(batch.id)) return

    this.captureBatchSnapshot(batch)
    this.notifyListeners('onBatchProgressUpdated', batch)

    // Check if batch completed
    if (batch.status === 'completed' || batch.status === 'failed') {
      this.completeBatchTracking(batch)
    }
  }

  /**
   * Get current progress for a job
   */
  getJobProgress(jobId: string): ProgressSnapshot | null {
    const snapshots = this.snapshots.get(jobId)
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  }

  /**
   * Get current progress for a batch
   */
  getBatchProgress(batchId: string): ProgressSnapshot | null {
    const snapshots = this.snapshots.get(batchId)
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  }

  /**
   * Get progress timeline for a job or batch
   */
  getTimeline(id: string): ProgressTimeline | null {
    return this.timelines.get(id) || null
  }

  /**
   * Get all active progress items
   */
  getActiveProgress(): {
    jobs: ProgressSnapshot[]
    batches: ProgressSnapshot[]
  } {
    const jobs: ProgressSnapshot[] = []
    const batches: ProgressSnapshot[] = []

    this.activeJobs.forEach(jobId => {
      const progress = this.getJobProgress(jobId)
      if (progress) jobs.push(progress)
    })

    this.activeBatches.forEach(batchId => {
      const progress = this.getBatchProgress(batchId)
      if (progress) batches.push(progress)
    })

    return { jobs, batches }
  }

  /**
   * Get progress insights and analytics
   */
  getInsights(timeRange?: { start: number; end: number }): ProgressInsights {
    const timelines = Array.from(this.timelines.values())
    const filteredTimelines = timeRange ? 
      timelines.filter(t => t.startTime >= timeRange.start && (t.endTime || Date.now()) <= timeRange.end) :
      timelines

    return this.calculateInsights(filteredTimelines)
  }

  /**
   * Get historical progress data
   */
  getHistoricalData(id: string): ProgressSnapshot[] {
    return this.snapshots.get(id) || []
  }

  /**
   * Export progress data
   */
  exportData(): string {
    const data = {
      snapshots: Object.fromEntries(this.snapshots),
      timelines: Object.fromEntries(this.timelines),
      config: this.config,
      exportedAt: Date.now()
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import progress data
   */
  importData(data: string): void {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.snapshots) {
        this.snapshots = new Map(Object.entries(parsed.snapshots))
      }
      
      if (parsed.timelines) {
        this.timelines = new Map(Object.entries(parsed.timelines))
      }

      console.log('📥 Progress data imported successfully')
    } catch (error) {
      console.error('❌ Failed to import progress data:', error)
      throw new Error('Invalid progress data format')
    }
  }

  /**
   * Add progress listener
   */
  addListener(listener: ProgressListener): void {
    this.listeners.add(listener)
  }

  /**
   * Remove progress listener
   */
  removeListener(listener: ProgressListener): void {
    this.listeners.delete(listener)
  }

  // Private methods

  private captureJobSnapshot(job: ProcessingJob): void {
    const snapshot: ProgressSnapshot = {
      id: `${job.id}_${Date.now()}`,
      timestamp: Date.now(),
      jobId: job.id,
      type: 'job',
      progress: { ...job.progress },
      metrics: {
        processingSpeed: this.calculateProcessingSpeed(job),
        errorRate: job.error ? 1 : 0
      },
      context: {
        totalJobs: 1,
        completedJobs: job.status === 'completed' ? 1 : 0,
        failedJobs: job.status === 'failed' ? 1 : 0
      }
    }

    this.addSnapshot(job.id, snapshot)
  }

  private captureBatchSnapshot(batch: BatchOperation): void {
    const snapshot: ProgressSnapshot = {
      id: `${batch.id}_${Date.now()}`,
      timestamp: Date.now(),
      batchId: batch.id,
      type: 'batch',
      progress: {
        percentage: batch.progress.percentage,
        stage: batch.status,
        message: `${batch.progress.completedJobs}/${batch.progress.totalJobs} jobs completed`
      },
      metrics: {
        throughput: this.calculateBatchThroughput(batch),
        errorRate: batch.progress.totalJobs > 0 ? batch.progress.failedJobs / batch.progress.totalJobs : 0
      },
      context: {
        totalJobs: batch.progress.totalJobs,
        completedJobs: batch.progress.completedJobs,
        failedJobs: batch.progress.failedJobs
      }
    }

    this.addSnapshot(batch.id, snapshot)
  }

  private addSnapshot(id: string, snapshot: ProgressSnapshot): void {
    if (!this.snapshots.has(id)) {
      this.snapshots.set(id, [])
    }

    const snapshots = this.snapshots.get(id)!
    snapshots.push(snapshot)

    // Limit snapshot count
    if (snapshots.length > this.config.maxSnapshots) {
      snapshots.splice(0, snapshots.length - this.config.maxSnapshots)
    }

    // Update timeline
    const timeline = this.timelines.get(id)
    if (timeline) {
      timeline.snapshots.push(snapshot)
    }
  }

  private collectSnapshots(): void {
    // This would be called periodically to capture queue-level snapshots
    // Implementation depends on integration with queue system
  }

  private completeJobTracking(job: ProcessingJob): void {
    this.activeJobs.delete(job.id)
    
    const timeline = this.timelines.get(job.id)
    if (timeline) {
      timeline.endTime = Date.now()
      timeline.duration = timeline.endTime - timeline.startTime
      timeline.averageSpeed = this.calculateAverageSpeed(timeline)
      timeline.peakSpeed = this.calculatePeakSpeed(timeline)
      timeline.bottlenecks = this.detectBottlenecks(timeline)
    }

    this.notifyListeners('onJobCompleted', job)
  }

  private completeBatchTracking(batch: BatchOperation): void {
    this.activeBatches.delete(batch.id)
    
    const timeline = this.timelines.get(batch.id)
    if (timeline) {
      timeline.endTime = Date.now()
      timeline.duration = timeline.endTime - timeline.startTime
      timeline.averageSpeed = this.calculateAverageSpeed(timeline)
      timeline.peakSpeed = this.calculatePeakSpeed(timeline)
    }

    this.notifyListeners('onBatchCompleted', batch)
  }

  private calculateProcessingSpeed(job: ProcessingJob): number {
    if (!job.startedAt || !job.progress.bytesProcessed) return 0
    
    const elapsed = Date.now() - job.startedAt
    return job.progress.bytesProcessed / (elapsed / 1000) // bytes per second
  }

  private calculateBatchThroughput(batch: BatchOperation): number {
    if (!batch.startedAt) return 0
    
    const elapsed = Date.now() - batch.startedAt
    return batch.progress.completedJobs / (elapsed / 1000 / 60) // jobs per minute
  }

  private calculateAverageSpeed(timeline: ProgressTimeline): number {
    if (timeline.snapshots.length < 2) return 0
    
    const speeds = timeline.snapshots
      .map(s => s.metrics.processingSpeed || 0)
      .filter(s => s > 0)
    
    return speeds.length > 0 ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0
  }

  private calculatePeakSpeed(timeline: ProgressTimeline): number {
    return Math.max(...timeline.snapshots.map(s => s.metrics.processingSpeed || 0))
  }

  private detectBottlenecks(timeline: ProgressTimeline): Array<{
    timestamp: number
    stage: string
    duration: number
    reason: string
  }> {
    const bottlenecks: Array<{
      timestamp: number
      stage: string
      duration: number
      reason: string
    }> = []

    // Analyze snapshots for performance drops
    for (let i = 1; i < timeline.snapshots.length; i++) {
      const current = timeline.snapshots[i]
      const previous = timeline.snapshots[i - 1]
      
      const timeDiff = current.timestamp - previous.timestamp
      const progressDiff = current.progress.percentage - previous.progress.percentage
      
      // Detect slow progress (less than 1% progress in 30 seconds)
      if (timeDiff > 30000 && progressDiff < 1) {
        bottlenecks.push({
          timestamp: current.timestamp,
          stage: current.progress.stage,
          duration: timeDiff,
          reason: 'Slow progress detected'
        })
      }
    }

    return bottlenecks
  }

  private calculateInsights(timelines: ProgressTimeline[]): ProgressInsights {
    const completedTimelines = timelines.filter(t => t.endTime)
    
    if (completedTimelines.length === 0) {
      return {
        performance: {
          averageProcessingTime: 0,
          medianProcessingTime: 0,
          throughputTrend: 'stable',
          efficiencyScore: 0,
          bottleneckStages: []
        },
        predictions: {
          expectedThroughput: 0,
          resourceRequirements: { cpu: 0, memory: 0, io: 0 }
        },
        recommendations: []
      }
    }

    // Calculate performance metrics
    const processingTimes = completedTimelines.map(t => t.duration || 0)
    const averageProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    const sortedTimes = [...processingTimes].sort((a, b) => a - b)
    const medianProcessingTime = sortedTimes[Math.floor(sortedTimes.length / 2)]

    // Analyze bottlenecks
    const allBottlenecks = completedTimelines.flatMap(t => t.bottlenecks || [])
    const bottleneckStages = [...new Set(allBottlenecks.map(b => b.stage))]

    // Calculate efficiency score (0-100)
    const averageSpeed = completedTimelines.reduce((sum, t) => sum + (t.averageSpeed || 0), 0) / completedTimelines.length
    const peakSpeed = Math.max(...completedTimelines.map(t => t.peakSpeed || 0))
    const efficiencyScore = peakSpeed > 0 ? Math.round((averageSpeed / peakSpeed) * 100) : 0

    return {
      performance: {
        averageProcessingTime,
        medianProcessingTime,
        throughputTrend: 'stable', // Would need more complex analysis
        efficiencyScore,
        bottleneckStages
      },
      predictions: {
        expectedThroughput: averageSpeed,
        resourceRequirements: { cpu: 50, memory: 50, io: 50 } // Placeholder
      },
      recommendations: this.generateRecommendations(efficiencyScore, bottleneckStages)
    }
  }

  private generateRecommendations(efficiencyScore: number, bottleneckStages: string[]): Array<{
    type: 'performance' | 'resource' | 'strategy'
    priority: 'low' | 'medium' | 'high'
    message: string
    action?: string
  }> {
    const recommendations: Array<{
      type: 'performance' | 'resource' | 'strategy'
      priority: 'low' | 'medium' | 'high'
      message: string
      action?: string
    }> = []

    if (efficiencyScore < 50) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Low efficiency detected. Consider optimizing processing strategy.',
        action: 'Switch to conservative processing strategy'
      })
    }

    if (bottleneckStages.includes('parsing')) {
      recommendations.push({
        type: 'strategy',
        priority: 'medium',
        message: 'Parsing bottleneck detected. Consider pre-processing optimization.',
        action: 'Enable parsing cache or reduce validation overhead'
      })
    }

    return recommendations
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000) // Run every hour
  }

  private cleanup(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod
    let cleanedCount = 0

    // Clean old snapshots
    this.snapshots.forEach((snapshots, id) => {
      const filtered = snapshots.filter(s => s.timestamp > cutoffTime)
      if (filtered.length !== snapshots.length) {
        this.snapshots.set(id, filtered)
        cleanedCount += snapshots.length - filtered.length
      }
    })

    // Clean old timelines
    this.timelines.forEach((timeline, id) => {
      if (timeline.endTime && timeline.endTime < cutoffTime) {
        this.timelines.delete(id)
        this.snapshots.delete(id)
      }
    })

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old progress snapshots`)
    }
  }

  private notifyListeners(event: keyof ProgressListener, ...args: any[]): void {
    this.listeners.forEach(listener => {
      const handler = listener[event] as Function | undefined
      if (handler && typeof handler === 'function') {
        try {
          handler.apply(listener, args)
        } catch (error) {
          console.error(`Error in progress listener:`, error)
        }
      }
    })
  }
}

// Progress Listener Interface
export interface ProgressListener {
  onJobTracked?: (job: ProcessingJob) => void
  onJobProgressUpdated?: (job: ProcessingJob) => void
  onJobCompleted?: (job: ProcessingJob) => void
  onBatchTracked?: (batch: BatchOperation) => void
  onBatchProgressUpdated?: (batch: BatchOperation) => void
  onBatchCompleted?: (batch: BatchOperation) => void
}

// Export singleton instance
export const progressTracker = new ProgressTracker()

// Export class for custom instances
export default ProgressTracker 