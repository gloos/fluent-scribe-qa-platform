/**
 * Parallel Processing Strategy Framework
 * 
 * This module provides intelligent parallel processing strategies for batch operations,
 * optimizing resource utilization and throughput while preventing system overload.
 */

import { ProcessingJob, JobPriority, QueueConfig, QueueMetrics } from './types'

export interface SystemResources {
  cpuCores: number
  totalMemory: number // MB
  availableMemory: number // MB
  cpuUsage: number // percentage 0-100
  memoryUsage: number // percentage 0-100
  networkBandwidth?: number // Mbps
  diskIO?: number // MB/s
}

export interface JobResourceRequirements {
  cpuIntensity: 'low' | 'medium' | 'high' | 'very-high'
  memoryUsage: number // MB estimate
  ioIntensity: 'low' | 'medium' | 'high' | 'very-high'
  networkRequirements?: 'none' | 'low' | 'medium' | 'high'
  estimatedDuration: number // milliseconds
  canRunConcurrently: boolean
  resourceConstraints?: string[]
}

export interface ParallelStrategy {
  id: string
  name: string
  description: string
  
  /**
   * Determine optimal concurrency level for given conditions
   */
  calculateOptimalConcurrency(
    systemResources: SystemResources,
    pendingJobs: ProcessingJob[],
    currentMetrics: QueueMetrics
  ): number

  /**
   * Select next batch of jobs to process in parallel
   */
  selectJobBatch(
    pendingJobs: ProcessingJob[],
    maxConcurrency: number,
    systemResources: SystemResources
  ): ProcessingJob[]

  /**
   * Check if system can handle additional job
   */
  canAcceptNewJob(
    job: ProcessingJob,
    currentJobs: ProcessingJob[],
    systemResources: SystemResources
  ): boolean

  /**
   * Estimate performance impact of job combination
   */
  estimatePerformanceImpact(
    jobCombination: ProcessingJob[],
    systemResources: SystemResources
  ): {
    throughputScore: number // 0-100
    resourceUtilization: number // 0-100
    estimatedCompletionTime: number // milliseconds
    bottlenecks: string[]
  }
}

/**
 * Get estimated resource requirements for a job based on its characteristics
 */
export function getJobResourceRequirements(job: ProcessingJob): JobResourceRequirements {
  const baseRequirements: Record<ProcessingJob['type'], Partial<JobResourceRequirements>> = {
    parse: {
      cpuIntensity: 'medium',
      memoryUsage: Math.max(50, job.fileSize / (1024 * 1024) * 2), // 2MB per file MB
      ioIntensity: 'high',
      networkRequirements: 'none',
      estimatedDuration: Math.max(5000, job.fileSize / 1024), // 1ms per KB minimum 5s
      canRunConcurrently: true
    },
    analyze: {
      cpuIntensity: 'very-high',
      memoryUsage: Math.max(100, job.fileSize / (1024 * 1024) * 4), // 4MB per file MB
      ioIntensity: 'medium',
      networkRequirements: 'none',
      estimatedDuration: Math.max(10000, job.fileSize / 512), // 2ms per KB minimum 10s
      canRunConcurrently: true,
      resourceConstraints: ['cpu-bound']
    },
    validate: {
      cpuIntensity: 'low',
      memoryUsage: Math.max(30, job.fileSize / (1024 * 1024) * 1.5), // 1.5MB per file MB
      ioIntensity: 'medium',
      networkRequirements: 'none',
      estimatedDuration: Math.max(3000, job.fileSize / 2048), // 0.5ms per KB minimum 3s
      canRunConcurrently: true
    },
    export: {
      cpuIntensity: 'medium',
      memoryUsage: Math.max(75, job.fileSize / (1024 * 1024) * 3), // 3MB per file MB
      ioIntensity: 'very-high',
      networkRequirements: 'low',
      estimatedDuration: Math.max(8000, job.fileSize / 1024), // 1ms per KB minimum 8s
      canRunConcurrently: true,
      resourceConstraints: ['io-bound']
    }
  }

  const base = baseRequirements[job.type] || {}
  
  // Adjust based on priority
  const priorityMultiplier = {
    [JobPriority.LOW]: 0.8,
    [JobPriority.NORMAL]: 1.0,
    [JobPriority.HIGH]: 1.2,
    [JobPriority.URGENT]: 1.4,
    [JobPriority.IMMEDIATE]: 1.6
  }

  const multiplier = priorityMultiplier[job.priority] || 1.0

  return {
    cpuIntensity: base.cpuIntensity || 'medium',
    memoryUsage: (base.memoryUsage || 50) * multiplier,
    ioIntensity: base.ioIntensity || 'medium',
    networkRequirements: base.networkRequirements || 'none',
    estimatedDuration: (base.estimatedDuration || 5000) / multiplier, // Higher priority = faster processing
    canRunConcurrently: base.canRunConcurrently !== false,
    resourceConstraints: base.resourceConstraints || []
  }
}

