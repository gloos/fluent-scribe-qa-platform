/**
 * React Hooks for Progress Tracking
 * 
 * Provides React hooks for easy integration of progress tracking
 * functionality into UI components with real-time updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  progressTracker, 
  ProgressSnapshot, 
  ProgressTimeline, 
  ProgressInsights,
  ProgressListener 
} from './progress-tracker'
import { progressAnalytics, AnalyticsReport } from './progress-analytics'
import { ProcessingJob, BatchOperation } from './types'

// Hook Types
export interface UseProgressOptions {
  refreshInterval?: number
  enableAnalytics?: boolean
  enableStorage?: boolean
}

export interface ProgressState {
  jobs: ProgressSnapshot[]
  batches: ProgressSnapshot[]
  insights: ProgressInsights | null
  isLoading: boolean
  error: string | null
}

export interface JobProgressState {
  progress: ProgressSnapshot | null
  timeline: ProgressTimeline | null
  predictions: {
    estimatedCompletionTime?: number
    confidence?: number
  }
  isLoading: boolean
  error: string | null
}

/**
 * Hook for monitoring overall progress across all jobs and batches
 */
export function useProgress(options: UseProgressOptions = {}): ProgressState & {
  refresh: () => void
  generateReport: () => Promise<AnalyticsReport | null>
} {
  const {
    refreshInterval = 5000,
    enableAnalytics = true,
    enableStorage = true
  } = options

  const [state, setState] = useState<ProgressState>({
    jobs: [],
    batches: [],
    insights: null,
    isLoading: true,
    error: null
  })

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // Get current progress
      const { jobs, batches } = progressTracker.getActiveProgress()
      
      // Get insights if analytics enabled
      let insights: ProgressInsights | null = null
      if (enableAnalytics) {
        insights = progressTracker.getInsights()
      }

      setState({
        jobs,
        batches,
        insights,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [enableAnalytics])

  const generateReport = useCallback(async (): Promise<AnalyticsReport | null> => {
    try {
      const now = Date.now()
      const timeRange = {
        start: now - (24 * 60 * 60 * 1000), // Last 24 hours
        end: now
      }

      // This would need access to timeline data from progressTracker
      // For now, return a placeholder - would need to extend progressTracker API
      return null
    } catch (error) {
      console.error('Failed to generate analytics report:', error)
      return null
    }
  }, [])

  useEffect(() => {
    // Initial load
    refresh()

    // Set up periodic refresh
    if (refreshInterval > 0) {
      refreshTimeoutRef.current = setInterval(refresh, refreshInterval)
    }

    // Set up progress tracker listener
    const listener: ProgressListener = {
      onJobProgressUpdated: () => refresh(),
      onBatchProgressUpdated: () => refresh(),
      onJobCompleted: () => refresh(),
      onBatchCompleted: () => refresh()
    }

    progressTracker.addListener(listener)

    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current)
      }
      progressTracker.removeListener(listener)
    }
  }, [refresh, refreshInterval])

  return {
    ...state,
    refresh,
    generateReport
  }
}

/**
 * Hook for monitoring a specific job's progress
 */
