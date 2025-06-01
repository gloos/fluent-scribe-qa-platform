import { ProcessingJob, ProcessingError, BatchOperation, ProcessingConfig } from './types'
import { RecoveryAction, ErrorContext } from './error-handler'

export interface RecoveryStrategy {
  name: string
  description: string
  canHandle: (error: ProcessingError, job: ProcessingJob) => boolean
  execute: (error: ProcessingError, job: ProcessingJob, context: RecoveryContext) => Promise<RecoveryResult>
  priority: number
  maxAttempts: number
}

export interface RecoveryContext {
  queue: any // Will be injected
  processor: any // Will be injected
  systemMetrics: {
    memoryUsage: number
    cpuUsage: number
    queueSize: number
    concurrentJobs: number
  }
  retryHistory: RecoveryAttempt[]
}

export interface RecoveryAttempt {
  strategyName: string
  timestamp: number
  success: boolean
  duration: number
  error?: string
  details?: Record<string, any>
}

export interface RecoveryResult {
  success: boolean
  action: 'retry' | 'skip' | 'fallback' | 'escalate' | 'pause'
  message: string
  newJobConfig?: Partial<ProcessingJob>
  delayBeforeRetry?: number
  requiresIntervention?: boolean
  modifiedJob?: ProcessingJob
}

// Graceful Degradation Modes
export enum DegradationMode {
  MINIMAL = 'minimal',     // Basic parsing only, no validation
  REDUCED = 'reduced',     // Skip advanced features, keep core functionality
  CONSERVATIVE = 'conservative', // Reduce concurrency, increase timeouts
  SAFE = 'safe'           // Maximum safety checks, lowest performance
}

export interface DegradationConfig {
  mode: DegradationMode
  maxConcurrency: number
  timeoutMultiplier: number
  skipValidation: boolean
  skipAnalysis: boolean
  enableLenientParsing: boolean
  reducedQualityChecks: boolean
}

// Recovery Strategies Implementation
export class RecoveryStrategyManager {
  private strategies: Map<string, RecoveryStrategy> = new Map()
  private degradationConfigs: Map<DegradationMode, DegradationConfig> = new Map()
  private recoveryHistory: Map<string, RecoveryAttempt[]> = new Map()
  private activeRecoveries: Set<string> = new Set()

  constructor() {
    this.initializeStrategies()
    this.initializeDegradationConfigs()
  }

  // Main Recovery Orchestration
  async attemptRecovery(
    error: ProcessingError,
    job: ProcessingJob,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    if (this.activeRecoveries.has(job.id)) {
      return {
        success: false,
        action: 'skip',
        message: 'Recovery already in progress for this job'
      }
    }

    this.activeRecoveries.add(job.id)

    try {
      // Get applicable strategies, sorted by priority
      const applicableStrategies = this.getApplicableStrategies(error, job)
        .sort((a, b) => b.priority - a.priority)

      // Try each strategy until one succeeds or we exhaust options
      for (const strategy of applicableStrategies) {
        if (this.canAttemptStrategy(strategy, job)) {
          const result = await this.executeStrategy(strategy, error, job, context)
          
          if (result.success) {
            console.log(`✅ Recovery successful using strategy: ${strategy.name}`)
            return result
          } else {
            console.warn(`❌ Recovery strategy failed: ${strategy.name} - ${result.message}`)
          }
        }
      }

      // All strategies failed
      return {
        success: false,
        action: 'escalate',
        message: 'All recovery strategies exhausted',
        requiresIntervention: true
      }

    } finally {
      this.activeRecoveries.delete(job.id)
    }
  }

  // Graceful Degradation
  async applyGracefulDegradation(
    jobs: ProcessingJob[],
    targetMode: DegradationMode
  ): Promise<{ modifiedJobs: ProcessingJob[]; config: DegradationConfig }> {
    const degradationConfig = this.degradationConfigs.get(targetMode)!
    const modifiedJobs: ProcessingJob[] = []

    for (const job of jobs) {
      const modifiedJob = this.applyDegradationToJob(job, degradationConfig)
      modifiedJobs.push(modifiedJob)
    }

    console.log(`🔻 Applied graceful degradation: ${targetMode} mode to ${jobs.length} jobs`)

    return {
      modifiedJobs,
      config: degradationConfig
    }
  }

  // Data Integrity Protection
  async protectDataIntegrity(job: ProcessingJob): Promise<{
    checksum: string
    backup: any
    integrityVerified: boolean
  }> {
    try {
      // Create file checksum
      const checksum = await this.calculateChecksum(job.file)
      
      // Create job state backup
      const backup = {
        originalJob: JSON.parse(JSON.stringify(job)),
        timestamp: Date.now(),
        fileSize: job.file.size,
        fileName: job.fileName
      }

      // Verify current state
      const integrityVerified = await this.verifyJobIntegrity(job)

      return {
        checksum,
        backup,
        integrityVerified
      }

    } catch (error) {
      console.error('Failed to protect data integrity:', error)
      return {
        checksum: '',
        backup: null,
        integrityVerified: false
      }
    }
  }

