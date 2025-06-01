import { ProcessingJob, ProcessingError, BatchOperation } from './types'

// Enhanced Error Types
export interface ErrorContext {
  jobId: string
  fileName: string
  fileSize: number
  fileType: string
  stage: string
  timestamp: number
  systemState: {
    memoryUsage: number
    cpuUsage: number
    queueSize: number
    concurrentJobs: number
  }
  additionalContext?: Record<string, any>
}

export interface ErrorPattern {
  id: string
  type: string
  frequency: number
  lastOccurrence: number
  affectedJobs: string[]
  commonContext: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  isRecurring: boolean
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'pause' | 'escalate'
  description: string
  parameters?: Record<string, any>
  estimatedRecoveryTime?: number
  successProbability?: number
}

export interface ErrorAlert {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  errorCode: string
  affectedJobs: string[]
  timestamp: number
  requiresAttention: boolean
  suggestedActions: RecoveryAction[]
}

export interface CircuitBreakerState {
  isOpen: boolean
  lastFailureTime: number
  failureCount: number
  successCount: number
  halfOpenAttempts: number
  thresholds: {
    failureRate: number
    failureCount: number
    timeout: number
  }
}

// Error Classification System
export class ErrorClassifier {
  private static readonly ERROR_PATTERNS = {
    MEMORY_EXHAUSTION: {
      patterns: ['out of memory', 'memory allocation', 'heap overflow'],
      type: 'system' as const,
      severity: 'critical' as const,
      isRetriable: false,
      recoveryActions: ['pause', 'reduce_concurrency', 'escalate']
    },
    FILE_CORRUPTION: {
      patterns: ['invalid xml', 'malformed', 'unexpected end', 'encoding error'],
      type: 'validation' as const,
      severity: 'high' as const,
      isRetriable: false,
      recoveryActions: ['skip', 'fallback']
    },
    NETWORK_TIMEOUT: {
      patterns: ['timeout', 'connection refused', 'network error'],
      type: 'system' as const,
      severity: 'medium' as const,
      isRetriable: true,
      recoveryActions: ['retry', 'backoff']
    },
    PARSER_ERROR: {
      patterns: ['parse error', 'invalid format', 'schema validation'],
      type: 'parsing' as const,
      severity: 'medium' as const,
      isRetriable: false,
      recoveryActions: ['fallback', 'skip']
    },
    QUOTA_EXCEEDED: {
      patterns: ['quota exceeded', 'rate limit', 'too many requests'],
      type: 'system' as const,
      severity: 'medium' as const,
      isRetriable: true,
      recoveryActions: ['backoff', 'retry']
    },
    PERMISSION_DENIED: {
      patterns: ['permission denied', 'access denied', 'unauthorized'],
      type: 'system' as const,
      severity: 'high' as const,
      isRetriable: false,
      recoveryActions: ['escalate', 'skip']
    }
  }

  static classifyError(error: Error | ProcessingError, context: ErrorContext): ProcessingError {
    const errorMessage = error.message?.toLowerCase() || ''
    const errorStack = 'stack' in error ? error.stack : undefined

    // Find matching pattern
    for (const [patternName, pattern] of Object.entries(this.ERROR_PATTERNS)) {
      if (pattern.patterns.some(p => errorMessage.includes(p))) {
        return {
          code: patternName,
          message: error.message,
          type: pattern.type,
          severity: pattern.severity,
          isRetriable: pattern.isRetriable,
          details: {
            ...context,
            originalError: error,
            classificationPattern: patternName,
            suggestedActions: pattern.recoveryActions,
            stack: errorStack
          },
          stack: errorStack,
          timestamp: Date.now()
        }
      }
    }

    // Default classification for unrecognized errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      type: 'system',
      severity: 'medium',
      isRetriable: true,
      details: {
        ...context,
        originalError: error,
        stack: errorStack
      },
      stack: errorStack,
      timestamp: Date.now()
    }
  }

  static getSuggestedRecoveryActions(error: ProcessingError): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    switch (error.code) {
      case 'MEMORY_EXHAUSTION':
        actions.push(
          {
            type: 'pause',
            description: 'Pause processing to allow memory recovery',
            estimatedRecoveryTime: 30000,
            successProbability: 0.8
          },
          {
            type: 'escalate',
            description: 'Escalate to system administrator'
          }
        )
        break

      case 'FILE_CORRUPTION':
        actions.push(
          {
            type: 'skip',
            description: 'Skip corrupted file and continue with others',
            successProbability: 1.0
          },
          {
            type: 'fallback',
            description: 'Try alternative parser or processing method',
            successProbability: 0.6
          }
        )
        break

      case 'NETWORK_TIMEOUT':
        actions.push(
          {
            type: 'retry',
            description: 'Retry with exponential backoff',
            parameters: { maxAttempts: 3, backoffMultiplier: 2 },
            successProbability: 0.7
          }
        )
        break

      case 'PARSER_ERROR':
        actions.push(
          {
            type: 'fallback',
            description: 'Try alternative parser or lenient mode',
            successProbability: 0.5
          },
          {
            type: 'skip',
            description: 'Skip file if all parsers fail',
            successProbability: 1.0
          }
        )
        break

      default:
        if (error.isRetriable) {
          actions.push({
            type: 'retry',
            description: 'Retry with standard backoff',
            parameters: { maxAttempts: 3 },
            successProbability: 0.5
          })
        } else {
          actions.push({
            type: 'skip',
            description: 'Skip and continue processing',
            successProbability: 1.0
          })
        }
    }

    return actions
  }
}

