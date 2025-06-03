import { promises as fs } from 'fs';
import { EventEmitter } from 'events';
import path from 'path';
import { ResourceMonitoringService, SystemMetrics } from './resourceMonitoringService';
import { DatabaseMonitoringService, DatabaseMetrics } from './databaseMonitoringService';

export interface LoadTestResult {
  timestamp: number;
  label: string;
  responseCode: string;
  responseMessage: string;
  threadName: string;
  success: boolean;
  failureMessage?: string;
  bytes: number;
  sentBytes: number;
  elapsed: number;
  latency: number;
  connect: number;
  grpThreads: number;
  allThreads: number;
  url?: string;
}

export interface PerformanceMetrics {
  timestamp: number;
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
  errorRate: {
    percentage: number;
    totalErrors: number;
    errorsByType: Record<string, number>;
  };
  concurrency: {
    activeThreads: number;
    maxThreads: number;
    threadUtilization: number;
  };
}

export interface BottleneckAnalysis {
  id: string;
  type: 'database' | 'system' | 'network' | 'application';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number; // 1-10 scale
  description: string;
  recommendations: string[];
  metrics: {
    current: number;
    threshold: number;
    unit: string;
  };
  affectedOperations: string[];
}

export interface PerformanceReport {
  testId: string;
  timestamp: number;
  duration: number;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    maxResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  bottlenecks: BottleneckAnalysis[];
  systemMetrics: SystemMetrics[];
  databaseMetrics: DatabaseMetrics[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  performanceGoals: {
    responseTime: { current: number; target: number; status: 'pass' | 'fail' };
    throughput: { current: number; target: number; status: 'pass' | 'fail' };
    errorRate: { current: number; target: number; status: 'pass' | 'fail' };
  };
}

export interface JTLRecord {
  timeStamp: number;
  elapsed: number;
  label: string;
  responseCode: string;
  responseMessage: string;
  threadName: string;
  dataType: string;
  success: boolean;
  failureMessage: string;
  bytes: number;
  sentBytes: number;
  grpThreads: number;
  allThreads: number;
  url: string;
  latency: number;
  idleTime: number;
  connect: number;
}

export interface OperationMetrics {
  operation: string;
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
  averageBytes: number;
  errors: string[];
}

export interface PerformanceThresholds {
  responseTimeThreshold: number; // ms
  errorRateThreshold: number; // percentage
  throughputMinimum: number; // requests/second
  p95ResponseTimeThreshold: number; // ms
  p99ResponseTimeThreshold: number; // ms
}

export class PerformanceAnalysisService extends EventEmitter {
  private resourceMonitoring: ResourceMonitoringService;
  private databaseMonitoring: DatabaseMonitoringService;
  private loadTestResults: LoadTestResult[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private defaultThresholds: PerformanceThresholds = {
    responseTimeThreshold: 1000, // 1 second
    errorRateThreshold: 1, // 1%
    throughputMinimum: 100, // 100 requests/second
    p95ResponseTimeThreshold: 2000, // 2 seconds
    p99ResponseTimeThreshold: 5000, // 5 seconds
  };
  private thresholds: PerformanceThresholds;

  constructor(
    resourceMonitoring: ResourceMonitoringService,
    databaseMonitoring: DatabaseMonitoringService
  ) {
    super();
    this.resourceMonitoring = resourceMonitoring;
    this.databaseMonitoring = databaseMonitoring;
    this.thresholds = { ...this.defaultThresholds };
  }

  /**
   * Parse JTL (JMeter Test Log) file format
   */
  parseJTLResults(jtlContent: string): LoadTestResult[] {
    const lines = jtlContent.trim().split('\n');
    const results: LoadTestResult[] = [];

    // Skip header line if present
    const dataLines = lines[0].includes('timeStamp') ? lines.slice(1) : lines;

    for (const line of dataLines) {
      if (!line.trim()) continue;

      const fields = line.split(',');
      if (fields.length < 10) continue;

      try {
        const result: LoadTestResult = {
          timestamp: parseInt(fields[0]),
          elapsed: parseInt(fields[1]),
          label: fields[2],
          responseCode: fields[3],
          responseMessage: fields[4],
          threadName: fields[5],
          success: fields[7] === 'true',
          failureMessage: fields[8] || undefined,
          bytes: parseInt(fields[9]) || 0,
          sentBytes: parseInt(fields[10]) || 0,
          grpThreads: parseInt(fields[11]) || 0,
          allThreads: parseInt(fields[12]) || 0,
          url: fields[13] || undefined,
          latency: parseInt(fields[14]) || 0,
          connect: parseInt(fields[16]) || 0,
        };

        results.push(result);
      } catch (error) {
        console.warn(`Failed to parse JTL line: ${line}`, error);
      }
    }

    this.loadTestResults = results;
    return results;
  }

  /**
   * Calculate performance metrics from load test results
   */
  calculatePerformanceMetrics(results: LoadTestResult[]): PerformanceMetrics {
    if (results.length === 0) {
      throw new Error('No load test results to analyze');
    }

    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const responseTimes = successfulResults.map(r => r.elapsed);

    // Calculate response time percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
      return sortedTimes[Math.max(0, index)] || 0;
    };

    // Calculate throughput
    const testDuration = (Math.max(...results.map(r => r.timestamp)) - 
                         Math.min(...results.map(r => r.timestamp))) / 1000; // seconds
    const requestsPerSecond = results.length / testDuration;
    const bytesPerSecond = results.reduce((sum, r) => sum + r.bytes, 0) / testDuration;

    // Calculate error rates by type
    const errorsByType: Record<string, number> = {};
    failedResults.forEach(result => {
      const errorType = result.failureMessage || 'Unknown Error';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    return {
      timestamp: Date.now(),
      responseTime: {
        min: Math.min(...responseTimes) || 0,
        max: Math.max(...responseTimes) || 0,
        avg: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
        p50: getPercentile(50),
        p90: getPercentile(90),
        p95: getPercentile(95),
        p99: getPercentile(99),
      },
      throughput: {
        requestsPerSecond,
        bytesPerSecond,
        totalRequests: results.length,
        successfulRequests: successfulResults.length,
        failedRequests: failedResults.length,
      },
      errorRate: {
        percentage: (failedResults.length / results.length) * 100,
        totalErrors: failedResults.length,
        errorsByType,
      },
      concurrency: {
        activeThreads: Math.max(...results.map(r => r.allThreads)) || 0,
        maxThreads: Math.max(...results.map(r => r.grpThreads)) || 0,
        threadUtilization: 0, // Would need additional data to calculate
      },
    };
  }

  /**
   * Identify performance bottlenecks based on metrics
   */
  identifyBottlenecks(
    performanceMetrics: PerformanceMetrics,
    systemMetrics: SystemMetrics[],
    databaseMetrics: DatabaseMetrics[]
  ): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Check response time bottlenecks
    if (performanceMetrics.responseTime.avg > this.thresholds.responseTimeThreshold) {
      bottlenecks.push({
        id: 'high-response-time',
        type: 'application',
        severity: performanceMetrics.responseTime.avg > this.thresholds.responseTimeThreshold * 2 ? 'critical' : 'high',
        impact: Math.min(10, Math.floor(performanceMetrics.responseTime.avg / this.thresholds.responseTimeThreshold * 5)),
        description: `Average response time (${performanceMetrics.responseTime.avg}ms) exceeds threshold (${this.thresholds.responseTimeThreshold}ms)`,
        recommendations: [
          'Optimize database queries with proper indexing',
          'Implement application-level caching',
          'Review and optimize slow API endpoints',
          'Consider database connection pooling',
        ],
        metrics: {
          current: performanceMetrics.responseTime.avg,
          threshold: this.thresholds.responseTimeThreshold,
          unit: 'ms',
        },
        affectedOperations: this.getSlowOperations(performanceMetrics),
      });
    }

    // Check error rate bottlenecks
    if (performanceMetrics.errorRate.percentage > this.thresholds.errorRateThreshold * 100) {
      bottlenecks.push({
        id: 'high-error-rate',
        type: 'application',
        severity: performanceMetrics.errorRate.percentage > 10 ? 'critical' : 'high',
        impact: Math.min(10, Math.floor(performanceMetrics.errorRate.percentage / 2)),
        description: `Error rate (${performanceMetrics.errorRate.percentage.toFixed(2)}%) exceeds threshold (${(this.thresholds.errorRateThreshold * 100).toFixed(2)}%)`,
        recommendations: [
          'Fix database connection issues',
          'Implement proper error handling and retry logic',
          'Review and fix failing operations',
          'Improve input validation and sanitization',
        ],
        metrics: {
          current: performanceMetrics.errorRate.percentage,
          threshold: this.thresholds.errorRateThreshold * 100,
          unit: '%',
        },
        affectedOperations: Object.keys(performanceMetrics.errorRate.errorsByType),
      });
    }

    // Check throughput bottlenecks
    if (performanceMetrics.throughput.requestsPerSecond < this.thresholds.throughputMinimum) {
      bottlenecks.push({
        id: 'low-throughput',
        type: 'application',
        severity: performanceMetrics.throughput.requestsPerSecond < this.thresholds.throughputMinimum / 2 ? 'critical' : 'medium',
        impact: Math.min(10, Math.floor((this.thresholds.throughputMinimum - performanceMetrics.throughput.requestsPerSecond) / this.thresholds.throughputMinimum * 10)),
        description: `Throughput (${performanceMetrics.throughput.requestsPerSecond.toFixed(2)} req/s) below target (${this.thresholds.throughputMinimum} req/s)`,
        recommendations: [
          'Optimize database queries and add proper indexes',
          'Implement connection pooling and keep-alive',
          'Add application-level caching (Redis/Memcached)',
          'Consider horizontal scaling or load balancing',
        ],
        metrics: {
          current: performanceMetrics.throughput.requestsPerSecond,
          threshold: this.thresholds.throughputMinimum,
          unit: 'req/s',
        },
        affectedOperations: ['All operations'],
      });
    }

    // Analyze system resource bottlenecks
    if (systemMetrics.length > 0) {
      const latestSystemMetrics = systemMetrics[systemMetrics.length - 1];

      // CPU bottleneck
      if (latestSystemMetrics.cpu.usage > 80) {
        bottlenecks.push({
          id: 'high-cpu-usage',
          type: 'system',
          severity: latestSystemMetrics.cpu.usage > 95 ? 'critical' : 'high',
          impact: Math.min(10, Math.floor(latestSystemMetrics.cpu.usage / 10)),
          description: `CPU usage (${latestSystemMetrics.cpu.usage.toFixed(1)}%) exceeds threshold (80%)`,
          recommendations: [
            'Optimize CPU-intensive operations',
            'Implement better algorithm efficiency',
            'Consider horizontal scaling',
            'Profile application for CPU hotspots',
          ],
          metrics: {
            current: latestSystemMetrics.cpu.usage,
            threshold: 80,
            unit: '%',
          },
          affectedOperations: ['All operations'],
        });
      }

      // Memory bottleneck
      if (latestSystemMetrics.memory.usagePercent > 85) {
        bottlenecks.push({
          id: 'high-memory-usage',
          type: 'system',
          severity: latestSystemMetrics.memory.usagePercent > 95 ? 'critical' : 'high',
          impact: Math.min(10, Math.floor(latestSystemMetrics.memory.usagePercent / 10)),
          description: `Memory usage (${latestSystemMetrics.memory.usagePercent.toFixed(1)}%) exceeds threshold (85%)`,
          recommendations: [
            'Optimize memory usage and fix memory leaks',
            'Implement efficient data structures',
            'Add memory-based caching strategies',
            'Consider increasing available memory',
          ],
          metrics: {
            current: latestSystemMetrics.memory.usagePercent,
            threshold: 85,
            unit: '%',
          },
          affectedOperations: ['All operations'],
        });
      }
    }

    // Analyze database bottlenecks
    if (databaseMetrics.length > 0) {
      const latestDbMetrics = databaseMetrics[databaseMetrics.length - 1];

      // Database connection bottleneck
      if (latestDbMetrics.connections.usagePercent > 80) {
        bottlenecks.push({
          id: 'high-db-connection-usage',
          type: 'database',
          severity: latestDbMetrics.connections.usagePercent > 95 ? 'critical' : 'high',
          impact: Math.min(10, Math.floor(latestDbMetrics.connections.usagePercent / 10)),
          description: `Database connection usage (${latestDbMetrics.connections.usagePercent.toFixed(1)}%) exceeds threshold (80%)`,
          recommendations: [
            'Implement connection pooling',
            'Optimize long-running queries',
            'Add connection timeout configurations',
            'Consider read replicas for read-heavy workloads',
          ],
          metrics: {
            current: latestDbMetrics.connections.usagePercent,
            threshold: 80,
            unit: '%',
          },
          affectedOperations: ['Database operations'],
        });
      }

      // Database cache hit ratio bottleneck
      if (latestDbMetrics.performance.cacheHitRatio < 95) {
        bottlenecks.push({
          id: 'low-db-cache-hit-ratio',
          type: 'database',
          severity: latestDbMetrics.performance.cacheHitRatio < 85 ? 'high' : 'medium',
          impact: Math.min(10, Math.floor((95 - latestDbMetrics.performance.cacheHitRatio) / 10)),
          description: `Database cache hit ratio (${latestDbMetrics.performance.cacheHitRatio.toFixed(1)}%) below threshold (95%)`,
          recommendations: [
            'Increase database shared_buffers size',
            'Optimize frequently accessed queries',
            'Add appropriate database indexes',
            'Consider query result caching',
          ],
          metrics: {
            current: latestDbMetrics.performance.cacheHitRatio,
            threshold: 95,
            unit: '%',
          },
          affectedOperations: ['Database queries'],
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(
    testId: string,
    loadTestResults: LoadTestResult[],
    systemMetrics: SystemMetrics[],
    databaseMetrics: DatabaseMetrics[]
  ): PerformanceReport {
    const performanceMetrics = this.calculatePerformanceMetrics(loadTestResults);
    const bottlenecks = this.identifyBottlenecks(performanceMetrics, systemMetrics, databaseMetrics);

    const testDuration = loadTestResults.length > 0 
      ? (Math.max(...loadTestResults.map(r => r.timestamp)) - Math.min(...loadTestResults.map(r => r.timestamp))) / 1000
      : 0;

    const report: PerformanceReport = {
      testId,
      timestamp: Date.now(),
      duration: testDuration,
      summary: {
        totalRequests: performanceMetrics.throughput.totalRequests,
        successfulRequests: performanceMetrics.throughput.successfulRequests,
        failedRequests: performanceMetrics.throughput.failedRequests,
        avgResponseTime: performanceMetrics.responseTime.avg,
        maxResponseTime: performanceMetrics.responseTime.max,
        throughput: performanceMetrics.throughput.requestsPerSecond,
        errorRate: performanceMetrics.errorRate.percentage,
      },
      bottlenecks,
      systemMetrics,
      databaseMetrics,
      recommendations: this.generateRecommendations(bottlenecks),
      performanceGoals: {
        responseTime: {
          current: performanceMetrics.responseTime.avg,
          target: this.thresholds.responseTimeThreshold,
          status: performanceMetrics.responseTime.avg <= this.thresholds.responseTimeThreshold ? 'pass' : 'fail',
        },
        throughput: {
          current: performanceMetrics.throughput.requestsPerSecond,
          target: this.thresholds.throughputMinimum,
          status: performanceMetrics.throughput.requestsPerSecond >= this.thresholds.throughputMinimum ? 'pass' : 'fail',
        },
        errorRate: {
          current: performanceMetrics.errorRate.percentage,
          target: this.thresholds.errorRateThreshold * 100,
          status: performanceMetrics.errorRate.percentage <= this.thresholds.errorRateThreshold * 100 ? 'pass' : 'fail',
        },
      },
    };

    this.emit('report-generated', report);
    return report;
  }

  /**
   * Generate actionable recommendations based on bottlenecks
   */
  private generateRecommendations(bottlenecks: BottleneckAnalysis[]) {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Prioritize recommendations based on severity and impact
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    const highBottlenecks = bottlenecks.filter(b => b.severity === 'high');
    const mediumBottlenecks = bottlenecks.filter(b => b.severity === 'medium');

    // Immediate actions for critical issues
    criticalBottlenecks.forEach(bottleneck => {
      immediate.push(...bottleneck.recommendations.slice(0, 2));
    });

    // Short-term actions for high priority issues
    highBottlenecks.forEach(bottleneck => {
      shortTerm.push(...bottleneck.recommendations);
    });

    // Long-term actions for medium priority issues and strategic improvements
    mediumBottlenecks.forEach(bottleneck => {
      longTerm.push(...bottleneck.recommendations);
    });

    // Add strategic long-term recommendations
    longTerm.push(
      'Implement comprehensive monitoring and alerting',
      'Set up automated performance testing in CI/CD pipeline',
      'Consider microservices architecture for better scalability',
      'Implement CDN for static content delivery',
      'Plan for horizontal scaling with load balancers'
    );

    return {
      immediate: [...new Set(immediate)], // Remove duplicates
      shortTerm: [...new Set(shortTerm)],
      longTerm: [...new Set(longTerm)],
    };
  }

  /**
   * Identify slow operations from performance metrics
   */
  private getSlowOperations(performanceMetrics: PerformanceMetrics): string[] {
    // This would require operation-level breakdown from JTL results
    // For now, return generic slow operations
    return [
      'Database write operations',
      'Complex query operations',
      'File upload operations',
      'Report generation',
    ];
  }

  /**
   * Get performance analysis from file path
   */
  async analyzeFromFiles(jtlFilePath: string, testId?: string): Promise<PerformanceReport> {
    try {
      // This would read the JTL file - for now we'll use the existing results
      const testResults = this.loadTestResults;
      const systemMetrics = this.resourceMonitoring.getMetricsHistory();
      const databaseMetrics = this.databaseMonitoring.getMetricsHistory();

      return this.generatePerformanceReport(
        testId || `test_${Date.now()}`,
        testResults,
        systemMetrics,
        databaseMetrics
      );
    } catch (error) {
      console.error('Error analyzing performance from files:', error);
      throw error;
    }
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, newThresholds);
    this.emit('thresholds-updated', this.thresholds);
  }

  /**
   * Get current performance thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }
} 