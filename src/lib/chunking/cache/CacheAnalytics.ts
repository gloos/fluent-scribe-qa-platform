import { CacheManager, CacheStats, CacheEvent, CacheEventListener, cacheUtils } from './index'

export interface CachePerformanceMetrics {
  averageHitRate: number
  averageResponseTime: number
  memoryEfficiency: number
  evictionRate: number
  errorRate: number
  totalRequests: number
  trending: {
    hitRateTrend: 'improving' | 'declining' | 'stable'
    memoryUsageTrend: 'increasing' | 'decreasing' | 'stable'
    errorTrend: 'improving' | 'worsening' | 'stable'
  }
}

export interface CacheOptimizationRecommendation {
  type: 'memory_size' | 'ttl' | 'eviction_policy' | 'cleanup_frequency'
  priority: 'high' | 'medium' | 'low'
  description: string
  currentValue: string | number
  recommendedValue: string | number
  expectedImprovement: string
}

export interface CacheInsights {
  topCachedFiles: Array<{ fileId: string; fileName: string; hitCount: number; size: number }>
  mostEvictedChunks: Array<{ chunkId: string; evictionCount: number }>
  peakUsageHours: Array<{ hour: number; requestCount: number }>
  cacheHealthScore: number // 0-100
  recommendations: CacheOptimizationRecommendation[]
}

export class CacheAnalytics implements CacheEventListener {
  private metrics: Map<string, number> = new Map()
  private events: CacheEvent[] = []
  private maxEventHistory = 1000
  private performanceHistory: CachePerformanceMetrics[] = []
  private maxHistorySize = 24 // 24 hours of hourly snapshots

  // Performance tracking
  private requestTimes: Map<string, number> = new Map()
  private fileAccessCounts: Map<string, number> = new Map()
  private chunkEvictionCounts: Map<string, number> = new Map()
  private hourlyRequestCounts: Map<number, number> = new Map()

  constructor(private cacheManager: CacheManager) {
    this.cacheManager.addListener(this)
    this.startPeriodicAnalysis()
  }

  onCacheEvent(event: CacheEvent): void {
    // Store event for analysis
    this.events.push(event)
    if (this.events.length > this.maxEventHistory) {
      this.events.shift()
    }

    // Track metrics based on event type
    this.updateMetrics(event)
    this.trackPerformance(event)
  }

  private updateMetrics(event: CacheEvent): void {
    const metricKey = `${event.type}_count`
    this.metrics.set(metricKey, (this.metrics.get(metricKey) || 0) + 1)

    // Track request timing
    if (event.type === 'cache_get') {
      this.requestTimes.set(event.key, event.timestamp)
    } else if (event.type === 'cache_hit' || event.type === 'cache_miss') {
      const startTime = this.requestTimes.get(event.key)
      if (startTime) {
        const responseTime = event.timestamp - startTime
        this.metrics.set('total_response_time', (this.metrics.get('total_response_time') || 0) + responseTime)
        this.requestTimes.delete(event.key)
      }
    }

    // Track file access patterns
    if (event.metadata?.fileId) {
      const fileId = event.metadata.fileId
      this.fileAccessCounts.set(fileId, (this.fileAccessCounts.get(fileId) || 0) + 1)
    }

    // Track evictions
    if (event.type === 'cache_eviction') {
      this.chunkEvictionCounts.set(event.key, (this.chunkEvictionCounts.get(event.key) || 0) + 1)
    }

    // Track hourly patterns
    const hour = new Date(event.timestamp).getHours()
    this.hourlyRequestCounts.set(hour, (this.hourlyRequestCounts.get(hour) || 0) + 1)
  }

  private trackPerformance(event: CacheEvent): void {
    // Performance tracking logic would be implemented here
    // For now, we'll update when we get cache stats updates
  }

  getCurrentMetrics(): CachePerformanceMetrics {
    const stats = this.cacheManager.getStats()
    const totalRequests = this.metrics.get('cache_hit_count') || 0 + this.metrics.get('cache_miss_count') || 0
    const errorCount = this.metrics.get('cache_error_count') || 0
    const evictionCount = this.metrics.get('cache_eviction_count') || 0
    const totalResponseTime = this.metrics.get('total_response_time') || 0

    return {
      averageHitRate: stats.overall.hitRatio,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      memoryEfficiency: stats.memoryCache.totalSize > 0 ? 
        (stats.memoryCache.entries / stats.memoryCache.totalSize) * 100 : 0,
      evictionRate: totalRequests > 0 ? evictionCount / totalRequests : 0,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      totalRequests,
      trending: this.calculateTrends()
    }
  }

  private calculateTrends(): CachePerformanceMetrics['trending'] {
    if (this.performanceHistory.length < 2) {
      return {
        hitRateTrend: 'stable',
        memoryUsageTrend: 'stable',
        errorTrend: 'stable'
      }
    }

    const recent = this.performanceHistory[this.performanceHistory.length - 1]
    const previous = this.performanceHistory[this.performanceHistory.length - 2]

    const hitRateDiff = recent.averageHitRate - previous.averageHitRate
    const memoryDiff = recent.memoryEfficiency - previous.memoryEfficiency
    const errorDiff = recent.errorRate - previous.errorRate

    return {
      hitRateTrend: hitRateDiff > 0.05 ? 'improving' : hitRateDiff < -0.05 ? 'declining' : 'stable',
      memoryUsageTrend: memoryDiff > 5 ? 'increasing' : memoryDiff < -5 ? 'decreasing' : 'stable',
      errorTrend: errorDiff < -0.01 ? 'improving' : errorDiff > 0.01 ? 'worsening' : 'stable'
    }
  }

