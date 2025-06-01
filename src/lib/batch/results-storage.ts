import {
  AggregatedResult,
  ResultsQuery,
  ResultsStorage,
  ResultsStorageConfig,
  DEFAULT_RESULTS_STORAGE_CONFIG
} from './types'

/**
 * Storage adapter interface for different persistence mechanisms
 */
export interface StorageAdapter {
  name: string
  store(key: string, data: string): Promise<void>
  retrieve(key: string): Promise<string | null>
  list(prefix?: string): Promise<string[]>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  size(): Promise<number>
  configure(config: Record<string, any>): void
}

/**
 * Local Storage adapter for browser environments
 */
export class LocalStorageAdapter implements StorageAdapter {
  name = 'localStorage'
  private prefix = 'batch_results_'

  configure(config: Record<string, any>): void {
    if (config.prefix) {
      this.prefix = config.prefix
    }
  }

  async store(key: string, data: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, data)
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Auto-cleanup old entries and retry
        await this.performCleanup()
        localStorage.setItem(this.prefix + key, data)
      } else {
        throw error
      }
    }
  }

  async retrieve(key: string): Promise<string | null> {
    return localStorage.getItem(this.prefix + key)
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = []
    const searchPrefix = this.prefix + (prefix || '')
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(searchPrefix)) {
        keys.push(key.substring(this.prefix.length))
      }
    }
    
    return keys
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.prefix + key
    if (localStorage.getItem(fullKey) !== null) {
      localStorage.removeItem(fullKey)
      return true
    }
    return false
  }

  async clear(): Promise<void> {
    const keys = await this.list()
    for (const key of keys) {
      await this.delete(key)
    }
  }

  async size(): Promise<number> {
    let totalSize = 0
    const keys = await this.list()
    
    for (const key of keys) {
      const data = await this.retrieve(key)
      if (data) {
        totalSize += new Blob([data]).size
      }
    }
    
    return totalSize
  }

  private async performCleanup(): Promise<void> {
    const keys = await this.list()
    const entries: Array<{ key: string; timestamp: number }> = []
    
    // Parse timestamps and sort by age
    for (const key of keys) {
      const data = await this.retrieve(key)
      if (data) {
        try {
          const parsed = JSON.parse(data)
          entries.push({ key, timestamp: parsed.createdAt || 0 })
        } catch {
          // Invalid data, mark for deletion
          entries.push({ key, timestamp: 0 })
        }
      }
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp)
    
    // Delete oldest 25% of entries
    const toDelete = Math.ceil(entries.length * 0.25)
    for (let i = 0; i < toDelete; i++) {
      await this.delete(entries[i].key)
    }
  }
}

/**
 * IndexedDB adapter for browser environments with larger storage capacity
 */
export class IndexedDBAdapter implements StorageAdapter {
  name = 'indexedDB'
  private dbName = 'BatchResultsDB'
  private storeName = 'results'
  private version = 1
  private db: IDBDatabase | null = null

  configure(config: Record<string, any>): void {
    if (config.dbName) this.dbName = config.dbName
    if (config.storeName) this.storeName = config.storeName
    if (config.version) this.version = config.version
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async store(key: string, data: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.put({
        key,
        data,
        timestamp: Date.now(),
        size: new Blob([data]).size
      })
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async retrieve(key: string): Promise<string | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
    })
  }

  async list(prefix?: string): Promise<string[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const keys = request.result as string[]
        if (prefix) {
          resolve(keys.filter(key => key.startsWith(prefix)))
        } else {
          resolve(keys)
        }
      }
    })
  }

  async delete(key: string): Promise<boolean> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      // Check if exists first
      const getRequest = store.get(key)
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          const deleteRequest = store.delete(key)
          deleteRequest.onerror = () => reject(deleteRequest.error)
          deleteRequest.onsuccess = () => resolve(true)
        } else {
          resolve(false)
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async clear(): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async size(): Promise<number> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result
        const totalSize = results.reduce((sum: number, item: any) => sum + (item.size || 0), 0)
        resolve(totalSize)
      }
    })
  }
}

/**
 * Memory adapter for testing and temporary storage
 */