// Main Error Handler
export class BatchErrorHandler {
  private errorHistory: Map<string, ProcessingError[]> = new Map()
  private errorPatterns: Map<string, ErrorPattern> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private alertListeners: Set<(alert: ErrorAlert) => void> = new Set()
  private errorMetrics = {
    totalErrors: 0,
    errorsByType: new Map<string, number>(),
    errorsByCode: new Map<string, number>(),
    errorRate: 0,
    lastCalculated: Date.now()
  }

  // Error Handling
  async handleJobError(
    job: ProcessingJob, 
    error: Error, 
    context?: Partial<ErrorContext>
  ): Promise<RecoveryAction[]> {
    const errorContext = this.buildErrorContext(job, context)
    const classifiedError = ErrorClassifier.classifyError(error, errorContext)

    // Store error in history
    this.addErrorToHistory(job.id, classifiedError)

    // Update job with classified error
    job.error = classifiedError
    job.updatedAt = Date.now()

    // Analyze patterns
    await this.analyzeErrorPatterns(classifiedError)

    // Check circuit breaker
    this.updateCircuitBreaker(classifiedError.type, classifiedError)

    // Generate recovery actions
    const recoveryActions = ErrorClassifier.getSuggestedRecoveryActions(classifiedError)

    // Create alert if necessary
    if (classifiedError.severity === 'critical' || this.shouldCreateAlert(classifiedError)) {
      this.createAlert(classifiedError, [job.id], recoveryActions)
    }

    // Update metrics
    this.updateErrorMetrics(classifiedError)

    console.error(`❌ Classified error for job ${job.fileName}:`, {
      code: classifiedError.code,
      type: classifiedError.type,
      severity: classifiedError.severity,
      isRetriable: classifiedError.isRetriable,
      recoveryActions: recoveryActions.map(a => a.type)
    })

    return recoveryActions
  }

  async handleBatchError(
    batch: BatchOperation,
    errors: Map<string, ProcessingError>
  ): Promise<RecoveryAction[]> {
    const errorCodes = Array.from(errors.values()).map(e => e.code)
    const uniqueErrorCodes = [...new Set(errorCodes)]
    
    // Analyze batch-level patterns
    const batchPattern = this.analyzeBatchErrorPattern(batch, errors)
    
    if (batchPattern) {
      this.errorPatterns.set(batchPattern.id, batchPattern)
    }

    // Generate batch-level recovery actions
    const recoveryActions: RecoveryAction[] = []

    // If majority of jobs failed with same error, suggest batch-level action
    const majorityErrorCode = this.findMajorityErrorCode(errorCodes)
    if (majorityErrorCode && errorCodes.filter(c => c === majorityErrorCode).length > batch.jobIds.length * 0.6) {
      if (majorityErrorCode === 'MEMORY_EXHAUSTION') {
        recoveryActions.push({
          type: 'pause',
          description: 'Pause entire batch processing due to system constraints',
          estimatedRecoveryTime: 60000
        })
      } else if (majorityErrorCode === 'QUOTA_EXCEEDED') {
        recoveryActions.push({
          type: 'pause',
          description: 'Pause batch due to quota limits',
          estimatedRecoveryTime: 3600000 // 1 hour
        })
      }
    }

    // Create critical alert for batch failures
    if (errors.size > batch.jobIds.length * 0.5) {
      this.createAlert(
        {
          code: 'BATCH_FAILURE_THRESHOLD',
          message: `Batch ${batch.name} has ${errors.size}/${batch.jobIds.length} failed jobs`,
          type: 'system',
          severity: 'high',
          isRetriable: false,
          timestamp: Date.now()
        },
        Array.from(errors.keys()),
        recoveryActions
      )
    }

    return recoveryActions
  }

