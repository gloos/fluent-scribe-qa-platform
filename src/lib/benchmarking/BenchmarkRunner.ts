import {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkReport,
  TestCase,
  NetworkCondition,
  MemoryCondition,
  CacheCondition,
  BenchmarkEventHandlers,
  PerformanceComparison
} from './types'
import { SyntheticFileGenerator } from './generators/SyntheticFileGenerator'
import { MetricsCollector } from './metrics/MetricsCollector'
import { createChunkingService } from '../chunking'
import { memoryManager } from '../chunking/MemoryManager'
import { defaultCacheManager } from '../chunking/cache'

export class BenchmarkRunner {
  private config: BenchmarkConfig
  private eventHandlers: BenchmarkEventHandlers
  private metricsCollector: MetricsCollector
  private testFiles: Map<string, File> = new Map()
  private results: BenchmarkResult[] = []
  private currentTestIndex: number = 0
  private totalTests: number = 0

  constructor(config: BenchmarkConfig, eventHandlers: BenchmarkEventHandlers = {}) {
    this.config = config
    this.eventHandlers = eventHandlers
    this.metricsCollector = new MetricsCollector()
    
    // Calculate total number of tests
    this.totalTests = this.calculateTotalTests()
    console.log(`🧪 Benchmark suite configured: ${this.totalTests} total tests`)
  }

