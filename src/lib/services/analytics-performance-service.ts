import { analyticsAggregationService } from './analytics-aggregation-service';

export interface PerformanceMetrics {
  renderTime: number;
  dataProcessingTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  componentCount: number;
  dataPointCount: number;
  optimizationLevel: 'none' | 'basic' | 'advanced' | 'extreme';
  bottlenecks: PerformanceBottleneck[];
}

export interface PerformanceBottleneck {
  type: 'rendering' | 'data-processing' | 'memory' | 'cache' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  impact: number; // 1-10 scale
}

export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  applicableWhen: (metrics: PerformanceMetrics) => boolean;
  apply: () => Promise<void>;
  rollback: () => Promise<void>;
  expectedImprovement: number; // percentage
}

export interface DatasetComplexity {
  size: 'small' | 'medium' | 'large' | 'massive';
  dimensionality: 'low' | 'medium' | 'high' | 'very-high';
  temporality: 'static' | 'slow-changing' | 'real-time';
  volatility: 'stable' | 'moderate' | 'high' | 'extreme';
  complexity: number; // 1-10 scale
  recommendedOptimizations: string[];
}

export interface VirtualizationConfig {
  enabled: boolean;
  chunkSize: number;
  renderAhead: number;
  recycleThreshold: number;
  enableInfiniteScroll: boolean;
}

export interface CacheStrategy {
  type: 'lru' | 'lfu' | 'ttl' | 'adaptive';
  maxSize: number;
  ttl: number;
  compressionEnabled: boolean;
  prefetchEnabled: boolean;
  intelligentEviction: boolean;
}

class AnalyticsPerformanceService {
  private performanceObserver: PerformanceObserver | null = null;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private optimizations: Map<string, OptimizationStrategy> = new Map();
  private readonly MAX_DATA_POINTS = 10000;
  private readonly PERFORMANCE_BUDGET = 16; // 60fps = 16ms per frame
  
  constructor() {
    this.initializeOptimizationStrategies();
    this.setupPerformanceObserver();
  }

  /**
   * Analyze dataset complexity and recommend optimization strategies
   */
  analyzeDatasetComplexity(data: any[]): DatasetComplexity {
    const size = this.calculateDataSize(data);
    const dimensionality = this.calculateDimensionality(data);
    const temporality = this.calculateTemporality(data);
    const volatility = this.calculateVolatility(data);
    
    const complexity = this.calculateOverallComplexity(size, dimensionality, temporality, volatility);
    const recommendedOptimizations = this.getRecommendedOptimizations(complexity);

    return {
      size,
      dimensionality,
      temporality,
      volatility,
      complexity,
      recommendedOptimizations
    };
  }

  /**
   * Measure and track component performance
   */
  async measureComponentPerformance<T>(
    componentName: string,
    operation: () => Promise<T> | T,
    dataSize: number = 0
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const startMemory = this.estimateMemoryUsage();

    let result: T;
    try {
      result = await operation();
    } catch (error) {
      throw error;
    }

    const endTime = performance.now();
    const endMemory = this.estimateMemoryUsage();

    const metrics: PerformanceMetrics = {
      renderTime: endTime - startTime,
      dataProcessingTime: endTime - startTime, // Simplified for this calculation
      memoryUsage: endMemory - startMemory,
      cacheHitRate: this.getCacheHitRate(),
      componentCount: 1,
      dataPointCount: dataSize,
      optimizationLevel: this.determineOptimizationLevel(endTime - startTime, dataSize),
      bottlenecks: this.identifyBottlenecks(endTime - startTime, endMemory - startMemory, dataSize)
    };

    this.metrics.set(componentName, metrics);
    return { result, metrics };
  }

  /**
   * Get optimization recommendations based on current performance
   */
  getOptimizationRecommendations(componentName: string): string[] {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return [];

    const recommendations: string[] = [];

    // Render time optimization
    if (metrics.renderTime > this.PERFORMANCE_BUDGET * 2) {
      recommendations.push('Consider implementing virtualization for large datasets');
      recommendations.push('Enable component memoization with React.memo');
      recommendations.push('Implement data sampling for initial render');
    }

    // Memory optimization
    if (metrics.memoryUsage > 50) { // MB
      recommendations.push('Implement data chunking and lazy loading');
      recommendations.push('Enable garbage collection hints');
      recommendations.push('Use more efficient data structures');
    }

    // Data processing optimization
    if (metrics.dataPointCount > this.MAX_DATA_POINTS) {
      recommendations.push('Implement data aggregation and downsampling');
      recommendations.push('Use web workers for heavy computations');
      recommendations.push('Enable progressive data loading');
    }

    // Cache optimization
    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Improve cache strategies and prefetching');
      recommendations.push('Implement intelligent cache warming');
      recommendations.push('Use compression for cached data');
    }