  async restoreFromBackup(jobId: string, backup: any): Promise<ProcessingJob | null> {
    try {
      if (!backup || !backup.originalJob) {
        return null
      }

      // Restore job from backup
      const restoredJob: ProcessingJob = {
        ...backup.originalJob,
        status: 'pending' as const,
        progress: {
          percentage: 0,
          stage: 'restored',
          message: 'Job restored from backup after integrity failure'
        },
        error: undefined,
        updatedAt: Date.now()
      }

      console.log(`🔄 Restored job ${jobId} from backup (${backup.timestamp})`)
      return restoredJob

    } catch (error) {
      console.error('Failed to restore from backup:', error)
      return null
    }
  }

  // Strategy Management
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  removeStrategy(strategyName: string): void {
    this.strategies.delete(strategyName)
  }

  getRecoveryHistory(jobId: string): RecoveryAttempt[] {
    return this.recoveryHistory.get(jobId) || []
  }

  // Private Methods
  private initializeStrategies(): void {
    // Exponential Backoff Retry Strategy
    this.strategies.set('exponential-backoff', {
      name: 'exponential-backoff',
      description: 'Retry with exponential backoff for transient errors',
      priority: 8,
      maxAttempts: 3,
      canHandle: (error) => error.isRetriable && ['NETWORK_TIMEOUT', 'QUOTA_EXCEEDED'].includes(error.code),
      execute: async (error, job, context) => {
        const attempt = job.retryAttempt + 1
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)

        return {
          success: true,
          action: 'retry',
          message: `Retrying with ${delay}ms delay (attempt ${attempt})`,
          delayBeforeRetry: delay,
          newJobConfig: {
            retryAttempt: attempt,
            progress: {
              ...job.progress,
              stage: 'retrying',
              message: `Retry attempt ${attempt} after ${delay}ms`
            }
          }
        }
      }
    })

    // Fallback Parser Strategy
    this.strategies.set('fallback-parser', {
      name: 'fallback-parser',
      description: 'Try alternative parser for file format issues',
      priority: 7,
      maxAttempts: 2,
      canHandle: (error) => error.code === 'PARSER_ERROR' || error.code === 'FILE_CORRUPTION',
      execute: async (error, job, context) => {
        // Determine fallback parser based on current file type
        let fallbackFileType: string
        switch (job.fileType) {
          case 'xliff-2.0':
            fallbackFileType = 'xliff-1.2'
            break
          case 'xliff-1.2':
            fallbackFileType = 'mxliff'
            break
          default:
            fallbackFileType = 'xliff-1.2'
        }

        return {
          success: true,
          action: 'fallback',
          message: `Trying fallback parser: ${fallbackFileType}`,
          newJobConfig: {
            fileType: fallbackFileType as any,
            config: {
              ...job.config,
              parseOptions: {
                ...job.config.parseOptions,
                validateSchema: false, // Disable validation for fallback
                preserveOriginalStructure: false
              }
            }
          }
        }
      }
    })

    // Lenient Processing Strategy
    this.strategies.set('lenient-processing', {
      name: 'lenient-processing',
      description: 'Process with lenient settings, skip validation',
      priority: 6,
      maxAttempts: 1,
      canHandle: (error) => ['PARSER_ERROR', 'FILE_CORRUPTION', 'VALIDATION_ERROR'].includes(error.code),
      execute: async (error, job, context) => {
        return {
          success: true,
          action: 'fallback',
          message: 'Switching to lenient processing mode',
          newJobConfig: {
            config: {
              parseOptions: {
                validateSchema: false,
                extractMetadata: true,
                preserveOriginalStructure: false
              },
              validationOptions: {
                checkTranslationUnits: false,
                validateLanguageCodes: false,
                checkFileIntegrity: false
              }
            },
            progress: {
              ...job.progress,
              stage: 'lenient-processing',
              message: 'Processing with relaxed validation'
            }
          }
        }
      }
    })

    // Memory Recovery Strategy
    this.strategies.set('memory-recovery', {
      name: 'memory-recovery',
      description: 'Pause processing to allow memory recovery',
      priority: 9,
      maxAttempts: 1,
      canHandle: (error) => error.code === 'MEMORY_EXHAUSTION',
      execute: async (error, job, context) => {
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        return {
          success: true,
          action: 'pause',
          message: 'Pausing for memory recovery',
          delayBeforeRetry: 30000,
          newJobConfig: {
            priority: 1, // Lower priority after recovery
            progress: {
              ...job.progress,
              stage: 'memory-recovery',
              message: 'Waiting for memory recovery'
            }
          }
        }
      }
    })