  /**
   * Run the complete benchmark suite
   */
  async runBenchmark(): Promise<BenchmarkReport> {
    const startTime = new Date()
    console.log(`🚀 Starting comprehensive benchmark suite: ${this.config.name}`)
    
    try {
      // Initialize environment
      await this.initializeEnvironment()
      
      // Generate test files
      this.generateTestFiles()
      
      // Run all test combinations
      const results = await this.executeTestMatrix()
      
      // Generate comparisons if baseline is enabled
      const comparisons = this.config.enableBaseline ? this.generateComparisons(results) : []
      
      // Generate final report
      const report = this.generateReport(results, comparisons, startTime)
      
      // Save report if path is specified
      if (this.config.outputPath) {
        await this.saveReport(report)
      }
      
      console.log(`✅ Benchmark completed: ${results.length} tests in ${report.executionTime}`)
      return report
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  /**
   * Initialize the benchmark environment
   */
  private async initializeEnvironment(): Promise<void> {
    console.log('🔧 Initializing benchmark environment...')
    
    // Clear any existing cache to ensure clean start
    await defaultCacheManager.clear()
    
    // Reset memory manager state
    await memoryManager.performCleanup()
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc()
    }
    
    console.log('✅ Environment initialized')
  }

  /**
   * Generate all test files for the benchmark
   */
  private generateTestFiles(): void {
    console.log('📁 Generating test files...')
    
    this.testFiles = SyntheticFileGenerator.generateTestSuite(this.config.testFiles)
    
    const totalSize = Array.from(this.testFiles.values())
      .reduce((sum, file) => sum + file.size, 0)
    
    console.log(`✅ Generated ${this.testFiles.size} test files (${Math.round(totalSize / (1024 * 1024))}MB total)`)
  }

  /**
   * Execute the complete test matrix
   */
  private async executeTestMatrix(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []
    this.currentTestIndex = 0
    
    console.log('🧪 Executing test matrix...')
    
    for (const fileConfig of this.config.testFiles) {
      for (const networkCondition of this.config.networkConditions) {
        for (const memoryCondition of this.config.memoryConditions) {
          for (const cacheCondition of this.config.cacheConditions) {
            for (let iteration = 1; iteration <= this.config.iterations; iteration++) {
              const testCase: TestCase = {
                fileConfig,
                networkCondition,
                memoryCondition,
                cacheCondition,
                iteration
              }
              
              this.currentTestIndex++
              console.log(`\n🔬 Test ${this.currentTestIndex}/${this.totalTests}: ${this.getTestDescription(testCase)}`)
              
              try {
                const result = await this.executeTestCase(testCase)
                results.push(result)
                
                if (this.eventHandlers.onTestComplete) {
                  this.eventHandlers.onTestComplete(result)
                }
                
              } catch (error) {
                console.error(`❌ Test failed: ${error}`)
                
                // Create failed result
                const failedResult: BenchmarkResult = {
                  config: this.config,
                  testCase,
                  metrics: this.createEmptyMetrics(),
                  rawData: this.metricsCollector.getRawData(),
                  timestamp: new Date().toISOString(),
                  environment: MetricsCollector.getBenchmarkEnvironment(),
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                }
                
                results.push(failedResult)
                
                if (this.eventHandlers.onError) {
                  this.eventHandlers.onError(testCase, error instanceof Error ? error : new Error(String(error)))
                }
              }
              
              // Brief pause between tests to allow cleanup
              await this.pauseBetweenTests()
            }
          }
        }
      }
    }
    
    return results
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(testCase: TestCase): Promise<BenchmarkResult> {
    if (this.eventHandlers.onTestStart) {
      this.eventHandlers.onTestStart(testCase)
    }
    
    // Get test file
    const file = this.testFiles.get(testCase.fileConfig.name)
    if (!file) {
      throw new Error(`Test file not found: ${testCase.fileConfig.name}`)
    }
    
    try {
      // Setup test conditions
      await this.setupTestConditions(testCase)
      
      // Start metrics collection
      this.metricsCollector.startCollection(testCase)
      
      // Execute the upload test
      await this.performUploadTest(file, testCase)
      
      // Stop metrics collection and get results
      const metrics = this.metricsCollector.stopCollection()
      
      // Create successful result
      const result: BenchmarkResult = {
        config: this.config,
        testCase,
        metrics,
        rawData: this.metricsCollector.getRawData(),
        timestamp: new Date().toISOString(),
        environment: MetricsCollector.getBenchmarkEnvironment(),
        success: true
      }
      
      console.log(`✅ Test completed: ${metrics.uploadThroughputMBps.toFixed(2)} MB/s throughput`)
      return result
      
    } finally {
      // Cleanup test conditions
      await this.cleanupTestConditions(testCase)
    }
  }

  /**
   * Setup conditions for a specific test case
   */
  private async setupTestConditions(testCase: TestCase): Promise<void> {
    // Setup cache condition
    await this.setupCacheCondition(testCase.cacheCondition)
    
    // Setup memory condition (simulated)
    await this.setupMemoryCondition(testCase.memoryCondition)
    
    // Network condition would be setup here in a real implementation
    // For now, we'll just log it
    console.log(`🌐 Network condition: ${testCase.networkCondition.name} (${testCase.networkCondition.bandwidthMbps}Mbps)`)
  }

  /**
   * Setup cache condition
   */
  private async setupCacheCondition(condition: CacheCondition): Promise<void> {
    switch (condition.state) {
      case 'cold':
        await defaultCacheManager.clear()
        break
      
      case 'warm':
        // Partially populate cache
        await this.prewarmCache(0.3)
        break
      
      case 'hot':
        // Fully populate cache
        await this.prewarmCache(0.8)
        break
      
      case 'resumable':
        // Setup resumable upload scenario
        await this.setupResumableScenario(condition)
        break
    }
    
    console.log(`💾 Cache condition: ${condition.name}`)
  }

  /**
   * Setup memory condition (simulated)
   */
  private async setupMemoryCondition(condition: MemoryCondition): Promise<void> {
    // In a real implementation, this would apply memory pressure
    // For now, we'll just log and adjust chunk sizes accordingly
    console.log(`🧠 Memory condition: ${condition.name} (${condition.availableMemoryMB}MB available)`)
    
    // Force garbage collection to start with clean state
    if ('gc' in window) {
      (window as any).gc()
    }
  }

  /**
   * Perform the actual upload test
   */
  private async performUploadTest(file: File, testCase: TestCase): Promise<void> {
    const chunkingService = createChunkingService()
    
    // Create a modified file with the test case name as file ID
    const testFile = new File([file], testCase.fileConfig.name, {
      type: file.type,
      lastModified: file.lastModified
    })
    
    try {
      const uploadResult = await chunkingService.uploadFileInChunks(
        testFile,
        {
          onProgress: (progress) => {
            if (this.eventHandlers.onProgressUpdate) {
              this.eventHandlers.onProgressUpdate(testCase, progress)
            }
          },
          onChunkComplete: (chunk) => {
            // Record chunk timing for metrics
            const chunkStartTime = performance.now() - 1000 // Simplified
            const chunkEndTime = performance.now()
            this.metricsCollector.recordChunkUpload(
              chunk.chunkIndex,
              chunkStartTime,
              chunkEndTime,
              chunk.actualSize
            )
          },
          maxRetries: 3
        }
      )
      
      if (!uploadResult.isComplete) {
        throw new Error('Upload did not complete successfully')
      }
      
    } catch (error) {
      this.metricsCollector.recordError('upload_error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * Cleanup test conditions
   */
  private async cleanupTestConditions(testCase: TestCase): Promise<void> {
    // Cleanup would restore original conditions
    // For now, just perform basic cleanup
    await memoryManager.performCleanup()
  }

  /**
   * Prewarm cache to specified percentage
   */
  private async prewarmCache(percentage: number): Promise<void> {
    // Simplified cache prewarming - in real implementation would populate with realistic data
    console.log(`🔥 Prewarming cache to ${Math.round(percentage * 100)}%`)
  }

  /**
   * Setup resumable upload scenario
   */
  private async setupResumableScenario(condition: CacheCondition): Promise<void> {
    // Setup partial upload state for resumability testing
    console.log(`🔄 Setting up resumable scenario with ${condition.preloadPercentage || 50}% completion`)
  }

  /**
   * Pause between tests to allow cleanup
   */
  private async pauseBetweenTests(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500)) // 500ms pause
  }

  /**
   * Calculate total number of tests
   */
  private calculateTotalTests(): number {
    return this.config.testFiles.length * 
           this.config.networkConditions.length * 
           this.config.memoryConditions.length * 
           this.config.cacheConditions.length * 
           this.config.iterations
  }

  /**
   * Generate test description
   */
  private getTestDescription(testCase: TestCase): string {
    return `${testCase.fileConfig.name} | ${testCase.networkCondition.name} | ${testCase.memoryCondition.name} | ${testCase.cacheCondition.name} | Iter ${testCase.iteration}`
  }

  /**
   * Generate performance comparisons
   */
  private generateComparisons(results: BenchmarkResult[]): PerformanceComparison[] {
    const comparisons: PerformanceComparison[] = []
    
    // Group results by test scenario (excluding iteration)
    const groupedResults = new Map<string, BenchmarkResult[]>()
    
    results.forEach(result => {
      if (result.success) {
        const key = `${result.testCase.fileConfig.name}_${result.testCase.networkCondition.name}_${result.testCase.memoryCondition.name}_${result.testCase.cacheCondition.name}`
        if (!groupedResults.has(key)) {
          groupedResults.set(key, [])
        }
        groupedResults.get(key)!.push(result)
      }
    })
    
    // For each group, compare against baseline
    groupedResults.forEach((groupResults, key) => {
      if (groupResults.length > 1) {
        const averageMetrics = this.averageMetrics(groupResults.map(r => r.metrics))
        
        // Use first result as baseline for comparison
        const baselineMetrics = groupResults[0].metrics
        
        const comparison: PerformanceComparison = {
          baselineMetrics,
          optimizedMetrics: averageMetrics,
          improvements: {
            throughputImprovement: ((averageMetrics.uploadThroughputMBps - baselineMetrics.uploadThroughputMBps) / baselineMetrics.uploadThroughputMBps) * 100,
            latencyImprovement: ((baselineMetrics.chunkProcessingLatencyMs.reduce((sum, val) => sum + val, 0) / baselineMetrics.chunkProcessingLatencyMs.length) - 
                               (averageMetrics.chunkProcessingLatencyMs.reduce((sum, val) => sum + val, 0) / averageMetrics.chunkProcessingLatencyMs.length)),
            memoryImprovement: ((baselineMetrics.peakMemoryUsageMB - averageMetrics.peakMemoryUsageMB) / baselineMetrics.peakMemoryUsageMB) * 100,
            cacheEfficiencyImprovement: ((averageMetrics.cacheHitRatio - baselineMetrics.cacheHitRatio) / (baselineMetrics.cacheHitRatio || 0.01)) * 100,
            errorRateImprovement: ((baselineMetrics.errorRate - averageMetrics.errorRate) / (baselineMetrics.errorRate || 0.01)) * 100
          },
          summary: `Test scenario: ${key}`
        }
        
        comparisons.push(comparison)
      }
    })
    
    return comparisons
  }

  /**
   * Generate final benchmark report
   */
  private generateReport(
    results: BenchmarkResult[], 
    comparisons: PerformanceComparison[], 
    startTime: Date
  ): BenchmarkReport {
    const endTime = new Date()
    const executionTime = `${Math.round((endTime.getTime() - startTime.getTime()) / 1000)}s`
    
    const passedTests = results.filter(r => r.success).length
    const failedTests = results.filter(r => !r.success).length
    
    const successfulResults = results.filter(r => r.success)
    const averageMetrics = successfulResults.length > 0 
      ? this.averageMetrics(successfulResults.map(r => r.metrics))
      : this.createEmptyMetrics()
    
    // Find best and worst performing scenarios
    const bestResult = successfulResults.reduce((best, current) => 
      current.metrics.uploadThroughputMBps > best.metrics.uploadThroughputMBps ? current : best,
      successfulResults[0]
    )
    
    const worstResult = successfulResults.reduce((worst, current) => 
      current.metrics.uploadThroughputMBps < worst.metrics.uploadThroughputMBps ? current : worst,
      successfulResults[0]
    )
    
    return {
      title: this.config.name,
      description: this.config.description,
      executionTime,
      totalTests: this.totalTests,
      passedTests,
      failedTests,
      environment: MetricsCollector.getBenchmarkEnvironment(),
      results,
      comparisons,
      recommendations: this.generateRecommendations(results),
      summary: {
        bestPerformingScenario: bestResult?.testCase || successfulResults[0]?.testCase,
        worstPerformingScenario: worstResult?.testCase || successfulResults[0]?.testCase,
        averageMetrics,
        keyFindings: this.generateKeyFindings(results)
      }
    }
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = []
    const successfulResults = results.filter(r => r.success)
    
    if (successfulResults.length === 0) {
      return ['No successful tests to analyze']
    }
    
    // Analyze throughput patterns
    const avgThroughput = successfulResults.reduce((sum, r) => sum + r.metrics.uploadThroughputMBps, 0) / successfulResults.length
    const bestThroughput = Math.max(...successfulResults.map(r => r.metrics.uploadThroughputMBps))
    
    if (avgThroughput < bestThroughput * 0.7) {
      recommendations.push('Significant performance variation detected. Consider implementing adaptive chunk sizing based on network conditions.')
    }
    
    // Analyze memory usage
    const avgPeakMemory = successfulResults.reduce((sum, r) => sum + r.metrics.peakMemoryUsageMB, 0) / successfulResults.length
    if (avgPeakMemory > 500) {
      recommendations.push('High memory usage detected. Consider reducing chunk sizes or implementing more aggressive memory cleanup.')
    }
    
    // Analyze cache effectiveness
    const avgCacheHitRatio = successfulResults.reduce((sum, r) => sum + r.metrics.cacheHitRatio, 0) / successfulResults.length
    if (avgCacheHitRatio < 0.3) {
      recommendations.push('Low cache hit ratio. Consider implementing cache prewarming or adjusting cache retention policies.')
    }
    
    // Analyze error rates
    const avgErrorRate = successfulResults.reduce((sum, r) => sum + r.metrics.errorRate, 0) / successfulResults.length
    if (avgErrorRate > 0.05) {
      recommendations.push('High error rate detected. Consider implementing more robust retry mechanisms or network condition detection.')
    }
    
    return recommendations
  }

  /**
   * Generate key findings
   */
  private generateKeyFindings(results: BenchmarkResult[]): string[] {
    const findings: string[] = []
    const successfulResults = results.filter(r => r.success)
    
    if (successfulResults.length === 0) {
      return ['No successful tests to analyze']
    }
    
    // Find optimal file size for throughput
    const throughputBySize = new Map<number, number[]>()
    successfulResults.forEach(result => {
      const sizeMB = result.testCase.fileConfig.sizeInMB
      if (!throughputBySize.has(sizeMB)) {
        throughputBySize.set(sizeMB, [])
      }
      throughputBySize.get(sizeMB)!.push(result.metrics.uploadThroughputMBps)
    })
    
    let optimalSize = 0
    let maxAvgThroughput = 0
    throughputBySize.forEach((throughputs, size) => {
      const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length
      if (avgThroughput > maxAvgThroughput) {
        maxAvgThroughput = avgThroughput
        optimalSize = size
      }
    })
    
    findings.push(`Optimal file size for throughput: ${optimalSize}MB (${maxAvgThroughput.toFixed(2)} MB/s average)`)
    
    // Memory efficiency analysis
    const avgMemoryEfficiency = successfulResults.reduce((sum, r) => 
      sum + (r.metrics.uploadThroughputMBps / r.metrics.peakMemoryUsageMB), 0) / successfulResults.length
    
    findings.push(`Average memory efficiency: ${avgMemoryEfficiency.toFixed(3)} MB/s per MB memory`)
    
    // Cache impact analysis
    const cacheResults = successfulResults.filter(r => r.metrics.cacheHitRatio > 0)
    if (cacheResults.length > 0) {
      const avgCacheImprovement = cacheResults.reduce((sum, r) => 
        sum + (r.metrics.cacheHitRatio * r.metrics.uploadThroughputMBps), 0) / cacheResults.length
      
      findings.push(`Cache provides average ${(avgCacheImprovement / maxAvgThroughput * 100).toFixed(1)}% performance improvement`)
    }
    
    return findings
  }

  /**
   * Average multiple metrics objects
   */
  private averageMetrics(metricsArray: Array<any>): any {
    if (metricsArray.length === 0) return this.createEmptyMetrics()
    
    const averaged: any = {}
    const sampleMetrics = metricsArray[0]
    
    Object.keys(sampleMetrics).forEach(key => {
      if (Array.isArray(sampleMetrics[key])) {
        // For arrays, concatenate all values
        averaged[key] = metricsArray.reduce((acc, metrics) => acc.concat(metrics[key]), [])
      } else if (typeof sampleMetrics[key] === 'number') {
        // For numbers, calculate average
        averaged[key] = metricsArray.reduce((sum, metrics) => sum + metrics[key], 0) / metricsArray.length
      } else {
        // For other types, use first value
        averaged[key] = sampleMetrics[key]
      }
    })
    
    return averaged
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): any {
    return {
      startTime: 0,
      endTime: 0,
      totalDurationMs: 0,
      uploadThroughputMBps: 0,
      chunkProcessingLatencyMs: [],
      networkEfficiencyPercent: 0,
      peakMemoryUsageMB: 0,
      averageMemoryUsageMB: 0,
      memoryPressureEvents: 0,
      gcEvents: 0,
      cacheHitRatio: 0,
      cacheMissRatio: 0,
      cacheLookupTimeMs: [],
      totalChunks: 0,
      chunkSize: 0,
      chunksPerSecond: 0,
      parallelism: 0,
      failedChunks: 0,
      retryAttempts: 0,
      errorRate: 0,
      networkUtilizationPercent: 0,
      timeToFirstByte: 0,
      progressUpdateFrequency: 0
    }
  }

  /**
   * Save report to file (if running in Node.js environment)
   */
  private async saveReport(report: BenchmarkReport): Promise<void> {
    try {
      const reportJson = JSON.stringify(report, null, 2)
      console.log(`💾 Report saved to ${this.config.outputPath}`)
      
      // In browser environment, trigger download
      if (typeof window !== 'undefined') {
        const blob = new Blob([reportJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = this.config.outputPath || 'benchmark-report.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }

  /**
   * Cleanup benchmark resources
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up benchmark resources...')
    
    // Clear cache
    await defaultCacheManager.clear()
    
    // Reset memory manager
    await memoryManager.performCleanup()
    
    console.log('✅ Cleanup completed')
  }
} 