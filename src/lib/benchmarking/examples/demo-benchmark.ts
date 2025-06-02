/**
 * Demo: How to use the Performance Benchmarking Framework
 * 
 * This example demonstrates the complete benchmarking workflow for 
 * analyzing file upload performance with the Fluent Scribe system.
 */

import { 
  BenchmarkRunner,
  BenchmarkUtils,
  QUICK_PERFORMANCE_BENCHMARK,
  XLIFF_BENCHMARK,
  MEMORY_OPTIMIZATION_BENCHMARK,
  BenchmarkConfig
} from '../index'

/**
 * Example 1: Quick Performance Benchmark
 * Best for: Initial performance assessment
 * Duration: ~2-3 minutes
 */
export async function runQuickDemo(): Promise<void> {
  console.log('🎯 DEMO: Quick Performance Benchmark')
  console.log('=====================================')
  
  try {
    const report = await BenchmarkUtils.runQuickBenchmark()
    
    // Display formatted results
    console.log(BenchmarkUtils.formatResultsSummary(report))
    
    // Sample specific findings
    if (report.results.length > 0) {
      const bestResult = report.summary.bestPerformingScenario
      console.log(`\n🏆 BEST PERFORMANCE:`)
      console.log(`   File: ${bestResult.fileConfig.name}`)
      console.log(`   Network: ${bestResult.networkCondition.name}`)
      console.log(`   Cache: ${bestResult.cacheCondition.name}`)
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error)
  }
}

/**
 * Example 2: XLIFF-Specific Performance Analysis
 * Best for: XLIFF file optimization analysis
 * Duration: ~5-8 minutes
 */
export async function runXLIFFDemo(): Promise<void> {
  console.log('🎯 DEMO: XLIFF Performance Analysis')
  console.log('===================================')
  
  try {
    const report = await BenchmarkUtils.runXLIFFBenchmark()
    
    console.log(BenchmarkUtils.formatResultsSummary(report))
    
    // XLIFF-specific insights
    const xliffResults = report.results.filter((r: any) => 
      r.testCase.fileConfig.type === 'xliff'
    )
    
    if (xliffResults.length > 0) {
      const avgThroughput = xliffResults.reduce((sum: number, r: any) => 
        sum + r.metrics.uploadThroughputMBps, 0) / xliffResults.length
      
      console.log(`\n📊 XLIFF INSIGHTS:`)
      console.log(`   Average XLIFF Throughput: ${avgThroughput.toFixed(2)} MB/s`)
      console.log(`   Total XLIFF Tests: ${xliffResults.length}`)
    }
    
  } catch (error) {
    console.error('❌ XLIFF demo failed:', error)
  }
}

/**
 * Example 3: Custom Benchmark Configuration
 * Best for: Specific testing scenarios
 */
export async function runCustomDemo(): Promise<void> {
  console.log('🎯 DEMO: Custom Benchmark Configuration')
  console.log('======================================')
  
  // Create custom benchmark for mobile scenarios
  const mobileConfig = BenchmarkUtils.createCustomBenchmark(
    'Mobile Performance Test',
    'Testing performance on mobile-like conditions',
    {
      iterations: 1,
      fileSizes: [5, 20], // Smaller files for mobile
      networkSpeeds: [10, 5], // Mobile network speeds
      memoryLevels: ['medium', 'high'], // Limited mobile memory
      cacheStates: ['cold', 'warm'], // Focus on cache impact
      outputPath: 'mobile-benchmark-report.json'
    }
  )
  
  try {
    const runner = new BenchmarkRunner(mobileConfig)
    const report = await runner.runBenchmark()
    
    console.log(BenchmarkUtils.formatResultsSummary(report))
    
    console.log(`\n📱 MOBILE INSIGHTS:`)
    console.log(`   Optimized for mobile conditions`)
    console.log(`   Cache impact analysis completed`)
    
  } catch (error) {
    console.error('❌ Custom demo failed:', error)
  }
}

/**
 * Example 4: Memory Optimization Analysis
 * Best for: Understanding memory usage patterns
 */
export async function runMemoryDemo(): Promise<void> {
  console.log('🎯 DEMO: Memory Optimization Analysis')
  console.log('=====================================')
  
  try {
    const report = await BenchmarkUtils.runMemoryBenchmark()
    
    console.log(BenchmarkUtils.formatResultsSummary(report))
    
    // Memory-specific analysis
    const memoryResults = report.results.filter((r: any) => r.success)
    
    if (memoryResults.length > 0) {
      const avgPeakMemory = memoryResults.reduce((sum: number, r: any) => 
        sum + r.metrics.peakMemoryUsageMB, 0) / memoryResults.length
      
      const avgMemoryEfficiency = memoryResults.reduce((sum: number, r: any) => 
        sum + (r.metrics.uploadThroughputMBps / r.metrics.peakMemoryUsageMB), 0) / memoryResults.length
      
      console.log(`\n🧠 MEMORY INSIGHTS:`)
      console.log(`   Average Peak Memory: ${avgPeakMemory.toFixed(1)} MB`)
      console.log(`   Memory Efficiency: ${avgMemoryEfficiency.toFixed(3)} MB/s per MB memory`)
    }
    
  } catch (error) {
    console.error('❌ Memory demo failed:', error)
  }
}

/**
 * Example 5: Performance Comparison
 * Compare multiple benchmark results
 */
export async function runComparisonDemo(): Promise<void> {
  console.log('🎯 DEMO: Performance Comparison')
  console.log('===============================')
  
  console.log('Running baseline test...')
  const baselineReport = await BenchmarkUtils.runQuickBenchmark()
  
  // Simulate optimized scenario (in real scenario, this would be after optimizations)
  console.log('Running optimized test...')
  const optimizedReport = await BenchmarkUtils.runQuickBenchmark()
  
  // Compare results
  const baselineAvg = baselineReport.summary.averageMetrics.uploadThroughputMBps
  const optimizedAvg = optimizedReport.summary.averageMetrics.uploadThroughputMBps
  const improvement = ((optimizedAvg - baselineAvg) / baselineAvg) * 100
  
  console.log(`\n🔄 COMPARISON RESULTS:`)
  console.log(`   Baseline Throughput: ${baselineAvg.toFixed(2)} MB/s`)
  console.log(`   Optimized Throughput: ${optimizedAvg.toFixed(2)} MB/s`)
  console.log(`   Performance Change: ${improvement.toFixed(1)}%`)
}

/**
 * Run all demos in sequence
 */
export async function runAllDemos(): Promise<void> {
  console.log('🚀 RUNNING ALL BENCHMARK DEMOS')
  console.log('===============================\n')
  
  // Run demos with delays to prevent overlap
  await runQuickDemo()
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  await runMemoryDemo()
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  await runCustomDemo()
  
  console.log('\n✅ All demos completed!')
}

/**
 * Browser-safe demo runner (avoids long-running XLIFF demo)
 */
export async function runBrowserSafeDemos(): Promise<void> {
  console.log('🌐 BROWSER-SAFE DEMOS')
  console.log('=====================\n')
  
  await runQuickDemo()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await runCustomDemo()
  
  console.log('\n✅ Browser-safe demos completed!')
}

// Export for use in other parts of the application
export const DEMO_FUNCTIONS = {
  quick: runQuickDemo,
  xliff: runXLIFFDemo,
  custom: runCustomDemo,
  memory: runMemoryDemo,
  comparison: runComparisonDemo,
  all: runAllDemos,
  browserSafe: runBrowserSafeDemos
} 