/**
 * Detect current system resources
 */
export async function detectSystemResources(): Promise<SystemResources> {
  // Browser environment detection
  const nav = navigator as any
  
  const cpuCores = nav.hardwareConcurrency || 4
  const totalMemory = (nav.deviceMemory || 4) * 1024 // Convert GB to MB
  
  // Estimate available memory (conservative approach)
  const availableMemory = totalMemory * 0.7 // Assume 70% available
  
  // Estimate CPU usage based on performance.now() timing
  const cpuUsage = await estimateCPUUsage()
  
  // Calculate memory usage estimate
  const memoryUsage = ((totalMemory - availableMemory) / totalMemory) * 100

  return {
    cpuCores,
    totalMemory,
    availableMemory,
    cpuUsage,
    memoryUsage
  }
}

/**
 * Estimate CPU usage using performance timing
 */
async function estimateCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now()
    let iterations = 0
    const maxTime = 50 // 50ms test
    
    function testLoop() {
      const current = performance.now()
      if (current - start >= maxTime) {
        // Rough estimation: lower iterations = higher CPU usage
        const expectedIterations = 1000000 // Baseline for idle system
        const usageEstimate = Math.max(0, Math.min(100, 
          (1 - (iterations / expectedIterations)) * 100
        ))
        resolve(usageEstimate)
        return
      }
      
      iterations++
      // Small delay to prevent blocking
      setTimeout(testLoop, 0)
    }
    
    testLoop()
  })
}

/**
 * Conservative Strategy: Prioritizes stability and prevents overload
 */
export class ConservativeStrategy implements ParallelStrategy {
  id = 'conservative'
  name = 'Conservative Processing'
  description = 'Prioritizes system stability with conservative resource usage'

  calculateOptimalConcurrency(
    systemResources: SystemResources,
    pendingJobs: ProcessingJob[],
    currentMetrics: QueueMetrics
  ): number {
    // Conservative approach: use 60% of available resources
    const cpuBasedLimit = Math.max(1, Math.floor(systemResources.cpuCores * 0.6))
    
    // Memory-based limit (assume 200MB per job)
    const memoryBasedLimit = Math.floor(systemResources.availableMemory / 200)
    
    // Consider current system load
    const loadAdjustment = systemResources.cpuUsage > 70 ? 0.5 : 
                          systemResources.cpuUsage > 50 ? 0.7 : 1.0
    
    return Math.max(1, Math.min(
      cpuBasedLimit,
      memoryBasedLimit,
      Math.floor(systemResources.cpuCores * loadAdjustment)
    ))
  }

  selectJobBatch(
    pendingJobs: ProcessingJob[],
    maxConcurrency: number,
    systemResources: SystemResources
  ): ProcessingJob[] {
    // Sort by priority, then by size (smaller first for conservative approach)
    const sorted = [...pendingJobs].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      return a.fileSize - b.fileSize
    })

    const selected: ProcessingJob[] = []
    let totalMemoryEstimate = 0

    for (const job of sorted) {
      if (selected.length >= maxConcurrency) break
      
      const requirements = getJobResourceRequirements(job)
      
      // Conservative memory check
      if (totalMemoryEstimate + requirements.memoryUsage > systemResources.availableMemory * 0.5) {
        continue
      }
      
      selected.push(job)
      totalMemoryEstimate += requirements.memoryUsage
    }

    return selected
  }

  canAcceptNewJob(
    job: ProcessingJob,
    currentJobs: ProcessingJob[],
    systemResources: SystemResources
  ): boolean {
    const requirements = getJobResourceRequirements(job)
    const currentMemoryUsage = currentJobs.reduce((sum, j) => 
      sum + getJobResourceRequirements(j).memoryUsage, 0
    )
    
    return (currentMemoryUsage + requirements.memoryUsage) <= systemResources.availableMemory * 0.5
  }

  estimatePerformanceImpact(
    jobCombination: ProcessingJob[],
    systemResources: SystemResources
  ): {
    throughputScore: number
    resourceUtilization: number
    estimatedCompletionTime: number
    bottlenecks: string[]
  } {
    const totalMemory = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).memoryUsage, 0
    )
    
    const avgDuration = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).estimatedDuration, 0
    ) / jobCombination.length

    const memoryUtilization = totalMemory / systemResources.totalMemory
    const cpuUtilization = jobCombination.length / systemResources.cpuCores

    const bottlenecks: string[] = []
    if (memoryUtilization > 0.6) bottlenecks.push('memory')
    if (cpuUtilization > 0.8) bottlenecks.push('cpu')

    return {
      throughputScore: Math.max(0, 100 - bottlenecks.length * 30),
      resourceUtilization: (memoryUtilization + cpuUtilization) / 2 * 100,
      estimatedCompletionTime: avgDuration * (1 + cpuUtilization * 0.3),
      bottlenecks
    }
  }
}