export class MemoryAdapter implements StorageAdapter {
  name = 'memory'
  private storage = new Map<string, { data: string; timestamp: number; size: number }>()

  configure(config: Record<string, any>): void {
    // Memory adapter doesn't need configuration
  }

  async store(key: string, data: string): Promise<void> {
    this.storage.set(key, {
      data,
      timestamp: Date.now(),
      size: new Blob([data]).size
    })
  }

  async retrieve(key: string): Promise<string | null> {
    const entry = this.storage.get(key)
    return entry ? entry.data : null
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys())
    if (prefix) {
      return keys.filter(key => key.startsWith(prefix))
    }
    return keys
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  async size(): Promise<number> {
    let totalSize = 0
    for (const entry of this.storage.values()) {
      totalSize += entry.size
    }
    return totalSize
  }
}

/**
 * Main results storage implementation
 */
export class BatchResultsStorage implements ResultsStorage {
  private adapter: StorageAdapter
  private config: ResultsStorageConfig
  private compressionEnabled: boolean
  private cleanupIntervalId?: NodeJS.Timeout

  constructor(
    adapter?: StorageAdapter,
    config: ResultsStorageConfig = DEFAULT_RESULTS_STORAGE_CONFIG
  ) {
    this.adapter = adapter || this.createDefaultAdapter(config.adapter)
    this.config = { ...config }
    this.compressionEnabled = config.compressionEnabled
    
    this.adapter.configure(config)
    this.setupAutoCleanup()
  }

  /**
   * Store an aggregated result
   */
  async store(result: AggregatedResult): Promise<string> {
    try {
      const key = this.generateKey(result)
      let data = JSON.stringify(result)
      
      // Compress if enabled
      if (this.compressionEnabled) {
        data = await this.compress(data)
      }
      
      // Check storage size before storing
      await this.ensureStorageCapacity(data)
      
      await this.adapter.store(key, data)
      
      console.log(`💾 Stored aggregated result: ${result.id}`)
      return key
      
    } catch (error) {
      console.error('❌ Error storing aggregated result:', error)
      throw error
    }
  }

  /**
   * Retrieve an aggregated result by ID
   */
  async retrieve(id: string): Promise<AggregatedResult | null> {
    try {
      const key = this.formatKey(id)
      let data = await this.adapter.retrieve(key)
      
      if (!data) return null
      
      // Decompress if necessary
      if (this.compressionEnabled) {
        data = await this.decompress(data)
      }
      
      const result = JSON.parse(data) as AggregatedResult
      return result
      
    } catch (error) {
      console.error(`❌ Error retrieving result ${id}:`, error)
      return null
    }
  }

  /**
   * Query aggregated results based on criteria
   */
  async query(query: ResultsQuery): Promise<AggregatedResult[]> {
    try {
      const keys = await this.adapter.list()
      const results: AggregatedResult[] = []
      
      // Load and filter results
      for (const key of keys) {
        const result = await this.retrieve(this.extractIdFromKey(key))
        if (result && this.matchesQuery(result, query)) {
          results.push(result)
        }
      }
      
      // Apply sorting
      if (query.sortBy) {
        results.sort((a, b) => this.compareResults(a, b, query.sortBy!, query.sortOrder))
      }
      
      // Apply pagination
      let paginatedResults = results
      if (query.offset || query.limit) {
        const start = query.offset || 0
        const end = query.limit ? start + query.limit : results.length
        paginatedResults = results.slice(start, end)
      }
      
      return paginatedResults
      
    } catch (error) {
      console.error('❌ Error querying results:', error)
      return []
    }
  }

  /**
   * Update an existing aggregated result
   */
  async update(id: string, updates: Partial<AggregatedResult>): Promise<boolean> {
    try {
      const existing = await this.retrieve(id)
      if (!existing) return false
      
      const updated = { ...existing, ...updates }
      await this.store(updated)
      
      return true
      
    } catch (error) {
      console.error(`❌ Error updating result ${id}:`, error)
      return false
    }
  }

