export interface UploadError {
  type: 'network' | 'authentication' | 'storage' | 'validation' | 'server' | 'timeout' | 'cancelled' | 'unknown'
  code?: string
  message: string
  userMessage: string
  isRetriable: boolean
  retryAfter?: number // seconds
  metadata?: Record<string, any>
  timestamp: number
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  exponentialBackoff: boolean
  retryableErrorTypes: UploadError['type'][]
}

export interface UploadErrorLog {
  fileId: string
  fileName: string
  fileSize: number
  error: UploadError
  attempt: number
  duration: number // milliseconds
  timestamp: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  exponentialBackoff: true,
  retryableErrorTypes: ['network', 'server', 'timeout']
}

export class UploadErrorHandler {
  private errorLogs: UploadErrorLog[] = []
  private retryConfig: RetryConfig
  private networkStatus: boolean = navigator.onLine

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
    
    // Monitor network status
    this.setupNetworkMonitoring()
  }

  private setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.networkStatus = true
      console.log('🟢 Network connection restored')
    })
    
    window.addEventListener('offline', () => {
      this.networkStatus = false
      console.log('🔴 Network connection lost')
    })
  }

  /**
   * Classify and standardize upload errors
   */
  classifyError(error: any, context?: Record<string, any>): UploadError {
    const timestamp = Date.now()
    const baseError: Partial<UploadError> = {
      timestamp,
      metadata: { ...context, networkStatus: this.networkStatus }
    }

    // Network errors
    if (!this.networkStatus || error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return {
        ...baseError,
        type: 'network',
        code: 'NETWORK_ERROR',
        message: error.message || 'Network connection failed',
        userMessage: 'Connection lost. Please check your internet connection and try again.',
        isRetriable: true,
        retryAfter: 5
      } as UploadError
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return {
        ...baseError,
        type: 'timeout',
        code: 'TIMEOUT',
        message: error.message || 'Upload request timed out',
        userMessage: 'Upload is taking longer than expected. Please try again.',
        isRetriable: true,
        retryAfter: 2
      } as UploadError
    }

    // Authentication errors
    if (error.status === 401 || error.status === 403 || error.code === 'UNAUTHORIZED') {
      return {
        ...baseError,
        type: 'authentication',
        code: 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
        userMessage: 'Authentication failed. Please refresh the page and try again.',
        isRetriable: false
      } as UploadError
    }

    // Storage errors (Supabase specific)
    if (error.error?.startsWith('storage/') || error.code?.startsWith('STORAGE_')) {
      const storageErrorCode = error.error || error.code
      let userMessage = 'Storage error occurred. Please try again.'
      
      if (storageErrorCode.includes('quota')) {
        userMessage = 'Storage quota exceeded. Please contact support.'
      } else if (storageErrorCode.includes('permission')) {
        userMessage = 'Permission denied. Please check your access rights.'
      } else if (storageErrorCode.includes('bucket')) {
        userMessage = 'Storage configuration error. Please contact support.'
      }

      return {
        ...baseError,
        type: 'storage',
        code: storageErrorCode,
        message: error.message || 'Storage operation failed',
        userMessage,
        isRetriable: !storageErrorCode.includes('permission') && !storageErrorCode.includes('quota')
      } as UploadError
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return {
        ...baseError,
        type: 'server',
        code: `HTTP_${error.status}`,
        message: error.message || `Server error: ${error.status}`,
        userMessage: 'Server is temporarily unavailable. Please try again in a moment.',
        isRetriable: true,
        retryAfter: 10
      } as UploadError
    }

    // Client errors (4xx excluding auth)
    if (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403) {
      return {
        ...baseError,
        type: 'validation',
        code: `HTTP_${error.status}`,
        message: error.message || `Client error: ${error.status}`,
        userMessage: 'Request failed due to invalid data. Please check your file and try again.',
        isRetriable: false
      } as UploadError
    }

    // File validation errors
    if (error.name === 'ValidationError' || error.type === 'validation') {
      return {
        ...baseError,
        type: 'validation',
        code: 'VALIDATION_ERROR',
        message: error.message || 'File validation failed',
        userMessage: error.userMessage || error.message || 'File validation failed. Please check your file and try again.',
        isRetriable: false
      } as UploadError
    }

    // Cancelled operations
    if (error.name === 'AbortError' || error.code === 'CANCELLED') {
      return {
        ...baseError,
        type: 'cancelled',
        code: 'CANCELLED',
        message: 'Upload was cancelled',
        userMessage: 'Upload was cancelled by user.',
        isRetriable: false
      } as UploadError
    }

    // Unknown errors
    return {
      ...baseError,
      type: 'unknown',
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again.',
      isRetriable: true,
      retryAfter: 5
    } as UploadError
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number, error: UploadError): number {
    if (!error.isRetriable || attempt >= this.retryConfig.maxAttempts) {
      return 0
    }

    // Use error-specific retry delay if available
    if (error.retryAfter) {
      return error.retryAfter * 1000
    }

    let delay = this.retryConfig.baseDelay

    if (this.retryConfig.exponentialBackoff) {
      delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
        this.retryConfig.maxDelay
      )
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay
    return Math.floor(delay + jitter)
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error: UploadError, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxAttempts) {
      return false
    }

    if (!error.isRetriable) {
      return false
    }

    if (!this.retryConfig.retryableErrorTypes.includes(error.type)) {
      return false
    }

    // Don't retry if offline unless it's a network error
    if (!this.networkStatus && error.type !== 'network') {
      return false
    }

    return true
  }

  /**
   * Log upload error for analytics and debugging
   */
  logError(
    fileId: string,
    fileName: string,
    fileSize: number,
    error: UploadError,
    attempt: number,
    duration: number
  ): void {
    const logEntry: UploadErrorLog = {
      fileId,
      fileName,
      fileSize,
      error,
      attempt,
      duration,
      timestamp: Date.now()
    }

    this.errorLogs.push(logEntry)

    // Keep only last 100 errors to prevent memory leaks
    if (this.errorLogs.length > 100) {
      this.errorLogs = this.errorLogs.slice(-100)
    }

    // Structured logging for debugging
    console.group(`🚨 Upload Error - ${error.type.toUpperCase()}`)
    console.error('Error Details:', {
      file: `${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
      type: error.type,
      code: error.code,
      message: error.message,
      attempt: `${attempt}/${this.retryConfig.maxAttempts}`,
      retriable: error.isRetriable,
      duration: `${duration}ms`,
      networkStatus: this.networkStatus,
      metadata: error.metadata
    })
    console.groupEnd()

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorAnalytics(logEntry)
    }
  }

  /**
   * Send error analytics (placeholder for actual implementation)
   */
  private sendErrorAnalytics(logEntry: UploadErrorLog): void {
    // TODO: Implement actual analytics sending
    // This could integrate with services like Sentry, LogRocket, or custom analytics
    console.log('📊 Error analytics:', {
      errorType: logEntry.error.type,
      errorCode: logEntry.error.code,
      fileName: logEntry.fileName,
      fileSize: logEntry.fileSize,
      attempt: logEntry.attempt,
      timestamp: logEntry.timestamp
    })
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number
    errorsByType: Record<string, number>
    retrySuccessRate: number
    avgRetryAttempts: number
  } {
    const total = this.errorLogs.length
    const errorsByType: Record<string, number> = {}
    let totalRetryAttempts = 0

    this.errorLogs.forEach(log => {
      errorsByType[log.error.type] = (errorsByType[log.error.type] || 0) + 1
      totalRetryAttempts += log.attempt
    })

    const retriedErrors = this.errorLogs.filter(log => log.attempt > 1).length
    const retrySuccessRate = retriedErrors > 0 ? (retriedErrors / total) * 100 : 0

    return {
      totalErrors: total,
      errorsByType,
      retrySuccessRate,
      avgRetryAttempts: total > 0 ? totalRetryAttempts / total : 0
    }
  }

  /**
   * Clear error logs
   */
  clearErrorLogs(): void {
    this.errorLogs = []
  }

  /**
   * Get network status
   */
  isOnline(): boolean {
    return this.networkStatus
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }
}

// Export singleton instance
export const uploadErrorHandler = new UploadErrorHandler()

// Helper functions for common use cases
export const createUserFriendlyErrorMessage = (error: UploadError, fileName: string): string => {
  const baseMessage = error.userMessage
  
  switch (error.type) {
    case 'network':
      return `${baseMessage} File: ${fileName}`
    case 'timeout':
      return `${baseMessage} Large files may take longer to upload. File: ${fileName}`
    case 'storage':
      return `${baseMessage} File: ${fileName}`
    case 'validation':
      return `${baseMessage} File: ${fileName}`
    default:
      return `${baseMessage} File: ${fileName}`
  }
}

export const isRetriableError = (error: UploadError): boolean => {
  return error.isRetriable && uploadErrorHandler.isOnline()
} 