/**
 * Aggressive Strategy: Maximizes throughput and resource utilization
 */
export class AggressiveStrategy implements ParallelStrategy {
  id = 'aggressive'
  name = 'Aggressive Processing'
  description = 'Maximizes throughput by pushing resource limits'

  calculateOptimalConcurrency(
    systemResources: SystemResources,
    pendingJobs: ProcessingJob[],
    currentMetrics: QueueMetrics
  ): number {
    // Aggressive approach: use 90% of available resources
    const cpuBasedLimit = Math.max(2, Math.floor(systemResources.cpuCores * 0.9))
    
    // More optimistic memory calculation
    const memoryBasedLimit = Math.floor(systemResources.availableMemory / 150)
    
    // Less conservative load adjustment
    const loadAdjustment = systemResources.cpuUsage > 85 ? 0.7 : 
                          systemResources.cpuUsage > 70 ? 0.8 : 1.0
    
    return Math.max(2, Math.min(
      cpuBasedLimit,
      memoryBasedLimit,
      Math.floor(systemResources.cpuCores * 1.2 * loadAdjustment) // Allow oversubscription
    ))
  }

  selectJobBatch(
    pendingJobs: ProcessingJob[],
    maxConcurrency: number,
    systemResources: SystemResources
  ): ProcessingJob[] {
    // Prioritize high-value jobs and optimal resource mixing
    const sorted = [...pendingJobs].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      
      // Prefer larger files for better throughput
      return b.fileSize - a.fileSize
    })

    const selected: ProcessingJob[] = []
    let totalMemoryEstimate = 0
    const maxMemory = systemResources.availableMemory * 0.8 // Use 80% of memory

    for (const job of sorted) {
      if (selected.length >= maxConcurrency) break
      
      const requirements = getJobResourceRequirements(job)
      
      if (totalMemoryEstimate + requirements.memoryUsage <= maxMemory) {
        selected.push(job)
        totalMemoryEstimate += requirements.memoryUsage
      }
    }

    return selected
  }

  canAcceptNewJob(
    job: ProcessingJob,
    currentJobs: ProcessingJob[],
    systemResources: SystemResources
  ): boolean {
    const requirements = getJobResourceRequirements(job)
    const currentMemoryUsage = currentJobs.reduce((sum, j) => 
      sum + getJobResourceRequirements(j).memoryUsage, 0
    )
    
    return (currentMemoryUsage + requirements.memoryUsage) <= systemResources.availableMemory * 0.8
  }

  estimatePerformanceImpact(
    jobCombination: ProcessingJob[],
    systemResources: SystemResources
  ): {
    throughputScore: number
    resourceUtilization: number
    estimatedCompletionTime: number
    bottlenecks: string[]
  } {
    const totalMemory = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).memoryUsage, 0
    )
    
    const avgDuration = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).estimatedDuration, 0
    ) / jobCombination.length

    const memoryUtilization = totalMemory / systemResources.totalMemory
    const cpuUtilization = jobCombination.length / systemResources.cpuCores

    const bottlenecks: string[] = []
    if (memoryUtilization > 0.9) bottlenecks.push('memory')
    if (cpuUtilization > 1.2) bottlenecks.push('cpu')

    // Higher throughput score for aggressive utilization
    const utilizationBonus = Math.min(30, (memoryUtilization + cpuUtilization) * 15)

    return {
      throughputScore: Math.min(100, 70 + utilizationBonus - bottlenecks.length * 20),
      resourceUtilization: (memoryUtilization + cpuUtilization) / 2 * 100,
      estimatedCompletionTime: avgDuration * (1 + cpuUtilization * 0.2), // Less penalty for oversubscription
      bottlenecks
    }
  }
}

