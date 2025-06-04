/**
 * Batch Processing Library
 * 
 * Comprehensive batch file processing system with intelligent parallel processing,
 * queue management, and performance optimization.
 */

// Export all batch processing types
export * from './types'

// Export core processing components
export { BatchProcessingQueue } from './queue'

// Export results aggregation system
export { BatchResultsAggregator, resultsAggregator } from './results-aggregator'
export { BatchResultsStorage, defaultLocalStorage as resultsStorage } from './results-storage'
export { BatchResultsAnalytics, resultsAnalytics } from './results-analytics'
export { BatchResultsExporter, resultsExporter } from './results-exporter'
export { BatchResultsDistributor, resultsDistributor } from './results-distributor'

// Import instances for the manager
import { resultsAggregator } from './results-aggregator'
import { defaultLocalStorage } from './results-storage'
import { resultsAnalytics } from './results-analytics'
import { resultsExporter } from './results-exporter'
import { resultsDistributor } from './results-distributor'

/**
 * Comprehensive batch results management system
 * Provides unified access to aggregation, storage, analytics, export, and distribution
 */
export class BatchResultsManager {
  constructor(
    public aggregator = resultsAggregator,
    public storage = defaultLocalStorage,
    public analytics = resultsAnalytics,
    public exporter = resultsExporter,
    public distributor = resultsDistributor
  ) {}

  /**
   * Initialize the results management system
   */
  async initialize(): Promise<void> {
    // Initialize storage adapters
    await this.storage.initialize()
    
    // Set up real-time aggregation
    this.aggregator.startRealTimeAggregation()
    
    // Connect aggregator to storage for automatic persistence
    this.aggregator.onResultAggregated(async (result) => {
      await this.storage.store(result)
      
      // Trigger distribution to configured channels
      await this.distributor.distribute(result)
    })
    
    console.log('📊 Batch Results Management System initialized')
  }

  /**
   * Process and store results for a completed batch
   */
  async processBatchResults(
    jobs: Array<{ id: string; result: any }>,
    batchId?: string
  ): Promise<string> {
    // Aggregate results from all jobs in the batch
    const aggregatedResult = await this.aggregator.aggregateByJobs(
      jobs.map(job => job.id),
      batchId
    )

    // Store the aggregated result
    await this.storage.store(aggregatedResult)

    // Distribute to configured channels
    await this.distributor.distribute(aggregatedResult)

    return aggregatedResult.id
  }

  /**
   * Get comprehensive analytics for a time period
   */
  async getAnalytics(timeWindowMs: number = 86400000): Promise<any> {
    const endTime = Date.now()
    const startTime = endTime - timeWindowMs

    const results = await this.storage.query({
      timeRange: { start: startTime, end: endTime }
    })

    return {
      trends: await this.analytics.analyzeTrends(results, timeWindowMs),
      benchmarks: this.analytics.generateBenchmarks(results),
      anomalies: this.analytics.detectAnomalies(results),
      summary: {
        totalResults: results.length,
        averageQuality: results.reduce((sum, r) => sum + (r.qualityMetrics.overallScore || 0), 0) / results.length,
        totalFiles: results.reduce((sum, r) => sum + r.fileAnalysis.totalFiles, 0),
        totalSegments: results.reduce((sum, r) => sum + r.fileAnalysis.totalSegments, 0)
      }
    }
  }

  /**
   * Export results in various formats
   */
  async exportResults(
    query: any,
    format: 'json' | 'csv' | 'excel' | 'pdf' = 'json'
  ): Promise<{ success: boolean; data?: Blob | string; error?: string }> {
    const results = await this.storage.query(query)
    
    if (results.length === 0) {
      return { success: false, error: 'No results found for the given query' }
    }

    // For multiple results, aggregate them first
    let dataToExport
    if (results.length === 1) {
      dataToExport = results[0]
    } else {
      // Create a summary aggregation
      dataToExport = await this.aggregator.aggregateByResults(results, 'export-summary')
    }

    return this.exporter.export(dataToExport, {
      format: format as any,
      filename: `results-export-${Date.now()}.${format}`
    })
  }

  /**
   * Set up distribution channels
   */
  configureDistribution(channels: any[]): void {
    channels.forEach(channel => {
      this.distributor.registerChannel(channel)
    })
  }

  /**
   * Get system health and metrics
   */
  getSystemHealth(): {
    aggregator: any
    storage: any
    distributor: any
    analytics: boolean
  } {
    return {
      aggregator: this.aggregator.getMetrics(),
      storage: this.storage.getMetrics(),
      distributor: this.distributor.getMetrics(),
      analytics: true // Analytics is stateless
    }
  }

  /**
   * Cleanup old data based on retention policies
   */
  async cleanup(): Promise<void> {
    await this.storage.cleanup()
    console.log('🧹 Batch results cleanup completed')
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    this.aggregator.stopRealTimeAggregation()
    await this.storage.cleanup()
    console.log('⏹️ Batch Results Management System shutdown')
  }
}

// Create and export singleton instance
export const batchResultsManager = new BatchResultsManager()

// Auto-initialize on import (can be disabled by setting env var)
if (typeof window !== 'undefined' && !import.meta.env.VITE_DISABLE_AUTO_INIT) {
  batchResultsManager.initialize().catch(console.error)
} 