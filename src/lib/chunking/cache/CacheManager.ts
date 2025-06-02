import { 
  CacheManager as ICacheManager,
  CacheConfig,
  ChunkCacheEntry,
  ProgressCacheEntry,
  FileProgressState,
  CacheStats,
  CacheEvent,
  CacheEventListener,
  DEFAULT_CACHE_CONFIG
} from './types'
import { LRUMemoryCache } from './MemoryCache'
import { IndexedDBStorage } from './IndexedDBStorage'
import { memoryManager } from '../MemoryManager'

export class CacheManager implements ICacheManager {
  private config: CacheConfig
  private memoryCache: LRUMemoryCache
  private persistentStorage: IndexedDBStorage
  private listeners: CacheEventListener[] = []
  private cleanupInterval: NodeJS.Timeout | null = null
  private stats = {
    memoryHits: 0,
    memoryMisses: 0,
    persistentHits: 0,
    persistentMisses: 0,
    totalRequests: 0
  }

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.memoryCache = new LRUMemoryCache(this.config)
    this.persistentStorage = new IndexedDBStorage()
    
    this.startPeriodicCleanup()
    this.setupMemoryPressureHandling()
  }

  // Chunk caching operations
  async cacheChunk(chunkId: string, chunkBlob: Blob, metadata: Omit<ChunkCacheEntry, 'key' | 'value' | 'timestamp' | 'accessCount' | 'lastAccessed' | 'size'>): Promise<void> {
    try {
      const entry: ChunkCacheEntry = {
        key: chunkId,
        value: chunkBlob,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        size: chunkBlob.size,
        expiresAt: this.config.defaultTTL ? Date.now() + this.config.defaultTTL : undefined,
        ...metadata
      }

      // Always try to cache in memory first
      const memoryCached = this.memoryCache.set(chunkId, entry, this.config.defaultTTL)
      
      // If memory cache fails or persistent cache is enabled, store in IndexedDB
      if (!memoryCached || this.config.persistentCacheEnabled) {
        await this.persistentStorage.set(chunkId, entry, this.config.defaultTTL)
      }

      this.emitEvent('cache_set', chunkId, { size: chunkBlob.size, type: 'chunk' })
      
      console.log(`📦 Cached chunk ${chunkId} (${Math.round(chunkBlob.size / 1024)}KB) - Memory: ${memoryCached ? '✅' : '❌'}, Persistent: ${this.config.persistentCacheEnabled ? '✅' : '❌'}`)
    } catch (error) {
      console.error('Failed to cache chunk:', error)
      this.emitEvent('cache_error', chunkId, { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  async getCachedChunk(chunkId: string): Promise<ChunkCacheEntry | null> {
    this.stats.totalRequests++

    try {
      // Try memory cache first
      const memoryCached = this.memoryCache.get<ChunkCacheEntry>(chunkId)
      if (memoryCached) {
        this.stats.memoryHits++
        this.emitEvent('cache_hit', chunkId, { source: 'memory' })
        console.log(`💨 Memory cache hit for chunk ${chunkId}`)
        return memoryCached
      }

      this.stats.memoryMisses++

      // Try persistent storage if enabled
      if (this.config.persistentCacheEnabled) {
        const persistentCached = await this.persistentStorage.get<ChunkCacheEntry>(chunkId)
        if (persistentCached) {
          this.stats.persistentHits++
          this.emitEvent('cache_hit', chunkId, { source: 'persistent' })
          
          // Promote to memory cache for faster future access
          this.memoryCache.set(chunkId, persistentCached, this.config.defaultTTL)
          
          console.log(`💾 Persistent cache hit for chunk ${chunkId} (promoted to memory)`)
          return persistentCached
        }
        this.stats.persistentMisses++
      }

      this.emitEvent('cache_miss', chunkId, { searched: ['memory', ...(this.config.persistentCacheEnabled ? ['persistent'] : [])] })
      console.log(`❌ Cache miss for chunk ${chunkId}`)
      return null
    } catch (error) {
      console.error('Failed to get cached chunk:', error)
      this.emitEvent('cache_error', chunkId, { error: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }

  async removeCachedChunk(chunkId: string): Promise<void> {
    try {
      this.memoryCache.delete(chunkId)
      
      if (this.config.persistentCacheEnabled) {
        await this.persistentStorage.delete(chunkId)
      }

      this.emitEvent('cache_delete', chunkId, { type: 'chunk' })
      console.log(`🗑️ Removed cached chunk ${chunkId}`)
    } catch (error) {
      console.error('Failed to remove cached chunk:', error)
      this.emitEvent('cache_error', chunkId, { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  // Progress state caching
  async cacheFileProgress(fileId: string, progressState: FileProgressState): Promise<void> {
    try {
      const entry: ProgressCacheEntry = {
        key: fileId,
        value: progressState,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        size: this.calculateProgressStateSize(progressState),
        expiresAt: this.config.defaultTTL ? Date.now() + this.config.defaultTTL : undefined,
        fileId,
        fileName: progressState.fileName
      }

      // Progress states are primarily stored in persistent storage for cross-session resumability
      if (this.config.persistentCacheEnabled) {
        await this.persistentStorage.set(`progress_${fileId}`, entry, this.config.defaultTTL)
      }

      // Also cache in memory for quick access during current session
      this.memoryCache.set(`progress_${fileId}`, entry, this.config.defaultTTL)

      this.emitEvent('cache_set', `progress_${fileId}`, { type: 'progress', fileId })
      console.log(`📊 Cached progress for file ${fileId} (${progressState.fileName})`)
    } catch (error) {
      console.error('Failed to cache file progress:', error)
      this.emitEvent('cache_error', `progress_${fileId}`, { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  async getCachedFileProgress(fileId: string): Promise<ProgressCacheEntry | null> {
    const key = `progress_${fileId}`
    this.stats.totalRequests++

    try {
      // Try memory cache first
      const memoryCached = this.memoryCache.get<ProgressCacheEntry>(key)
      if (memoryCached) {
        this.stats.memoryHits++
        this.emitEvent('cache_hit', key, { source: 'memory', type: 'progress' })
        return memoryCached
      }

      this.stats.memoryMisses++

      // Try persistent storage
      if (this.config.persistentCacheEnabled) {
        const persistentCached = await this.persistentStorage.get<ProgressCacheEntry>(key)
        if (persistentCached) {
          this.stats.persistentHits++
          this.emitEvent('cache_hit', key, { source: 'persistent', type: 'progress' })
          
          // Promote to memory cache
          this.memoryCache.set(key, persistentCached, this.config.defaultTTL)
          
          console.log(`📊 Restored progress for file ${fileId} from persistent cache`)
          return persistentCached
        }
        this.stats.persistentMisses++
      }

      this.emitEvent('cache_miss', key, { type: 'progress' })
      return null
    } catch (error) {
      console.error('Failed to get cached file progress:', error)
      this.emitEvent('cache_error', key, { error: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }

  async removeCachedFileProgress(fileId: string): Promise<void> {
    const key = `progress_${fileId}`
    
    try {
      this.memoryCache.delete(key)
      
      if (this.config.persistentCacheEnabled) {
        await this.persistentStorage.delete(key)
      }

      this.emitEvent('cache_delete', key, { type: 'progress', fileId })
      console.log(`🗑️ Removed cached progress for file ${fileId}`)
    } catch (error) {
      console.error('Failed to remove cached file progress:', error)
      this.emitEvent('cache_error', key, { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  // Bulk operations
  async getCachedChunksForFile(fileId: string): Promise<ChunkCacheEntry[]> {
    try {
      const chunks: ChunkCacheEntry[] = []

      // Get from memory cache
      const memoryKeys = this.memoryCache.keys()
      for (const key of memoryKeys) {
        if (key.startsWith(fileId)) {
          const chunk = this.memoryCache.get<ChunkCacheEntry>(key)
          if (chunk?.fileId === fileId) {
            chunks.push(chunk)
          }
        }
      }

      // Get from persistent storage if enabled
      if (this.config.persistentCacheEnabled) {
        const persistentChunks = await this.persistentStorage.getByFileId(fileId)
        
        // Merge with memory cache results, avoiding duplicates
        for (const chunk of persistentChunks) {
          if (!chunks.find(c => c.chunkId === chunk.chunkId)) {
            chunks.push(chunk)
          }
        }
      }

      console.log(`📦 Found ${chunks.length} cached chunks for file ${fileId}`)
      return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    } catch (error) {
      console.error('Failed to get cached chunks for file:', error)
      return []
    }
  }

  async clearFileCache(fileId: string): Promise<void> {
    try {
      // Clear chunks
      const chunks = await this.getCachedChunksForFile(fileId)
      for (const chunk of chunks) {
        await this.removeCachedChunk(chunk.chunkId)
      }

      // Clear progress
      await this.removeCachedFileProgress(fileId)

      this.emitEvent('cache_clear', fileId, { type: 'file' })
      console.log(`🧹 Cleared all cache for file ${fileId}`)
    } catch (error) {
      console.error('Failed to clear file cache:', error)
      throw error
    }
  }

  // Cache management
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats()
    
    return {
      memoryCache: {
        entries: memoryStats.size,
        totalSize: memoryStats.memoryUsage,
        hitRate: this.stats.memoryHits / Math.max(1, this.stats.memoryHits + this.stats.memoryMisses),
        missRate: this.stats.memoryMisses / Math.max(1, this.stats.memoryHits + this.stats.memoryMisses),
        evictions: memoryStats.evictions
      },
      persistentCache: {
        entries: 0, // Will be populated async if needed
        totalSize: 0, // Will be populated async if needed
        hitRate: this.stats.persistentHits / Math.max(1, this.stats.persistentHits + this.stats.persistentMisses),
        missRate: this.stats.persistentMisses / Math.max(1, this.stats.persistentHits + this.stats.persistentMisses)
      },
      overall: {
        totalRequests: this.stats.totalRequests,
        cacheHits: this.stats.memoryHits + this.stats.persistentHits,
        cacheMisses: this.stats.memoryMisses + this.stats.persistentMisses,
        hitRatio: (this.stats.memoryHits + this.stats.persistentHits) / Math.max(1, this.stats.totalRequests)
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Starting cache cleanup...')
      
      // Clean expired entries from memory cache
      const expiredMemoryCount = this.memoryCache.cleanupExpired()
      
      // Clean expired entries from persistent storage
      let expiredPersistentCount = 0
      if (this.config.persistentCacheEnabled) {
        expiredPersistentCount = await this.persistentStorage.cleanupExpired()
      }

      console.log(`🧹 Cache cleanup complete: ${expiredMemoryCount} expired memory entries, ${expiredPersistentCount} expired persistent entries`)
    } catch (error) {
      console.error('Failed to cleanup cache:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      this.memoryCache.clear()
      
      if (this.config.persistentCacheEnabled) {
        await this.persistentStorage.clear()
      }

      // Reset stats
      this.stats = {
        memoryHits: 0,
        memoryMisses: 0,
        persistentHits: 0,
        persistentMisses: 0,
        totalRequests: 0
      }

      this.emitEvent('cache_clear', 'all', { type: 'all' })
      console.log('🧹 Cleared all cache data')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      throw error
    }
  }

  // Configuration
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config }
    this.memoryCache.updateConfig(this.config)
    console.log('⚙️ Updated cache configuration', config)
  }

  getConfig(): CacheConfig {
    return { ...this.config }
  }

  // Event system
  addListener(listener: CacheEventListener): void {
    this.listeners.push(listener)
  }

  removeListener(listener: CacheEventListener): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  private emitEvent(type: CacheEvent['type'], key: string, metadata?: Record<string, any>): void {
    const event: CacheEvent = {
      type,
      key,
      timestamp: Date.now(),
      metadata
    }

    this.listeners.forEach(listener => {
      try {
        listener.onCacheEvent(event)
      } catch (error) {
        console.error('Error in cache event listener:', error)
      }
    })
  }

  private calculateProgressStateSize(progressState: FileProgressState): number {
    // Estimate size of progress state object
    const baseSize = 512 // Base object overhead
    const chunkStatesSize = progressState.chunkStates.size * 256 // Estimate per chunk state
    return baseSize + chunkStatesSize
  }

  private startPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error)
    }, 5 * 60 * 1000)
  }

  private setupMemoryPressureHandling(): void {
    // Listen to memory pressure events and adjust cache behavior
    if (memoryManager) {
      memoryManager.registerCleanupCallback(() => {
        console.log('💾 Memory pressure detected, reducing cache size')
        
        // Reduce memory cache size during memory pressure
        const currentStats = this.memoryCache.getStats()
        const targetReduction = Math.min(currentStats.size * 0.3, 50) // Remove 30% or 50 entries max
        
        for (let i = 0; i < targetReduction; i++) {
          const keys = this.memoryCache.keys()
          if (keys.length === 0) break
          
          // Remove least recently used items
          const keyToRemove = keys[keys.length - 1]
          this.memoryCache.delete(keyToRemove)
        }
      })
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.persistentStorage.close()
    this.listeners = []
    
    console.log('🧹 Cache manager destroyed')
  }
}

// Singleton instance for global use
export const defaultCacheManager = new CacheManager() 