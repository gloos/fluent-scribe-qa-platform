/**
 * Progress Storage System
 * 
 * Handles persistence and recovery of progress tracking data.
 * Provides storage adapters for different environments and
 * ensures progress data survives browser refreshes and crashes.
 */

import { 
  ProgressSnapshot, 
  ProgressTimeline, 
  ProgressMonitorConfig 
} from './progress-tracker'
import { AnalyticsReport } from './progress-analytics'

// Storage Types
export interface StorageAdapter {
  save(key: string, data: any): Promise<void>
  load(key: string): Promise<any | null>
  remove(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  clear(): Promise<void>
}

export interface ProgressStorageConfig {
  adapter: StorageAdapter
  autoSave: boolean
  saveInterval: number // milliseconds
  maxStorageSize: number // bytes
  compressionEnabled: boolean
  encryptionEnabled: boolean
}

export interface StoredProgressData {
  version: string
  timestamp: number
  snapshots: Record<string, ProgressSnapshot[]>
  timelines: Record<string, ProgressTimeline>
  config: ProgressMonitorConfig
  metadata: {
    totalSnapshots: number
    totalTimelines: number
    dataSize: number
    lastCleanup: number
  }
}

// Storage Adapters

/**
 * LocalStorage adapter for browser environments
 */
export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string

  constructor(prefix: string = 'progress_') {
    this.prefix = prefix
  }

  async save(key: string, data: any): Promise<void> {
    try {
      const serialized = JSON.stringify(data)
      localStorage.setItem(this.prefix + key, serialized)
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
      throw new Error('Storage quota exceeded or data serialization failed')
    }
  }

  async load(key: string): Promise<any | null> {
    try {
      const item = localStorage.getItem(this.prefix + key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key)
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

  async clear(): Promise<void> {
    const keys = await this.list()
    keys.forEach(key => localStorage.removeItem(this.prefix + key))
  }
}

/**
 * IndexedDB adapter for larger data storage
 */
export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string
  private storeName: string
  private version: number
  private db: IDBDatabase | null = null

  constructor(dbName: string = 'ProgressDB', storeName: string = 'progress', version: number = 1) {
    this.dbName = dbName
    this.storeName = storeName
    this.version = version
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
          db.createObjectStore(this.storeName, { keyPath: 'key' })
        }
      }
    })
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put({ key, data, timestamp: Date.now() })
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async load(key: string): Promise<any | null> {
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

  async remove(key: string): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
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
        const filtered = prefix ? keys.filter(key => key.startsWith(prefix)) : keys
        resolve(filtered)
      }
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
}

/**
 * Memory adapter for testing or temporary storage
 */
export class MemoryAdapter implements StorageAdapter {
  private storage: Map<string, any> = new Map()

  async save(key: string, data: any): Promise<void> {
    this.storage.set(key, JSON.parse(JSON.stringify(data))) // Deep clone
  }

  async load(key: string): Promise<any | null> {
    const data = this.storage.get(key)
    return data ? JSON.parse(JSON.stringify(data)) : null // Deep clone
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys())
    return prefix ? keys.filter(key => key.startsWith(prefix)) : keys
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }
}

/**
 * Main Progress Storage Manager
 */
export class ProgressStorage {
  private config: ProgressStorageConfig
  private saveTimer: NodeJS.Timeout | null = null
  private pendingChanges: boolean = false

  constructor(config: Partial<ProgressStorageConfig> = {}) {
    this.config = {
      adapter: new LocalStorageAdapter(),
      autoSave: true,
      saveInterval: 30000, // 30 seconds
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      compressionEnabled: false,
      encryptionEnabled: false,
      ...config
    }

    if (this.config.autoSave) {
      this.startAutoSave()
    }
  }

  /**
   * Save progress data
   */
  async saveProgress(
    snapshots: Map<string, ProgressSnapshot[]>,
    timelines: Map<string, ProgressTimeline>,
    config: ProgressMonitorConfig
  ): Promise<void> {
    try {
      const data: StoredProgressData = {
        version: '1.0.0',
        timestamp: Date.now(),
        snapshots: Object.fromEntries(snapshots),
        timelines: Object.fromEntries(timelines),
        config,
        metadata: {
          totalSnapshots: Array.from(snapshots.values()).reduce((sum, arr) => sum + arr.length, 0),
          totalTimelines: timelines.size,
          dataSize: 0, // Will be calculated
          lastCleanup: Date.now()
        }
      }

      // Calculate data size
      const serialized = JSON.stringify(data)
      data.metadata.dataSize = new Blob([serialized]).size

      // Check storage limits
      if (data.metadata.dataSize > this.config.maxStorageSize) {
        console.warn('⚠️ Progress data exceeds storage limit, performing cleanup')
        await this.cleanup(snapshots, timelines)
        return this.saveProgress(snapshots, timelines, config)
      }

      // Apply compression if enabled
      const finalData = this.config.compressionEnabled ? 
        await this.compress(data) : data

      // Apply encryption if enabled
      const encryptedData = this.config.encryptionEnabled ? 
        await this.encrypt(finalData) : finalData

      await this.config.adapter.save('current', encryptedData)
      
      // Save backup
      await this.config.adapter.save(`backup_${Date.now()}`, encryptedData)
      
      // Clean old backups (keep last 5)
      await this.cleanupBackups()

      this.pendingChanges = false
      console.log('💾 Progress data saved successfully')
    } catch (error) {
      console.error('❌ Failed to save progress data:', error)
      throw error
    }
  }