  // Circuit Breaker
  isCircuitBreakerOpen(errorType: string): boolean {
    const breaker = this.circuitBreakers.get(errorType)
    if (!breaker) return false

    // Check if breaker should transition from open to half-open
    if (breaker.isOpen && Date.now() - breaker.lastFailureTime > breaker.thresholds.timeout) {
      breaker.isOpen = false
      breaker.halfOpenAttempts = 0
      console.log(`🔄 Circuit breaker for ${errorType} transitioning to half-open`)
    }

    return breaker.isOpen
  }

  canProcessJob(job: ProcessingJob): { canProcess: boolean; reason?: string } {
    // Check circuit breakers for job type and file type
    const jobTypeBreaker = this.isCircuitBreakerOpen(`job-${job.type}`)
    const fileTypeBreaker = this.isCircuitBreakerOpen(`file-${job.fileType}`)
    const systemBreaker = this.isCircuitBreakerOpen('system')

    if (systemBreaker) {
      return { canProcess: false, reason: 'System circuit breaker is open due to critical errors' }
    }

    if (jobTypeBreaker) {
      return { canProcess: false, reason: `Circuit breaker open for ${job.type} jobs` }
    }

    if (fileTypeBreaker) {
      return { canProcess: false, reason: `Circuit breaker open for ${job.fileType} files` }
    }

    return { canProcess: true }
  }

  // Error Analytics
  getErrorStatistics(): any {
    return {
      ...this.errorMetrics,
      patterns: Array.from(this.errorPatterns.values()),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      recentErrors: this.getRecentErrors(3600000) // Last hour
    }
  }

  getJobErrorHistory(jobId: string): ProcessingError[] {
    return this.errorHistory.get(jobId) || []
  }

  // Alert Management
  addAlertListener(listener: (alert: ErrorAlert) => void): void {
    this.alertListeners.add(listener)
  }

  removeAlertListener(listener: (alert: ErrorAlert) => void): void {
    this.alertListeners.delete(listener)
  }

  // Private Methods
  private buildErrorContext(job: ProcessingJob, context?: Partial<ErrorContext>): ErrorContext {
    return {
      jobId: job.id,
      fileName: job.fileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      stage: job.progress.stage,
      timestamp: Date.now(),
      systemState: {
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: 0, // Browser limitation
        queueSize: 0, // Will be injected by processor
        concurrentJobs: 0 // Will be injected by processor
      },
      ...context
    }
  }

  private addErrorToHistory(jobId: string, error: ProcessingError): void {
    if (!this.errorHistory.has(jobId)) {
      this.errorHistory.set(jobId, [])
    }
    
    const jobErrors = this.errorHistory.get(jobId)!
    jobErrors.push(error)

    // Keep only last 10 errors per job to prevent memory bloat
    if (jobErrors.length > 10) {
      jobErrors.splice(0, jobErrors.length - 10)
    }
  }

  private async analyzeErrorPatterns(error: ProcessingError): Promise<void> {
    const patternId = `${error.code}-${error.type}`
    let pattern = this.errorPatterns.get(patternId)

    if (!pattern) {
      pattern = {
        id: patternId,
        type: error.code,
        frequency: 1,
        lastOccurrence: error.timestamp,
        affectedJobs: [error.details?.jobId || ''],
        commonContext: {},
        severity: error.severity,
        isRecurring: false
      }
    } else {
      pattern.frequency++
      pattern.lastOccurrence = error.timestamp
      pattern.affectedJobs.push(error.details?.jobId || '')
      
      // Mark as recurring if frequency > 3 and occurred within last hour
      pattern.isRecurring = pattern.frequency > 3 && 
        (error.timestamp - pattern.lastOccurrence) < 3600000
    }

    this.errorPatterns.set(patternId, pattern)

    // Alert on recurring patterns
    if (pattern.isRecurring && pattern.frequency % 5 === 0) {
      this.createAlert(error, pattern.affectedJobs, [
        {
          type: 'escalate',
          description: `Recurring error pattern detected: ${pattern.type} (${pattern.frequency} occurrences)`
        }
      ])
    }
  }

  private updateCircuitBreaker(breakerKey: string, error: ProcessingError): void {
    if (!this.circuitBreakers.has(breakerKey)) {
      this.circuitBreakers.set(breakerKey, {
        isOpen: false,
        lastFailureTime: 0,
        failureCount: 0,
        successCount: 0,
        halfOpenAttempts: 0,
        thresholds: {
          failureRate: 0.5,
          failureCount: 5,
          timeout: 60000 // 1 minute
        }
      })
    }

    const breaker = this.circuitBreakers.get(breakerKey)!
    breaker.failureCount++
    breaker.lastFailureTime = Date.now()

    // Open circuit if thresholds exceeded
    if (breaker.failureCount >= breaker.thresholds.failureCount) {
      breaker.isOpen = true
      console.warn(`⚡ Circuit breaker opened for ${breakerKey} due to ${breaker.failureCount} failures`)
    }
  }