export function useJobProgress(jobId: string): JobProgressState & {
  refresh: () => void
} {
  const [state, setState] = useState<JobProgressState>({
    progress: null,
    timeline: null,
    predictions: {},
    isLoading: true,
    error: null
  })

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const progress = progressTracker.getJobProgress(jobId)
      const timeline = progressTracker.getTimeline(jobId)
      
      let predictions = {}
      if (progress && timeline) {
        const historicalData = progressTracker.getHistoricalData(jobId)
        if (historicalData.length > 0) {
          predictions = progressAnalytics.predictCompletionTime(progress, historicalData)
        }
      }

      setState({
        progress,
        timeline,
        predictions,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [jobId])

  useEffect(() => {
    refresh()

    const listener: ProgressListener = {
      onJobProgressUpdated: (job) => {
        if (job.id === jobId) {
          refresh()
        }
      },
      onJobCompleted: (job) => {
        if (job.id === jobId) {
          refresh()
        }
      }
    }

    progressTracker.addListener(listener)

    return () => {
      progressTracker.removeListener(listener)
    }
  }, [refresh, jobId])

  return {
    ...state,
    refresh
  }
}

/**
 * Hook for monitoring a specific batch's progress
 */
export function useBatchProgress(batchId: string): {
  progress: ProgressSnapshot | null
  timeline: ProgressTimeline | null
  isLoading: boolean
  error: string | null
  refresh: () => void
} {
  const [state, setState] = useState({
    progress: null as ProgressSnapshot | null,
    timeline: null as ProgressTimeline | null,
    isLoading: true,
    error: null as string | null
  })

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const progress = progressTracker.getBatchProgress(batchId)
      const timeline = progressTracker.getTimeline(batchId)

      setState({
        progress,
        timeline,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [batchId])

  useEffect(() => {
    refresh()

    const listener: ProgressListener = {
      onBatchProgressUpdated: (batch) => {
        if (batch.id === batchId) {
          refresh()
        }
      },
      onBatchCompleted: (batch) => {
        if (batch.id === batchId) {
          refresh()
        }
      }
    }

    progressTracker.addListener(listener)

    return () => {
      progressTracker.removeListener(listener)
    }
  }, [refresh, batchId])

  return {
    ...state,
    refresh
  }
}

/**
 * Hook for analytics and performance insights
 */
export function useProgressAnalytics(timeRange?: { start: number; end: number }): {
  report: AnalyticsReport | null
  isLoading: boolean
  error: string | null
  generateReport: () => Promise<void>
  refresh: () => void
} {
  const [state, setState] = useState({
    report: null as AnalyticsReport | null,
    isLoading: true,
    error: null as string | null
  })

  const generateReport = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // This would need access to timeline and snapshot data
      // For now, return basic insights from progressTracker
      const insights = progressTracker.getInsights(timeRange)
      
      // Create a basic report structure
      const now = Date.now()
      const range = timeRange || {
        start: now - (24 * 60 * 60 * 1000),
        end: now
      }

      const report: AnalyticsReport = {
        generatedAt: now,
        timeRange: range,
        summary: {
          totalJobs: 0,
          totalBatches: 0,
          averageProcessingTime: insights.performance.averageProcessingTime,
          overallThroughput: insights.predictions.expectedThroughput,
          errorRate: 0,
          efficiencyScore: insights.performance.efficiencyScore
        },
        trends: [],
        bottlenecks: [],
        profiles: [],
        predictions: [],
        recommendations: insights.recommendations.map(rec => ({
          category: rec.type as 'performance' | 'resource' | 'strategy' | 'infrastructure',
          priority: rec.priority as 'low' | 'medium' | 'high' | 'critical',
          title: rec.message,
          description: rec.action || 'No specific action provided',
          expectedImpact: 'Improvement expected',
          implementation: rec.action ? [rec.action] : []
        }))
      }

      setState({
        report,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [timeRange])

  const refresh = useCallback(() => {
    generateReport()
  }, [generateReport])

  useEffect(() => {
    generateReport()
  }, [generateReport])

  return {
    ...state,
    generateReport,
    refresh
  }
}

/**
 * Hook for real-time progress monitoring with WebSocket-like behavior
 */
export function useRealTimeProgress(options: {
  updateInterval?: number
  maxUpdatesPerSecond?: number
} = {}): {
  activeJobs: ProcessingJob[]
  activeBatches: BatchOperation[]
  queueMetrics: any
  lastUpdate: number
  isConnected: boolean
} {
  const {
    updateInterval = 1000,
    maxUpdatesPerSecond = 10
  } = options

  const [state, setState] = useState({
    activeJobs: [] as ProcessingJob[],
    activeBatches: [] as BatchOperation[],
    queueMetrics: null,
    lastUpdate: 0,
    isConnected: false
  })

  const lastUpdateRef = useRef(0)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateProgress = useCallback(() => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    const minInterval = 1000 / maxUpdatesPerSecond

    if (timeSinceLastUpdate < minInterval) {
      return // Rate limiting
    }

    try {
      // This would integrate with the actual queue system
      // For now, simulate real-time updates
      setState(prev => ({
        ...prev,
        lastUpdate: now,
        isConnected: true
      }))

      lastUpdateRef.current = now
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnected: false
      }))
    }
  }, [maxUpdatesPerSecond])

  useEffect(() => {
    updateProgress()
    
    updateIntervalRef.current = setInterval(updateProgress, updateInterval)

    const listener: ProgressListener = {
      onJobProgressUpdated: updateProgress,
      onBatchProgressUpdated: updateProgress,
      onJobTracked: updateProgress,
      onBatchTracked: updateProgress
    }

    progressTracker.addListener(listener)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      progressTracker.removeListener(listener)
    }
  }, [updateProgress, updateInterval])

  return state
}

/**
 * Hook for progress tracking configuration and control
 */
export function useProgressTracker(): {
  isTracking: boolean
  start: () => void
  stop: () => void
  clear: () => void
  exportData: () => string
  importData: (data: string) => void
} {
  const [isTracking, setIsTracking] = useState(false)

  const start = useCallback(() => {
    progressTracker.start()
    setIsTracking(true)
  }, [])

  const stop = useCallback(() => {
    progressTracker.stop()
    setIsTracking(false)
  }, [])

  const clear = useCallback(() => {
    // This would need to be implemented in progressTracker
    console.log('Clear progress data')
  }, [])

  const exportData = useCallback(() => {
    return progressTracker.exportData()
  }, [])

  const importData = useCallback((data: string) => {
    progressTracker.importData(data)
  }, [])

  return {
    isTracking,
    start,
    stop,
    clear,
    exportData,
    importData
  }
} 