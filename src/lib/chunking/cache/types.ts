export interface CacheEntry<T> {
  key: string
  value: T
  timestamp: number
  expiresAt?: number
  accessCount: number
  lastAccessed: number
  size: number // in bytes
  metadata?: Record<string, any>
}

export interface CacheConfig {
  maxMemorySize: number // Maximum memory cache size in bytes
  defaultTTL: number // Default time to live in milliseconds
  maxMemoryEntries: number // Maximum number of entries in memory
  persistentCacheEnabled: boolean // Enable IndexedDB persistent cache
  compressionEnabled: boolean // Enable compression for large entries
  evictionPolicy: 'LRU' | 'LFU' | 'TTL' // Cache eviction strategy
}

export interface ChunkCacheEntry extends CacheEntry<Blob> {
  chunkId: string
  fileId: string
  chunkIndex: number
  checksum: string
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed'
  uploadPath?: string
  retryCount: number
}

export interface ProgressCacheEntry extends CacheEntry<FileProgressState> {
  fileId: string
  fileName: string
}

export interface FileProgressState {
  fileId: string
  fileName: string
  fileSize: number
  fileChecksum: string
  lastModified: number
  chunkStates: Map<string, ChunkState>
  uploadProgress: {
    totalChunks: number
    completedChunks: number
    failedChunks: number
    bytesUploaded: number
    totalBytes: number
    startTime: number
    lastUpdateTime: number
  }
  resumeToken?: string
}

export interface ChunkState {
  chunkId: string
  chunkIndex: number
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cached'
  uploadPath?: string
  checksum: string
  size: number
  attempts: number
  lastAttempt?: number
  errorMessage?: string
}

export interface CacheStats {
  memoryCache: {
    entries: number
    totalSize: number
    hitRate: number
    missRate: number
    evictions: number
  }
  persistentCache: {
    entries: number
    totalSize: number
    hitRate: number
    missRate: number
  }
  overall: {
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    hitRatio: number
  }
}

export interface CacheManager {
  // Chunk caching operations
  cacheChunk(chunkId: string, chunkBlob: Blob, metadata: ChunkCacheEntry): Promise<void>
  getCachedChunk(chunkId: string): Promise<ChunkCacheEntry | null>
  removeCachedChunk(chunkId: string): Promise<void>
  
  // Progress state caching
  cacheFileProgress(fileId: string, progressState: FileProgressState): Promise<void>
  getCachedFileProgress(fileId: string): Promise<ProgressCacheEntry | null>
  removeCachedFileProgress(fileId: string): Promise<void>
  
  // Bulk operations
  getCachedChunksForFile(fileId: string): Promise<ChunkCacheEntry[]>
  clearFileCache(fileId: string): Promise<void>
  
  // Cache management
  getStats(): CacheStats
  cleanup(): Promise<void>
  clear(): Promise<void>
  
  // Configuration
  updateConfig(config: Partial<CacheConfig>): void
  getConfig(): CacheConfig
}

export interface PersistentStorage {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  clear(): Promise<void>
  keys(): Promise<string[]>
  size(): Promise<number>
}

export interface MemoryCache {
  get<T>(key: string): T | null
  set<T>(key: string, value: T, ttl?: number): boolean
  delete(key: string): boolean
  has(key: string): boolean
  clear(): void
  size(): number
  keys(): string[]
  getStats(): {
    hits: number
    misses: number
    evictions: number
    size: number
    memoryUsage: number
  }
}

export type CacheEventType = 
  | 'cache_hit' 
  | 'cache_miss' 
  | 'cache_set' 
  | 'cache_delete' 
  | 'cache_evict'
  | 'cache_clear'
  | 'cache_error'

export interface CacheEvent {
  type: CacheEventType
  key: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface CacheEventListener {
  onCacheEvent: (event: CacheEvent) => void
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxMemorySize: 100 * 1024 * 1024, // 100MB
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxMemoryEntries: 1000,
  persistentCacheEnabled: true,
  compressionEnabled: true,
  evictionPolicy: 'LRU'
} 