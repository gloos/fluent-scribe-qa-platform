import {
  AggregatedResult,
  ResultsAnalytics
} from './types'

/**
 * Trend data point interface
 */
export interface TrendPoint {
  timestamp: number
  value: number
  metadata?: Record<string, any>
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  resultId: string
  anomalyType: 'quality' | 'performance' | 'errors' | 'volume'
  severity: 'low' | 'medium' | 'high'
  description: string
  value: number
  expectedRange: { min: number; max: number }
  confidence: number
  recommendations: string[]
}

/**
 * Comparative analysis result
 */
export interface ComparisonResult {
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
  metadata: {
    comparedAt: number
    confidence: number
  }
}

/**
 * Predictive model result
 */
export interface PredictionResult {
  predictedThroughput: number
  predictedQualityScore: number
  predictedErrorRate: number
  confidence: number
  recommendations: string[]
  basedOnSamples: number
  validUntil: number
}

/**
 * Benchmark metrics
 */
export interface BenchmarkMetrics {
  qualityBenchmarks: {
    averageScore: number
    p95Score: number
    p99Score: number
    medianScore: number
    standardDeviation: number
  }
  performanceBenchmarks: {
    averageThroughput: number
    peakThroughput: number
    averageProcessingTime: number
    p95ProcessingTime: number
    efficiency: number
  }
  reliabilityBenchmarks: {
    averageErrorRate: number
    maxErrorRate: number
    uptime: number
    mtbf: number // Mean Time Between Failures
    mttr: number // Mean Time To Recovery
  }
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  trendAnalysis: {
    enabled: boolean
    timeWindows: number[] // in milliseconds
    smoothingFactor: number
    minDataPoints: number
  }
  anomalyDetection: {
    enabled: boolean
    sensitivityLevel: 'low' | 'medium' | 'high'
    confidenceThreshold: number
    adaptiveThresholds: boolean
  }
  prediction: {
    enabled: boolean
    modelType: 'linear' | 'exponential' | 'seasonal'
    forecastPeriod: number // in milliseconds
    minHistoryRequired: number
  }
  benchmarking: {
    enabled: boolean
    updateInterval: number // in milliseconds
    historyDays: number
  }
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  trendAnalysis: {
    enabled: true,
    timeWindows: [3600000, 86400000, 604800000], // 1h, 1d, 1w
    smoothingFactor: 0.3,
    minDataPoints: 3
  },
  anomalyDetection: {
    enabled: true,
    sensitivityLevel: 'medium',
    confidenceThreshold: 0.75,
    adaptiveThresholds: true
  },
  prediction: {
    enabled: true,
    modelType: 'linear',
    forecastPeriod: 86400000, // 24 hours
    minHistoryRequired: 10
  },
  benchmarking: {
    enabled: true,
    updateInterval: 3600000, // 1 hour
    historyDays: 30
  }
}

/**
 * Results analytics engine implementation
 */
export class BatchResultsAnalytics implements ResultsAnalytics {
  private config: AnalyticsConfig
  private benchmarkCache: BenchmarkMetrics | null = null
  private benchmarkLastUpdated = 0

  constructor(config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG) {
    this.config = { ...config }
  }

