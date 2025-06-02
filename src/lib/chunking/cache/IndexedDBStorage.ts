import { PersistentStorage } from './types'

export class IndexedDBStorage implements PersistentStorage {
  private dbName: string
  private storeName: string
  private version: number
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  constructor(
    dbName: string = 'FluentScribeCache',
    storeName: string = 'chunks',
    version: number = 1
  ) {
    this.dbName = dbName
    this.storeName = storeName
    this.version = version
  }

  private async init(): Promise<void> {
    if (this.db) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment'))
        return
      }

      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result

        // Handle unexpected close
        this.db.onclose = () => {
          console.warn('IndexedDB connection closed unexpectedly')
          this.db = null
          this.initPromise = null
        }

        // Handle version change while open
        this.db.onversionchange = () => {
          console.warn('IndexedDB version changed, closing connection')
          this.db?.close()
          this.db = null
          this.initPromise = null
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          
          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('expiresAt', 'expiresAt', { unique: false })
          store.createIndex('fileId', 'fileId', { unique: false })
          
          console.log(`Created IndexedDB object store: ${this.storeName}`)
        }
      }
    })

    await this.initPromise
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(key)

        request.onsuccess = () => {
          const result = request.result
          
          if (!result) {
            resolve(null)
            return
          }

          // Check TTL expiration
          const now = Date.now()
          if (result.expiresAt && result.expiresAt < now) {
            // Expired entry, delete it
            this.delete(key).catch(console.error)
            resolve(null)
            return
          }

          // Parse value if it was stored as JSON
          try {
            const value = typeof result.value === 'string' 
              ? JSON.parse(result.value) 
              : result.value
            resolve(value)
          } catch (parseError) {
            resolve(result.value)
          }
        }

        request.onerror = () => {
          reject(new Error(`Failed to get key ${key}: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      const now = Date.now()
      const expiresAt = ttl ? now + ttl : undefined

      // Prepare value for storage
      let storageValue: any
      let size = 0

      if (value instanceof Blob) {
        // Store blobs as ArrayBuffer
        storageValue = await value.arrayBuffer()
        size = value.size
      } else if (value instanceof ArrayBuffer) {
        storageValue = value
        size = value.byteLength
      } else {
        // Store other objects as JSON strings
        storageValue = JSON.stringify(value)
        size = storageValue.length * 2 // UTF-16 characters
      }

      const entry = {
        key,
        value: storageValue,
        timestamp: now,
        expiresAt,
        size,
        type: value instanceof Blob ? 'blob' : 
              value instanceof ArrayBuffer ? 'arraybuffer' : 'json'
      }

      // Extract fileId for indexing if present
      if (typeof value === 'object' && value !== null && 'fileId' in value) {
        (entry as any).fileId = (value as any).fileId
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put(entry)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          reject(new Error(`Failed to set key ${key}: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB set error:', error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.delete(key)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          reject(new Error(`Failed to delete key ${key}: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB delete error:', error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.get(key)
      return value !== null
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => {
          reject(new Error(`Failed to clear store: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB clear error:', error)
      throw error
    }
  }

  async keys(): Promise<string[]> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAllKeys()

        request.onsuccess = () => {
          resolve(request.result as string[])
        }

        request.onerror = () => {
          reject(new Error(`Failed to get keys: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB keys error:', error)
      return []
    }
  }

  async size(): Promise<number> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.count()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => {
          reject(new Error(`Failed to get size: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB size error:', error)
      return 0
    }
  }

  // Additional utility methods

  async getByFileId(fileId: string): Promise<any[]> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const index = store.index('fileId')
        const request = index.getAll(fileId)

        request.onsuccess = () => {
          const results = request.result.map(entry => {
            try {
              return typeof entry.value === 'string' 
                ? JSON.parse(entry.value) 
                : entry.value
            } catch {
              return entry.value
            }
          })
          resolve(results)
        }

        request.onerror = () => {
          reject(new Error(`Failed to get by fileId ${fileId}: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB getByFileId error:', error)
      return []
    }
  }

  async cleanupExpired(): Promise<number> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      const now = Date.now()
      let deletedCount = 0

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const index = store.index('expiresAt')
        
        // Get all entries that have expired
        const range = IDBKeyRange.upperBound(now)
        const request = index.openCursor(range)

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            cursor.delete()
            deletedCount++
            cursor.continue()
          } else {
            resolve(deletedCount)
          }
        }

        request.onerror = () => {
          reject(new Error(`Failed to cleanup expired entries: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB cleanup error:', error)
      return 0
    }
  }

  async getStorageUsage(): Promise<{ entries: number; estimatedSize: number }> {
    try {
      await this.init()
      if (!this.db) throw new Error('Database not initialized')

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAll()

        request.onsuccess = () => {
          const entries = request.result
          const estimatedSize = entries.reduce((total, entry) => {
            return total + (entry.size || 0)
          }, 0)

          resolve({
            entries: entries.length,
            estimatedSize
          })
        }

        request.onerror = () => {
          reject(new Error(`Failed to get storage usage: ${request.error?.message}`))
        }
      })
    } catch (error) {
      console.error('IndexedDB storage usage error:', error)
      return { entries: 0, estimatedSize: 0 }
    }
  }

  // Close the database connection
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
} 