/**
 * Memory Manager for Optimized Chunk Processing
 * 
 * This module provides memory optimization strategies for large file chunk processing,
 * including memory pressure detection, buffer pooling, and progressive cleanup.
 */

export interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  memoryPressure: 'low' | 'medium' | 'high' | 'critical'
  availableMemoryMB: number
  recommendedChunkSize: number
}

export interface BufferPoolConfig {
  maxPoolSize: number
  targetChunkSize: number
  enableReuse: boolean
  cleanupIntervalMs: number
}

export interface MemoryCleanupResult {
  freedMemoryMB: number
  remainingObjects: number
  gcTriggered: boolean
  newMemoryPressure: MemoryStats['memoryPressure']
}

/**
 * Buffer pool for reusing ArrayBuffers to reduce garbage collection
 */
class BufferPool {
  private pool: ArrayBuffer[] = []
  private config: BufferPoolConfig
  private lastCleanup: number = Date.now()

  constructor(config: BufferPoolConfig) {
    this.config = config
  }

  /**
   * Get a buffer from the pool or create a new one
   */
  acquire(size: number): ArrayBuffer {
    // Try to find a suitable buffer in the pool
    const suitableIndex = this.pool.findIndex(buffer => 
      buffer.byteLength >= size && buffer.byteLength <= size * 1.5
    )

    if (suitableIndex !== -1 && this.config.enableReuse) {
      const buffer = this.pool.splice(suitableIndex, 1)[0]
      console.log(`🔄 Reused buffer from pool: ${buffer.byteLength} bytes`)
      return buffer.slice(0, size) // Return exactly the size needed
    }

    // Create new buffer
    console.log(`🆕 Created new buffer: ${size} bytes`)
    return new ArrayBuffer(size)
  }

  /**
   * Return a buffer to the pool for reuse
   */
  release(buffer: ArrayBuffer): void {
    if (!this.config.enableReuse) {
      return // Reuse disabled
    }

    if (this.pool.length >= this.config.maxPoolSize) {
      // Pool is full, let garbage collector handle it
      return
    }

    // Only pool buffers close to target size
    if (buffer.byteLength >= this.config.targetChunkSize * 0.5 && 
        buffer.byteLength <= this.config.targetChunkSize * 2) {
      this.pool.push(buffer)
      console.log(`♻️ Buffer returned to pool: ${buffer.byteLength} bytes (pool size: ${this.pool.length})`)
    }

    this.cleanupIfNeeded()
  }

  /**
   * Clean up old buffers periodically
   */
  private cleanupIfNeeded(): void {
    const now = Date.now()
    if (now - this.lastCleanup > this.config.cleanupIntervalMs) {
      const oldLength = this.pool.length
      // Remove oldest buffers if pool is getting large
      if (this.pool.length > this.config.maxPoolSize * 0.8) {
        this.pool.splice(0, Math.floor(this.pool.length * 0.3))
      }
      this.lastCleanup = now
      
      if (oldLength !== this.pool.length) {
        console.log(`🧹 Buffer pool cleanup: ${oldLength} → ${this.pool.length} buffers`)
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      totalPoolMemoryMB: this.pool.reduce((total, buf) => total + buf.byteLength, 0) / (1024 * 1024),
      maxPoolSize: this.config.maxPoolSize
    }
  }

  /**
   * Clear all buffers from pool
   */
  clear(): void {
    const freed = this.pool.length
    this.pool.length = 0
    console.log(`🗑️ Cleared buffer pool: ${freed} buffers released`)
  }
}

/**
 * Memory Manager for chunk processing optimization
 */
export class MemoryManager {
  private static instance: MemoryManager
  private bufferPool: BufferPool
  private lastMemoryCheck: number = 0
  private memoryCheckInterval: number = 2000 // Check every 2 seconds
  private activeBlobReferences = new WeakSet<Blob>()
  private cleanupCallbacks: (() => void)[] = []

  private constructor() {
    this.bufferPool = new BufferPool({
      maxPoolSize: 20,
      targetChunkSize: 5 * 1024 * 1024, // 5MB
      enableReuse: true,
      cleanupIntervalMs: 30000 // 30 seconds
    })

    this.setupPeriodicCleanup()
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const performance = window.performance as any
    const memory = performance.memory

    if (!memory) {
      // Fallback for browsers without memory API
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        memoryPressure: 'low',
        availableMemoryMB: 1000, // Conservative fallback
        recommendedChunkSize: 5 * 1024 * 1024 // 5MB
      }
    }

    const usedMB = memory.usedJSHeapSize / (1024 * 1024)
    const totalMB = memory.totalJSHeapSize / (1024 * 1024)
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024)
    
    const usageRatio = usedMB / limitMB
    let memoryPressure: MemoryStats['memoryPressure']
    let recommendedChunkSize: number