  /**
   * Delete an aggregated result
   */
  async delete(id: string): Promise<boolean> {
    try {
      const key = this.formatKey(id)
      const deleted = await this.adapter.delete(key)
      
      if (deleted) {
        console.log(`🗑️ Deleted aggregated result: ${id}`)
      }
      
      return deleted
      
    } catch (error) {
      console.error(`❌ Error deleting result ${id}:`, error)
      return false
    }
  }

  /**
   * Store multiple results in batch
   */
  async storeBatch(results: AggregatedResult[]): Promise<string[]> {
    const keys: string[] = []
    
    for (const result of results) {
      try {
        const key = await this.store(result)
        keys.push(key)
      } catch (error) {
        console.error(`❌ Error storing result ${result.id} in batch:`, error)
      }
    }
    
    return keys
  }

  /**
   * Get count of results matching query
   */
  async queryCount(query: ResultsQuery): Promise<number> {
    const results = await this.query(query)
    return results.length
  }

  /**
   * Clean up old results
   */
  async cleanup(olderThan: number): Promise<number> {
    try {
      const keys = await this.adapter.list()
      let deletedCount = 0
      
      for (const key of keys) {
        const result = await this.retrieve(this.extractIdFromKey(key))
        if (result && result.createdAt < olderThan) {
          const deleted = await this.delete(result.id)
          if (deleted) deletedCount++
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} old results`)
      return deletedCount
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error)
      return 0
    }
  }

  /**
   * Export results matching query as JSON string
   */
  async export(query: ResultsQuery): Promise<string> {
    const results = await this.query(query)
    return JSON.stringify({
      exportedAt: Date.now(),
      count: results.length,
      query,
      results
    }, null, 2)
  }

  /**
   * Import results from JSON string
   */
  async import(data: string): Promise<number> {
    try {
      const imported = JSON.parse(data)
      
      if (!imported.results || !Array.isArray(imported.results)) {
        throw new Error('Invalid import data format')
      }
      
      const keys = await this.storeBatch(imported.results)
      
      console.log(`📥 Imported ${keys.length} results`)
      return keys.length
      
    } catch (error) {
      console.error('❌ Error importing results:', error)
      return 0
    }
  }

  /**
   * Configure the storage
   */
  configure(config: ResultsStorageConfig): void {
    this.config = { ...this.config, ...config }
    this.compressionEnabled = config.compressionEnabled
    this.adapter.configure(config)
    
    // Restart auto-cleanup with new config
    this.setupAutoCleanup()
    
    console.log('⚙️ Results storage configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): ResultsStorageConfig {
    return { ...this.config }
  }

  // ===== Private Methods =====

  /**
   * Create default adapter based on type
   */
  private createDefaultAdapter(type: string): StorageAdapter {
    switch (type) {
      case 'localStorage':
        return new LocalStorageAdapter()
      case 'indexedDB':
        return new IndexedDBAdapter()
      case 'memory':
        return new MemoryAdapter()
      default:
        return new LocalStorageAdapter()
    }
  }

  /**
   * Generate storage key for result
   */
  private generateKey(result: AggregatedResult): string {
    return this.formatKey(result.id)
  }

  /**
   * Format key with consistent prefix
   */
  private formatKey(id: string): string {
    return `result_${id}`
  }

  /**
   * Extract ID from storage key
   */
  private extractIdFromKey(key: string): string {
    return key.replace(/^result_/, '')
  }

  /**
   * Check if result matches query criteria
   */
  private matchesQuery(result: AggregatedResult, query: ResultsQuery): boolean {
    // Date range filter
    if (query.dateRange) {
      const resultTime = result.completedAt || result.createdAt
      if (resultTime < query.dateRange.start || resultTime > query.dateRange.end) {
        return false
      }
    }

    // Batch ID filter
    if (query.batchIds && query.batchIds.length > 0) {
      if (!result.batchId || !query.batchIds.includes(result.batchId)) {
        return false
      }
    }

    // Project ID filter
    if (query.projectIds && query.projectIds.length > 0) {
      if (!result.projectId || !query.projectIds.includes(result.projectId)) {
        return false
      }
    }

    // Quality score filter
    if (query.minQualityScore !== undefined) {
      if (!result.qualityMetrics.overallScore || result.qualityMetrics.overallScore < query.minQualityScore) {
        return false
      }
    }

    // Error rate filter
    if (query.maxErrorRate !== undefined) {
      if (result.errorAnalysis.errorRate > query.maxErrorRate) {
        return false
      }
    }

    // Has errors filter
    if (query.hasErrors !== undefined) {
      const hasErrors = result.errorAnalysis.totalErrors > 0
      if (query.hasErrors !== hasErrors) {
        return false
      }
    }

    return true
  }

  /**
   * Compare results for sorting
   */
  private compareResults(
    a: AggregatedResult,
    b: AggregatedResult,
    sortBy: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): number {
    let comparison = 0

    switch (sortBy) {
      case 'createdAt':
        comparison = a.createdAt - b.createdAt
        break
      case 'completedAt':
        const aCompleted = a.completedAt || a.createdAt
        const bCompleted = b.completedAt || b.createdAt
        comparison = aCompleted - bCompleted
        break
      case 'qualityScore':
        const aScore = a.qualityMetrics.overallScore || 0
        const bScore = b.qualityMetrics.overallScore || 0
        comparison = aScore - bScore
        break
      case 'errorRate':
        comparison = a.errorAnalysis.errorRate - b.errorAnalysis.errorRate
        break
      case 'processingTime':
        comparison = a.summary.processingTimeMs - b.summary.processingTimeMs
        break
      default:
        comparison = a.createdAt - b.createdAt
    }

    return sortOrder === 'asc' ? comparison : -comparison
  }

  /**
   * Ensure storage has capacity for new data
   */
  private async ensureStorageCapacity(data: string): Promise<void> {
    const currentSize = await this.adapter.size()
    const dataSize = new Blob([data]).size
    const maxSize = this.config.maxStorageSize * 1024 * 1024 // Convert MB to bytes
    
    if (currentSize + dataSize > maxSize) {
      // Perform cleanup to make space
      const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
      await this.cleanup(cutoff)
      
      // If still over capacity, remove oldest entries
      const newSize = await this.adapter.size()
      if (newSize + dataSize > maxSize) {
        await this.performEmergencyCleanup(dataSize)
      }
    }
  }

  /**
   * Emergency cleanup when storage is full
   */
  private async performEmergencyCleanup(requiredSpace: number): Promise<void> {
    const keys = await this.adapter.list()
    const entries: Array<{ key: string; result: AggregatedResult }> = []
    
    // Load all results and sort by age
    for (const key of keys) {
      const result = await this.retrieve(this.extractIdFromKey(key))
      if (result) {
        entries.push({ key, result })
      }
    }
    
    // Sort by creation time (oldest first)
    entries.sort((a, b) => a.result.createdAt - b.result.createdAt)
    
    // Delete oldest entries until we have enough space
    let freedSpace = 0
    for (const entry of entries) {
      const deleted = await this.delete(entry.result.id)
      if (deleted) {
        const data = JSON.stringify(entry.result)
        freedSpace += new Blob([data]).size
        
        if (freedSpace >= requiredSpace * 1.2) { // 20% buffer
          break
        }
      }
    }
  }

  /**
   * Set up automatic cleanup
   */
  private setupAutoCleanup(): void {
    // Clear existing interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
    }
    
    if (!this.config.autoCleanup) return
    
    // Run cleanup daily
    this.cleanupIntervalId = setInterval(async () => {
      const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
      await this.cleanup(cutoff)
    }, 24 * 60 * 60 * 1000) // 24 hours
  }

  /**
   * Simple compression (placeholder - in production use proper compression)
   */
  private async compress(data: string): Promise<string> {
    // For now, just return the data
    // In production, implement proper compression like gzip
    return data
  }

  /**
   * Simple decompression (placeholder)
   */
  private async decompress(data: string): Promise<string> {
    // For now, just return the data
    return data
  }
}

// Create default instances
export const defaultLocalStorage = new BatchResultsStorage(new LocalStorageAdapter())
export const defaultIndexedDB = new BatchResultsStorage(new IndexedDBAdapter())
export const defaultMemoryStorage = new BatchResultsStorage(new MemoryAdapter())

// Default export
export default BatchResultsStorage 