  private shouldCreateAlert(error: ProcessingError): boolean {
    // Create alerts for critical errors, high frequency errors, or system errors
    return error.severity === 'critical' || 
           error.severity === 'high' ||
           error.type === 'system' ||
           (this.errorPatterns.get(`${error.code}-${error.type}`)?.frequency || 0) > 3
  }

  private createAlert(
    error: ProcessingError, 
    affectedJobs: string[], 
    suggestedActions: RecoveryAction[]
  ): void {
    const alert: ErrorAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: error.severity === 'critical' ? 'critical' : 
             error.severity === 'high' ? 'error' : 'warning',
      message: error.message,
      errorCode: error.code,
      affectedJobs,
      timestamp: Date.now(),
      requiresAttention: error.severity === 'critical' || error.severity === 'high',
      suggestedActions
    }

    // Notify all listeners
    this.alertListeners.forEach(listener => {
      try {
        listener(alert)
      } catch (err) {
        console.error('Error in alert listener:', err)
      }
    })

    console.warn(`🚨 Alert created: ${alert.level.toUpperCase()} - ${alert.message}`)
  }

  private updateErrorMetrics(error: ProcessingError): void {
    this.errorMetrics.totalErrors++
    
    const typeCount = this.errorMetrics.errorsByType.get(error.type) || 0
    this.errorMetrics.errorsByType.set(error.type, typeCount + 1)
    
    const codeCount = this.errorMetrics.errorsByCode.get(error.code) || 0
    this.errorMetrics.errorsByCode.set(error.code, codeCount + 1)

    // Recalculate error rate every 5 minutes
    if (Date.now() - this.errorMetrics.lastCalculated > 300000) {
      this.recalculateErrorRate()
    }
  }

  private recalculateErrorRate(): void {
    const recentErrors = this.getRecentErrors(3600000) // Last hour
    const totalRecentJobs = this.getTotalRecentJobs(3600000) // Estimated
    
    this.errorMetrics.errorRate = totalRecentJobs > 0 ? recentErrors.length / totalRecentJobs : 0
    this.errorMetrics.lastCalculated = Date.now()
  }

  private getRecentErrors(timeWindow: number): ProcessingError[] {
    const cutoff = Date.now() - timeWindow
    const recentErrors: ProcessingError[] = []

    this.errorHistory.forEach(errors => {
      recentErrors.push(...errors.filter(e => e.timestamp > cutoff))
    })

    return recentErrors
  }

  private getTotalRecentJobs(timeWindow: number): number {
    // This would need to be injected from the queue/processor
    // For now, estimate based on error history size
    return this.errorHistory.size * 2 // Rough estimate
  }

  private analyzeBatchErrorPattern(
    batch: BatchOperation, 
    errors: Map<string, ProcessingError>
  ): ErrorPattern | null {
    if (errors.size < 2) return null

    const errorCodes = Array.from(errors.values()).map(e => e.code)
    const majorityCode = this.findMajorityErrorCode(errorCodes)
    
    if (!majorityCode) return null

    return {
      id: `batch-${batch.id}-${majorityCode}`,
      type: majorityCode,
      frequency: errorCodes.filter(c => c === majorityCode).length,
      lastOccurrence: Date.now(),
      affectedJobs: Array.from(errors.keys()),
      commonContext: { batchId: batch.id, batchName: batch.name },
      severity: errors.values().next().value?.severity || 'medium',
      isRecurring: false
    }
  }

  private findMajorityErrorCode(errorCodes: string[]): string | null {
    if (errorCodes.length === 0) return null

    const counts = new Map<string, number>()
    errorCodes.forEach(code => {
      counts.set(code, (counts.get(code) || 0) + 1)
    })

    let maxCount = 0
    let majorityCode: string | null = null

    counts.forEach((count, code) => {
      if (count > maxCount) {
        maxCount = count
        majorityCode = code
      }
    })

    return maxCount > errorCodes.length * 0.3 ? majorityCode : null
  }

  private getMemoryUsage(): number {
    // Browser-compatible memory usage estimation
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      return memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
    }
    return 0 // Unknown
  }
}

// Export singleton instance
export const batchErrorHandler = new BatchErrorHandler() 