// Cache types and interfaces
export * from './types'

// Cache implementations
export { LRUMemoryCache } from './MemoryCache'
export { IndexedDBStorage } from './IndexedDBStorage'
export { CacheManager, defaultCacheManager } from './CacheManager'
export { CacheAnalytics, initializeCacheAnalytics } from './CacheAnalytics'
export type { CachePerformanceMetrics, CacheOptimizationRecommendation, CacheInsights } from './CacheAnalytics'

// Convenience re-exports
export type {
  CacheEntry,
  CacheConfig,
  ChunkCacheEntry,
  ProgressCacheEntry,
  FileProgressState,
  ChunkState,
  CacheStats,
  CacheManager as ICacheManager,
  PersistentStorage,
  MemoryCache,
  CacheEventType,
  CacheEvent,
  CacheEventListener
} from './types'

// Default configuration
export { DEFAULT_CACHE_CONFIG } from './types'

// Import CacheManager for the utility function
import { CacheManager } from './CacheManager'
import type { CacheConfig } from './types'

// Utility function to create a configured cache manager
export function createCacheManager(config?: Partial<CacheConfig>) {
  return new CacheManager(config)
}

// Cache utilities
export const cacheUtils = {
  /**
   * Generate a cache key for a chunk
   */
  generateChunkCacheKey: (fileId: string, chunkIndex: number): string => {
    return `chunk_${fileId}_${chunkIndex}`
  },

  /**
   * Generate a cache key for file progress
   */
  generateProgressCacheKey: (fileId: string): string => {
    return `progress_${fileId}`
  },

  /**
   * Extract file ID from a chunk cache key
   */
  extractFileIdFromChunkKey: (chunkKey: string): string | null => {
    const match = chunkKey.match(/^chunk_([^_]+)_\d+$/)
    return match ? match[1] : null
  },

  /**
   * Extract chunk index from a chunk cache key
   */
  extractChunkIndexFromKey: (chunkKey: string): number | null => {
    const match = chunkKey.match(/^chunk_[^_]+_(\d+)$/)
    return match ? parseInt(match[1], 10) : null
  },

  /**
   * Check if a cache key is for a chunk
   */
  isChunkCacheKey: (key: string): boolean => {
    return /^chunk_[^_]+_\d+$/.test(key)
  },

  /**
   * Check if a cache key is for progress
   */
  isProgressCacheKey: (key: string): boolean => {
    return key.startsWith('progress_')
  },

  /**
   * Format cache size for display
   */
  formatCacheSize: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  },

  /**
   * Format hit rate as percentage
   */
  formatHitRate: (hitRate: number): string => {
    return `${(hitRate * 100).toFixed(1)}%`
  },

  /**
   * Calculate cache efficiency score (0-100)
   */
  calculateCacheEfficiency: (stats: import('./types').CacheStats): number => {
    const { overall } = stats
    if (overall.totalRequests === 0) return 0
    
    // Base efficiency on hit ratio, but also consider eviction rate
    const hitRatio = overall.hitRatio
    const evictionPenalty = Math.min(stats.memoryCache.evictions / overall.totalRequests, 0.2)
    
    return Math.max(0, Math.min(100, (hitRatio - evictionPenalty) * 100))
  }
} 