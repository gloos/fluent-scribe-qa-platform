// Main exports for the benchmarking framework
export { BenchmarkRunner } from './BenchmarkRunner'
export { SyntheticFileGenerator } from './generators/SyntheticFileGenerator'
export { MetricsCollector } from './metrics/MetricsCollector'

// Export all types
export * from './types'

// Predefined benchmark configurations
import {
  BenchmarkConfig,
  TestFileConfig,
  NetworkCondition,
  MemoryCondition,
  CacheCondition
} from './types'

/**
 * Standard file size configurations for testing
 */
export const STANDARD_FILE_SIZES: TestFileConfig[] = [
  { name: 'small-1mb', sizeInMB: 1, type: 'synthetic', contentPattern: 'random' },
  { name: 'medium-10mb', sizeInMB: 10, type: 'synthetic', contentPattern: 'random' },
  { name: 'large-50mb', sizeInMB: 50, type: 'synthetic', contentPattern: 'random' },
  { name: 'xlarge-100mb', sizeInMB: 100, type: 'synthetic', contentPattern: 'random' },
  { name: 'xliff-small', sizeInMB: 5, type: 'xliff', contentPattern: 'structured' },
  { name: 'xliff-large', sizeInMB: 25, type: 'xliff', contentPattern: 'structured' }
]

/**
 * Standard network conditions for testing
 */
export const STANDARD_NETWORK_CONDITIONS: NetworkCondition[] = [
  { 
    name: 'fast-broadband', 
    bandwidthMbps: 100, 
    latencyMs: 10, 
    description: 'Fast broadband connection (100Mbps)' 
  },
  { 
    name: 'medium-broadband', 
    bandwidthMbps: 25, 
    latencyMs: 20, 
    description: 'Medium broadband connection (25Mbps)' 
  },
  { 
    name: 'slow-broadband', 
    bandwidthMbps: 5, 
    latencyMs: 50, 
    description: 'Slow broadband connection (5Mbps)' 
  },
  { 
    name: 'mobile-4g', 
    bandwidthMbps: 10, 
    latencyMs: 30, 
    packetLoss: 0.1, 
    description: 'Mobile 4G connection' 
  },
  { 
    name: 'throttled', 
    bandwidthMbps: 1, 
    latencyMs: 100, 
    packetLoss: 0.5, 
    description: 'Heavily throttled connection (1Mbps)' 
  }
]

/**
 * Standard memory conditions for testing
 */
export const STANDARD_MEMORY_CONDITIONS: MemoryCondition[] = [
  { 
    name: 'low-pressure', 
    pressureLevel: 'low', 
    availableMemoryMB: 2048, 
    description: 'Low memory pressure (2GB available)' 
  },
  { 
    name: 'medium-pressure', 
    pressureLevel: 'medium', 
    availableMemoryMB: 1024, 
    description: 'Medium memory pressure (1GB available)' 
  },
  { 
    name: 'high-pressure', 
    pressureLevel: 'high', 
    availableMemoryMB: 512, 
    description: 'High memory pressure (512MB available)' 
  },
  { 
    name: 'critical-pressure', 
    pressureLevel: 'critical', 
    availableMemoryMB: 256, 
    description: 'Critical memory pressure (256MB available)' 
  }
]

/**
 * Standard cache conditions for testing
 */
export const STANDARD_CACHE_CONDITIONS: CacheCondition[] = [
  { 
    name: 'cold-cache', 
    state: 'cold', 
    description: 'Empty cache (worst case scenario)' 
  },
  { 
    name: 'warm-cache', 
    state: 'warm', 
    preloadPercentage: 30, 
    description: 'Partially populated cache (30% hit rate)' 
  },
  { 
    name: 'hot-cache', 
    state: 'hot', 
    preloadPercentage: 80, 
    description: 'Well-populated cache (80% hit rate)' 
  },
  { 
    name: 'resumable-upload', 
    state: 'resumable', 
    preloadPercentage: 50, 
    description: 'Resumable upload scenario (50% complete)' 
  }
]

/**
 * Quick performance benchmark configuration
 */