    // Skip Strategy (Last Resort)
    this.strategies.set('skip-job', {
      name: 'skip-job',
      description: 'Skip job and continue with others',
      priority: 1,
      maxAttempts: 1,
      canHandle: () => true, // Always applicable as last resort
      execute: async (error, job, context) => {
        return {
          success: true,
          action: 'skip',
          message: 'Skipping job due to unrecoverable error',
          newJobConfig: {
            status: 'cancelled' as const,
            progress: {
              ...job.progress,
              stage: 'skipped',
              message: `Skipped due to ${error.code}: ${error.message}`
            }
          }
        }
      }
    })
  }

  private initializeDegradationConfigs(): void {
    this.degradationConfigs.set(DegradationMode.MINIMAL, {
      mode: DegradationMode.MINIMAL,
      maxConcurrency: 1,
      timeoutMultiplier: 1,
      skipValidation: true,
      skipAnalysis: true,
      enableLenientParsing: true,
      reducedQualityChecks: true
    })

    this.degradationConfigs.set(DegradationMode.REDUCED, {
      mode: DegradationMode.REDUCED,
      maxConcurrency: 2,
      timeoutMultiplier: 1.5,
      skipValidation: false,
      skipAnalysis: true,
      enableLenientParsing: true,
      reducedQualityChecks: true
    })

    this.degradationConfigs.set(DegradationMode.CONSERVATIVE, {
      mode: DegradationMode.CONSERVATIVE,
      maxConcurrency: 1,
      timeoutMultiplier: 2,
      skipValidation: false,
      skipAnalysis: false,
      enableLenientParsing: false,
      reducedQualityChecks: true
    })

    this.degradationConfigs.set(DegradationMode.SAFE, {
      mode: DegradationMode.SAFE,
      maxConcurrency: 1,
      timeoutMultiplier: 3,
      skipValidation: false,
      skipAnalysis: false,
      enableLenientParsing: false,
      reducedQualityChecks: false
    })
  }

  private getApplicableStrategies(error: ProcessingError, job: ProcessingJob): RecoveryStrategy[] {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(error, job))
  }

  private canAttemptStrategy(strategy: RecoveryStrategy, job: ProcessingJob): boolean {
    const history = this.recoveryHistory.get(job.id) || []
    const strategyAttempts = history.filter(attempt => attempt.strategyName === strategy.name)
    
    return strategyAttempts.length < strategy.maxAttempts
  }

  private async executeStrategy(
    strategy: RecoveryStrategy,
    error: ProcessingError,
    job: ProcessingJob,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      const result = await strategy.execute(error, job, context)
      
      // Record successful attempt
      this.recordRecoveryAttempt(job.id, {
        strategyName: strategy.name,
        timestamp: startTime,
        success: result.success,
        duration: Date.now() - startTime,
        details: { action: result.action, message: result.message }
      })

      return result

    } catch (strategyError) {
      // Record failed attempt
      this.recordRecoveryAttempt(job.id, {
        strategyName: strategy.name,
        timestamp: startTime,
        success: false,
        duration: Date.now() - startTime,
        error: (strategyError as Error).message
      })

      return {
        success: false,
        action: 'escalate',
        message: `Strategy execution failed: ${(strategyError as Error).message}`
      }
    }
  }

  private recordRecoveryAttempt(jobId: string, attempt: RecoveryAttempt): void {
    if (!this.recoveryHistory.has(jobId)) {
      this.recoveryHistory.set(jobId, [])
    }

    const history = this.recoveryHistory.get(jobId)!
    history.push(attempt)

    // Keep only last 20 attempts per job
    if (history.length > 20) {
      history.splice(0, history.length - 20)
    }
  }

  private applyDegradationToJob(job: ProcessingJob, config: DegradationConfig): ProcessingJob {
    const modifiedJob: ProcessingJob = {
      ...job,
      config: {
        ...job.config,
        parseOptions: {
          ...job.config.parseOptions,
          validateSchema: !config.skipValidation,
          preserveOriginalStructure: !config.enableLenientParsing
        },
        analysisOptions: config.skipAnalysis ? undefined : job.config.analysisOptions,
        validationOptions: config.skipValidation ? undefined : {
          ...job.config.validationOptions,
          checkTranslationUnits: !config.reducedQualityChecks,
          validateLanguageCodes: !config.reducedQualityChecks,
          checkFileIntegrity: !config.reducedQualityChecks
        }
      },
      priority: 1, // Lower priority for degraded jobs
      metadata: {
        ...job.metadata,
        degradationMode: config.mode,
        originalPriority: job.priority
      }
    }

    return modifiedJob
  }

  private async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private async verifyJobIntegrity(job: ProcessingJob): Promise<boolean> {
    try {
      // Basic integrity checks
      return !!(
        job.id &&
        job.file &&
        job.fileName &&
        job.fileSize > 0 &&
        job.file.size === job.fileSize
      )
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const recoveryStrategyManager = new RecoveryStrategyManager() 