import { MemoryCache, CacheConfig, CacheEntry } from './types'

interface LRUNode<T> {
  key: string
  entry: CacheEntry<T>
  prev: LRUNode<T> | null
  next: LRUNode<T> | null
}

export class LRUMemoryCache implements MemoryCache {
  private cache = new Map<string, LRUNode<any>>()
  private head: LRUNode<any> | null = null
  private tail: LRUNode<any> | null = null
  private maxSize: number
  private maxEntries: number
  private currentSize: number = 0
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    deletes: 0
  }

  constructor(private config: CacheConfig) {
    this.maxSize = config.maxMemorySize
    this.maxEntries = config.maxMemoryEntries
  }

  get<T>(key: string): T | null {
    const node = this.cache.get(key)
    if (!node) {
      this.stats.misses++
      return null
    }

    // Check TTL expiration
    const now = Date.now()
    if (node.entry.expiresAt && node.entry.expiresAt < now) {
      this.delete(key)
      this.stats.misses++
      return null
    }

    // Update access information
    node.entry.lastAccessed = now
    node.entry.accessCount++
    
    // Move to front (most recently used)
    this.moveToFront(node)
    
    this.stats.hits++
    return node.entry.value as T
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    const size = this.calculateSize(value)
    
    // Check if we need to make room
    while (
      (this.currentSize + size > this.maxSize) || 
      (this.cache.size >= this.maxEntries)
    ) {
      if (!this.evictLRU()) {
        // Cannot evict any more items
        return false
      }
    }

    const now = Date.now()
    const expiresAt = ttl ? now + ttl : undefined

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expiresAt,
      accessCount: 1,
      lastAccessed: now,
      size,
      metadata: {}
    }

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.delete(key)
    }

    // Create new node
    const node: LRUNode<T> = {
      key,
      entry,
      prev: null,
      next: null
    }

    // Add to cache and move to front
    this.cache.set(key, node)
    this.addToFront(node)
    this.currentSize += size
    this.stats.sets++

    return true
  }

  delete(key: string): boolean {
    const node = this.cache.get(key)
    if (!node) {
      return false
    }

    // Remove from linked list
    this.removeNode(node)
    
    // Remove from cache
    this.cache.delete(key)
    this.currentSize -= node.entry.size
    this.stats.deletes++

    return true
  }

  has(key: string): boolean {
    const node = this.cache.get(key)
    if (!node) return false

    // Check TTL expiration
    const now = Date.now()
    if (node.entry.expiresAt && node.entry.expiresAt < now) {
      this.delete(key)
      return false
    }

    return true
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
    this.currentSize = 0
    this.stats.evictions += this.cache.size
  }

  size(): number {
    return this.cache.size
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      memoryUsage: this.currentSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      sets: this.stats.sets,
      deletes: this.stats.deletes
    }
  }

  // Get entries sorted by access time (for debugging)
  getEntriesByAccess(): Array<{ key: string; lastAccessed: number; accessCount: number }> {
    const entries: Array<{ key: string; lastAccessed: number; accessCount: number }> = []
    let current = this.head
    
    while (current) {
      entries.push({
        key: current.key,
        lastAccessed: current.entry.lastAccessed,
        accessCount: current.entry.accessCount
      })
      current = current.next
    }
    
    return entries
  }

  // Clean up expired entries
  cleanupExpired(): number {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, node] of this.cache) {
      if (node.entry.expiresAt && node.entry.expiresAt < now) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.delete(key))
    return keysToDelete.length
  }

  // Update configuration
  updateConfig(config: Partial<CacheConfig>): void {
    if (config.maxMemorySize !== undefined) {
      this.maxSize = config.maxMemorySize
      // Trigger cleanup if new size is smaller
      while (this.currentSize > this.maxSize) {
        if (!this.evictLRU()) break
      }
    }
    
    if (config.maxMemoryEntries !== undefined) {
      this.maxEntries = config.maxMemoryEntries
      // Trigger cleanup if new entry limit is smaller
      while (this.cache.size > this.maxEntries) {
        if (!this.evictLRU()) break
      }
    }
  }

  private calculateSize(value: any): number {
    if (value instanceof Blob) {
      return value.size
    }
    
    if (value instanceof ArrayBuffer) {
      return value.byteLength
    }
    
    if (typeof value === 'string') {
      return value.length * 2 // UTF-16 characters
    }
    
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2
      } catch {
        return 1024 // Default size for objects that can't be serialized
      }
    }
    
    return 64 // Default size for primitives
  }

  private moveToFront(node: LRUNode<any>): void {
    // Remove from current position
    this.removeNode(node)
    // Add to front
    this.addToFront(node)
  }

  private addToFront(node: LRUNode<any>): void {
    node.prev = null
    node.next = this.head

    if (this.head) {
      this.head.prev = node
    }

    this.head = node

    if (!this.tail) {
      this.tail = node
    }
  }

  private removeNode(node: LRUNode<any>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }
  }

  private evictLRU(): boolean {
    if (!this.tail) {
      return false
    }

    const key = this.tail.key
    this.delete(key)
    this.stats.evictions++
    
    return true
  }
} 