/**
 * Balanced Strategy: Optimal balance between performance and stability
 */
export class BalancedStrategy implements ParallelStrategy {
  id = 'balanced'
  name = 'Balanced Processing'
  description = 'Optimizes both performance and stability'

  calculateOptimalConcurrency(
    systemResources: SystemResources,
    pendingJobs: ProcessingJob[],
    currentMetrics: QueueMetrics
  ): number {
    // Adaptive approach based on historical performance
    const baseConcurrency = Math.floor(systemResources.cpuCores * 0.75)
    
    // Adjust based on error rate and throughput
    let adjustment = 1.0
    if (currentMetrics.errorRate > 0.1) {
      adjustment *= 0.8 // Reduce concurrency if high error rate
    } else if (currentMetrics.throughputPerHour > 0 && currentMetrics.averageProcessingTime > 0) {
      // Increase if performing well
      adjustment *= 1.1
    }
    
    // Memory consideration
    const memoryLimit = Math.floor(systemResources.availableMemory / 175)
    
    // System load consideration
    const loadFactor = systemResources.cpuUsage > 75 ? 0.7 : 
                      systemResources.cpuUsage < 40 ? 1.2 : 1.0
    
    return Math.max(1, Math.min(
      Math.floor(baseConcurrency * adjustment),
      memoryLimit,
      Math.floor(systemResources.cpuCores * loadFactor)
    ))
  }

  selectJobBatch(
    pendingJobs: ProcessingJob[],
    maxConcurrency: number,
    systemResources: SystemResources
  ): ProcessingJob[] {
    // Smart job mixing: balance different types for optimal resource usage
    const jobsByType = pendingJobs.reduce((acc, job) => {
      acc[job.type] = acc[job.type] || []
      acc[job.type].push(job)
      return acc
    }, {} as Record<string, ProcessingJob[]>)

    // Sort each type by priority
    Object.values(jobsByType).forEach(jobs => {
      jobs.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return a.createdAt - b.createdAt
      })
    })

    const selected: ProcessingJob[] = []
    let totalMemoryEstimate = 0
    const maxMemory = systemResources.availableMemory * 0.7

    // Round-robin selection from different types for balanced resource usage
    const typeKeys = Object.keys(jobsByType)
    let typeIndex = 0

    while (selected.length < maxConcurrency && typeKeys.some(type => jobsByType[type].length > 0)) {
      const currentType = typeKeys[typeIndex % typeKeys.length]
      const jobs = jobsByType[currentType]
      
      if (jobs.length > 0) {
        const job = jobs.shift()!
        const requirements = getJobResourceRequirements(job)
        
        if (totalMemoryEstimate + requirements.memoryUsage <= maxMemory) {
          selected.push(job)
          totalMemoryEstimate += requirements.memoryUsage
        }
      }
      
      typeIndex++
    }

    return selected
  }

  canAcceptNewJob(
    job: ProcessingJob,
    currentJobs: ProcessingJob[],
    systemResources: SystemResources
  ): boolean {
    const requirements = getJobResourceRequirements(job)
    const currentMemoryUsage = currentJobs.reduce((sum, j) => 
      sum + getJobResourceRequirements(j).memoryUsage, 0
    )
    
    // Consider job type diversity for better resource balance
    const currentTypes = new Set(currentJobs.map(j => j.type))
    const diversityBonus = currentTypes.has(job.type) ? 1.0 : 1.1
    
    const memoryLimit = systemResources.availableMemory * 0.7 * diversityBonus
    
    return (currentMemoryUsage + requirements.memoryUsage) <= memoryLimit
  }

  estimatePerformanceImpact(
    jobCombination: ProcessingJob[],
    systemResources: SystemResources
  ): {
    throughputScore: number
    resourceUtilization: number
    estimatedCompletionTime: number
    bottlenecks: string[]
  } {
    const totalMemory = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).memoryUsage, 0
    )
    
    const avgDuration = jobCombination.reduce((sum, job) => 
      sum + getJobResourceRequirements(job).estimatedDuration, 0
    ) / jobCombination.length

    const memoryUtilization = totalMemory / systemResources.totalMemory
    const cpuUtilization = jobCombination.length / systemResources.cpuCores

    // Check for type diversity (better performance with mixed workloads)
    const uniqueTypes = new Set(jobCombination.map(j => j.type)).size
    const diversityBonus = Math.min(20, uniqueTypes * 5)

    const bottlenecks: string[] = []
    if (memoryUtilization > 0.8) bottlenecks.push('memory')
    if (cpuUtilization > 1.0) bottlenecks.push('cpu')

    return {
      throughputScore: Math.min(100, 80 + diversityBonus - bottlenecks.length * 25),
      resourceUtilization: (memoryUtilization + cpuUtilization) / 2 * 100,
      estimatedCompletionTime: avgDuration * (1 + cpuUtilization * 0.25),
      bottlenecks
    }
  }
}