  generateInsights(): CacheInsights {
    const stats = this.cacheManager.getStats()
    const metrics = this.getCurrentMetrics()

    // Top cached files
    const topFiles = Array.from(this.fileAccessCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([fileId, hitCount]) => ({
        fileId,
        fileName: this.extractFileNameFromId(fileId),
        hitCount,
        size: 0 // Would need to be calculated from actual cache data
      }))

    // Most evicted chunks
    const mostEvicted = Array.from(this.chunkEvictionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([chunkId, evictionCount]) => ({ chunkId, evictionCount }))

    // Peak usage hours
    const peakHours = Array.from(this.hourlyRequestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, requestCount]) => ({ hour, requestCount }))

    // Calculate health score
    const healthScore = this.calculateHealthScore(metrics, stats)

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, stats)

    return {
      topCachedFiles: topFiles,
      mostEvictedChunks: mostEvicted,
      peakUsageHours: peakHours,
      cacheHealthScore: healthScore,
      recommendations
    }
  }

  private calculateHealthScore(metrics: CachePerformanceMetrics, stats: CacheStats): number {
    let score = 100

    // Penalize low hit rate
    if (metrics.averageHitRate < 0.5) score -= 20
    else if (metrics.averageHitRate < 0.7) score -= 10

    // Penalize high error rate
    if (metrics.errorRate > 0.05) score -= 15
    else if (metrics.errorRate > 0.02) score -= 5

    // Penalize high eviction rate
    if (metrics.evictionRate > 0.3) score -= 15
    else if (metrics.evictionRate > 0.1) score -= 5

    // Penalize poor memory efficiency
    if (metrics.memoryEfficiency < 30) score -= 10
    else if (metrics.memoryEfficiency < 50) score -= 5

    // Reward good trending
    if (metrics.trending.hitRateTrend === 'improving') score += 5
    if (metrics.trending.errorTrend === 'improving') score += 5

    return Math.max(0, Math.min(100, score))
  }

  private generateRecommendations(
    metrics: CachePerformanceMetrics, 
    stats: CacheStats
  ): CacheOptimizationRecommendation[] {
    const recommendations: CacheOptimizationRecommendation[] = []

    // Memory size recommendations
    if (metrics.evictionRate > 0.2) {
      recommendations.push({
        type: 'memory_size',
        priority: 'high',
        description: 'High eviction rate indicates insufficient memory cache size',
        currentValue: cacheUtils.formatCacheSize(stats.memoryCache.totalSize),
        recommendedValue: cacheUtils.formatCacheSize(stats.memoryCache.totalSize * 1.5),
        expectedImprovement: 'Reduce evictions by ~40%, improve hit rate by ~15%'
      })
    }

    // TTL recommendations
    if (metrics.averageHitRate < 0.6) {
      recommendations.push({
        type: 'ttl',
        priority: 'medium',
        description: 'Low hit rate may indicate overly aggressive TTL expiration',
        currentValue: '30 minutes',
        recommendedValue: '60 minutes',
        expectedImprovement: 'Increase hit rate by ~10-20%'
      })
    }

    // Error rate recommendations
    if (metrics.errorRate > 0.02) {
      recommendations.push({
        type: 'cleanup_frequency',
        priority: 'high',
        description: 'High error rate suggests cache corruption or storage issues',
        currentValue: '5 minutes',
        recommendedValue: '2 minutes',
        expectedImprovement: 'Reduce errors by ~50%, improve reliability'
      })
    }

    return recommendations
  }

  private extractFileNameFromId(fileId: string): string {
    // Simple extraction - in real implementation, this might query cached metadata
    return fileId.split('_')[0] || 'unknown'
  }

  getPerformanceHistory(): CachePerformanceMetrics[] {
    return [...this.performanceHistory]
  }

  getRecentEvents(count: number = 50): CacheEvent[] {
    return this.events.slice(-count)
  }

  exportAnalytics(): string {
    const data = {
      metrics: this.getCurrentMetrics(),
      insights: this.generateInsights(),
      history: this.getPerformanceHistory(),
      recentEvents: this.getRecentEvents(100)
    }
    return JSON.stringify(data, null, 2)
  }

  private startPeriodicAnalysis(): void {
    // Take performance snapshot every hour
    setInterval(() => {
      const metrics = this.getCurrentMetrics()
      this.performanceHistory.push(metrics)
      
      if (this.performanceHistory.length > this.maxHistorySize) {
        this.performanceHistory.shift()
      }
      
      console.log('📊 Cache performance snapshot taken:', {
        hitRate: cacheUtils.formatHitRate(metrics.averageHitRate),
        requests: metrics.totalRequests,
        errorRate: cacheUtils.formatHitRate(metrics.errorRate)
      })
    }, 60 * 60 * 1000) // Every hour
  }

  destroy(): void {
    this.cacheManager.removeListener(this)
    this.events = []
    this.metrics.clear()
    this.performanceHistory = []
  }
}

// Export a default analytics instance
export const defaultCacheAnalytics = new CacheAnalytics(
  // Will be initialized when cache manager is available
  null as any // Temporary - should be properly initialized
)

// Utility function to initialize analytics with a cache manager
export function initializeCacheAnalytics(cacheManager: CacheManager): CacheAnalytics {
  return new CacheAnalytics(cacheManager)
} 