    if (usageRatio > 0.9) {
      memoryPressure = 'critical'
      recommendedChunkSize = 1024 * 1024 // 1MB
    } else if (usageRatio > 0.7) {
      memoryPressure = 'high'
      recommendedChunkSize = 2 * 1024 * 1024 // 2MB
    } else if (usageRatio > 0.5) {
      memoryPressure = 'medium'
      recommendedChunkSize = 5 * 1024 * 1024 // 5MB
    } else {
      memoryPressure = 'low'
      recommendedChunkSize = 10 * 1024 * 1024 // 10MB
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      memoryPressure,
      availableMemoryMB: limitMB - usedMB,
      recommendedChunkSize
    }
  }

  /**
   * Optimize chunk size based on current memory pressure
   */
  optimizeChunkSize(originalSize: number): number {
    const stats = this.getMemoryStats()
    const optimized = Math.min(originalSize, stats.recommendedChunkSize)
    
    if (optimized !== originalSize) {
      console.log(`📊 Chunk size optimized: ${originalSize / (1024 * 1024)}MB → ${optimized / (1024 * 1024)}MB (pressure: ${stats.memoryPressure})`)
    }
    
    return optimized
  }

  /**
   * Create an optimized chunk blob with memory management
   */
  createOptimizedChunk(file: File, start: number, end: number): { 
    blob: Blob, 
    cleanup: () => void 
  } {
    const blob = file.slice(start, end)
    this.activeBlobReferences.add(blob)
    
    const cleanup = () => {
      // Note: We can't forcibly release blob memory, but we can remove our reference
      // The WeakSet will automatically clean up when blob is garbage collected
      console.log(`🧹 Chunk cleanup called for range ${start}-${end}`)
    }

    return { blob, cleanup }
  }

  /**
   * Acquire a buffer for chunk processing
   */
  acquireBuffer(size: number): ArrayBuffer {
    const optimizedSize = this.optimizeChunkSize(size)
    return this.bufferPool.acquire(optimizedSize)
  }

  /**
   * Release a buffer back to the pool
   */
  releaseBuffer(buffer: ArrayBuffer): void {
    this.bufferPool.release(buffer)
  }

  /**
   * Perform memory cleanup
   */
  async performCleanup(): Promise<MemoryCleanupResult> {
    const beforeStats = this.getMemoryStats()
    
    console.log(`🧹 Starting memory cleanup (pressure: ${beforeStats.memoryPressure})`)
    
    // Clear buffer pool if memory pressure is high
    if (beforeStats.memoryPressure === 'high' || beforeStats.memoryPressure === 'critical') {
      this.bufferPool.clear()
    }
    
    // Run cleanup callbacks
    let freedCallbacks = 0
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback()
        freedCallbacks++
      } catch (error) {
        console.warn('Cleanup callback error:', error)
      }
    })
    this.cleanupCallbacks.length = 0
    
    // Trigger garbage collection hint (if available)
    let gcTriggered = false
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc()
        gcTriggered = true
        console.log('🗑️ Manual garbage collection triggered')
      } catch (error) {
        console.warn('Manual GC failed:', error)
      }
    }
    
    // Wait a bit for cleanup to take effect
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const afterStats = this.getMemoryStats()
    const freedMemoryMB = (beforeStats.usedJSHeapSize - afterStats.usedJSHeapSize) / (1024 * 1024)
    
    console.log(`✅ Memory cleanup completed: ${freedMemoryMB.toFixed(2)}MB freed, pressure: ${beforeStats.memoryPressure} → ${afterStats.memoryPressure}`)
    
    return {
      freedMemoryMB,
      remainingObjects: freedCallbacks,
      gcTriggered,
      newMemoryPressure: afterStats.memoryPressure
    }
  }

  /**
   * Register a cleanup callback
   */
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  /**
   * Check if memory cleanup is needed
   */
  shouldCleanup(): boolean {
    const now = Date.now()
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return false
    }
    
    this.lastMemoryCheck = now
    const stats = this.getMemoryStats()
    
    return stats.memoryPressure === 'high' || stats.memoryPressure === 'critical'
  }

  /**
   * Monitor memory during chunk processing
   */
  async monitorChunkProcessing<T>(
    operation: () => Promise<T>,
    operationName: string = 'chunk operation'
  ): Promise<T> {
    const beforeStats = this.getMemoryStats()
    const startTime = Date.now()
    
    try {
      const result = await operation()
      
      const afterStats = this.getMemoryStats()
      const duration = Date.now() - startTime
      const memoryDelta = (afterStats.usedJSHeapSize - beforeStats.usedJSHeapSize) / (1024 * 1024)
      
      console.log(`📊 ${operationName} completed: ${duration}ms, memory delta: ${memoryDelta.toFixed(2)}MB`)
      
      // Trigger cleanup if memory pressure increased
      if (afterStats.memoryPressure !== beforeStats.memoryPressure && 
          (afterStats.memoryPressure === 'high' || afterStats.memoryPressure === 'critical')) {
        setTimeout(() => this.performCleanup(), 0)
      }
      
      return result
    } catch (error) {
      console.error(`❌ ${operationName} failed:`, error)
      // Cleanup on error to free any allocated memory
      setTimeout(() => this.performCleanup(), 0)
      throw error
    }
  }

  /**
   * Get buffer pool statistics
   */
  getBufferPoolStats() {
    return this.bufferPool.getStats()
  }

  /**
   * Setup periodic memory cleanup
   */
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      if (this.shouldCleanup()) {
        this.performCleanup().catch(console.error)
      }
    }, this.memoryCheckInterval)
  }

  /**
   * Destroy the memory manager
   */
  destroy(): void {
    this.bufferPool.clear()
    this.cleanupCallbacks.length = 0
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance() 