  /**
   * Analyze trends in aggregated results over time
   */
  async analyzeTrends(results: AggregatedResult[], timeWindow: number): Promise<{
    qualityTrends: Array<{ timestamp: number; score: number }>
    performanceTrends: Array<{ timestamp: number; throughput: number }>
    errorTrends: Array<{ timestamp: number; errorRate: number }>
    volumeTrends: Array<{ timestamp: number; fileCount: number; segmentCount: number }>
  }> {
    if (!this.config.trendAnalysis.enabled) {
      return {
        qualityTrends: [],
        performanceTrends: [],
        errorTrends: [],
        volumeTrends: []
      }
    }

    // Filter results within time window
    const cutoff = Date.now() - timeWindow
    const filteredResults = results.filter(r => (r.completedAt || r.createdAt) >= cutoff)
    
    if (filteredResults.length < this.config.trendAnalysis.minDataPoints) {
      console.warn('Insufficient data points for trend analysis')
      return {
        qualityTrends: [],
        performanceTrends: [],
        errorTrends: [],
        volumeTrends: []
      }
    }

    // Sort by completion time
    const sortedResults = filteredResults.sort((a, b) => 
      (a.completedAt || a.createdAt) - (b.completedAt || b.createdAt)
    )

    // Generate trend data
    const qualityTrends = this.extractQualityTrends(sortedResults)
    const performanceTrends = this.extractPerformanceTrends(sortedResults)
    const errorTrends = this.extractErrorTrends(sortedResults)
    const volumeTrends = this.extractVolumeTrends(sortedResults)

    // Apply smoothing if configured
    if (this.config.trendAnalysis.smoothingFactor > 0) {
      this.applySmoothing(qualityTrends, this.config.trendAnalysis.smoothingFactor)
      this.applySmoothing(performanceTrends, this.config.trendAnalysis.smoothingFactor)
      this.applySmoothing(errorTrends, this.config.trendAnalysis.smoothingFactor)
    }

    return {
      qualityTrends,
      performanceTrends,
      errorTrends,
      volumeTrends
    }
  }

  /**
   * Compare two aggregated results
   */
  compareResults(result1: AggregatedResult, result2: AggregatedResult): ComparisonResult {
    const qualityComparison = this.compareQuality(result1, result2)
    const performanceComparison = this.comparePerformance(result1, result2)

    return {
      qualityComparison,
      performanceComparison,
      metadata: {
        comparedAt: Date.now(),
        confidence: this.calculateComparisonConfidence(result1, result2)
      }
    }
  }

  /**
   * Predict future performance based on historical results
   */
  predictPerformance(historicalResults: AggregatedResult[]): PredictionResult {
    if (!this.config.prediction.enabled) {
      return {
        predictedThroughput: 0,
        predictedQualityScore: 0,
        predictedErrorRate: 0,
        confidence: 0,
        recommendations: ['Prediction is disabled'],
        basedOnSamples: 0,
        validUntil: Date.now()
      }
    }

    if (historicalResults.length < this.config.prediction.minHistoryRequired) {
      return {
        predictedThroughput: 0,
        predictedQualityScore: 0,
        predictedErrorRate: 0,
        confidence: 0,
        recommendations: ['Insufficient historical data for prediction'],
        basedOnSamples: historicalResults.length,
        validUntil: Date.now()
      }
    }

    // Sort by completion time
    const sortedResults = historicalResults
      .filter(r => r.status === 'completed')
      .sort((a, b) => (a.completedAt || a.createdAt) - (b.completedAt || b.createdAt))

    // Extract time series data
    const throughputData = sortedResults.map(r => r.performanceMetrics.throughputFilesPerHour)
    const qualityData = sortedResults
      .map(r => r.qualityMetrics.overallScore)
      .filter(score => score !== undefined) as number[]
    const errorData = sortedResults.map(r => r.errorAnalysis.errorRate)

    // Apply prediction model
    const predictedThroughput = this.applyPredictionModel(throughputData)
    const predictedQualityScore = qualityData.length > 0 ? this.applyPredictionModel(qualityData) : 0
    const predictedErrorRate = this.applyPredictionModel(errorData)

    // Calculate confidence
    const confidence = this.calculatePredictionConfidence(sortedResults)

    // Generate recommendations
    const recommendations = this.generatePredictionRecommendations(
      predictedThroughput,
      predictedQualityScore,
      predictedErrorRate,
      sortedResults
    )

    return {
      predictedThroughput,
      predictedQualityScore,
      predictedErrorRate,
      confidence,
      recommendations,
      basedOnSamples: sortedResults.length,
      validUntil: Date.now() + this.config.prediction.forecastPeriod
    }
  }