/**
 * Available processing strategies
 */
export const PROCESSING_STRATEGIES = {
  conservative: new ConservativeStrategy(),
  balanced: new BalancedStrategy(),
  aggressive: new AggressiveStrategy()
} as const

export type StrategyType = keyof typeof PROCESSING_STRATEGIES

/**
 * Parallel Processing Manager
 */
export class ParallelProcessingManager {
  private currentStrategy: ParallelStrategy
  private systemResources: SystemResources | null = null
  private resourceUpdateInterval: NodeJS.Timeout | null = null

  constructor(strategy: StrategyType = 'balanced') {
    this.currentStrategy = PROCESSING_STRATEGIES[strategy]
    this.startResourceMonitoring()
  }

  /**
   * Set processing strategy
   */
  setStrategy(strategy: StrategyType): void {
    this.currentStrategy = PROCESSING_STRATEGIES[strategy]
    console.log(`🔄 Switched to ${this.currentStrategy.name} processing strategy`)
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy(): ParallelStrategy {
    return this.currentStrategy
  }

  /**
   * Get optimal concurrency for current conditions
   */
  async getOptimalConcurrency(
    pendingJobs: ProcessingJob[],
    currentMetrics: QueueMetrics
  ): Promise<number> {
    if (!this.systemResources) {
      this.systemResources = await detectSystemResources()
    }

    return this.currentStrategy.calculateOptimalConcurrency(
      this.systemResources,
      pendingJobs,
      currentMetrics
    )
  }

  /**
   * Select optimal job batch for parallel processing
   */
  async selectOptimalJobBatch(
    pendingJobs: ProcessingJob[],
    maxConcurrency?: number
  ): Promise<ProcessingJob[]> {
    if (!this.systemResources) {
      this.systemResources = await detectSystemResources()
    }

    const concurrency = maxConcurrency || await this.getOptimalConcurrency(pendingJobs, {
      totalJobs: 0,
      pendingJobs: pendingJobs.length,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      averageProcessingTime: 60000,
      averageWaitTime: 30000,
      throughputPerHour: 10,
      errorRate: 0.05,
      currentConcurrency: 0,
      queueUtilization: 0
    })

    return this.currentStrategy.selectJobBatch(
      pendingJobs,
      concurrency,
      this.systemResources
    )
  }

  /**
   * Check if system can accept new job
   */
  async canAcceptNewJob(job: ProcessingJob, currentJobs: ProcessingJob[]): Promise<boolean> {
    if (!this.systemResources) {
      this.systemResources = await detectSystemResources()
    }

    return this.currentStrategy.canAcceptNewJob(job, currentJobs, this.systemResources)
  }

  /**
   * Get performance impact analysis
   */
  async analyzePerformanceImpact(jobCombination: ProcessingJob[]) {
    if (!this.systemResources) {
      this.systemResources = await detectSystemResources()
    }

    return this.currentStrategy.estimatePerformanceImpact(jobCombination, this.systemResources)
  }

  /**
   * Get current system resources
   */
  async getSystemResources(): Promise<SystemResources> {
    if (!this.systemResources) {
      this.systemResources = await detectSystemResources()
    }
    return this.systemResources
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    // Update resources every 30 seconds
    this.resourceUpdateInterval = setInterval(async () => {
      try {
        this.systemResources = await detectSystemResources()
      } catch (error) {
        console.warn('Failed to update system resources:', error)
      }
    }, 30000)
  }

  /**
   * Stop resource monitoring
   */
  destroy(): void {
    if (this.resourceUpdateInterval) {
      clearInterval(this.resourceUpdateInterval)
      this.resourceUpdateInterval = null
    }
  }
}

// Export singleton instance
export const parallelProcessingManager = new ParallelProcessingManager()

// Export for custom instances
export default ParallelProcessingManager 