/**
 * Progress Tracker for Chunk Processing
 * 
 * Provides comprehensive progress tracking, reporting, and performance monitoring
 * for file chunking operations with real-time updates and memory optimization.
 */

import { 
  ChunkProgress, 
  FileProgress, 
  ProgressEvent, 
  ProgressReporter,
  ChunkMetadata,
  ChunkStatus
} from './types'
import { memoryManager } from './MemoryManager'

export class ChunkProgressTracker {
  private fileProgresses: Map<string, FileProgress> = new Map()
  private chunkProgresses: Map<string, ChunkProgress> = new Map()
  private reporters: ProgressReporter[] = []
  private eventHistory: ProgressEvent[] = []
  private isActive: boolean = false
  private updateInterval?: NodeJS.Timeout
  private maxEventHistory: number = 1000

  constructor() {
    this.startTracking()
  }

  /**
   * Start progress tracking
   */
  startTracking(): void {
    if (this.isActive) return
    
    this.isActive = true
    this.setupPeriodicUpdates()
    console.log('📊 Progress tracking started')
  }

  /**
   * Stop progress tracking
   */
  stopTracking(): void {
    if (!this.isActive) return
    
    this.isActive = false
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = undefined
    }
    console.log('⏹️ Progress tracking stopped')
  }

  /**
   * Register a progress reporter
   */
  addReporter(reporter: ProgressReporter): void {
    this.reporters.push(reporter)
    console.log(`📡 Progress reporter added (total: ${this.reporters.length})`)
  }

  /**
   * Remove a progress reporter
   */
  removeReporter(reporter: ProgressReporter): void {
    const index = this.reporters.indexOf(reporter)
    if (index !== -1) {
      this.reporters.splice(index, 1)
      console.log(`📡 Progress reporter removed (remaining: ${this.reporters.length})`)
    }
  }

  /**
   * Initialize file progress tracking
   */
  initializeFileProgress(
    fileId: string, 
    fileName: string, 
    totalBytes: number, 
    totalChunks: number
  ): void {
    const fileProgress: FileProgress = {
      fileId,
      fileName,
      status: 'analyzing',
      overallProgress: 0,
      totalChunks,
      completedChunks: 0,
      failedChunks: 0,
      retryingChunks: 0,
      pendingChunks: totalChunks,
      bytesUploaded: 0,
      totalBytes,
      uploadSpeed: 0,
      estimatedTimeRemaining: 0,
      startTime: Date.now(),
      chunkProgresses: new Map(),
      memoryStats: {
        currentUsageMB: 0,
        peakUsageMB: 0,
        memoryPressure: 'low'
      },
      performanceStats: {
        averageChunkUploadTime: 0,
        successRate: 0,
        totalRetries: 0,
        networkUtilization: 0
      }
    }

    this.fileProgresses.set(fileId, fileProgress)
    this.emitEvent('file_started', { fileProgress })
    console.log(`📋 File progress initialized: ${fileName} (${totalChunks} chunks)`)
  }

  /**
   * Initialize chunk progress tracking
   */
  initializeChunkProgress(chunk: ChunkMetadata): void {
    const chunkProgress: ChunkProgress = {
      chunkId: chunk.chunkId,
      status: 'pending',
      progress: 0,
      bytesUploaded: 0,
      totalBytes: chunk.actualSize,
      uploadSpeed: 0,
      startTime: Date.now(),
      retryCount: 0
    }

    this.chunkProgresses.set(chunk.chunkId, chunkProgress)
    
    // Add to file progress
    const fileProgress = this.fileProgresses.get(chunk.fileId)
    if (fileProgress) {
      fileProgress.chunkProgresses.set(chunk.chunkId, chunkProgress)
    }

    console.log(`🧩 Chunk progress initialized: ${chunk.chunkId}`)
  }

  /**
   * Update chunk progress
   */
  updateChunkProgress(
    chunkId: string, 
    updates: Partial<Omit<ChunkProgress, 'chunkId'>>
  ): void {
    const chunkProgress = this.chunkProgresses.get(chunkId)
    if (!chunkProgress) {
      console.warn(`⚠️ Chunk progress not found: ${chunkId}`)
      return
    }

    // Update chunk progress
    Object.assign(chunkProgress, updates)
    chunkProgress.progress = Math.min(100, Math.max(0, chunkProgress.progress))

    // Update memory usage if available
    if (updates.status === 'uploading') {
      const memoryStats = memoryManager.getMemoryStats()
      chunkProgress.memoryUsageMB = memoryStats.usedJSHeapSize / (1024 * 1024)
    }

    // Set end time if completed or failed
    if (updates.status === 'completed' || updates.status === 'failed') {
      chunkProgress.endTime = Date.now()
    }

    // Emit chunk progress event
    this.emitEvent('chunk_progress', { chunkProgress })
    this.notifyReporters('chunk', chunkProgress)

    // Update file progress
    this.updateFileProgressFromChunks(this.getFileIdFromChunkId(chunkId))
  }

  /**
   * Update chunk status
   */
  updateChunkStatus(chunkId: string, status: ChunkStatus, error?: string): void {
    const updates: Partial<ChunkProgress> = { status }
    
    if (error) {
      updates.error = error
    }

    if (status === 'uploading') {
      updates.startTime = Date.now()
    } else if (status === 'retrying') {
      const current = this.chunkProgresses.get(chunkId)
      if (current) {
        updates.retryCount = current.retryCount + 1
      }
    }

    this.updateChunkProgress(chunkId, updates)
    
    const eventType = status === 'completed' ? 'chunk_completed' : 
                     status === 'failed' ? 'chunk_failed' : 'chunk_progress'
    this.emitEvent(eventType, { chunkId, status, error })
  }

  /**
   * Update bytes uploaded for a chunk
   */
  updateChunkBytes(chunkId: string, bytesUploaded: number): void {
    const chunkProgress = this.chunkProgresses.get(chunkId)
    if (!chunkProgress) return

    chunkProgress.bytesUploaded = bytesUploaded
    chunkProgress.progress = (bytesUploaded / chunkProgress.totalBytes) * 100

    // Calculate upload speed
    const timeElapsed = Date.now() - chunkProgress.startTime
    if (timeElapsed > 0) {
      chunkProgress.uploadSpeed = (bytesUploaded / timeElapsed) * 1000 // bytes per second
    }

    this.updateChunkProgress(chunkId, chunkProgress)
  }

  /**
   * Update file progress based on chunk progresses
   */
  private updateFileProgressFromChunks(fileId: string): void {
    const fileProgress = this.fileProgresses.get(fileId)
    if (!fileProgress) return

    const chunks = Array.from(fileProgress.chunkProgresses.values())
    
    // Count chunks by status
    fileProgress.completedChunks = chunks.filter(c => c.status === 'completed').length
    fileProgress.failedChunks = chunks.filter(c => c.status === 'failed').length
    fileProgress.retryingChunks = chunks.filter(c => c.status === 'retrying').length
    fileProgress.pendingChunks = chunks.filter(c => c.status === 'pending').length

    // Calculate bytes uploaded
    fileProgress.bytesUploaded = chunks.reduce((total, chunk) => total + chunk.bytesUploaded, 0)
    fileProgress.overallProgress = (fileProgress.bytesUploaded / fileProgress.totalBytes) * 100

    // Calculate overall upload speed (weighted average)
    const activeChunks = chunks.filter(c => c.status === 'uploading' && c.uploadSpeed > 0)
    if (activeChunks.length > 0) {
      fileProgress.uploadSpeed = activeChunks.reduce((total, chunk) => total + chunk.uploadSpeed, 0)
    }

    // Calculate estimated time remaining
    if (fileProgress.uploadSpeed > 0) {
      const remainingBytes = fileProgress.totalBytes - fileProgress.bytesUploaded
      fileProgress.estimatedTimeRemaining = remainingBytes / fileProgress.uploadSpeed
    }

    // Update status
    if (fileProgress.completedChunks === fileProgress.totalChunks) {
      fileProgress.status = 'completed'
      fileProgress.endTime = Date.now()
      this.emitEvent('file_completed', { fileProgress })
    } else if (fileProgress.failedChunks > 0 && 
               fileProgress.completedChunks + fileProgress.failedChunks === fileProgress.totalChunks) {
      fileProgress.status = 'failed'
      fileProgress.endTime = Date.now()
      this.emitEvent('file_failed', { fileProgress })
    } else if (fileProgress.completedChunks > 0 || fileProgress.retryingChunks > 0) {
      fileProgress.status = 'uploading'
    }

    // Update memory and performance stats
    this.updateFileStats(fileProgress)

    // Emit file progress event
    this.emitEvent('file_progress', { fileProgress })
    this.notifyReporters('file', fileProgress)
  }

  /**
   * Update file memory and performance statistics
   */
  private updateFileStats(fileProgress: FileProgress): void {
    // Update memory stats
    const memoryStats = memoryManager.getMemoryStats()
    const currentMemoryMB = memoryStats.usedJSHeapSize / (1024 * 1024)
    
    if (fileProgress.memoryStats) {
      fileProgress.memoryStats.currentUsageMB = currentMemoryMB
      fileProgress.memoryStats.peakUsageMB = Math.max(
        fileProgress.memoryStats.peakUsageMB, 
        currentMemoryMB
      )
      fileProgress.memoryStats.memoryPressure = memoryStats.memoryPressure
    }

    // Update performance stats
    const chunks = Array.from(fileProgress.chunkProgresses.values())
    const completedChunks = chunks.filter(c => c.status === 'completed' && c.endTime)
    
    if (completedChunks.length > 0 && fileProgress.performanceStats) {
      const avgUploadTime = completedChunks.reduce((total, chunk) => {
        return total + (chunk.endTime! - chunk.startTime)
      }, 0) / completedChunks.length

      fileProgress.performanceStats.averageChunkUploadTime = avgUploadTime
      fileProgress.performanceStats.successRate = 
        (fileProgress.completedChunks / (fileProgress.completedChunks + fileProgress.failedChunks)) * 100
      fileProgress.performanceStats.totalRetries = chunks.reduce((total, chunk) => total + chunk.retryCount, 0)
      
      // Network utilization estimate (simplified)
      const totalPossibleSpeed = fileProgress.uploadSpeed * fileProgress.totalChunks
      fileProgress.performanceStats.networkUtilization = 
        totalPossibleSpeed > 0 ? (fileProgress.uploadSpeed / totalPossibleSpeed) * 100 : 0
    }

    // Emit warnings if needed
    if (memoryStats.memoryPressure === 'high' || memoryStats.memoryPressure === 'critical') {
      this.emitEvent('memory_warning', { 
        fileId: fileProgress.fileId, 
        memoryPressure: memoryStats.memoryPressure,
        currentUsageMB: currentMemoryMB
      })
    }

    if (fileProgress.performanceStats && fileProgress.performanceStats.successRate < 90) {
      this.emitEvent('performance_warning', {
        fileId: fileProgress.fileId,
        successRate: fileProgress.performanceStats.successRate,
        totalRetries: fileProgress.performanceStats.totalRetries
      })
    }
  }

  /**
   * Get file progress
   */
  getFileProgress(fileId: string): FileProgress | undefined {
    return this.fileProgresses.get(fileId)
  }

  /**
   * Get chunk progress
   */
  getChunkProgress(chunkId: string): ChunkProgress | undefined {
    return this.chunkProgresses.get(chunkId)
  }

  /**
   * Get all file progresses
   */
  getAllFileProgresses(): FileProgress[] {
    return Array.from(this.fileProgresses.values())
  }

  /**
   * Get progress summary
   */
  getProgressSummary() {
    const files = Array.from(this.fileProgresses.values())
    const chunks = Array.from(this.chunkProgresses.values())

    return {
      totalFiles: files.length,
      completedFiles: files.filter(f => f.status === 'completed').length,
      failedFiles: files.filter(f => f.status === 'failed').length,
      totalChunks: chunks.length,
      completedChunks: chunks.filter(c => c.status === 'completed').length,
      failedChunks: chunks.filter(c => c.status === 'failed').length,
      totalBytes: files.reduce((total, f) => total + f.totalBytes, 0),
      uploadedBytes: files.reduce((total, f) => total + f.bytesUploaded, 0),
      overallProgress: files.length > 0 ? 
        files.reduce((total, f) => total + f.overallProgress, 0) / files.length : 0,
      averageUploadSpeed: files.reduce((total, f) => total + f.uploadSpeed, 0) / Math.max(files.length, 1)
    }
  }

  /**
   * Clean up completed file progress
   */
  cleanupFileProgress(fileId: string): void {
    const fileProgress = this.fileProgresses.get(fileId)
    if (!fileProgress) return

    // Remove chunk progresses
    for (const chunkId of fileProgress.chunkProgresses.keys()) {
      this.chunkProgresses.delete(chunkId)
    }

    // Remove file progress
    this.fileProgresses.delete(fileId)
    
    console.log(`🧹 Progress tracking cleaned up for file: ${fileId}`)
  }

  /**
   * Export progress data
   */
  exportProgressData(): string {
    const data = {
      fileProgresses: Array.from(this.fileProgresses.entries()).map(([id, progress]) => ({
        id,
        progress: {
          ...progress,
          chunkProgresses: Array.from(progress.chunkProgresses.entries())
        }
      })),
      eventHistory: this.eventHistory.slice(-100) // Last 100 events
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): ProgressEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory]
  }

  /**
   * Clear all progress data
   */
  clearAll(): void {
    this.fileProgresses.clear()
    this.chunkProgresses.clear()
    this.eventHistory.length = 0
    console.log('🗑️ All progress data cleared')
  }

  /**
   * Setup periodic updates for live reporting
   */
  private setupPeriodicUpdates(): void {
    this.updateInterval = setInterval(() => {
      if (!this.isActive) return

      // Update file progresses that are still active
      for (const fileProgress of this.fileProgresses.values()) {
        if (fileProgress.status === 'uploading') {
          this.updateFileProgressFromChunks(fileProgress.fileId)
        }
      }
    }, 1000) // Update every second
  }

  /**
   * Emit progress event
   */
  private emitEvent(type: ProgressEvent['type'], data: any): void {
    const event: ProgressEvent = {
      type,
      timestamp: Date.now(),
      data
    }

    this.eventHistory.push(event)
    
    // Limit event history size
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.splice(0, this.eventHistory.length - this.maxEventHistory)
    }

    // Notify reporters
    this.reporters.forEach(reporter => {
      try {
        reporter.onEvent(event)
      } catch (error) {
        console.warn('Progress reporter error:', error)
      }
    })
  }

  /**
   * Notify progress reporters
   */
  private notifyReporters(type: 'chunk' | 'file', progress: ChunkProgress | FileProgress): void {
    this.reporters.forEach(reporter => {
      try {
        if (type === 'chunk') {
          reporter.onChunkProgress(progress as ChunkProgress)
        } else {
          reporter.onFileProgress(progress as FileProgress)
        }
      } catch (error) {
        console.warn('Progress reporter notification error:', error)
      }
    })
  }

  /**
   * Extract file ID from chunk ID
   */
  private getFileIdFromChunkId(chunkId: string): string {
    // Assuming chunk ID format is fileId_chunkIndex
    return chunkId.split('_')[0] || chunkId
  }

  /**
   * Destroy the progress tracker
   */
  destroy(): void {
    this.stopTracking()
    this.clearAll()
    this.reporters.length = 0
  }
}

// Export singleton instance
export const chunkProgressTracker = new ChunkProgressTracker() 