export const QUICK_PERFORMANCE_BENCHMARK: BenchmarkConfig = {
  name: 'Quick Performance Benchmark',
  description: 'Fast benchmark covering basic performance scenarios',
  iterations: 2,
  testFiles: [
    STANDARD_FILE_SIZES[1], // 10MB
    STANDARD_FILE_SIZES[3]  // 100MB
  ],
  networkConditions: [
    STANDARD_NETWORK_CONDITIONS[0], // Fast
    STANDARD_NETWORK_CONDITIONS[2]  // Slow
  ],
  memoryConditions: [
    STANDARD_MEMORY_CONDITIONS[0], // Low pressure
    STANDARD_MEMORY_CONDITIONS[2]  // High pressure
  ],
  cacheConditions: [
    STANDARD_CACHE_CONDITIONS[0], // Cold
    STANDARD_CACHE_CONDITIONS[2]  // Hot
  ],
  enableBaseline: true,
  outputPath: 'quick-benchmark-report.json'
}

/**
 * Comprehensive benchmark configuration
 */
export const COMPREHENSIVE_BENCHMARK: BenchmarkConfig = {
  name: 'Comprehensive Performance Analysis',
  description: 'Complete benchmark covering all optimization scenarios',
  iterations: 3,
  testFiles: STANDARD_FILE_SIZES,
  networkConditions: STANDARD_NETWORK_CONDITIONS,
  memoryConditions: STANDARD_MEMORY_CONDITIONS,
  cacheConditions: STANDARD_CACHE_CONDITIONS,
  enableBaseline: true,
  outputPath: 'comprehensive-benchmark-report.json'
}

/**
 * XLIFF-focused benchmark configuration
 */
export const XLIFF_BENCHMARK: BenchmarkConfig = {
  name: 'XLIFF File Performance Benchmark',
  description: 'Benchmark focused on XLIFF file processing performance',
  iterations: 3,
  testFiles: [
    STANDARD_FILE_SIZES[4], // 5MB XLIFF
    STANDARD_FILE_SIZES[5], // 25MB XLIFF
    { name: 'xliff-huge', sizeInMB: 100, type: 'xliff', contentPattern: 'structured' }
  ],
  networkConditions: [
    STANDARD_NETWORK_CONDITIONS[0], // Fast
    STANDARD_NETWORK_CONDITIONS[1], // Medium
    STANDARD_NETWORK_CONDITIONS[2]  // Slow
  ],
  memoryConditions: [
    STANDARD_MEMORY_CONDITIONS[0], // Low pressure
    STANDARD_MEMORY_CONDITIONS[1], // Medium pressure
    STANDARD_MEMORY_CONDITIONS[2]  // High pressure
  ],
  cacheConditions: STANDARD_CACHE_CONDITIONS,
  enableBaseline: true,
  outputPath: 'xliff-benchmark-report.json'
}

/**
 * Memory optimization benchmark
 */
export const MEMORY_OPTIMIZATION_BENCHMARK: BenchmarkConfig = {
  name: 'Memory Optimization Analysis',
  description: 'Benchmark focused on memory usage and optimization',
  iterations: 2,
  testFiles: [
    STANDARD_FILE_SIZES[2], // 50MB
    STANDARD_FILE_SIZES[3]  // 100MB
  ],
  networkConditions: [STANDARD_NETWORK_CONDITIONS[1]], // Medium network
  memoryConditions: STANDARD_MEMORY_CONDITIONS, // All memory conditions
  cacheConditions: [
    STANDARD_CACHE_CONDITIONS[0], // Cold cache
    STANDARD_CACHE_CONDITIONS[2]  // Hot cache
  ],
  enableBaseline: true,
  outputPath: 'memory-benchmark-report.json'
}

/**
 * Utility functions for running benchmarks
 */
export class BenchmarkUtils {
  /**
   * Run a quick performance test
   */
  static async runQuickBenchmark(): Promise<any> {
    const { BenchmarkRunner } = await import('./BenchmarkRunner')
    console.log('🚀 Starting Quick Performance Benchmark...')
    const runner = new BenchmarkRunner(QUICK_PERFORMANCE_BENCHMARK)
    return await runner.runBenchmark()
  }

