import { ProcessingError, ProcessingJob, BatchOperation } from './types'
import { ErrorPattern, ErrorAlert } from './error-handler'

export interface ErrorTrend {
  errorCode: string
  timeWindow: '1h' | '6h' | '24h' | '7d'
  frequency: number
  trend: 'increasing' | 'decreasing' | 'stable'
  percentageChange: number
  prediction: {
    nextHourEstimate: number
    confidenceLevel: number
  }
}

export interface ErrorCorrelation {
  primaryError: string
  correlatedErrors: Array<{
    errorCode: string
    strength: number // 0-1
    description: string
  }>
  timeWindow: number
  sampleSize: number
}

export interface SystemHealthMetrics {
  timestamp: number
  errorRate: number
  memoryUsage: number
  processingThroughput: number
  averageProcessingTime: number
  failureRate: number
  recoverySuccessRate: number
  circuitBreakerStates: Record<string, boolean>
  alertCount: number
  criticalErrorCount: number
}

export interface ErrorPrediction {
  errorCode: string
  probability: number
  timeToOccurrence: number // milliseconds
  confidence: number
  riskFactors: string[]
  preventiveActions: string[]
}

export interface ErrorReport {
  id: string
  generatedAt: number
  timeRange: { start: number; end: number }
  summary: {
    totalErrors: number
    uniqueErrorTypes: number
    mostCommonError: string
    errorRate: number
    recoveryRate: number
  }
  trends: ErrorTrend[]
  correlations: ErrorCorrelation[]
  predictions: ErrorPrediction[]
  recommendations: string[]
  systemHealth: SystemHealthMetrics
}

export class ErrorAnalyticsEngine {
  private errorHistory: ProcessingError[] = []
  private systemMetricsHistory: SystemHealthMetrics[] = []
  private analysisCache: Map<string, any> = new Map()
  private cacheExpiry = 300000 // 5 minutes

  // Main Analytics Functions
  analyzeErrorPatterns(timeWindow: number = 3600000): ErrorPattern[] {
    const cutoff = Date.now() - timeWindow
    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoff)

    if (recentErrors.length === 0) return []

    // Group errors by code and type
    const errorGroups = new Map<string, ProcessingError[]>()
    recentErrors.forEach(error => {
      const key = `${error.code}-${error.type}`
      if (!errorGroups.has(key)) {
        errorGroups.set(key, [])
      }
      errorGroups.get(key)!.push(error)
    })

    // Create patterns
    const patterns: ErrorPattern[] = []
    errorGroups.forEach((errors, key) => {
      if (errors.length >= 2) { // Minimum frequency for pattern
        const pattern: ErrorPattern = {
          id: `pattern-${key}-${Date.now()}`,
          type: errors[0].code,
          frequency: errors.length,
          lastOccurrence: Math.max(...errors.map(e => e.timestamp)),
          affectedJobs: errors.map(e => e.details?.jobId || '').filter(Boolean),
          commonContext: this.extractCommonContext(errors),
          severity: this.calculatePatternSeverity(errors),
          isRecurring: this.isRecurringPattern(errors, timeWindow)
        }
        patterns.push(pattern)
      }
    })

    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  analyzeErrorTrends(): ErrorTrend[] {
    const timeWindows = ['1h', '6h', '24h', '7d'] as const
    const trends: ErrorTrend[] = []

    // Get unique error codes
    const errorCodes = [...new Set(this.errorHistory.map(e => e.code))]

    errorCodes.forEach(errorCode => {
      timeWindows.forEach(window => {
        const trend = this.calculateErrorTrend(errorCode, window)
        if (trend) {
          trends.push(trend)
        }
      })
    })

    return trends
  }

  analyzeErrorCorrelations(timeWindow: number = 3600000): ErrorCorrelation[] {
    const cutoff = Date.now() - timeWindow
    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoff)

    if (recentErrors.length < 5) return [] // Need minimum sample size

    const correlations: ErrorCorrelation[] = []
    const errorCodes = [...new Set(recentErrors.map(e => e.code))]

    errorCodes.forEach(primaryError => {
      const primaryOccurrences = recentErrors.filter(e => e.code === primaryError)
      const correlatedErrors: ErrorCorrelation['correlatedErrors'] = []

      errorCodes.forEach(otherError => {
        if (otherError === primaryError) return

        const strength = this.calculateCorrelationStrength(
          primaryOccurrences,
          recentErrors.filter(e => e.code === otherError),
          timeWindow
        )

        if (strength > 0.3) { // Threshold for significant correlation
          correlatedErrors.push({
            errorCode: otherError,
            strength,
            description: this.getCorrelationDescription(primaryError, otherError, strength)
          })
        }
      })

      if (correlatedErrors.length > 0) {
        correlations.push({
          primaryError,
          correlatedErrors: correlatedErrors.sort((a, b) => b.strength - a.strength),
          timeWindow,
          sampleSize: primaryOccurrences.length
        })
      }
    })