  /**
   * Load progress data
   */
  async loadProgress(): Promise<{
    snapshots: Map<string, ProgressSnapshot[]>
    timelines: Map<string, ProgressTimeline>
    config: ProgressMonitorConfig
  } | null> {
    try {
      let data = await this.config.adapter.load('current')
      
      if (!data) {
        // Try to load from backup
        const backups = await this.config.adapter.list('backup_')
        if (backups.length > 0) {
          const latestBackup = backups.sort().pop()!
          data = await this.config.adapter.load(latestBackup)
          console.log('📥 Loaded progress data from backup')
        }
      }

      if (!data) {
        return null
      }

      // Apply decryption if enabled
      const decryptedData = this.config.encryptionEnabled ? 
        await this.decrypt(data) : data

      // Apply decompression if enabled
      const finalData = this.config.compressionEnabled ? 
        await this.decompress(decryptedData) : decryptedData

      // Validate data structure
      if (!this.validateData(finalData)) {
        console.warn('⚠️ Invalid progress data structure, starting fresh')
        return null
      }

      const result = {
        snapshots: new Map(Object.entries(finalData.snapshots).map(([key, value]) => [key, value as ProgressSnapshot[]])),
        timelines: new Map(Object.entries(finalData.timelines).map(([key, value]) => [key, value as ProgressTimeline])),
        config: finalData.config as ProgressMonitorConfig
      }

      console.log('📥 Progress data loaded successfully')
      return result
    } catch (error) {
      console.error('❌ Failed to load progress data:', error)
      return null
    }
  }

  /**
   * Save analytics report
   */
  async saveReport(report: AnalyticsReport): Promise<void> {
    const key = `report_${report.generatedAt}`
    await this.config.adapter.save(key, report)
  }

  /**
   * Load analytics reports
   */
  async loadReports(limit: number = 10): Promise<AnalyticsReport[]> {
    const keys = await this.config.adapter.list('report_')
    const sortedKeys = keys.sort().slice(-limit)
    
    const reports: AnalyticsReport[] = []
    for (const key of sortedKeys) {
      const report = await this.config.adapter.load(key)
      if (report) reports.push(report)
    }
    
    return reports
  }

  /**
   * Export all progress data
   */
  async exportData(): Promise<string> {
    const current = await this.config.adapter.load('current')
    const reports = await this.loadReports(50)
    
    const exportData = {
      progress: current,
      reports,
      exportedAt: Date.now(),
      version: '1.0.0'
    }
    
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import progress data
   */
  async importData(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.progress) {
        await this.config.adapter.save('current', parsed.progress)
      }
      
      if (parsed.reports && Array.isArray(parsed.reports)) {
        for (const report of parsed.reports) {
          await this.saveReport(report)
        }
      }
      
      console.log('📥 Progress data imported successfully')
    } catch (error) {
      console.error('❌ Failed to import progress data:', error)
      throw error
    }
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    await this.config.adapter.clear()
    console.log('🧹 All progress data cleared')
  }

  /**
   * Mark data as changed (for auto-save)
   */
  markChanged(): void {
    this.pendingChanges = true
  }

  /**
   * Stop auto-save
   */
  stop(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
  }

  // Private methods

  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      if (this.pendingChanges) {
        // Auto-save would need access to current progress data
        // This would be implemented by the ProgressTracker
        console.log('🔄 Auto-save triggered')
      }
    }, this.config.saveInterval)
  }

  private async cleanup(
    snapshots: Map<string, ProgressSnapshot[]>,
    timelines: Map<string, ProgressTimeline>
  ): Promise<void> {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    let cleanedCount = 0

    // Clean old snapshots
    snapshots.forEach((snapshotArray, id) => {
      const filtered = snapshotArray.filter(s => s.timestamp > cutoffTime)
      if (filtered.length !== snapshotArray.length) {
        snapshots.set(id, filtered)
        cleanedCount += snapshotArray.length - filtered.length
      }
    })

    // Clean old timelines
    timelines.forEach((timeline, id) => {
      if (timeline.endTime && timeline.endTime < cutoffTime) {
        timelines.delete(id)
        snapshots.delete(id)
      }
    })

    console.log(`🧹 Cleaned up ${cleanedCount} old progress records`)
  }

  private async cleanupBackups(): Promise<void> {
    const backups = await this.config.adapter.list('backup_')
    const sortedBackups = backups.sort()
    
    // Keep only the last 5 backups
    if (sortedBackups.length > 5) {
      const toDelete = sortedBackups.slice(0, sortedBackups.length - 5)
      for (const backup of toDelete) {
        await this.config.adapter.remove(backup)
      }
    }
  }

  private validateData(data: any): boolean {
    return data && 
           data.version && 
           data.snapshots && 
           data.timelines && 
           data.config &&
           typeof data.snapshots === 'object' &&
           typeof data.timelines === 'object'
  }

  private async compress(data: any): Promise<any> {
    // Placeholder for compression implementation
    // Could use libraries like pako for gzip compression
    return data
  }

  private async decompress(data: any): Promise<any> {
    // Placeholder for decompression implementation
    return data
  }

  private async encrypt(data: any): Promise<any> {
    // Placeholder for encryption implementation
    // Could use Web Crypto API for encryption
    return data
  }

  private async decrypt(data: any): Promise<any> {
    // Placeholder for decryption implementation
    return data
  }
}

// Export default adapters
export const defaultLocalStorage = new LocalStorageAdapter()
export const defaultIndexedDB = new IndexedDBAdapter()
export const defaultMemoryStorage = new MemoryAdapter()

// Export singleton instance
export const progressStorage = new ProgressStorage({
  adapter: defaultLocalStorage,
  autoSave: true,
  saveInterval: 30000
})

// Export class for custom instances
export default ProgressStorage 