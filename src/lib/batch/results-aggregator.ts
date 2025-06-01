import {
  ProcessingJob,
  ProcessingResult,
  ProcessingError,
  AggregatedResult,
  AggregationConfig,
  ResultsQuery,
  DEFAULT_AGGREGATION_CONFIG,
  ResultsAggregator,
  BatchOperation
} from './types'
import { BatchProcessingQueue } from './queue'
import { progressTracker } from './progress-tracker'

/**
 * Core results aggregation engine
 * Collects, analyzes, and aggregates processing results from completed jobs
 */
export class BatchResultsAggregator implements ResultsAggregator {
  private config: AggregationConfig
  private queue: BatchProcessingQueue
  private aggregationListeners: Array<(result: AggregatedResult) => void> = []
  private isRealTimeEnabled = false
  private realtimeIntervalId?: NodeJS.Timeout

  constructor(
    queue: BatchProcessingQueue,
    config: AggregationConfig = DEFAULT_AGGREGATION_CONFIG
  ) {
    this.queue = queue
    this.config = { ...config }
    this.setupEventListeners()
  }

  /**
   * Aggregate results from a collection of jobs
   */
  async aggregate(jobs: ProcessingJob[]): Promise<AggregatedResult> {
    const startTime = Date.now()
    const completedJobs = jobs.filter(job => job.status === 'completed' || job.status === 'failed')
    
    if (completedJobs.length === 0) {
      throw new Error('No completed jobs found for aggregation')
    }

    // Create base aggregated result
    const aggregatedResult: AggregatedResult = {
      id: this.generateResultId(),
      jobIds: completedJobs.map(job => job.id),
      status: 'aggregating',
      createdAt: startTime,
      summary: {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        totalFiles: 0,
        totalSegments: 0,
        totalWordCount: 0,
        processingTimeMs: 0
      },
      qualityMetrics: {
        translatedSegments: 0,
        untranslatedSegments: 0,
        errorCount: 0,
        warningCount: 0,
        scoresByFileType: {},
        scoresByLanguagePair: {}
      },
      fileAnalysis: {
        byFileType: {},
        byLanguagePair: {}
      },
      performanceMetrics: {
        avgProcessingTimePerFile: 0,
        avgProcessingTimePerSegment: 0,
        throughputFilesPerHour: 0,
        throughputSegmentsPerHour: 0,
        peakProcessingTimes: []
      },
      errorAnalysis: {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        commonErrors: [],
        errorRate: 0
      },
      rawResults: [],
      jobResults: [],
      metadata: {
        aggregatedAt: startTime,
        aggregationConfig: this.config,
        version: '1.0.0'
      }
    }

    try {
      // Process each completed job
      for (const job of completedJobs) {
        await this.processJob(job, aggregatedResult)
      }

      // Calculate derived metrics
      this.calculateDerivedMetrics(aggregatedResult)
      
      // Apply quality scoring if enabled
      if (this.config.enableQualityScoring) {
        aggregatedResult.qualityMetrics.overallScore = this.calculateQualityScore(aggregatedResult)
      }
      
      // Generate performance insights
      if (this.config.includePerformanceMetrics) {
        this.analyzePerformance(aggregatedResult)
      }
      
      // Analyze errors and patterns
      if (this.config.includeDetailedErrors) {
        this.analyzeErrors(aggregatedResult)
      }

      // Mark as completed
      aggregatedResult.status = 'completed'
      aggregatedResult.completedAt = Date.now()

      // Notify listeners
      this.notifyAggregationListeners(aggregatedResult)

      return aggregatedResult

    } catch (error) {
      aggregatedResult.status = 'failed'
      aggregatedResult.metadata.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  /**
   * Aggregate results for a specific batch
   */
  async aggregateBatch(batchId: string): Promise<AggregatedResult> {
    const batch = this.queue.getBatch(batchId)
    if (!batch) {
      throw new Error(`Batch with ID ${batchId} not found`)
    }

    const jobs = batch.jobIds.map(id => this.queue.getJob(id)).filter(Boolean) as ProcessingJob[]
    const result = await this.aggregate(jobs)
    
    // Add batch-specific metadata
    result.batchId = batchId
    result.metadata.batchInfo = {
      name: batch.name,
      description: batch.description,
      config: batch.config
    }

    return result
  }

  /**
   * Aggregate results based on query criteria
   */
  async aggregateByQuery(query: ResultsQuery): Promise<AggregatedResult[]> {
    const jobs = this.queue.getAllJobs()
    const filteredJobs = this.filterJobsByQuery(jobs, query)
    
    // Group jobs based on query groupBy option
    const groupedJobs = this.groupJobs(filteredJobs, query.groupBy)
    
    const results: AggregatedResult[] = []
    for (const [groupKey, groupJobs] of Object.entries(groupedJobs)) {
      if (groupJobs.length > 0) {
        const result = await this.aggregate(groupJobs)
        result.metadata.groupKey = groupKey
        result.metadata.groupBy = query.groupBy
        results.push(result)
      }
    }

    return results
  }

  /**
   * Start real-time aggregation monitoring
   */
  startRealTimeAggregation(config?: AggregationConfig): void {
    if (config) {
      this.configure(config)
    }
    
    this.isRealTimeEnabled = true
    
    // Set up periodic aggregation for recent completions
    this.realtimeIntervalId = setInterval(() => {
      this.performRealtimeAggregation()
    }, 10000) // Every 10 seconds

    console.log('🔄 Real-time results aggregation started')
  }

  /**
   * Stop real-time aggregation monitoring
   */
  stopRealTimeAggregation(): void {
    this.isRealTimeEnabled = false
    
    if (this.realtimeIntervalId) {
      clearInterval(this.realtimeIntervalId)
      this.realtimeIntervalId = undefined
    }

    console.log('⏸️ Real-time results aggregation stopped')
  }

  /**
   * Register callback for aggregation events
   */
  onResultAggregated(callback: (result: AggregatedResult) => void): void {
    this.aggregationListeners.push(callback)
  }

  /**
   * Configure the aggregator
   */
  configure(config: AggregationConfig): void {
    this.config = { ...this.config, ...config }
    console.log('⚙️ Results aggregator configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): AggregationConfig {
    return { ...this.config }
  }

  /**
   * Validate an aggregated result
   */
  validateResult(result: AggregatedResult): boolean {
    try {
      // Basic structure validation
      if (!result.id || !result.summary || !result.qualityMetrics) {
        return false
      }

      // Data consistency checks
      if (result.summary.totalJobs !== result.jobIds.length) {
        return false
      }

      if (result.summary.successfulJobs + result.summary.failedJobs !== result.summary.totalJobs) {
        return false
      }

      // Quality metrics validation
      const totalTranslations = result.qualityMetrics.translatedSegments + result.qualityMetrics.untranslatedSegments
      if (totalTranslations > result.summary.totalSegments) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(result: AggregatedResult): number {
    if (!this.config.enableQualityScoring) {
      return 0
    }

    const weights = this.config.qualityWeights
    let score = 100

    // Error penalty
    if (result.summary.totalSegments > 0) {
      const errorRate = result.errorAnalysis.errorRate
      score -= (errorRate * 100) * weights.errors
    }

    // Warning penalty (lighter)
    if (result.qualityMetrics.warningCount > 0) {
      const warningRate = result.qualityMetrics.warningCount / Math.max(result.summary.totalSegments, 1)
      score -= (warningRate * 100) * weights.warnings
    }

    // Completeness score
    if (result.summary.totalSegments > 0) {
      const completenessRate = result.qualityMetrics.translatedSegments / result.summary.totalSegments
      score = score * (completenessRate * weights.completeness + (1 - weights.completeness))
    }

    // Consistency score (based on error patterns)
    const consistencyScore = this.calculateConsistencyScore(result)
    score = score * (consistencyScore * weights.consistency + (1 - weights.consistency))

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Generate insights about the aggregated results
   */
  generateInsights(result: AggregatedResult): string[] {
    const insights: string[] = []

    // Performance insights
    if (result.performanceMetrics.throughputFilesPerHour < this.config.performanceBaselines.expectedFilesPerHour * 0.8) {
      insights.push(`Processing throughput is ${Math.round((1 - result.performanceMetrics.throughputFilesPerHour / this.config.performanceBaselines.expectedFilesPerHour) * 100)}% below expected baseline`)
    }

    // Quality insights
    if (result.qualityMetrics.overallScore && result.qualityMetrics.overallScore < 80) {
      insights.push(`Quality score of ${result.qualityMetrics.overallScore.toFixed(1)} indicates potential quality issues`)
    }

    // Error insights
    if (result.errorAnalysis.errorRate > this.config.performanceBaselines.expectedErrorRate) {
      insights.push(`Error rate of ${(result.errorAnalysis.errorRate * 100).toFixed(2)}% exceeds baseline of ${(this.config.performanceBaselines.expectedErrorRate * 100).toFixed(2)}%`)
    }

    // File type insights
    const fileTypeAnalysis = result.fileAnalysis.byFileType
    const dominantFileType = Object.keys(fileTypeAnalysis).reduce((a, b) => 
      fileTypeAnalysis[a].count > fileTypeAnalysis[b].count ? a : b
    )
    if (dominantFileType) {
      insights.push(`${dominantFileType.toUpperCase()} files represent ${Math.round((fileTypeAnalysis[dominantFileType].count / result.summary.totalFiles) * 100)}% of the batch`)
    }

    // Completion insights
    const completionRate = result.qualityMetrics.translatedSegments / Math.max(result.summary.totalSegments, 1)
    if (completionRate < 0.9) {
      insights.push(`${Math.round((1 - completionRate) * 100)}% of segments remain untranslated`)
    }

    return insights
  }

  // ===== Private Methods =====

  /**
   * Set up event listeners for real-time updates
   */
  private setupEventListeners(): void {
    this.queue.addEventListener({
      onJobCompleted: (job) => {
        if (this.isRealTimeEnabled) {
          this.handleJobCompletion(job)
        }
      },
      onBatchCompleted: (batch) => {
        if (this.isRealTimeEnabled) {
          this.handleBatchCompletion(batch)
        }
      }
    })
  }

  /**
   * Process a single job and add to aggregated result
   */
  private async processJob(job: ProcessingJob, aggregatedResult: AggregatedResult): Promise<void> {
    // Update basic counts
    aggregatedResult.summary.totalJobs++
    aggregatedResult.summary.totalFiles++

    // Create job result entry
    const jobResult = {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status as 'completed' | 'failed',
      result: job.result,
      error: job.error
    }
    aggregatedResult.jobResults.push(jobResult)

    if (job.status === 'completed' && job.result) {
      aggregatedResult.summary.successfulJobs++
      await this.processSuccessfulJob(job, job.result, aggregatedResult)
    } else if (job.status === 'failed' && job.error) {
      aggregatedResult.summary.failedJobs++
      this.processFailedJob(job, job.error, aggregatedResult)
    }

    // Add processing time
    if (job.startedAt && job.completedAt) {
      aggregatedResult.summary.processingTimeMs += (job.completedAt - job.startedAt)
    }

    // File type analysis
    this.updateFileAnalysis(job, aggregatedResult)
  }

  /**
   * Process a successful job result
   */
  private async processSuccessfulJob(
    job: ProcessingJob,
    result: ProcessingResult,
    aggregatedResult: AggregatedResult
  ): Promise<void> {
    // Add raw result if configured
    if (this.config.includeRawResults) {
      aggregatedResult.rawResults.push(result)
    }

    // Process statistics
    if (result.statistics) {
      aggregatedResult.summary.totalSegments += result.statistics.segmentCount || 0
      aggregatedResult.summary.totalWordCount += result.statistics.wordCount || 0
      aggregatedResult.qualityMetrics.translatedSegments += result.statistics.translatedSegments || 0
      aggregatedResult.qualityMetrics.untranslatedSegments += result.statistics.untranslatedSegments || 0

      // Quality score by file type
      if (result.statistics.qualityScore) {
        const fileType = job.fileType
        if (!aggregatedResult.qualityMetrics.scoresByFileType[fileType]) {
          aggregatedResult.qualityMetrics.scoresByFileType[fileType] = result.statistics.qualityScore
        } else {
          // Average the scores
          aggregatedResult.qualityMetrics.scoresByFileType[fileType] = 
            (aggregatedResult.qualityMetrics.scoresByFileType[fileType] + result.statistics.qualityScore) / 2
        }
      }
    }

    // Process analysis report
    if (result.analysisReport) {
      aggregatedResult.qualityMetrics.errorCount += result.analysisReport.errors?.length || 0
      aggregatedResult.qualityMetrics.warningCount += result.analysisReport.warnings?.length || 0

      // Add to error analysis
      if (result.analysisReport.errors) {
        for (const error of result.analysisReport.errors) {
          aggregatedResult.errorAnalysis.errorsByType[error.type] = 
            (aggregatedResult.errorAnalysis.errorsByType[error.type] || 0) + 1
          aggregatedResult.errorAnalysis.errorsBySeverity[error.severity] = 
            (aggregatedResult.errorAnalysis.errorsBySeverity[error.severity] || 0) + 1
        }
      }
    }

    // Language pair analysis
    const sourceLang = job.metadata.sourceLanguage || 'unknown'
    const targetLang = job.metadata.targetLanguage || 'unknown'
    const langPair = `${sourceLang}-${targetLang}`
    
    if (!aggregatedResult.fileAnalysis.byLanguagePair[langPair]) {
      aggregatedResult.fileAnalysis.byLanguagePair[langPair] = {
        count: 0,
        totalSegments: 0,
        translatedSegments: 0
      }
    }
    aggregatedResult.fileAnalysis.byLanguagePair[langPair].count++
    aggregatedResult.fileAnalysis.byLanguagePair[langPair].totalSegments += result.statistics?.segmentCount || 0
    aggregatedResult.fileAnalysis.byLanguagePair[langPair].translatedSegments += result.statistics?.translatedSegments || 0
  }

  /**
   * Process a failed job
   */
  private processFailedJob(
    job: ProcessingJob,
    error: ProcessingError,
    aggregatedResult: AggregatedResult
  ): void {
    aggregatedResult.errorAnalysis.totalErrors++
    aggregatedResult.errorAnalysis.errorsByType[error.type] = 
      (aggregatedResult.errorAnalysis.errorsByType[error.type] || 0) + 1
    aggregatedResult.errorAnalysis.errorsBySeverity[error.severity] = 
      (aggregatedResult.errorAnalysis.errorsBySeverity[error.severity] || 0) + 1

    // Track common errors
    const existingError = aggregatedResult.errorAnalysis.commonErrors.find(e => 
      e.type === error.type && e.message === error.message
    )
    
    if (existingError) {
      existingError.count++
      existingError.affectedFiles.push(job.fileName)
    } else {
      aggregatedResult.errorAnalysis.commonErrors.push({
        type: error.type,
        message: error.message,
        count: 1,
        affectedFiles: [job.fileName]
      })
    }
  }

  /**
   * Update file type analysis
   */
  private updateFileAnalysis(job: ProcessingJob, aggregatedResult: AggregatedResult): void {
    const fileType = job.fileType
    
    if (!aggregatedResult.fileAnalysis.byFileType[fileType]) {
      aggregatedResult.fileAnalysis.byFileType[fileType] = {
        count: 0,
        totalSize: 0,
        avgSegments: 0
      }
    }
    
    const analysis = aggregatedResult.fileAnalysis.byFileType[fileType]
    analysis.count++
    analysis.totalSize += job.fileSize

    // Update average segments
    if (job.result?.statistics?.segmentCount) {
      analysis.avgSegments = ((analysis.avgSegments * (analysis.count - 1)) + job.result.statistics.segmentCount) / analysis.count
    }

    // Update average quality score
    if (job.result?.statistics?.qualityScore) {
      const currentAvg = analysis.avgQualityScore || 0
      analysis.avgQualityScore = ((currentAvg * (analysis.count - 1)) + job.result.statistics.qualityScore) / analysis.count
    }
  }

  /**
   * Calculate derived metrics
   */
  private calculateDerivedMetrics(result: AggregatedResult): void {
    const totalJobs = result.summary.totalJobs
    const totalSegments = result.summary.totalSegments
    const processingTimeMs = result.summary.processingTimeMs

    if (totalJobs > 0 && processingTimeMs > 0) {
      result.performanceMetrics.avgProcessingTimePerFile = processingTimeMs / totalJobs
      result.performanceMetrics.throughputFilesPerHour = (totalJobs / processingTimeMs) * 3600000 // Convert to per hour
    }

    if (totalSegments > 0 && processingTimeMs > 0) {
      result.performanceMetrics.avgProcessingTimePerSegment = processingTimeMs / totalSegments
      result.performanceMetrics.throughputSegmentsPerHour = (totalSegments / processingTimeMs) * 3600000
    }

    // Error rate calculation
    result.errorAnalysis.errorRate = totalJobs > 0 ? result.summary.failedJobs / totalJobs : 0
  }

  /**
   * Analyze performance patterns
   */
  private analyzePerformance(result: AggregatedResult): void {
    // This would ideally track peak processing times from progress tracker
    // For now, we'll create a basic analysis
    const peakTime = {
      timestamp: Date.now(),
      concurrent: result.summary.totalJobs,
      throughput: result.performanceMetrics.throughputFilesPerHour
    }
    result.performanceMetrics.peakProcessingTimes.push(peakTime)
  }

  /**
   * Analyze error patterns
   */
  private analyzeErrors(result: AggregatedResult): void {
    // Sort common errors by frequency
    result.errorAnalysis.commonErrors.sort((a, b) => b.count - a.count)
    
    // Keep only top 10 most common errors
    result.errorAnalysis.commonErrors = result.errorAnalysis.commonErrors.slice(0, 10)
  }

  /**
   * Calculate consistency score based on error patterns
   */
  private calculateConsistencyScore(result: AggregatedResult): number {
    // Simple consistency metric based on error distribution
    const errorTypes = Object.keys(result.errorAnalysis.errorsByType)
    if (errorTypes.length === 0) return 1.0

    // Lower score if errors are concentrated in few types (indicates systematic issues)
    const totalErrors = result.errorAnalysis.totalErrors
    const entropy = errorTypes.reduce((sum, type) => {
      const probability = result.errorAnalysis.errorsByType[type] / totalErrors
      return sum - (probability * Math.log2(probability))
    }, 0)

    // Normalize entropy to 0-1 scale
    const maxEntropy = Math.log2(errorTypes.length)
    return maxEntropy > 0 ? entropy / maxEntropy : 1.0
  }

  /**
   * Filter jobs based on query criteria
   */
  private filterJobsByQuery(jobs: ProcessingJob[], query: ResultsQuery): ProcessingJob[] {
    return jobs.filter(job => {
      // Status filter
      if (query.statusFilter && !query.statusFilter.includes(job.status as any)) {
        return false
      }

      // Date range filter
      if (query.dateRange) {
        const jobTime = job.completedAt || job.createdAt
        if (jobTime < query.dateRange.start || jobTime > query.dateRange.end) {
          return false
        }
      }

      // File type filter
      if (query.fileTypes && !query.fileTypes.includes(job.fileType)) {
        return false
      }

      // Quality filters
      if (query.minQualityScore && job.result?.statistics?.qualityScore) {
        if (job.result.statistics.qualityScore < query.minQualityScore) {
          return false
        }
      }

      if (query.hasErrors !== undefined) {
        const hasErrors = (job.error !== undefined) || 
          (job.result?.analysisReport?.errors && job.result.analysisReport.errors.length > 0)
        if (query.hasErrors !== hasErrors) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Group jobs for aggregation
   */
  private groupJobs(jobs: ProcessingJob[], groupBy?: string): Record<string, ProcessingJob[]> {
    if (!groupBy) {
      return { 'all': jobs }
    }

    const groups: Record<string, ProcessingJob[]> = {}

    for (const job of jobs) {
      let groupKey: string

      switch (groupBy) {
        case 'fileType':
          groupKey = job.fileType
          break
        case 'day':
          groupKey = new Date(job.createdAt).toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(job.createdAt)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          groupKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          groupKey = new Date(job.createdAt).toISOString().substring(0, 7)
          break
        case 'languagePair':
          const source = job.metadata.sourceLanguage || 'unknown'
          const target = job.metadata.targetLanguage || 'unknown'
          groupKey = `${source}-${target}`
          break
        case 'batch':
          groupKey = job.metadata.batchId || 'unbatched'
          break
        case 'project':
          groupKey = job.projectId || 'default'
          break
        default:
          groupKey = 'all'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(job)
    }

    return groups
  }

  /**
   * Handle real-time job completion
   */
  private async handleJobCompletion(job: ProcessingJob): Promise<void> {
    try {
      // Check if this job is part of any ongoing batch
      const batches = this.queue.getAllBatches()
      const parentBatch = batches.find(batch => batch.jobIds.includes(job.id))
      
      if (parentBatch && parentBatch.status === 'completed') {
        // Aggregate the completed batch
        const result = await this.aggregateBatch(parentBatch.id)
        console.log(`📊 Real-time aggregation completed for batch: ${parentBatch.name}`)
      }
    } catch (error) {
      console.error('❌ Error in real-time job completion handling:', error)
    }
  }

  /**
   * Handle real-time batch completion
   */
  private async handleBatchCompletion(batch: BatchOperation): Promise<void> {
    try {
      const result = await this.aggregateBatch(batch.id)
      console.log(`📊 Real-time batch aggregation completed: ${batch.name}`)
    } catch (error) {
      console.error('❌ Error in real-time batch completion handling:', error)
    }
  }

  /**
   * Perform periodic real-time aggregation
   */
  private async performRealtimeAggregation(): Promise<void> {
    try {
      // Get recently completed jobs (last 60 seconds)
      const cutoff = Date.now() - 60000
      const allJobs = this.queue.getAllJobs()
      const recentlyCompleted = allJobs.filter(job => 
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt && job.completedAt > cutoff
      )

      if (recentlyCompleted.length > 0) {
        const result = await this.aggregate(recentlyCompleted)
        result.metadata.realtimeAggregation = true
        console.log(`📊 Real-time aggregation: ${recentlyCompleted.length} jobs processed`)
      }
    } catch (error) {
      console.error('❌ Error in periodic real-time aggregation:', error)
    }
  }

  /**
   * Generate unique result ID
   */
  private generateResultId(): string {
    return `result_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  /**
   * Notify aggregation listeners
   */
  private notifyAggregationListeners(result: AggregatedResult): void {
    for (const listener of this.aggregationListeners) {
      try {
        listener(result)
      } catch (error) {
        console.error('❌ Error in aggregation listener:', error)
      }
    }
  }
}

// Create singleton instance
export const resultsAggregator = new BatchResultsAggregator(
  // We'll inject the queue instance when the module is fully loaded
  {} as BatchProcessingQueue
)

// Default export
export default BatchResultsAggregator 