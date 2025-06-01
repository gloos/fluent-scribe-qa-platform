/**
 * Progress Analytics Engine
 * 
 * Advanced analytics and insights system for batch processing progress.
 * Provides predictive analytics, performance trends, and optimization
 * recommendations based on historical progress data.
 */

import { 
  ProgressSnapshot, 
  ProgressTimeline, 
  ProgressInsights 
} from './progress-tracker'
import { ProcessingJob, BatchOperation, QueueMetrics } from './types'

// Analytics Types
export interface PerformanceTrend {
  metric: string
  timeRange: { start: number; end: number }
  dataPoints: Array<{ timestamp: number; value: number }>
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  changeRate: number // percentage change per hour
  confidence: number // 0-1
}

export interface BottleneckAnalysis {
  stage: string
  frequency: number
  averageDuration: number
  impact: 'low' | 'medium' | 'high'
  suggestedOptimizations: string[]
  affectedJobTypes: string[]
}

export interface PredictiveModel {
  type: 'completion_time' | 'throughput' | 'resource_usage'
  accuracy: number // 0-1
  lastUpdated: number
  parameters: Record<string, number>
  predictions: Array<{
    timestamp: number
    value: number
    confidence: number
  }>
}

export interface PerformanceProfile {
  jobType: string
  fileType: string
  averageProcessingTime: number
  averageThroughput: number
  errorRate: number
  resourceIntensity: {
    cpu: number
    memory: number
    io: number
  }
  optimalConcurrency: number
  seasonality?: {
    pattern: 'hourly' | 'daily' | 'weekly'
    peakHours: number[]
    lowHours: number[]
  }
}

export interface AnalyticsReport {
  generatedAt: number
  timeRange: { start: number; end: number }
  summary: {
    totalJobs: number
    totalBatches: number
    averageProcessingTime: number
    overallThroughput: number
    errorRate: number
    efficiencyScore: number
  }
  trends: PerformanceTrend[]
  bottlenecks: BottleneckAnalysis[]
  profiles: PerformanceProfile[]
  predictions: PredictiveModel[]
  recommendations: Array<{
    category: 'performance' | 'resource' | 'strategy' | 'infrastructure'
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    expectedImpact: string
    implementation: string[]
  }>
}

