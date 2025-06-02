/**
 * React Hook for Chunk Progress Tracking
 * 
 * Provides real-time progress updates, performance monitoring, and event handling
 * for chunk-based file upload operations with comprehensive UI integration.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ChunkProgress, 
  FileProgress, 
  ProgressEvent, 
  ProgressReporter 
} from '@/lib/chunking/types'
import { chunkProgressTracker } from '@/lib/chunking/ProgressTracker'

export interface UseChunkProgressOptions {
  fileId?: string
  autoCleanup?: boolean
  enableDetailedLogging?: boolean
  updateInterval?: number
  enablePerformanceMonitoring?: boolean
}

export interface ChunkProgressState {
  fileProgress: FileProgress | null
  chunkProgresses: Map<string, ChunkProgress>
  isTracking: boolean
  summary: {
    totalFiles: number
    completedFiles: number
    failedFiles: number
    totalChunks: number
    completedChunks: number
    failedChunks: number
    totalBytes: number
    uploadedBytes: number
    overallProgress: number
    averageUploadSpeed: number
  }
  events: ProgressEvent[]
  warnings: {
    memoryWarnings: ProgressEvent[]
    performanceWarnings: ProgressEvent[]
  }
}

export const useChunkProgress = (options: UseChunkProgressOptions = {}) => {
  const {
    fileId,
    autoCleanup = true,
    enableDetailedLogging = true,
    updateInterval = 1000,
    enablePerformanceMonitoring = true
  } = options

  const [progressState, setProgressState] = useState<ChunkProgressState>({
    fileProgress: null,
    chunkProgresses: new Map(),
    isTracking: false,
    summary: {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      totalChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      totalBytes: 0,
      uploadedBytes: 0,
      overallProgress: 0,
      averageUploadSpeed: 0
    },
    events: [],
    warnings: {
      memoryWarnings: [],
      performanceWarnings: []
    }
  })

  const reporterRef = useRef<ProgressReporter | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Update progress state from tracker
   */
  const updateProgressState = useCallback(() => {
    const summary = chunkProgressTracker.getProgressSummary()
    const fileProgress = fileId ? chunkProgressTracker.getFileProgress(fileId) : null
    const events = chunkProgressTracker.getEventHistory(50) // Last 50 events
    
    // Extract warnings from events
    const memoryWarnings = events.filter(e => e.type === 'memory_warning')
    const performanceWarnings = events.filter(e => e.type === 'performance_warning')

    // Get chunk progresses for the specific file
    const chunkProgresses = new Map<string, ChunkProgress>()
    if (fileProgress) {
      for (const [chunkId, progress] of fileProgress.chunkProgresses.entries()) {
        chunkProgresses.set(chunkId, progress)
      }
    }

    setProgressState({
      fileProgress,
      chunkProgresses,
      isTracking: true, // Always true when hook is active
      summary,
      events,
      warnings: {
        memoryWarnings,
        performanceWarnings
      }
    })
  }, [fileId])

  /**
   * Setup progress reporter and periodic updates
   */
  useEffect(() => {
    // Create progress reporter
    const reporter: ProgressReporter = {
      onEvent: (event: ProgressEvent) => {
        if (enableDetailedLogging) {
          console.log('Progress event:', event)
        }
        
        // Trigger state update on relevant events
        if (fileId) {
          if (event.type.includes('file') && event.data.fileProgress?.fileId === fileId) {
            updateProgressState()
          }
          if (event.type.includes('chunk') && event.data.chunkProgress?.chunkId.includes(fileId)) {
            updateProgressState()
          }
        } else {
          // Update for all events if no specific file
          updateProgressState()
        }
      },
      onChunkProgress: (progress: ChunkProgress) => {
        if (enableDetailedLogging) {
          console.log('Chunk progress:', progress)
        }
        // Real-time chunk progress updates will trigger through events
      },
      onFileProgress: (progress: FileProgress) => {
        if (enableDetailedLogging) {
          console.log('File progress:', progress)
        }
        // Real-time file progress updates will trigger through events
      }
    }

    reporterRef.current = reporter
    chunkProgressTracker.addReporter(reporter)

    // Setup periodic updates
    if (updateInterval > 0) {
      updateIntervalRef.current = setInterval(updateProgressState, updateInterval)
    }

    // Initial state load
    updateProgressState()

    return () => {
      // Cleanup reporter
      if (reporterRef.current) {
        chunkProgressTracker.removeReporter(reporterRef.current)
        reporterRef.current = null
      }
      
      // Clear update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [fileId, enableDetailedLogging, updateInterval, updateProgressState])

  /**
   * Cleanup progress data for a specific file
   */
  const cleanupFile = useCallback((targetFileId?: string) => {
    const cleanupFileId = targetFileId || fileId
    if (cleanupFileId) {
      chunkProgressTracker.cleanupFileProgress(cleanupFileId)
      updateProgressState()
    }
  }, [fileId, updateProgressState])

  /**
   * Get specific chunk progress
   */
  const getChunkProgress = useCallback((chunkId: string): ChunkProgress | undefined => {
    return chunkProgressTracker.getChunkProgress(chunkId)
  }, [])

  /**
   * Export progress data
   */
  const exportProgressData = useCallback((): string => {
    return chunkProgressTracker.exportProgressData()
  }, [])

  /**
   * Clear all progress data
   */
  const clearAllProgress = useCallback(() => {
    chunkProgressTracker.clearAll()
    updateProgressState()
  }, [updateProgressState])

  /**
   * Get performance insights
   */
  const getPerformanceInsights = useCallback(() => {
    if (!progressState.fileProgress?.performanceStats) {
      return null
    }

    const stats = progressState.fileProgress.performanceStats
    const memoryStats = progressState.fileProgress.memoryStats

    return {
      uploadEfficiency: {
        successRate: stats.successRate,
        averageChunkTime: stats.averageChunkUploadTime,
        networkUtilization: stats.networkUtilization,
        totalRetries: stats.totalRetries
      },
      memoryUsage: {
        currentUsageMB: memoryStats?.currentUsageMB || 0,
        peakUsageMB: memoryStats?.peakUsageMB || 0,
        memoryPressure: memoryStats?.memoryPressure || 'low'
      },
      recommendations: getPerformanceRecommendations(stats, memoryStats)
    }
  }, [progressState.fileProgress])

  /**
   * Get formatted progress information for UI display
   */
  const getFormattedProgress = useCallback(() => {
    const { fileProgress, summary } = progressState

    return {
      file: fileProgress ? {
        fileName: fileProgress.fileName,
        status: fileProgress.status,
        progress: Math.round(fileProgress.overallProgress * 10) / 10,
        speed: formatUploadSpeed(fileProgress.uploadSpeed),
        eta: formatTimeRemaining(fileProgress.estimatedTimeRemaining),
        chunks: {
          completed: fileProgress.completedChunks,
          failed: fileProgress.failedChunks,
          retrying: fileProgress.retryingChunks,
          pending: fileProgress.pendingChunks,
          total: fileProgress.totalChunks
        },
        bytes: {
          uploaded: formatFileSize(fileProgress.bytesUploaded),
          total: formatFileSize(fileProgress.totalBytes)
        }
      } : null,
      overall: {
        progress: Math.round(summary.overallProgress * 10) / 10,
        speed: formatUploadSpeed(summary.averageUploadSpeed),
        files: {
          completed: summary.completedFiles,
          failed: summary.failedFiles,
          total: summary.totalFiles
        },
        chunks: {
          completed: summary.completedChunks,
          failed: summary.failedChunks,
          total: summary.totalChunks
        },
        bytes: {
          uploaded: formatFileSize(summary.uploadedBytes),
          total: formatFileSize(summary.totalBytes)
        }
      }
    }
  }, [progressState])

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCleanup && fileId) {
        chunkProgressTracker.cleanupFileProgress(fileId)
      }
    }
  }, [autoCleanup, fileId])

  return {
    // Core progress state
    ...progressState,
    
    // Formatted data for UI
    formatted: getFormattedProgress(),
    
    // Performance insights
    performanceInsights: enablePerformanceMonitoring ? getPerformanceInsights() : null,
    
    // Actions
    cleanupFile,
    getChunkProgress,
    exportProgressData,
    clearAllProgress,
    
    // Computed values
    isActive: progressState.isTracking && (fileId ? progressState.fileProgress !== null : true),
    hasWarnings: progressState.warnings.memoryWarnings.length > 0 || 
                 progressState.warnings.performanceWarnings.length > 0,
    lastEvent: progressState.events[progressState.events.length - 1] || null
  }
}

/**
 * Helper function to get performance recommendations
 */
function getPerformanceRecommendations(
  stats: any, 
  memoryStats: any
): string[] {
  const recommendations: string[] = []

  if (stats.successRate < 90) {
    recommendations.push('Consider reducing chunk size or concurrency due to high failure rate')
  }

  if (stats.networkUtilization < 50) {
    recommendations.push('Network utilization is low - consider increasing concurrency')
  }

  if (stats.totalRetries > stats.successRate * 0.1) {
    recommendations.push('High retry rate detected - check network stability')
  }

  if (memoryStats?.memoryPressure === 'high' || memoryStats?.memoryPressure === 'critical') {
    recommendations.push('High memory pressure - reduce chunk size or concurrency')
  }

  if (stats.averageChunkUploadTime > 10000) { // 10 seconds
    recommendations.push('Slow chunk uploads - consider reducing chunk size')
  }

  return recommendations
}

/**
 * Format upload speed for display
 */
function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let size = bytesPerSecond
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format time remaining for display
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '—'
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${minutes}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
} 