  /**
   * Detect anomalies in results
   */
  detectAnomalies(results: AggregatedResult[]): AnomalyDetectionResult[] {
    if (!this.config.anomalyDetection.enabled) {
      return []
    }

    const anomalies: AnomalyDetectionResult[] = []

    // Calculate statistical baselines
    const baselines = this.calculateStatisticalBaselines(results)

    for (const result of results) {
      // Quality anomalies
      if (result.qualityMetrics.overallScore !== undefined) {
        const qualityAnomaly = this.detectQualityAnomaly(result, baselines)
        if (qualityAnomaly) anomalies.push(qualityAnomaly)
      }

      // Performance anomalies
      const performanceAnomaly = this.detectPerformanceAnomaly(result, baselines)
      if (performanceAnomaly) anomalies.push(performanceAnomaly)

      // Error anomalies
      const errorAnomaly = this.detectErrorAnomaly(result, baselines)
      if (errorAnomaly) anomalies.push(errorAnomaly)

      // Volume anomalies
      const volumeAnomaly = this.detectVolumeAnomaly(result, baselines)
      if (volumeAnomaly) anomalies.push(volumeAnomaly)
    }

    // Sort by severity and confidence
    anomalies.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return b.confidence - a.confidence
    })

    return anomalies
  }

  /**
   * Generate benchmark metrics
   */
  generateBenchmarks(results: AggregatedResult[]): BenchmarkMetrics {
    if (!this.config.benchmarking.enabled) {
      return this.getEmptyBenchmarks()
    }

    // Use cached benchmarks if recent
    if (this.benchmarkCache && 
        Date.now() - this.benchmarkLastUpdated < this.config.benchmarking.updateInterval) {
      return this.benchmarkCache
    }

    // Filter to recent results within history window
    const cutoff = Date.now() - (this.config.benchmarking.historyDays * 24 * 60 * 60 * 1000)
    const recentResults = results.filter(r => (r.completedAt || r.createdAt) >= cutoff)

    if (recentResults.length === 0) {
      return this.getEmptyBenchmarks()
    }

    const benchmarks: BenchmarkMetrics = {
      qualityBenchmarks: this.calculateQualityBenchmarks(recentResults),
      performanceBenchmarks: this.calculatePerformanceBenchmarks(recentResults),
      reliabilityBenchmarks: this.calculateReliabilityBenchmarks(recentResults)
    }

    // Cache the results
    this.benchmarkCache = benchmarks
    this.benchmarkLastUpdated = Date.now()

    return benchmarks
  }

  /**
   * Configure the analytics engine
   */
  configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config }
    // Clear cache when configuration changes
    this.benchmarkCache = null
    console.log('📊 Analytics configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config }
  }

  // ===== Private Methods =====

  /**
   * Extract quality trends from results
   */
  private extractQualityTrends(results: AggregatedResult[]): Array<{ timestamp: number; score: number }> {
    return results
      .filter(r => r.qualityMetrics.overallScore !== undefined)
      .map(r => ({
        timestamp: r.completedAt || r.createdAt,
        score: r.qualityMetrics.overallScore!
      }))
  }

  /**
   * Extract performance trends from results
   */
  private extractPerformanceTrends(results: AggregatedResult[]): Array<{ timestamp: number; throughput: number }> {
    return results.map(r => ({
      timestamp: r.completedAt || r.createdAt,
      throughput: r.performanceMetrics.throughputFilesPerHour
    }))
  }

  /**
   * Extract error trends from results
   */
  private extractErrorTrends(results: AggregatedResult[]): Array<{ timestamp: number; errorRate: number }> {
    return results.map(r => ({
      timestamp: r.completedAt || r.createdAt,
      errorRate: r.errorAnalysis.errorRate
    }))
  }

  /**
   * Extract volume trends from results
   */
  private extractVolumeTrends(results: AggregatedResult[]): Array<{ 
    timestamp: number; 
    fileCount: number; 
    segmentCount: number 
  }> {
    return results.map(r => ({
      timestamp: r.completedAt || r.createdAt,
      fileCount: r.summary.totalFiles,
      segmentCount: r.summary.totalSegments
    }))
  }

  /**
   * Apply exponential smoothing to trend data
   */
  private applySmoothing<T extends { value?: number; score?: number; throughput?: number; errorRate?: number }>(
    data: T[], 
    alpha: number
  ): void {
    if (data.length <= 1) return

    for (let i = 1; i < data.length; i++) {
      const current = data[i]
      const previous = data[i - 1]

      // Apply smoothing based on available properties
      if ('score' in current && 'score' in previous && 
          typeof current.score === 'number' && typeof previous.score === 'number') {
        current.score = alpha * current.score + (1 - alpha) * previous.score
      }
      if ('throughput' in current && 'throughput' in previous &&
          typeof current.throughput === 'number' && typeof previous.throughput === 'number') {
        current.throughput = alpha * current.throughput + (1 - alpha) * previous.throughput
      }
      if ('errorRate' in current && 'errorRate' in previous &&
          typeof current.errorRate === 'number' && typeof previous.errorRate === 'number') {
        current.errorRate = alpha * current.errorRate + (1 - alpha) * previous.errorRate
      }
    }
  }

  /**
   * Compare quality metrics between two results
   */
  private compareQuality(result1: AggregatedResult, result2: AggregatedResult) {
    const score1 = result1.qualityMetrics.overallScore || 0
    const score2 = result2.qualityMetrics.overallScore || 0
    const errorRate1 = result1.errorAnalysis.errorRate
    const errorRate2 = result2.errorAnalysis.errorRate

    const scoreDiff = score2 - score1
    const errorRateDiff = errorRate2 - errorRate1

    const improvements: string[] = []
    const regressions: string[] = []

    if (scoreDiff > 5) {
      improvements.push(`Quality score improved by ${scoreDiff.toFixed(1)} points`)
    } else if (scoreDiff < -5) {
      regressions.push(`Quality score decreased by ${Math.abs(scoreDiff).toFixed(1)} points`)
    }

    if (errorRateDiff < -0.02) {
      improvements.push(`Error rate reduced by ${Math.abs(errorRateDiff * 100).toFixed(1)}%`)
    } else if (errorRateDiff > 0.02) {
      regressions.push(`Error rate increased by ${(errorRateDiff * 100).toFixed(1)}%`)
    }

    return { scoreDiff, errorRateDiff, improvements, regressions }
  }

  /**
   * Compare performance metrics between two results
   */
  private comparePerformance(result1: AggregatedResult, result2: AggregatedResult) {
    const throughput1 = result1.performanceMetrics.throughputFilesPerHour
    const throughput2 = result2.performanceMetrics.throughputFilesPerHour
    const time1 = result1.performanceMetrics.avgProcessingTimePerFile
    const time2 = result2.performanceMetrics.avgProcessingTimePerFile

    const throughputDiff = throughput2 - throughput1
    const processingTimeDiff = time2 - time1
    const efficiencyChange = throughput1 > 0 ? (throughputDiff / throughput1) * 100 : 0

    return { throughputDiff, processingTimeDiff, efficiencyChange }
  }

  /**
   * Calculate confidence in comparison
   */
  private calculateComparisonConfidence(result1: AggregatedResult, result2: AggregatedResult): number {
    // Simple confidence based on sample sizes
    const minJobs = Math.min(result1.summary.totalJobs, result2.summary.totalJobs)
    return Math.min(1.0, minJobs / 10) // Full confidence at 10+ jobs
  }

  /**
   * Apply prediction model to time series data
   */
  private applyPredictionModel(data: number[]): number {
    if (data.length === 0) return 0

    switch (this.config.prediction.modelType) {
      case 'linear':
        return this.linearTrendPrediction(data)
      case 'exponential':
        return this.exponentialTrendPrediction(data)
      case 'seasonal':
        return this.seasonalPrediction(data)
      default:
        return this.linearTrendPrediction(data)
    }
  }

  /**
   * Linear trend prediction
   */
  private linearTrendPrediction(data: number[]): number {
    if (data.length < 2) return data[0] || 0

    // Simple linear regression
    const n = data.length
    const x = Array.from({ length: n }, (_, i) => i)
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = data.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * data[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Predict next value
    return slope * n + intercept
  }

  /**
   * Exponential trend prediction
   */
  private exponentialTrendPrediction(data: number[]): number {
    if (data.length < 2) return data[0] || 0

    // Simple exponential moving average
    const alpha = 0.3
    let ema = data[0]
    for (let i = 1; i < data.length; i++) {
      ema = alpha * data[i] + (1 - alpha) * ema
    }
    return ema
  }

  /**
   * Seasonal prediction (placeholder)
   */
  private seasonalPrediction(data: number[]): number {
    // For now, just return average
    return data.reduce((sum, val) => sum + val, 0) / data.length
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(results: AggregatedResult[]): number {
    if (results.length < this.config.prediction.minHistoryRequired) {
      return 0
    }

    // Confidence based on data consistency and sample size
    const consistency = this.calculateDataConsistency(results)
    const sampleFactor = Math.min(1.0, results.length / 20) // Full confidence at 20+ samples
    
    return consistency * sampleFactor
  }

  /**
   * Calculate data consistency for confidence
   */
  private calculateDataConsistency(results: AggregatedResult[]): number {
    if (results.length < 2) return 0

    const throughputValues = results.map(r => r.performanceMetrics.throughputFilesPerHour)
    const mean = throughputValues.reduce((sum, val) => sum + val, 0) / throughputValues.length
    const variance = throughputValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / throughputValues.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1 // Coefficient of variation

    // Lower CV = higher consistency
    return Math.max(0, 1 - cv)
  }

  /**
   * Generate prediction recommendations
   */
  private generatePredictionRecommendations(
    throughput: number,
    quality: number,
    errorRate: number,
    historicalResults: AggregatedResult[]
  ): string[] {
    const recommendations: string[] = []

    // Throughput recommendations
    if (historicalResults.length > 0) {
      const avgThroughput = historicalResults.reduce((sum, r) => 
        sum + r.performanceMetrics.throughputFilesPerHour, 0
      ) / historicalResults.length

      if (throughput < avgThroughput * 0.8) {
        recommendations.push('Predicted throughput decline - consider system optimization')
      } else if (throughput > avgThroughput * 1.2) {
        recommendations.push('Predicted throughput increase - ensure system capacity')
      }
    }

    // Quality recommendations
    if (quality < 70) {
      recommendations.push('Predicted quality concerns - review error patterns')
    }

    // Error rate recommendations
    if (errorRate > 0.1) {
      recommendations.push('High error rate predicted - investigate root causes')
    }

    return recommendations
  }

  /**
   * Calculate statistical baselines for anomaly detection
   */
  private calculateStatisticalBaselines(results: AggregatedResult[]) {
    const qualityScores = results
      .map(r => r.qualityMetrics.overallScore)
      .filter(score => score !== undefined) as number[]
    const throughputs = results.map(r => r.performanceMetrics.throughputFilesPerHour)
    const errorRates = results.map(r => r.errorAnalysis.errorRate)
    const volumes = results.map(r => r.summary.totalFiles)

    return {
      quality: this.calculateStats(qualityScores),
      throughput: this.calculateStats(throughputs),
      errorRate: this.calculateStats(errorRates),
      volume: this.calculateStats(volumes)
    }
  }

  /**
   * Calculate basic statistics for a dataset
   */
  private calculateStats(data: number[]) {
    if (data.length === 0) return { mean: 0, std: 0, min: 0, max: 0, p95: 0 }

    const sorted = [...data].sort((a, b) => a - b)
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
    const std = Math.sqrt(variance)
    const p95Index = Math.floor(data.length * 0.95)

    return {
      mean,
      std,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Index] || sorted[sorted.length - 1]
    }
  }

  /**
   * Detect quality anomalies
   */
  private detectQualityAnomaly(result: AggregatedResult, baselines: any): AnomalyDetectionResult | null {
    const score = result.qualityMetrics.overallScore!
    const baseline = baselines.quality

    if (baseline.std === 0) return null

    const zScore = Math.abs(score - baseline.mean) / baseline.std
    const threshold = this.getAnomalyThreshold()

    if (zScore > threshold) {
      const severity = zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low'
      
      return {
        resultId: result.id,
        anomalyType: 'quality',
        severity,
        description: `Quality score ${score.toFixed(1)} is ${zScore.toFixed(1)} standard deviations from mean`,
        value: score,
        expectedRange: {
          min: baseline.mean - baseline.std * threshold,
          max: baseline.mean + baseline.std * threshold
        },
        confidence: Math.min(1.0, zScore / threshold),
        recommendations: [
          'Review processing parameters',
          'Check input file quality',
          'Analyze error patterns'
        ]
      }
    }

    return null
  }

  /**
   * Detect performance anomalies
   */
  private detectPerformanceAnomaly(result: AggregatedResult, baselines: any): AnomalyDetectionResult | null {
    const throughput = result.performanceMetrics.throughputFilesPerHour
    const baseline = baselines.throughput

    if (baseline.std === 0) return null

    const zScore = Math.abs(throughput - baseline.mean) / baseline.std
    const threshold = this.getAnomalyThreshold()

    if (zScore > threshold) {
      const severity = zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low'
      
      return {
        resultId: result.id,
        anomalyType: 'performance',
        severity,
        description: `Throughput ${throughput.toFixed(1)} files/hour is ${zScore.toFixed(1)} standard deviations from mean`,
        value: throughput,
        expectedRange: {
          min: baseline.mean - baseline.std * threshold,
          max: baseline.mean + baseline.std * threshold
        },
        confidence: Math.min(1.0, zScore / threshold),
        recommendations: [
          'Check system resources',
          'Review parallel processing settings',
          'Monitor concurrent jobs'
        ]
      }
    }

    return null
  }

  /**
   * Detect error anomalies
   */
  private detectErrorAnomaly(result: AggregatedResult, baselines: any): AnomalyDetectionResult | null {
    const errorRate = result.errorAnalysis.errorRate
    const baseline = baselines.errorRate

    if (baseline.std === 0) return null

    const zScore = Math.abs(errorRate - baseline.mean) / baseline.std
    const threshold = this.getAnomalyThreshold()

    if (zScore > threshold && errorRate > baseline.mean) {
      const severity = zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low'
      
      return {
        resultId: result.id,
        anomalyType: 'errors',
        severity,
        description: `Error rate ${(errorRate * 100).toFixed(1)}% is ${zScore.toFixed(1)} standard deviations above mean`,
        value: errorRate,
        expectedRange: {
          min: 0,
          max: baseline.mean + baseline.std * threshold
        },
        confidence: Math.min(1.0, zScore / threshold),
        recommendations: [
          'Investigate error patterns',
          'Check input file formats',
          'Review processing logic'
        ]
      }
    }

    return null
  }

  /**
   * Detect volume anomalies
   */
  private detectVolumeAnomaly(result: AggregatedResult, baselines: any): AnomalyDetectionResult | null {
    const volume = result.summary.totalFiles
    const baseline = baselines.volume

    if (baseline.std === 0) return null

    const zScore = Math.abs(volume - baseline.mean) / baseline.std
    const threshold = this.getAnomalyThreshold()

    if (zScore > threshold) {
      const severity = zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low'
      
      return {
        resultId: result.id,
        anomalyType: 'volume',
        severity,
        description: `File count ${volume} is ${zScore.toFixed(1)} standard deviations from mean`,
        value: volume,
        expectedRange: {
          min: baseline.mean - baseline.std * threshold,
          max: baseline.mean + baseline.std * threshold
        },
        confidence: Math.min(1.0, zScore / threshold),
        recommendations: [
          'Verify batch composition',
          'Check for duplicate processing',
          'Review input validation'
        ]
      }
    }

    return null
  }

  /**
   * Get anomaly detection threshold based on sensitivity
   */
  private getAnomalyThreshold(): number {
    switch (this.config.anomalyDetection.sensitivityLevel) {
      case 'low': return 3.0    // 99.7% confidence
      case 'medium': return 2.5  // 98.8% confidence
      case 'high': return 2.0    // 95.4% confidence
      default: return 2.5
    }
  }

  /**
   * Calculate quality benchmarks
   */
  private calculateQualityBenchmarks(results: AggregatedResult[]) {
    const scores = results
      .map(r => r.qualityMetrics.overallScore)
      .filter(score => score !== undefined) as number[]

    if (scores.length === 0) {
      return {
        averageScore: 0,
        p95Score: 0,
        p99Score: 0,
        medianScore: 0,
        standardDeviation: 0
      }
    }

    const sorted = [...scores].sort((a, b) => a - b)
    const sum = scores.reduce((a, b) => a + b, 0)
    const mean = sum / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length

    return {
      averageScore: mean,
      p95Score: sorted[Math.floor(scores.length * 0.95)] || 0,
      p99Score: sorted[Math.floor(scores.length * 0.99)] || 0,
      medianScore: sorted[Math.floor(scores.length * 0.5)] || 0,
      standardDeviation: Math.sqrt(variance)
    }
  }

  /**
   * Calculate performance benchmarks
   */
  private calculatePerformanceBenchmarks(results: AggregatedResult[]) {
    const throughputs = results.map(r => r.performanceMetrics.throughputFilesPerHour)
    const processingTimes = results.map(r => r.performanceMetrics.avgProcessingTimePerFile)

    const sortedThroughputs = [...throughputs].sort((a, b) => a - b)
    const sortedTimes = [...processingTimes].sort((a, b) => a - b)

    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length

    return {
      averageThroughput: avgThroughput,
      peakThroughput: Math.max(...throughputs),
      averageProcessingTime: avgProcessingTime,
      p95ProcessingTime: sortedTimes[Math.floor(processingTimes.length * 0.95)] || 0,
      efficiency: avgThroughput > 0 ? 1 / avgProcessingTime : 0
    }
  }

  /**
   * Calculate reliability benchmarks
   */
  private calculateReliabilityBenchmarks(results: AggregatedResult[]) {
    const errorRates = results.map(r => r.errorAnalysis.errorRate)
    const avgErrorRate = errorRates.reduce((a, b) => a + b, 0) / errorRates.length
    const maxErrorRate = Math.max(...errorRates)

    // Simple uptime calculation based on successful vs failed jobs
    const totalJobs = results.reduce((sum, r) => sum + r.summary.totalJobs, 0)
    const successfulJobs = results.reduce((sum, r) => sum + r.summary.successfulJobs, 0)
    const uptime = totalJobs > 0 ? successfulJobs / totalJobs : 1

    return {
      averageErrorRate: avgErrorRate,
      maxErrorRate,
      uptime,
      mtbf: 0, // Would need more detailed failure tracking
      mttr: 0  // Would need recovery time tracking
    }
  }

  /**
   * Get empty benchmarks structure
   */
  private getEmptyBenchmarks(): BenchmarkMetrics {
    return {
      qualityBenchmarks: {
        averageScore: 0,
        p95Score: 0,
        p99Score: 0,
        medianScore: 0,
        standardDeviation: 0
      },
      performanceBenchmarks: {
        averageThroughput: 0,
        peakThroughput: 0,
        averageProcessingTime: 0,
        p95ProcessingTime: 0,
        efficiency: 0
      },
      reliabilityBenchmarks: {
        averageErrorRate: 0,
        maxErrorRate: 0,
        uptime: 1,
        mtbf: 0,
        mttr: 0
      }
    }
  }
}

// Create singleton instance
export const resultsAnalytics = new BatchResultsAnalytics()

// Default export
export default BatchResultsAnalytics 