    return recommendations;
  }

  /**
   * Apply automatic optimizations based on dataset complexity
   */
  async applyOptimizations(
    componentName: string,
    complexity: DatasetComplexity
  ): Promise<void> {
    const strategies = this.selectOptimizationStrategies(complexity);
    
    for (const strategy of strategies) {
      try {
        await strategy.apply();
        console.log(`Applied optimization: ${strategy.name}`);
      } catch (error) {
        console.error(`Failed to apply optimization ${strategy.name}:`, error);
      }
    }
  }

  /**
   * Create optimized virtualization configuration
   */
  createVirtualizationConfig(dataSize: number): VirtualizationConfig {
    const baseChunkSize = 100;
    let chunkSize = baseChunkSize;
    
    // Adjust chunk size based on data size
    if (dataSize > 10000) chunkSize = 50;
    if (dataSize > 50000) chunkSize = 25;
    if (dataSize > 100000) chunkSize = 10;

    return {
      enabled: dataSize > 1000,
      chunkSize,
      renderAhead: Math.max(2, Math.ceil(chunkSize / 10)),
      recycleThreshold: chunkSize * 5,
      enableInfiniteScroll: dataSize > 5000
    };
  }

  /**
   * Create adaptive cache strategy
   */
  createCacheStrategy(complexity: DatasetComplexity): CacheStrategy {
    const baseConfig: CacheStrategy = {
      type: 'adaptive',
      maxSize: 50, // MB
      ttl: 5 * 60 * 1000, // 5 minutes
      compressionEnabled: false,
      prefetchEnabled: false,
      intelligentEviction: false
    };

    // Adjust based on complexity
    switch (complexity.size) {
      case 'large':
      case 'massive':
        return {
          ...baseConfig,
          type: 'lru',
          maxSize: 100,
          compressionEnabled: true,
          prefetchEnabled: true,
          intelligentEviction: true
        };
      
      case 'medium':
        return {
          ...baseConfig,
          maxSize: 75,
          prefetchEnabled: true
        };
        
      default:
        return baseConfig;
    }
  }

  /**
   * Optimize data for rendering based on screen size and viewport
   */
  optimizeDataForViewport(
    data: any[],
    viewportWidth: number,
    chartType: 'line' | 'bar' | 'pie' | 'scatter'
  ): any[] {
    const maxDataPoints = this.calculateMaxDataPoints(viewportWidth, chartType);
    
    if (data.length <= maxDataPoints) {
      return data;
    }

    // Apply different optimization strategies based on chart type
    switch (chartType) {
      case 'line':
        return this.downsampleTimeSeriesData(data, maxDataPoints);
      
      case 'bar':
        return this.aggregateBarData(data, maxDataPoints);
      
      case 'pie':
        return this.consolidatePieData(data, maxDataPoints);
      
      case 'scatter':
        return this.sampleScatterData(data, maxDataPoints);
      
      default:
        return data.slice(0, maxDataPoints);
    }
  }

  /**
   * Monitor performance degradation and auto-optimize
   */
  startPerformanceMonitoring(componentName: string): () => void {
    const interval = setInterval(() => {
      const metrics = this.metrics.get(componentName);
      if (!metrics) return;

      // Check for performance degradation
      if (metrics.renderTime > this.PERFORMANCE_BUDGET * 3) {
        console.warn(`Performance degradation detected in ${componentName}`);
        this.autoOptimize(componentName);
      }
    }, 5000);

    return () => clearInterval(interval);
  }

  // Private helper methods
  private initializeOptimizationStrategies(): void {
    const strategies: OptimizationStrategy[] = [
      {
        id: 'data-virtualization',
        name: 'Data Virtualization',
        description: 'Implement virtual scrolling for large datasets',
        applicableWhen: (metrics) => metrics.dataPointCount > 1000,
        apply: async () => {
          // Enable virtualization in components
        },
        rollback: async () => {
          // Disable virtualization
        },
        expectedImprovement: 60
      },
      {
        id: 'memoization',
        name: 'Component Memoization',
        description: 'Apply React.memo and useMemo optimizations',
        applicableWhen: (metrics) => metrics.renderTime > this.PERFORMANCE_BUDGET,
        apply: async () => {
          // Apply memoization patterns
        },
        rollback: async () => {
          // Remove memoization
        },
        expectedImprovement: 30
      },
      {
        id: 'data-sampling',
        name: 'Intelligent Data Sampling',
        description: 'Sample data points while preserving trends',
        applicableWhen: (metrics) => metrics.dataPointCount > 5000,
        apply: async () => {
          // Implement data sampling
        },
        rollback: async () => {
          // Restore full dataset
        },
        expectedImprovement: 50
      }
    ];

    strategies.forEach(strategy => {
      this.optimizations.set(strategy.id, strategy);
    });
  }

  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            // Process performance entries
          }
        }
      });

      this.performanceObserver.observe({ 
        entryTypes: ['measure', 'navigation', 'resource'] 
      });
    }
  }

  private calculateDataSize(data: any[]): DatasetComplexity['size'] {
    const size = data.length;
    if (size < 1000) return 'small';
    if (size < 10000) return 'medium';
    if (size < 100000) return 'large';
    return 'massive';
  }

  private calculateDimensionality(data: any[]): DatasetComplexity['dimensionality'] {
    if (data.length === 0) return 'low';
    
    const sampleItem = data[0];
    const dimensions = Object.keys(sampleItem).length;
    
    if (dimensions <= 5) return 'low';
    if (dimensions <= 15) return 'medium';
    if (dimensions <= 30) return 'high';
    return 'very-high';
  }

  private calculateTemporality(data: any[]): DatasetComplexity['temporality'] {
    // Simplified: check if data has timestamp fields
    if (data.some(item => item.timestamp || item.date || item.time)) {
      return 'real-time';
    }
    return 'static';
  }

  private calculateVolatility(data: any[]): DatasetComplexity['volatility'] {
    // Simplified volatility calculation
    // In a real implementation, this would analyze data variance
    return 'moderate';
  }

  private calculateOverallComplexity(
    size: DatasetComplexity['size'],
    dimensionality: DatasetComplexity['dimensionality'],
    temporality: DatasetComplexity['temporality'],
    volatility: DatasetComplexity['volatility']
  ): number {
    const sizeScore = { small: 1, medium: 3, large: 7, massive: 10 }[size];
    const dimScore = { low: 1, medium: 3, high: 7, 'very-high': 10 }[dimensionality];
    const tempScore = { static: 1, 'slow-changing': 3, 'real-time': 8 }[temporality];
    const volScore = { stable: 1, moderate: 3, high: 7, extreme: 10 }[volatility];

    return Math.round((sizeScore + dimScore + tempScore + volScore) / 4);
  }

  private getRecommendedOptimizations(complexity: number): string[] {
    const recommendations: string[] = [];

    if (complexity >= 8) {
      recommendations.push('extreme-virtualization');
      recommendations.push('data-compression');
      recommendations.push('worker-threads');
      recommendations.push('progressive-loading');
    } else if (complexity >= 6) {
      recommendations.push('virtualization');
      recommendations.push('memoization');
      recommendations.push('data-sampling');
    } else if (complexity >= 4) {
      recommendations.push('basic-memoization');
      recommendations.push('cache-optimization');
    }

    return recommendations;
  }

  private estimateMemoryUsage(): number {
    // Simplified memory estimation
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private getCacheHitRate(): number {
    const stats = analyticsAggregationService.getCacheStats();
    return stats.size > 0 ? 0.8 : 0; // Simplified
  }

  private determineOptimizationLevel(
    renderTime: number,
    dataSize: number
  ): PerformanceMetrics['optimizationLevel'] {
    if (renderTime < this.PERFORMANCE_BUDGET && dataSize < 1000) return 'none';
    if (renderTime < this.PERFORMANCE_BUDGET * 2 && dataSize < 5000) return 'basic';
    if (renderTime < this.PERFORMANCE_BUDGET * 4 && dataSize < 20000) return 'advanced';
    return 'extreme';
  }

  private identifyBottlenecks(
    renderTime: number,
    memoryDelta: number,
    dataSize: number
  ): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    if (renderTime > this.PERFORMANCE_BUDGET * 2) {
      bottlenecks.push({
        type: 'rendering',
        severity: renderTime > this.PERFORMANCE_BUDGET * 4 ? 'critical' : 'high',
        description: `Render time ${renderTime.toFixed(2)}ms exceeds budget`,
        recommendation: 'Implement virtualization or reduce complexity',
        impact: Math.min(10, Math.floor(renderTime / this.PERFORMANCE_BUDGET))
      });
    }

    if (memoryDelta > 20) {
      bottlenecks.push({
        type: 'memory',
        severity: memoryDelta > 50 ? 'critical' : 'medium',
        description: `Memory usage increased by ${memoryDelta.toFixed(2)}MB`,
        recommendation: 'Implement data chunking and garbage collection',
        impact: Math.min(10, Math.floor(memoryDelta / 10))
      });
    }

    if (dataSize > this.MAX_DATA_POINTS) {
      bottlenecks.push({
        type: 'data-processing',
        severity: 'high',
        description: `Dataset size ${dataSize} exceeds recommended limit`,
        recommendation: 'Implement data sampling and pagination',
        impact: Math.min(10, Math.floor(dataSize / this.MAX_DATA_POINTS))
      });
    }

    return bottlenecks;
  }

  private selectOptimizationStrategies(
    complexity: DatasetComplexity
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    
    for (const [, strategy] of this.optimizations) {
      const mockMetrics: PerformanceMetrics = {
        renderTime: 100,
        dataProcessingTime: 100,
        memoryUsage: 30,
        cacheHitRate: 0.5,
        componentCount: 1,
        dataPointCount: complexity.size === 'massive' ? 100000 : 
                       complexity.size === 'large' ? 10000 : 1000,
        optimizationLevel: 'none',
        bottlenecks: []
      };

      if (strategy.applicableWhen(mockMetrics)) {
        strategies.push(strategy);
      }
    }

    return strategies.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
  }

  private calculateMaxDataPoints(
    viewportWidth: number,
    chartType: string
  ): number {
    const basePoints = Math.floor(viewportWidth / 2); // 2 pixels per point minimum
    
    switch (chartType) {
      case 'line':
        return Math.max(basePoints, 500);
      case 'bar':
        return Math.max(Math.floor(basePoints / 3), 50);
      case 'pie':
        return Math.max(20, Math.floor(basePoints / 10));
      case 'scatter':
        return Math.max(basePoints * 2, 1000);
      default:
        return basePoints;
    }
  }

  private downsampleTimeSeriesData(data: any[], maxPoints: number): any[] {
    if (data.length <= maxPoints) return data;
    
    const step = data.length / maxPoints;
    const downsampled: any[] = [];
    
    for (let i = 0; i < data.length; i += step) {
      const index = Math.floor(i);
      if (index < data.length) {
        downsampled.push(data[index]);
      }
    }
    
    return downsampled;
  }

  private aggregateBarData(data: any[], maxPoints: number): any[] {
    if (data.length <= maxPoints) return data;
    
    const chunkSize = Math.ceil(data.length / maxPoints);
    const aggregated: any[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const aggregatedItem = this.aggregateDataChunk(chunk);
      aggregated.push(aggregatedItem);
    }
    
    return aggregated;
  }

  private consolidatePieData(data: any[], maxPoints: number): any[] {
    if (data.length <= maxPoints) return data;
    
    const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
    const topItems = sorted.slice(0, maxPoints - 1);
    const others = sorted.slice(maxPoints - 1);
    
    if (others.length > 0) {
      const othersSum = others.reduce((sum, item) => sum + (item.value || 0), 0);
      topItems.push({
        ...others[0],
        label: 'Others',
        value: othersSum,
        count: others.length
      });
    }
    
    return topItems;
  }

  private sampleScatterData(data: any[], maxPoints: number): any[] {
    if (data.length <= maxPoints) return data;
    
    // Simple random sampling - could be improved with stratified sampling
    const sampled: any[] = [];
    const indices = new Set<number>();
    
    while (indices.size < maxPoints) {
      indices.add(Math.floor(Math.random() * data.length));
    }
    
    for (const index of indices) {
      sampled.push(data[index]);
    }
    
    return sampled.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  private aggregateDataChunk(chunk: any[]): any {
    const aggregated = { ...chunk[0] };
    
    // Aggregate numeric values
    Object.keys(aggregated).forEach(key => {
      if (typeof aggregated[key] === 'number') {
        aggregated[key] = chunk.reduce((sum, item) => sum + (item[key] || 0), 0) / chunk.length;
      }
    });
    
    return aggregated;
  }

  private async autoOptimize(componentName: string): Promise<void> {
    const metrics = this.metrics.get(componentName);
    if (!metrics) return;

    // Apply automatic optimizations based on current performance
    for (const [, strategy] of this.optimizations) {
      if (strategy.applicableWhen(metrics)) {
        try {
          await strategy.apply();
          console.log(`Auto-applied optimization: ${strategy.name}`);
          break; // Apply one optimization at a time
        } catch (error) {
          console.error(`Failed to auto-apply optimization ${strategy.name}:`, error);
        }
      }
    }
  }
}

export const analyticsPerformanceService = new AnalyticsPerformanceService(); 