    return correlations
  }

  predictUpcomingErrors(): ErrorPrediction[] {
    const patterns = this.analyzeErrorPatterns(86400000) // 24 hours
    const trends = this.analyzeErrorTrends()
    const predictions: ErrorPrediction[] = []

    patterns.forEach(pattern => {
      if (pattern.isRecurring && pattern.frequency > 3) {
        const trend = trends.find(t => t.errorCode === pattern.type)
        
        if (trend && trend.trend === 'increasing') {
          const prediction = this.generateErrorPrediction(pattern, trend)
          if (prediction) {
            predictions.push(prediction)
          }
        }
      }
    })

    return predictions.sort((a, b) => b.probability - a.probability)
  }

  generateErrorReport(timeRange?: { start: number; end: number }): ErrorReport {
    if (!timeRange) {
      timeRange = {
        start: Date.now() - 86400000, // 24 hours ago
        end: Date.now()
      }
    }

    const errors = this.errorHistory.filter(e => 
      e.timestamp >= timeRange!.start && e.timestamp <= timeRange!.end
    )

    const patterns = this.analyzeErrorPatterns(timeRange.end - timeRange.start)
    const trends = this.analyzeErrorTrends()
    const correlations = this.analyzeErrorCorrelations(timeRange.end - timeRange.start)
    const predictions = this.predictUpcomingErrors()

    const summary = this.generateSummary(errors)
    const recommendations = this.generateRecommendations(patterns, trends, predictions)

    return {
      id: `report-${Date.now()}`,
      generatedAt: Date.now(),
      timeRange,
      summary,
      trends,
      correlations,
      predictions,
      recommendations,
      systemHealth: this.getCurrentSystemHealth()
    }
  }

  // System Health Monitoring
  recordSystemMetrics(metrics: Partial<SystemHealthMetrics>): void {
    const fullMetrics: SystemHealthMetrics = {
      timestamp: Date.now(),
      errorRate: 0,
      memoryUsage: 0,
      processingThroughput: 0,
      averageProcessingTime: 0,
      failureRate: 0,
      recoverySuccessRate: 0,
      circuitBreakerStates: {},
      alertCount: 0,
      criticalErrorCount: 0,
      ...metrics
    }

    this.systemMetricsHistory.push(fullMetrics)

    // Keep only last 24 hours of metrics
    const cutoff = Date.now() - 86400000
    this.systemMetricsHistory = this.systemMetricsHistory.filter(m => m.timestamp > cutoff)
  }

  getCurrentSystemHealth(): SystemHealthMetrics {
    if (this.systemMetricsHistory.length === 0) {
      return {
        timestamp: Date.now(),
        errorRate: 0,
        memoryUsage: 0,
        processingThroughput: 0,
        averageProcessingTime: 0,
        failureRate: 0,
        recoverySuccessRate: 0,
        circuitBreakerStates: {},
        alertCount: 0,
        criticalErrorCount: 0
      }
    }

    return this.systemMetricsHistory[this.systemMetricsHistory.length - 1]
  }

  // Data Management
  addError(error: ProcessingError): void {
    this.errorHistory.push(error)

    // Keep only last 7 days of errors to prevent memory bloat
    const cutoff = Date.now() - 604800000 // 7 days
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > cutoff)

    // Clear analysis cache when new data arrives
    this.clearExpiredCache()
  }

  getErrorsByTimeRange(start: number, end: number): ProcessingError[] {
    return this.errorHistory.filter(e => e.timestamp >= start && e.timestamp <= end)
  }

  // Performance Metrics
  calculateErrorRate(timeWindow: number = 3600000): number {
    const cutoff = Date.now() - timeWindow
    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoff)
    
    // This would need total job count from processor
    // For now, estimate based on error frequency
    const estimatedTotalJobs = Math.max(recentErrors.length * 5, 1)
    return recentErrors.length / estimatedTotalJobs
  }

  calculateMTTR(errorCode?: string): number {
    // Mean Time To Recovery
    const errors = errorCode 
      ? this.errorHistory.filter(e => e.code === errorCode)
      : this.errorHistory

    if (errors.length === 0) return 0

    // This would need recovery time data from processor
    // For now, estimate based on error patterns
    return this.estimateMTTR(errors)
  }

  // Private Helper Methods
  private extractCommonContext(errors: ProcessingError[]): Record<string, any> {
    const commonContext: Record<string, any> = {}

    if (errors.length === 0) return commonContext

    // Extract common details from error context
    const firstError = errors[0]
    if (firstError.details) {
      Object.keys(firstError.details).forEach(key => {
        const values = errors
          .map(e => e.details?.[key])
          .filter(v => v !== undefined)

        if (values.length === errors.length && values.every(v => v === values[0])) {
          commonContext[key] = values[0]
        }
      })
    }

    return commonContext
  }

  private calculatePatternSeverity(errors: ProcessingError[]): 'low' | 'medium' | 'high' | 'critical' {
    const severityCounts = {
      critical: errors.filter(e => e.severity === 'critical').length,
      high: errors.filter(e => e.severity === 'high').length,
      medium: errors.filter(e => e.severity === 'medium').length,
      low: errors.filter(e => e.severity === 'low').length
    }

    if (severityCounts.critical > 0) return 'critical'
    if (severityCounts.high > errors.length * 0.5) return 'high'
    if (severityCounts.medium > errors.length * 0.3) return 'medium'
    return 'low'
  }

  private isRecurringPattern(errors: ProcessingError[], timeWindow: number): boolean {
    if (errors.length < 3) return false

    // Check if errors occurred with some regularity
    const sortedErrors = errors.sort((a, b) => a.timestamp - b.timestamp)
    const intervals: number[] = []

    for (let i = 1; i < sortedErrors.length; i++) {
      intervals.push(sortedErrors[i].timestamp - sortedErrors[i - 1].timestamp)
    }

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / intervals.length

    // Pattern is recurring if intervals are relatively consistent
    return variance < averageInterval * 0.5
  }

  private calculateErrorTrend(errorCode: string, window: '1h' | '6h' | '24h' | '7d'): ErrorTrend | null {
    const windowMs = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    }[window]

    const now = Date.now()
    const currentPeriod = this.errorHistory.filter(e => 
      e.code === errorCode && 
      e.timestamp > now - windowMs
    )

    const previousPeriod = this.errorHistory.filter(e => 
      e.code === errorCode && 
      e.timestamp > now - (windowMs * 2) && 
      e.timestamp <= now - windowMs
    )

    if (currentPeriod.length === 0 && previousPeriod.length === 0) return null

    const currentFreq = currentPeriod.length
    const previousFreq = previousPeriod.length

    let trend: 'increasing' | 'decreasing' | 'stable'
    let percentageChange: number

    if (previousFreq === 0) {
      trend = currentFreq > 0 ? 'increasing' : 'stable'
      percentageChange = currentFreq > 0 ? 100 : 0
    } else {
      percentageChange = ((currentFreq - previousFreq) / previousFreq) * 100
      
      if (Math.abs(percentageChange) < 10) {
        trend = 'stable'
      } else if (percentageChange > 0) {
        trend = 'increasing'
      } else {
        trend = 'decreasing'
      }
    }

    return {
      errorCode,
      timeWindow: window,
      frequency: currentFreq,
      trend,
      percentageChange,
      prediction: {
        nextHourEstimate: this.predictNextHourFrequency(errorCode, currentFreq, trend),
        confidenceLevel: this.calculatePredictionConfidence(currentFreq, previousFreq)
      }
    }
  }

  private calculateCorrelationStrength(
    primary: ProcessingError[],
    secondary: ProcessingError[],
    timeWindow: number
  ): number {
    if (primary.length === 0 || secondary.length === 0) return 0

    let correlatedOccurrences = 0
    const correlationWindow = 300000 // 5 minutes

    primary.forEach(primaryError => {
      const hasCorrelatedError = secondary.some(secondaryError => 
        Math.abs(primaryError.timestamp - secondaryError.timestamp) <= correlationWindow
      )
      
      if (hasCorrelatedError) {
        correlatedOccurrences++
      }
    })

    return correlatedOccurrences / primary.length
  }

  private getCorrelationDescription(primary: string, secondary: string, strength: number): string {
    const strengthDesc = strength > 0.8 ? 'strong' : strength > 0.5 ? 'moderate' : 'weak'
    return `${strengthDesc} correlation between ${primary} and ${secondary}`
  }

  private generateErrorPrediction(pattern: ErrorPattern, trend: ErrorTrend): ErrorPrediction | null {
    if (trend.trend !== 'increasing') return null

    const probability = Math.min(0.9, trend.frequency / 10 + trend.percentageChange / 100)
    const timeToOccurrence = this.estimateTimeToNextOccurrence(pattern, trend)

    return {
      errorCode: pattern.type,
      probability,
      timeToOccurrence,
      confidence: trend.prediction.confidenceLevel,
      riskFactors: this.identifyRiskFactors(pattern, trend),
      preventiveActions: this.suggestPreventiveActions(pattern.type)
    }
  }

  private generateSummary(errors: ProcessingError[]): ErrorReport['summary'] {
    const uniqueErrorTypes = new Set(errors.map(e => e.code)).size
    const errorCounts = new Map<string, number>()
    
    errors.forEach(error => {
      errorCounts.set(error.code, (errorCounts.get(error.code) || 0) + 1)
    })

    const mostCommonError = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    return {
      totalErrors: errors.length,
      uniqueErrorTypes,
      mostCommonError,
      errorRate: this.calculateErrorRate(),
      recoveryRate: this.calculateRecoveryRate(errors)
    }
  }

  private generateRecommendations(
    patterns: ErrorPattern[],
    trends: ErrorTrend[],
    predictions: ErrorPrediction[]
  ): string[] {
    const recommendations: string[] = []

    // Pattern-based recommendations
    patterns.forEach(pattern => {
      if (pattern.frequency > 5 && pattern.severity === 'critical') {
        recommendations.push(`Investigate critical error pattern: ${pattern.type} (${pattern.frequency} occurrences)`)
      }
    })

    // Trend-based recommendations
    trends.forEach(trend => {
      if (trend.trend === 'increasing' && trend.percentageChange > 50) {
        recommendations.push(`Monitor increasing trend for ${trend.errorCode} (+${trend.percentageChange.toFixed(1)}%)`)
      }
    })

    // Prediction-based recommendations
    predictions.forEach(prediction => {
      if (prediction.probability > 0.7) {
        recommendations.push(`Prepare for likely ${prediction.errorCode} in ${Math.round(prediction.timeToOccurrence / 60000)} minutes`)
      }
    })

    return recommendations.slice(0, 10) // Limit recommendations
  }

  private predictNextHourFrequency(errorCode: string, currentFreq: number, trend: 'increasing' | 'decreasing' | 'stable'): number {
    switch (trend) {
      case 'increasing':
        return Math.round(currentFreq * 1.2)
      case 'decreasing':
        return Math.round(currentFreq * 0.8)
      default:
        return currentFreq
    }
  }

  private calculatePredictionConfidence(current: number, previous: number): number {
    if (current === 0 && previous === 0) return 0.1
    if (previous === 0) return 0.3
    
    const sampleSize = Math.min(current + previous, 50)
    return Math.min(0.95, 0.5 + (sampleSize / 100))
  }

  private estimateTimeToNextOccurrence(pattern: ErrorPattern, trend: ErrorTrend): number {
    // Estimate based on frequency and trend
    const baseInterval = 3600000 / Math.max(pattern.frequency, 1) // Average interval
    const trendMultiplier = trend.trend === 'increasing' ? 0.8 : 1.2
    
    return Math.round(baseInterval * trendMultiplier)
  }

  private identifyRiskFactors(pattern: ErrorPattern, trend: ErrorTrend): string[] {
    const factors: string[] = []
    
    if (pattern.frequency > 10) factors.push('High frequency')
    if (trend.percentageChange > 100) factors.push('Rapid increase')
    if (pattern.severity === 'critical') factors.push('Critical severity')
    if (pattern.isRecurring) factors.push('Recurring pattern')
    
    return factors
  }

  private suggestPreventiveActions(errorCode: string): string[] {
    const actions: Record<string, string[]> = {
      'MEMORY_EXHAUSTION': ['Reduce concurrency', 'Enable garbage collection', 'Monitor memory usage'],
      'FILE_CORRUPTION': ['Validate files before processing', 'Implement file integrity checks'],
      'NETWORK_TIMEOUT': ['Increase timeout settings', 'Implement retry logic', 'Check network stability'],
      'PARSER_ERROR': ['Pre-validate file formats', 'Enable lenient parsing mode'],
      'QUOTA_EXCEEDED': ['Implement rate limiting', 'Monitor API usage', 'Add backoff delays']
    }
    
    return actions[errorCode] || ['Monitor error frequency', 'Implement preventive measures']
  }

  private calculateRecoveryRate(errors: ProcessingError[]): number {
    // This would need recovery data from recovery manager
    // For now, estimate based on error characteristics
    const retriableErrors = errors.filter(e => e.isRetriable).length
    return retriableErrors > 0 ? 0.7 : 0.2 // Estimated recovery rates
  }

  private estimateMTTR(errors: ProcessingError[]): number {
    // Estimate based on error severity and type
    const avgSeverityScore = errors.reduce((sum, error) => {
      const score = { low: 1, medium: 2, high: 3, critical: 4 }[error.severity] || 2
      return sum + score
    }, 0) / errors.length

    return avgSeverityScore * 15000 // 15 seconds per severity point
  }

  private clearExpiredCache(): void {
    const now = Date.now()
    Array.from(this.analysisCache.keys()).forEach(key => {
      const entry = this.analysisCache.get(key)
      if (entry && entry.timestamp + this.cacheExpiry < now) {
        this.analysisCache.delete(key)
      }
    })
  }
}

// Export singleton instance
export const errorAnalyticsEngine = new ErrorAnalyticsEngine() 