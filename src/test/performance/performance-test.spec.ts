import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceTestRunner, performanceTestConfigs } from './performance-test-setup';

describe('Performance Testing Framework', () => {
  let runner: PerformanceTestRunner;

  beforeAll(async () => {
    runner = new PerformanceTestRunner();
    await runner.initialize();
  });

  afterAll(async () => {
    if (runner) {
      await runner.cleanup();
    }
  });

  it('should initialize performance test runner', () => {
    expect(runner).toBeDefined();
  });

  it('should have predefined test configurations', () => {
    expect(performanceTestConfigs).toBeDefined();
    expect(performanceTestConfigs.apiEndpoints).toBeDefined();
    expect(performanceTestConfigs.databaseLoad).toBeDefined();
    expect(performanceTestConfigs.fullSystem).toBeDefined();
  });

  it('should validate performance test configurations', () => {
    const config = performanceTestConfigs.apiEndpoints;
    
    expect(config.name).toBe('API Endpoints Load Test');
    expect(config.duration).toBeGreaterThan(0);
    expect(config.concurrency).toBeGreaterThan(0);
    expect(config.thresholds).toBeDefined();
    expect(config.thresholds.responseTimeThreshold).toBeDefined();
    expect(config.thresholds.errorRateThreshold).toBeDefined();
    expect(config.thresholds.throughputMinimum).toBeDefined();
  });

  it('should validate database performance test configuration', () => {
    const config = performanceTestConfigs.databaseLoad;
    
    expect(config.name).toBe('Database Load Test');
    expect(config.jmeterTestPlan).toBeDefined();
    expect(config.jmeterTestPlan).toContain('database-load-test.jmx');
    expect(config.enableDatabaseLoad).toBe(true);
    expect(config.enableMonitoring).toBe(true);
  });

  it('should validate stress test configuration', () => {
    const config = performanceTestConfigs.fullSystem;
    
    expect(config.name).toBe('Full System Stress Test');
    expect(config.duration).toBeGreaterThan(performanceTestConfigs.apiEndpoints.duration);
    expect(config.concurrency).toBeGreaterThan(performanceTestConfigs.apiEndpoints.concurrency);
    expect(config.thresholds.responseTimeThreshold).toBeGreaterThan(
      performanceTestConfigs.apiEndpoints.thresholds.responseTimeThreshold
    );
  });

  it('should create proper test result directories', async () => {
    const testId = `test-${Date.now()}`;
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const testResultsDir = path.join(process.cwd(), 'test-results', 'performance');
    
    try {
      await fs.access(testResultsDir);
      // Directory should exist after runner initialization
      expect(true).toBe(true);
    } catch (error) {
      // Directory should be created during initialization
      expect.fail('Test results directory should be created during initialization');
    }
  });

  // Note: This is a mock test - actual performance tests should be run separately
  // to avoid impacting the unit test suite performance
  it('should be capable of running mock performance test (validation only)', async () => {
    // This test validates the configuration and setup without actually running load tests
    const config = {
      ...performanceTestConfigs.apiEndpoints,
      duration: 1, // Very short duration for testing
      concurrency: 1, // Single connection for testing
      targetEndpoint: 'http://httpbin.org/status/200' // External test endpoint
    };

    // Validate that the configuration is properly structured
    expect(() => {
      if (!config.targetEndpoint && !config.jmeterTestPlan) {
        throw new Error('Either targetEndpoint or jmeterTestPlan must be specified');
      }
    }).not.toThrow();

    expect(config.thresholds).toBeDefined();
    expect(config.name).toBeDefined();
    expect(config.description).toBeDefined();
  });

  it('should validate performance thresholds are reasonable', () => {
    const configs = Object.values(performanceTestConfigs);
    
    configs.forEach(config => {
      // Response time thresholds should be positive and reasonable (< 10 seconds)
      expect(config.thresholds.responseTimeThreshold).toBeGreaterThan(0);
      expect(config.thresholds.responseTimeThreshold).toBeLessThan(10000);
      
      // Error rate should be between 0 and 1 (0% to 100%)
      expect(config.thresholds.errorRateThreshold).toBeGreaterThanOrEqual(0);
      expect(config.thresholds.errorRateThreshold).toBeLessThanOrEqual(1);
      
      // Throughput minimum should be positive
      expect(config.thresholds.throughputMinimum).toBeGreaterThan(0);
      
      // P95 should be greater than average response time threshold
      expect(config.thresholds.p95ResponseTimeThreshold).toBeGreaterThanOrEqual(
        config.thresholds.responseTimeThreshold
      );
      
      // P99 should be greater than P95
      expect(config.thresholds.p99ResponseTimeThreshold).toBeGreaterThanOrEqual(
        config.thresholds.p95ResponseTimeThreshold
      );
    });
  });
}); 