  /**
   * Run comprehensive analysis
   */
  static async runComprehensiveBenchmark(): Promise<any> {
    const { BenchmarkRunner } = await import('./BenchmarkRunner')
    console.log('🚀 Starting Comprehensive Performance Analysis...')
    const runner = new BenchmarkRunner(COMPREHENSIVE_BENCHMARK)
    return await runner.runBenchmark()
  }

  /**
   * Run XLIFF-specific benchmark
   */
  static async runXLIFFBenchmark(): Promise<any> {
    const { BenchmarkRunner } = await import('./BenchmarkRunner')
    console.log('🚀 Starting XLIFF Performance Benchmark...')
    const runner = new BenchmarkRunner(XLIFF_BENCHMARK)
    return await runner.runBenchmark()
  }

  /**
   * Run memory optimization analysis
   */
  static async runMemoryBenchmark(): Promise<any> {
    const { BenchmarkRunner } = await import('./BenchmarkRunner')
    console.log('🚀 Starting Memory Optimization Analysis...')
    const runner = new BenchmarkRunner(MEMORY_OPTIMIZATION_BENCHMARK)
    return await runner.runBenchmark()
  }

  /**
   * Create custom benchmark configuration
   */
  static createCustomBenchmark(
    name: string,
    description: string,
    options: {
      iterations?: number
      fileSizes?: number[]
      networkSpeeds?: number[]
      memoryLevels?: ('low' | 'medium' | 'high' | 'critical')[]
      cacheStates?: ('cold' | 'warm' | 'hot' | 'resumable')[]
      outputPath?: string
    }
  ): BenchmarkConfig {
    const { 
      iterations = 2,
      fileSizes = [10, 50],
      networkSpeeds = [100, 25],
      memoryLevels = ['low', 'high'],
      cacheStates = ['cold', 'hot'],
      outputPath = 'custom-benchmark-report.json'
    } = options

    return {
      name,
      description,
      iterations,
      testFiles: fileSizes.map(size => ({
        name: `test-${size}mb`,
        sizeInMB: size,
        type: 'synthetic' as const,
        contentPattern: 'random' as const
      })),
      networkConditions: networkSpeeds.map(speed => ({
        name: `${speed}mbps`,
        bandwidthMbps: speed,
        latencyMs: speed > 50 ? 10 : speed > 10 ? 30 : 100,
        description: `${speed}Mbps connection`
      })),
      memoryConditions: memoryLevels.map(level => 
        STANDARD_MEMORY_CONDITIONS.find(c => c.pressureLevel === level)!
      ),
      cacheConditions: cacheStates.map(state => 
        STANDARD_CACHE_CONDITIONS.find(c => c.state === state)!
      ),
      enableBaseline: true,
      outputPath
    }
  }

  /**
   * Format benchmark results for console output
   */
  static formatResultsSummary(report: any): string {
    const { summary, totalTests, passedTests, failedTests, executionTime } = report
    
    let output = `\n🎯 BENCHMARK RESULTS SUMMARY\n`
    output += `${'='.repeat(50)}\n`
    output += `📊 Tests: ${passedTests}/${totalTests} passed (${Math.round((passedTests/totalTests) * 100)}%)\n`
    output += `⏱️  Duration: ${executionTime}\n`
    output += `🏆 Best Scenario: ${summary.bestPerformingScenario?.fileConfig?.name || 'N/A'}\n`
    output += `⚠️  Worst Scenario: ${summary.worstPerformingScenario?.fileConfig?.name || 'N/A'}\n\n`
    
    if (summary.keyFindings?.length > 0) {
      output += `🔍 KEY FINDINGS:\n`
      summary.keyFindings.forEach((finding: string) => {
        output += `   • ${finding}\n`
      })
      output += `\n`
    }

    if (report.recommendations?.length > 0) {
      output += `💡 RECOMMENDATIONS:\n`
      report.recommendations.forEach((rec: string) => {
        output += `   • ${rec}\n`
      })
    }

    return output
  }
} 