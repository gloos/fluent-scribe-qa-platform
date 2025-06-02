import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsAggregationService } from '@/lib/services/analytics-aggregation-service';
import { TrendAnalysisService } from '@/lib/services/trend-analysis-service';
import { ComparativeMetricsService } from '@/lib/services/comparative-metrics-service';

export interface PerformanceMetrics {
  loadTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  operationsPerSecond: number;
  errorRate: number;
  lastUpdate: Date;
}

export interface UseAnalyticsPerformanceOptions {
  enablePerformanceTracking?: boolean;
  maxCacheSize?: number;
  throttleMs?: number;
  enableLazyLoading?: boolean;
  enablePrefetching?: boolean;
}

export interface AnalyticsPerformanceState {
  isLoading: boolean;
  performance: PerformanceMetrics;
  cacheStats: {
    size: number;
    hitRate: number;
    missRate: number;
  };
  recommendations: string[];
  optimizationApplied: boolean;
}

export function useAnalyticsPerformance(
  options: UseAnalyticsPerformanceOptions = {}
) {
  const {
    enablePerformanceTracking = true,
    maxCacheSize = 100,
    throttleMs = 1000,
    enableLazyLoading = true,
    enablePrefetching = false
  } = options;

  const [state, setState] = useState<AnalyticsPerformanceState>({
    isLoading: false,
    performance: {
      loadTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
      errorRate: 0,
      lastUpdate: new Date()
    },
    cacheStats: {
      size: 0,
      hitRate: 0,
      missRate: 0
    },
    recommendations: [],
    optimizationApplied: false
  });

  // Performance tracking refs
  const operationCount = useRef(0);
  const errorCount = useRef(0);
  const startTime = useRef(Date.now());
  const lastThrottleTime = useRef(0);
  const loadTimeRef = useRef<number[]>([]);

  // Throttle function for performance optimization
  const throttle = useCallback((func: Function, delay: number) => {
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastThrottleTime.current >= delay) {
        lastThrottleTime.current = now;
        return func(...args);
      }
    };
  }, []);

  // Performance measurement wrapper
  const measurePerformance = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    if (!enablePerformanceTracking) {
      return operation();
    }

    const startTime = performance.now();
    operationCount.current++;

    try {
      const result = await operation();
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      loadTimeRef.current.push(loadTime);
      
      // Keep only last 100 measurements
      if (loadTimeRef.current.length > 100) {
        loadTimeRef.current = loadTimeRef.current.slice(-100);
      }

      updatePerformanceMetrics();
      return result;
    } catch (error) {
      errorCount.current++;
      updatePerformanceMetrics();
      throw error;
    }
  }, [enablePerformanceTracking]);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback(() => {
    const now = Date.now();
    const timeElapsed = (now - startTime.current) / 1000; // seconds
    const avgLoadTime = loadTimeRef.current.length > 0 
      ? loadTimeRef.current.reduce((sum, time) => sum + time, 0) / loadTimeRef.current.length
      : 0;

    // Get cache statistics
    const aggregationStats = analyticsAggregationService.getCacheStats();
    const trendStats = TrendAnalysisService.getCacheStats();
    const comparisonStats = ComparativeMetricsService.getCacheStats();
    
    const totalCacheSize = aggregationStats.size + trendStats.size + comparisonStats.size;
    const cacheHitRate = operationCount.current > 0 ? (totalCacheSize / operationCount.current) * 100 : 0;

    // Estimate memory usage (rough approximation)
    const memoryUsage = Math.min(100, (totalCacheSize / maxCacheSize) * 100);

    // Generate recommendations
    const recommendations = generateOptimizationRecommendations({
      loadTime: avgLoadTime,
      cacheHitRate,
      memoryUsage,
      errorRate: (errorCount.current / Math.max(1, operationCount.current)) * 100
    });

    setState(prev => ({
      ...prev,
      performance: {
        loadTime: avgLoadTime,
        cacheHitRate,
        memoryUsage,
        operationsPerSecond: timeElapsed > 0 ? operationCount.current / timeElapsed : 0,
        errorRate: (errorCount.current / Math.max(1, operationCount.current)) * 100,
        lastUpdate: new Date()
      },
      cacheStats: {
        size: totalCacheSize,
        hitRate: cacheHitRate,
        missRate: 100 - cacheHitRate
      },
      recommendations
    }));
  }, [maxCacheSize]);

  // Generate optimization recommendations
  const generateOptimizationRecommendations = useCallback((metrics: {
    loadTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    errorRate: number;
  }): string[] => {
    const recommendations: string[] = [];

    if (metrics.loadTime > 2000) {
      recommendations.push('Consider enabling data pagination or reducing query complexity');
    }

    if (metrics.cacheHitRate < 30) {
      recommendations.push('Low cache hit rate - consider increasing cache TTL or implementing prefetching');
    }

    if (metrics.memoryUsage > 80) {
      recommendations.push('High memory usage - consider reducing cache size or implementing cache eviction');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected - check network connectivity and API health');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no optimizations needed');
    }

    return recommendations;
  }, []);

  // Lazy loading wrapper
  const lazyLoad = useCallback(async <T>(
    loader: () => Promise<T>,
    condition: boolean = true
  ): Promise<T | null> => {
    if (!enableLazyLoading || !condition) {
      return null;
    }

    return measurePerformance(loader, 'lazy-load');
  }, [enableLazyLoading, measurePerformance]);

  // Prefetch data
  const prefetch = useCallback(async (
    prefetchOperations: (() => Promise<any>)[]
  ) => {
    if (!enablePrefetching) return;

    // Run prefetch operations in background without blocking UI
    Promise.all(
      prefetchOperations.map(operation => 
        measurePerformance(operation, 'prefetch').catch(console.warn)
      )
    );
  }, [enablePrefetching, measurePerformance]);

  // Optimize cache settings
  const optimizeCache = useCallback(() => {
    const { cacheHitRate, memoryUsage } = state.performance;

    // Clear cache if memory usage is too high
    if (memoryUsage > 90) {
      analyticsAggregationService.clearCache();
      TrendAnalysisService.clearCache();
      ComparativeMetricsService.clearCache();
    }

    // Optimize cache based on hit rate
    if (cacheHitRate < 20) {
      // Increase cache TTL or implement smarter caching
      console.log('Consider implementing smarter caching strategies');
    }

    setState(prev => ({ ...prev, optimizationApplied: true }));
    
    setTimeout(() => {
      setState(prev => ({ ...prev, optimizationApplied: false }));
    }, 2000);
  }, [state.performance]);

  // Throttled version of performance update
  const throttledUpdatePerformance = useCallback(
    throttle(updatePerformanceMetrics, throttleMs),
    [updatePerformanceMetrics, throttleMs, throttle]
  );

  // Initialize performance tracking
  useEffect(() => {
    if (enablePerformanceTracking) {
      startTime.current = Date.now();
      updatePerformanceMetrics();
    }
  }, [enablePerformanceTracking, updatePerformanceMetrics]);

  // Periodic performance updates
  useEffect(() => {
    if (!enablePerformanceTracking) return;

    const interval = setInterval(() => {
      throttledUpdatePerformance();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [enablePerformanceTracking, throttledUpdatePerformance]);

  // Monitor for performance degradation
  useEffect(() => {
    const { loadTime, errorRate } = state.performance;
    
    if (loadTime > 5000 || errorRate > 10) {
      console.warn('Performance degradation detected:', {
        loadTime,
        errorRate,
        recommendations: state.recommendations
      });
    }
  }, [state.performance, state.recommendations]);

  // Public API
  return {
    ...state,
    
    // Performance measurement
    measurePerformance,
    
    // Lazy loading
    lazyLoad,
    
    // Prefetching
    prefetch,
    
    // Cache optimization
    optimizeCache,
    clearAllCaches: () => {
      analyticsAggregationService.clearCache();
      TrendAnalysisService.clearCache();
      ComparativeMetricsService.clearCache();
    },
    
    // Manual performance update
    updatePerformance: updatePerformanceMetrics,
    
    // Reset performance tracking
    resetPerformance: () => {
      operationCount.current = 0;
      errorCount.current = 0;
      startTime.current = Date.now();
      loadTimeRef.current = [];
      updatePerformanceMetrics();
    }
  };
}

// Helper hook for component-level performance tracking
export function useComponentPerformance(componentName: string) {
  const [renderTime, setRenderTime] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const renderStartTime = useRef<number>();

  useEffect(() => {
    renderStartTime.current = performance.now();
    setRenderCount(prev => prev + 1);
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const endTime = performance.now();
      const time = endTime - renderStartTime.current;
      setRenderTime(time);
      
      // Log slow renders
      if (time > 16) { // More than one frame at 60fps
        console.warn(`Slow render in ${componentName}: ${time.toFixed(2)}ms`);
      }
    }
  });

  return {
    renderTime,
    renderCount,
    isSlowRender: renderTime > 16
  };
} 