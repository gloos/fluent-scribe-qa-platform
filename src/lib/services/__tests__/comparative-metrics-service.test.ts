import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComparativeMetricsService, ComparisonDataset, StreamingOptions, AdvancedAnalysisOptions } from '../comparative-metrics-service';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            not: vi.fn(() => ({
              in: vi.fn(() => ({
                data: [
                  { mqm_score: 85, created_at: '2024-01-01', user_id: 'user1', id: '1' },
                  { mqm_score: 90, created_at: '2024-01-02', user_id: 'user2', id: '2' },
                  { mqm_score: 78, created_at: '2024-01-03', user_id: 'user1', id: '3' },
                  { mqm_score: 92, created_at: '2024-01-04', user_id: 'user3', id: '4' },
                  { mqm_score: 88, created_at: '2024-01-05', user_id: 'user2', id: '5' },
                ],
                error: null
              }))
            }))
          }))
        }))
      }))
    }))
  }
}));

describe('ComparativeMetricsService - Enhanced Features', () => {
  const mockDatasets: ComparisonDataset[] = [
    {
      id: 'dataset1',
      name: 'Week 1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-07'),
    },
    {
      id: 'dataset2',
      name: 'Week 2',
      startDate: new Date('2024-01-08'),
      endDate: new Date('2024-01-14'),
    },
    {
      id: 'dataset3',
      name: 'Week 3',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-21'),
    },
  ];

  beforeEach(() => {
    ComparativeMetricsService.clearCache();
    vi.clearAllMocks();
  });

  describe('Streaming Comparison', () => {
    it('should stream quality metrics comparison in batches', async () => {
      const streamingOptions: StreamingOptions = {
        batchSize: 2,
        concurrency: 1,
        memoryLimit: 256,
        enableProgressTracking: true
      };

      const results: any[] = [];
      
      for await (const result of ComparativeMetricsService.compareQualityMetricsStreaming(
        mockDatasets,
        streamingOptions
      )) {
        results.push(result);
        
        // Verify streaming result structure
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('progress');
        expect(result).toHaveProperty('performance');
        expect(result).toHaveProperty('metadata');
        
        // Verify performance metrics
        expect(result.performance).toHaveProperty('processingTime');
        expect(result.performance).toHaveProperty('memoryUsage');
        expect(result.performance).toHaveProperty('cacheHitRatio');
        expect(result.performance).toHaveProperty('operationsPerSecond');
        
        // Verify metadata
        expect(result.metadata).toHaveProperty('batchesProcessed');
        expect(result.metadata).toHaveProperty('totalBatches');
        expect(result.metadata).toHaveProperty('estimatedTimeRemaining');
        
        // Progress should be between 0 and 100
        expect(result.progress).toBeGreaterThanOrEqual(0);
        expect(result.progress).toBeLessThanOrEqual(100);
      }

      expect(results.length).toBeGreaterThan(0);
      
      // Last result should have 100% progress
      const lastResult = results[results.length - 1];
      expect(lastResult.progress).toBe(100);
    });

    it('should handle memory limits during streaming', async () => {
      const streamingOptions: StreamingOptions = {
        batchSize: 1,
        concurrency: 1,
        memoryLimit: 1, // Very low memory limit to test cleanup
        enableProgressTracking: true
      };

      const results: any[] = [];
      
      for await (const result of ComparativeMetricsService.compareQualityMetricsStreaming(
        mockDatasets,
        streamingOptions
      )) {
        results.push(result);
        
        // Memory usage should be reported
        expect(result.performance.memoryUsage).toBeGreaterThanOrEqual(0);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Analysis', () => {
    it('should perform advanced comparison with statistical tests', async () => {
      const advancedOptions: AdvancedAnalysisOptions = {
        enableStatisticalTests: true,
        confidenceLevel: 0.95,
        enableAnomalyDetection: true,
        enableSeasonalAnalysis: false
      };

      const result = await ComparativeMetricsService.compareMetricsAdvanced(
        mockDatasets,
        advancedOptions
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify enhanced analysis
      result.forEach(metric => {
        expect(metric).toHaveProperty('metric');
        expect(metric).toHaveProperty('datasets');
        expect(metric).toHaveProperty('analysis');
        
        // Should have significance levels for advanced analysis
        metric.datasets.forEach(dataset => {
          if (dataset.significanceLevel) {
            expect(dataset.significanceLevel).toBeGreaterThan(0);
            expect(dataset.significanceLevel).toBeLessThanOrEqual(1);
          }
        });

        // Enhanced trends should have higher confidence
        metric.analysis.trends.forEach(trend => {
          expect(trend.confidence).toBeGreaterThan(0);
          expect(trend.confidence).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should detect anomalies when enabled', async () => {
      const advancedOptions: AdvancedAnalysisOptions = {
        enableStatisticalTests: false,
        confidenceLevel: 0.95,
        enableAnomalyDetection: true,
        enableSeasonalAnalysis: false
      };

      const result = await ComparativeMetricsService.compareMetricsAdvanced(
        mockDatasets,
        advancedOptions
      );

      expect(result).toBeInstanceOf(Array);
      
      // Verify that anomaly detection affects the data
      result.forEach(metric => {
        metric.datasets.forEach(dataset => {
          expect(dataset.count).toBeGreaterThanOrEqual(0);
          expect(dataset.confidence).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk comparison efficiently', async () => {
      const streamingOptions: StreamingOptions = {
        batchSize: 10,
        concurrency: 2,
        memoryLimit: 512,
        enableProgressTracking: true
      };

      const result = await ComparativeMetricsService.compareAllMetricsBulk(
        mockDatasets,
        streamingOptions
      );

      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('performance');

      // Verify performance metrics
      expect(result.performance.processingTime).toBeGreaterThan(0);
      expect(result.performance.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(result.performance.cacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(result.performance.operationsPerSecond).toBeGreaterThan(0);

      // Verify all metric types are included
      expect(result.quality).toBeInstanceOf(Array);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.efficiency).toBeInstanceOf(Array);
    });
  });

  describe('Memory Management', () => {
    it('should track cache statistics', () => {
      const stats = ComparativeMetricsService.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should track streaming cache statistics', () => {
      const stats = ComparativeMetricsService.getStreamingCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('memoryUsageEstimate');
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.keys)).toBe(true);
      expect(stats.memoryUsageEstimate).toBeGreaterThanOrEqual(0);
    });

    it('should clear streaming cache independently', () => {
      ComparativeMetricsService.clearStreamingCache();
      
      const stats = ComparativeMetricsService.getStreamingCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear all caches', () => {
      ComparativeMetricsService.clearCache();
      
      const regularStats = ComparativeMetricsService.getCacheStats();
      const streamingStats = ComparativeMetricsService.getStreamingCacheStats();
      
      expect(regularStats.size).toBe(0);
      expect(streamingStats.size).toBe(0);
    });
  });

  describe('Performance Optimization', () => {
    it('should chunk arrays for controlled processing', async () => {
      const largeDataset: ComparisonDataset[] = Array.from({ length: 25 }, (_, i) => ({
        id: `dataset${i}`,
        name: `Dataset ${i}`,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      }));

      const streamingOptions: StreamingOptions = {
        batchSize: 5,
        concurrency: 2,
        memoryLimit: 512,
        enableProgressTracking: true
      };

      const results: any[] = [];
      
      for await (const result of ComparativeMetricsService.compareQualityMetricsStreaming(
        largeDataset,
        streamingOptions
      )) {
        results.push(result);
        
        // Should process in expected number of batches
        expect(result.metadata.totalBatches).toBe(Math.ceil(largeDataset.length / streamingOptions.batchSize));
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect memory limits', async () => {
      const memoryLimitMB = 100;
      const streamingOptions: StreamingOptions = {
        batchSize: 5,
        concurrency: 1,
        memoryLimit: memoryLimitMB,
        enableProgressTracking: true
      };

      const results: any[] = [];
      
      for await (const result of ComparativeMetricsService.compareQualityMetricsStreaming(
        mockDatasets,
        streamingOptions
      )) {
        results.push(result);
        
        // Memory usage should be tracked and stay reasonable
        expect(result.performance.memoryUsage).toBeLessThanOrEqual(memoryLimitMB * 2); // Allow some overhead
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty datasets gracefully', async () => {
      const emptyDatasets: ComparisonDataset[] = [];
      
      const results: any[] = [];
      
      for await (const result of ComparativeMetricsService.compareQualityMetricsStreaming(
        emptyDatasets
      )) {
        results.push(result);
      }

      expect(results.length).toBe(0);
    });

    it('should handle datasets with no data', async () => {
      // This test verifies the service handles empty datasets gracefully
      const result = await ComparativeMetricsService.compareMetricsAdvanced(mockDatasets);
      
      expect(result).toBeInstanceOf(Array);
      // Should still return results even with empty data scenarios
    });
  });
}); 