export class ProgressAnalytics {
  private performanceProfiles: Map<string, PerformanceProfile> = new Map()
  private predictiveModels: Map<string, PredictiveModel> = new Map()
  private trendCache: Map<string, PerformanceTrend> = new Map()
  private lastAnalysisTime: number = 0
  private analysisInterval: number = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.initializePredictiveModels()
  }

  /**
   * Analyze progress data and generate comprehensive insights
   */
  analyzeProgress(
    timelines: ProgressTimeline[],
    snapshots: Map<string, ProgressSnapshot[]>,
    timeRange?: { start: number; end: number }
  ): AnalyticsReport {
    const now = Date.now()
    const range = timeRange || {
      start: now - (24 * 60 * 60 * 1000), // Last 24 hours
      end: now
    }

    // Filter data by time range
    const filteredTimelines = timelines.filter(t => 
      t.startTime >= range.start && (t.endTime || now) <= range.end
    )

    // Generate analysis components
    const summary = this.generateSummary(filteredTimelines)
    const trends = this.analyzeTrends(filteredTimelines, snapshots, range)
    const bottlenecks = this.analyzeBottlenecks(filteredTimelines)
    const profiles = this.generatePerformanceProfiles(filteredTimelines)
    const predictions = this.generatePredictions(filteredTimelines, snapshots)
    const recommendations = this.generateRecommendations(summary, trends, bottlenecks, profiles)

    return {
      generatedAt: now,
      timeRange: range,
      summary,
      trends,
      bottlenecks,
      profiles,
      predictions,
      recommendations
    }
  }

  /**
   * Get performance trends for specific metrics
   */
  getPerformanceTrends(
    metric: string,
    timelines: ProgressTimeline[],
    timeRange: { start: number; end: number }
  ): PerformanceTrend {
    const cacheKey = `${metric}_${timeRange.start}_${timeRange.end}`
    
    if (this.trendCache.has(cacheKey)) {
      return this.trendCache.get(cacheKey)!
    }

    const trend = this.calculateTrend(metric, timelines, timeRange)
    this.trendCache.set(cacheKey, trend)
    
    return trend
  }

  /**
   * Predict completion time for a job or batch
   */
  predictCompletionTime(
    currentProgress: ProgressSnapshot,
    historicalData: ProgressSnapshot[]
  ): { estimatedTime: number; confidence: number } {
    const model = this.predictiveModels.get('completion_time')
    if (!model || historicalData.length < 5) {
      return { estimatedTime: 0, confidence: 0 }
    }

    // Simple linear regression based on progress rate
    const progressRate = this.calculateProgressRate(historicalData)
    const remainingProgress = 100 - currentProgress.progress.percentage
    
    const estimatedTime = remainingProgress / progressRate
    const confidence = Math.min(model.accuracy, historicalData.length / 20)

    return { estimatedTime, confidence }
  }

  /**
   * Analyze resource usage patterns
   */
  analyzeResourceUsage(
    snapshots: ProgressSnapshot[]
  ): {
    patterns: Array<{ time: number; cpu: number; memory: number; io: number }>
    peaks: Array<{ timestamp: number; resource: string; value: number }>
    recommendations: string[]
  } {
    const patterns: Array<{ time: number; cpu: number; memory: number; io: number }> = []
    const peaks: Array<{ timestamp: number; resource: string; value: number }> = []
    
    snapshots.forEach(snapshot => {
      if (snapshot.metrics.resourceUsage) {
        const usage = snapshot.metrics.resourceUsage
        patterns.push({
          time: snapshot.timestamp,
          cpu: usage.cpu,
          memory: usage.memory,
          io: usage.io
        })

        // Detect peaks (usage > 90%)
        if (usage.cpu > 90) {
          peaks.push({ timestamp: snapshot.timestamp, resource: 'cpu', value: usage.cpu })
        }
        if (usage.memory > 90) {
          peaks.push({ timestamp: snapshot.timestamp, resource: 'memory', value: usage.memory })
        }
        if (usage.io > 90) {
          peaks.push({ timestamp: snapshot.timestamp, resource: 'io', value: usage.io })
        }
      }
    })

    const recommendations = this.generateResourceRecommendations(patterns, peaks)

    return { patterns, peaks, recommendations }
  }

  /**
   * Get optimal processing strategy based on current conditions
   */
  getOptimalStrategy(
    currentMetrics: QueueMetrics,
    resourceUsage: { cpu: number; memory: number; io: number },
    historicalPerformance: PerformanceProfile[]
  ): {
    strategy: 'conservative' | 'balanced' | 'aggressive'
    confidence: number
    reasoning: string[]
  } {
    const reasoning: string[] = []
    let score = 0

    // Analyze resource availability
    if (resourceUsage.cpu < 50 && resourceUsage.memory < 60) {
      score += 2
      reasoning.push('Low resource usage allows for aggressive processing')
    } else if (resourceUsage.cpu > 80 || resourceUsage.memory > 80) {
      score -= 2
      reasoning.push('High resource usage requires conservative approach')
    }

    // Analyze queue state
    if (currentMetrics.queueUtilization < 0.5) {
      score += 1
      reasoning.push('Low queue utilization supports increased concurrency')
    } else if (currentMetrics.queueUtilization > 0.9) {
      score -= 1
      reasoning.push('High queue utilization suggests capacity constraints')
    }

    // Analyze error rate
    if (currentMetrics.errorRate < 0.05) {
      score += 1
      reasoning.push('Low error rate indicates stable processing')
    } else if (currentMetrics.errorRate > 0.15) {
      score -= 2
      reasoning.push('High error rate requires more conservative processing')
    }

    // Determine strategy
    let strategy: 'conservative' | 'balanced' | 'aggressive'
    if (score >= 2) {
      strategy = 'aggressive'
    } else if (score <= -2) {
      strategy = 'conservative'
    } else {
      strategy = 'balanced'
    }

    const confidence = Math.min(0.9, Math.abs(score) / 4)

    return { strategy, confidence, reasoning }
  }

  /**
   * Update performance profiles based on completed jobs
   */
  updatePerformanceProfile(job: ProcessingJob, timeline: ProgressTimeline): void {
    const profileKey = `${job.type}_${job.fileType}`
    
    let profile = this.performanceProfiles.get(profileKey)
    if (!profile) {
      profile = {
        jobType: job.type,
        fileType: job.fileType,
        averageProcessingTime: 0,
        averageThroughput: 0,
        errorRate: 0,
        resourceIntensity: { cpu: 0, memory: 0, io: 0 },
        optimalConcurrency: 1
      }
    }

    // Update metrics with exponential moving average
    const alpha = 0.1 // Smoothing factor
    const processingTime = timeline.duration || 0
    const throughput = timeline.averageSpeed || 0
    const hasError = job.error ? 1 : 0

    profile.averageProcessingTime = (1 - alpha) * profile.averageProcessingTime + alpha * processingTime
    profile.averageThroughput = (1 - alpha) * profile.averageThroughput + alpha * throughput
    profile.errorRate = (1 - alpha) * profile.errorRate + alpha * hasError

    this.performanceProfiles.set(profileKey, profile)
  }

  // Private methods

  private generateSummary(timelines: ProgressTimeline[]) {
    const completedTimelines = timelines.filter(t => t.endTime)
    const jobTimelines = timelines.filter(t => t.type === 'job')
    const batchTimelines = timelines.filter(t => t.type === 'batch')

    const totalProcessingTime = completedTimelines.reduce((sum, t) => sum + (t.duration || 0), 0)
    const averageProcessingTime = completedTimelines.length > 0 ? totalProcessingTime / completedTimelines.length : 0

    const totalThroughput = completedTimelines.reduce((sum, t) => sum + (t.averageSpeed || 0), 0)
    const overallThroughput = completedTimelines.length > 0 ? totalThroughput / completedTimelines.length : 0

    // Calculate error rate from bottlenecks
    const totalBottlenecks = completedTimelines.reduce((sum, t) => sum + (t.bottlenecks?.length || 0), 0)
    const errorRate = completedTimelines.length > 0 ? totalBottlenecks / completedTimelines.length : 0

    // Calculate efficiency score
    const peakSpeeds = completedTimelines.map(t => t.peakSpeed || 0)
    const maxPeakSpeed = Math.max(...peakSpeeds, 1)
    const efficiencyScore = Math.round((overallThroughput / maxPeakSpeed) * 100)

    return {
      totalJobs: jobTimelines.length,
      totalBatches: batchTimelines.length,
      averageProcessingTime,
      overallThroughput,
      errorRate,
      efficiencyScore
    }
  }

  private analyzeTrends(
    timelines: ProgressTimeline[],
    snapshots: Map<string, ProgressSnapshot[]>,
    timeRange: { start: number; end: number }
  ): PerformanceTrend[] {
    const trends: PerformanceTrend[] = []

    // Analyze processing time trend
    trends.push(this.calculateTrend('processing_time', timelines, timeRange))
    
    // Analyze throughput trend
    trends.push(this.calculateTrend('throughput', timelines, timeRange))
    
    // Analyze error rate trend
    trends.push(this.calculateTrend('error_rate', timelines, timeRange))

    return trends
  }

  private calculateTrend(
    metric: string,
    timelines: ProgressTimeline[],
    timeRange: { start: number; end: number }
  ): PerformanceTrend {
    const dataPoints: Array<{ timestamp: number; value: number }> = []

    timelines.forEach(timeline => {
      if (timeline.endTime && timeline.endTime >= timeRange.start && timeline.endTime <= timeRange.end) {
        let value = 0
        
        switch (metric) {
          case 'processing_time':
            value = timeline.duration || 0
            break
          case 'throughput':
            value = timeline.averageSpeed || 0
            break
          case 'error_rate':
            value = (timeline.bottlenecks?.length || 0) > 0 ? 1 : 0
            break
        }

        dataPoints.push({ timestamp: timeline.endTime, value })
      }
    })

    // Calculate trend direction and rate
    const { trend, changeRate, confidence } = this.calculateTrendDirection(dataPoints)

    return {
      metric,
      timeRange,
      dataPoints,
      trend,
      changeRate,
      confidence
    }
  }

  private calculateTrendDirection(dataPoints: Array<{ timestamp: number; value: number }>): {
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
    changeRate: number
    confidence: number
  } {
    if (dataPoints.length < 3) {
      return { trend: 'stable', changeRate: 0, confidence: 0 }
    }

    // Simple linear regression
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum, p) => sum + p.timestamp, 0)
    const sumY = dataPoints.reduce((sum, p) => sum + p.value, 0)
    const sumXY = dataPoints.reduce((sum, p) => sum + p.timestamp * p.value, 0)
    const sumXX = dataPoints.reduce((sum, p) => sum + p.timestamp * p.timestamp, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate R-squared for confidence
    const meanY = sumY / n
    const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.value - meanY, 2), 0)
    const ssResidual = dataPoints.reduce((sum, p) => {
      const predicted = slope * p.timestamp + intercept
      return sum + Math.pow(p.value - predicted, 2)
    }, 0)
    const rSquared = 1 - (ssResidual / ssTotal)

    // Determine trend
    const changeRate = Math.abs(slope) * 3600000 // Convert to per hour
    let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'

    if (rSquared < 0.3) {
      trend = 'volatile'
    } else if (Math.abs(slope) < 0.001) {
      trend = 'stable'
    } else if (slope > 0) {
      trend = 'increasing'
    } else {
      trend = 'decreasing'
    }

    return { trend, changeRate, confidence: rSquared }
  }

  private analyzeBottlenecks(timelines: ProgressTimeline[]): BottleneckAnalysis[] {
    const bottleneckMap = new Map<string, {
      count: number
      totalDuration: number
      jobTypes: Set<string>
    }>()

    timelines.forEach(timeline => {
      timeline.bottlenecks?.forEach(bottleneck => {
        const stage = bottleneck.stage
        const existing = bottleneckMap.get(stage) || {
          count: 0,
          totalDuration: 0,
          jobTypes: new Set()
        }

        existing.count++
        existing.totalDuration += bottleneck.duration
        if (timeline.jobId) {
          // Would need job type from timeline or additional context
          existing.jobTypes.add('unknown')
        }

        bottleneckMap.set(stage, existing)
      })
    })

    return Array.from(bottleneckMap.entries()).map(([stage, data]) => ({
      stage,
      frequency: data.count,
      averageDuration: data.totalDuration / data.count,
      impact: data.count > 5 ? 'high' : data.count > 2 ? 'medium' : 'low',
      suggestedOptimizations: this.getOptimizationSuggestions(stage),
      affectedJobTypes: Array.from(data.jobTypes)
    }))
  }

  private generatePerformanceProfiles(timelines: ProgressTimeline[]): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values())
  }

  private generatePredictions(
    timelines: ProgressTimeline[],
    snapshots: Map<string, ProgressSnapshot[]>
  ): PredictiveModel[] {
    return Array.from(this.predictiveModels.values())
  }

  private generateRecommendations(
    summary: any,
    trends: PerformanceTrend[],
    bottlenecks: BottleneckAnalysis[],
    profiles: PerformanceProfile[]
  ): Array<{
    category: 'performance' | 'resource' | 'strategy' | 'infrastructure'
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    expectedImpact: string
    implementation: string[]
  }> {
    const recommendations: Array<{
      category: 'performance' | 'resource' | 'strategy' | 'infrastructure'
      priority: 'low' | 'medium' | 'high' | 'critical'
      title: string
      description: string
      expectedImpact: string
      implementation: string[]
    }> = []

    // Efficiency-based recommendations
    if (summary.efficiencyScore < 50) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Low Processing Efficiency Detected',
        description: 'System efficiency is below optimal levels, indicating potential bottlenecks or resource constraints.',
        expectedImpact: 'Improve throughput by 25-40%',
        implementation: [
          'Switch to conservative processing strategy',
          'Reduce concurrent job limits',
          'Enable adaptive scheduling'
        ]
      })
    }

    // Bottleneck-based recommendations
    const highImpactBottlenecks = bottlenecks.filter(b => b.impact === 'high')
    if (highImpactBottlenecks.length > 0) {
      recommendations.push({
        category: 'strategy',
        priority: 'medium',
        title: 'Processing Bottlenecks Identified',
        description: `High-impact bottlenecks detected in: ${highImpactBottlenecks.map(b => b.stage).join(', ')}`,
        expectedImpact: 'Reduce processing time by 15-30%',
        implementation: highImpactBottlenecks.flatMap(b => b.suggestedOptimizations)
      })
    }

    // Trend-based recommendations
    const decreasingTrends = trends.filter(t => t.trend === 'decreasing' && t.confidence > 0.5)
    if (decreasingTrends.length > 0) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        title: 'Performance Degradation Trend',
        description: 'Declining performance trends detected in key metrics.',
        expectedImpact: 'Prevent further performance degradation',
        implementation: [
          'Investigate resource constraints',
          'Review recent configuration changes',
          'Consider scaling resources'
        ]
      })
    }

    return recommendations
  }

  private calculateProgressRate(snapshots: ProgressSnapshot[]): number {
    if (snapshots.length < 2) return 0

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    
    const progressDiff = last.progress.percentage - first.progress.percentage
    const timeDiff = last.timestamp - first.timestamp
    
    return progressDiff / (timeDiff / 1000) // Progress per second
  }

  private generateResourceRecommendations(
    patterns: Array<{ time: number; cpu: number; memory: number; io: number }>,
    peaks: Array<{ timestamp: number; resource: string; value: number }>
  ): string[] {
    const recommendations: string[] = []

    if (peaks.filter(p => p.resource === 'cpu').length > 5) {
      recommendations.push('Consider reducing concurrent job limits to prevent CPU overload')
    }

    if (peaks.filter(p => p.resource === 'memory').length > 5) {
      recommendations.push('Monitor memory usage and consider processing smaller batches')
    }

    if (peaks.filter(p => p.resource === 'io').length > 5) {
      recommendations.push('I/O bottleneck detected - consider optimizing file access patterns')
    }

    return recommendations
  }

  private getOptimizationSuggestions(stage: string): string[] {
    const suggestions: Record<string, string[]> = {
      'parsing': [
        'Enable parsing cache',
        'Reduce schema validation overhead',
        'Optimize XML parsing libraries'
      ],
      'validation': [
        'Implement incremental validation',
        'Cache validation results',
        'Parallelize validation checks'
      ],
      'analysis': [
        'Optimize analysis algorithms',
        'Use sampling for large files',
        'Cache analysis results'
      ],
      'export': [
        'Stream export operations',
        'Compress output files',
        'Batch export operations'
      ]
    }

    return suggestions[stage] || ['Review stage implementation', 'Consider performance profiling']
  }

  private initializePredictiveModels(): void {
    // Initialize basic predictive models
    this.predictiveModels.set('completion_time', {
      type: 'completion_time',
      accuracy: 0.7,
      lastUpdated: Date.now(),
      parameters: { slope: 1, intercept: 0 },
      predictions: []
    })

    this.predictiveModels.set('throughput', {
      type: 'throughput',
      accuracy: 0.6,
      lastUpdated: Date.now(),
      parameters: { baseline: 1, trend: 0 },
      predictions: []
    })
  }
}

// Export singleton instance
export const progressAnalytics = new ProgressAnalytics()

// Export class for custom instances
export default ProgressAnalytics 