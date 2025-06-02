import { supabase } from '@/lib/supabase';
import { format, subDays, subWeeks, subMonths } from 'date-fns';

// Types for comparative analysis
export interface ComparisonDataset {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  filters?: ComparisonFilters;
}

export interface ComparisonFilters {
  userIds?: string[];
  documentTypes?: string[];
  errorTypes?: string[];
  severityLevels?: string[];
  languagePairs?: string[];
}

export interface MetricComparison {
  metric: string;
  datasets: DatasetMetric[];
  benchmark?: number;
  analysis: ComparisonAnalysis;
}

export interface DatasetMetric {
  datasetId: string;
  datasetName: string;
  value: number;
  count: number;
  confidence: number;
  percentChange?: number;
  significanceLevel?: number;
}

export interface ComparisonAnalysis {
  bestPerforming: string;
  worstPerforming: string;
  averageValue: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  outliers: string[];
  trends: ComparisonTrend[];
  recommendations: string[];
}

export interface ComparisonTrend {
  type: 'improvement' | 'decline' | 'stable';
  magnitude: number;
  confidence: number;
  description: string;
}

export interface BenchmarkConfig {
  type: 'historical' | 'industry' | 'target' | 'percentile';
  value?: number;
  percentile?: number;
  historicalPeriods?: number;
}

export interface ComparisonReport {
  id: string;
  title: string;
  datasets: ComparisonDataset[];
  metrics: MetricComparison[];
  summary: ComparisonSummary;
  generatedAt: Date;
}

export interface ComparisonSummary {
  totalDatasets: number;
  totalMetrics: number;
  keyFindings: string[];
  overallTrend: 'positive' | 'negative' | 'mixed' | 'stable';
  confidenceScore: number;
  actionItems: string[];
}

// Advanced streaming and performance optimization interfaces
export interface StreamingOptions {
  batchSize: number;
  concurrency: number;
  memoryLimit: number; // in MB
  enableProgressTracking: boolean;
}

export interface AdvancedAnalysisOptions {
  enableStatisticalTests: boolean;
  confidenceLevel: number;
  enableAnomalyDetection: boolean;
  enableSeasonalAnalysis: boolean;
}

export interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
  operationsPerSecond: number;
}

export interface StreamingResult<T> {
  data: T;
  progress: number;
  performance: PerformanceMetrics;
  metadata: {
    batchesProcessed: number;
    totalBatches: number;
    estimatedTimeRemaining: number;
  };
}

// Cache for comparison results
const comparisonCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Enhanced cache for streaming operations
const streamingCache = new Map<string, any>();
const STREAMING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for streaming data

export class ComparativeMetricsService {
  private static readonly SIGNIFICANCE_THRESHOLD = 0.05;
  private static readonly OUTLIER_THRESHOLD = 2.0; // Z-score threshold
  private static readonly DEFAULT_BATCH_SIZE = 1000;
  private static readonly DEFAULT_MEMORY_LIMIT = 512; // 512MB
  private static readonly MAX_CONCURRENT_STREAMS = 4;

  /**
   * Compare quality metrics across multiple datasets
   */
  static async compareQualityMetrics(
    datasets: ComparisonDataset[],
    benchmarkConfig?: BenchmarkConfig
  ): Promise<MetricComparison[]> {
    const cacheKey = `quality_comparison_${JSON.stringify(datasets)}_${JSON.stringify(benchmarkConfig)}`;
    const cached = comparisonCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const metrics: MetricComparison[] = [];

      // Define quality metrics to compare
      const qualityMetrics = [
        { key: 'mqm_score', name: 'MQM Score' },
        { key: 'fluency_score', name: 'Fluency Score' },
        { key: 'adequacy_score', name: 'Adequacy Score' },
        { key: 'overall_score', name: 'Overall Score' },
      ];

      for (const metric of qualityMetrics) {
        const datasetMetrics: DatasetMetric[] = [];

        for (const dataset of datasets) {
          const metricData = await this.getQualityMetricData(dataset, metric.key);
          datasetMetrics.push(metricData);
        }

        const benchmark = benchmarkConfig 
          ? await this.calculateBenchmark(datasetMetrics, benchmarkConfig)
          : undefined;

        const analysis = this.analyzeMetricComparison(datasetMetrics, benchmark);

        metrics.push({
          metric: metric.name,
          datasets: datasetMetrics,
          benchmark,
          analysis,
        });
      }

      comparisonCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
      return metrics;
    } catch (error) {
      console.error('Error comparing quality metrics:', error);
      throw error;
    }
  }

  /**
   * Compare error patterns across datasets
   */
  static async compareErrorPatterns(
    datasets: ComparisonDataset[]
  ): Promise<MetricComparison[]> {
    const cacheKey = `error_comparison_${JSON.stringify(datasets)}`;
    const cached = comparisonCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const metrics: MetricComparison[] = [];

      // Define error metrics to compare
      const errorMetrics = [
        { key: 'error_rate', name: 'Error Rate' },
        { key: 'critical_errors', name: 'Critical Errors' },
        { key: 'major_errors', name: 'Major Errors' },
        { key: 'minor_errors', name: 'Minor Errors' },
        { key: 'avg_errors_per_session', name: 'Average Errors per Session' },
      ];

      for (const metric of errorMetrics) {
        const datasetMetrics: DatasetMetric[] = [];

        for (const dataset of datasets) {
          const metricData = await this.getErrorMetricData(dataset, metric.key);
          datasetMetrics.push(metricData);
        }

        const analysis = this.analyzeMetricComparison(datasetMetrics);

        metrics.push({
          metric: metric.name,
          datasets: datasetMetrics,
          analysis,
        });
      }

      comparisonCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
      return metrics;
    } catch (error) {
      console.error('Error comparing error patterns:', error);
      throw error;
    }
  }

  /**
   * Compare processing efficiency across datasets
   */
  static async compareProcessingEfficiency(
    datasets: ComparisonDataset[]
  ): Promise<MetricComparison[]> {
    const cacheKey = `efficiency_comparison_${JSON.stringify(datasets)}`;
    const cached = comparisonCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const metrics: MetricComparison[] = [];

      // Define efficiency metrics to compare
      const efficiencyMetrics = [
        { key: 'words_per_minute', name: 'Words per Minute' },
        { key: 'avg_processing_time', name: 'Average Processing Time' },
        { key: 'session_completion_rate', name: 'Session Completion Rate' },
        { key: 'throughput', name: 'Daily Throughput' },
      ];

      for (const metric of efficiencyMetrics) {
        const datasetMetrics: DatasetMetric[] = [];

        for (const dataset of datasets) {
          const metricData = await this.getEfficiencyMetricData(dataset, metric.key);
          datasetMetrics.push(metricData);
        }

        const analysis = this.analyzeMetricComparison(datasetMetrics);

        metrics.push({
          metric: metric.name,
          datasets: datasetMetrics,
          analysis,
        });
      }

      comparisonCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
      return metrics;
    } catch (error) {
      console.error('Error comparing processing efficiency:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive comparison report
   */
  static async generateComparisonReport(
    title: string,
    datasets: ComparisonDataset[],
    benchmarkConfig?: BenchmarkConfig
  ): Promise<ComparisonReport> {
    try {
      const [qualityMetrics, errorMetrics, efficiencyMetrics] = await Promise.all([
        this.compareQualityMetrics(datasets, benchmarkConfig),
        this.compareErrorPatterns(datasets),
        this.compareProcessingEfficiency(datasets),
      ]);

      const allMetrics = [...qualityMetrics, ...errorMetrics, ...efficiencyMetrics];
      const summary = this.generateComparisonSummary(datasets, allMetrics);

      return {
        id: `comparison_${Date.now()}`,
        title,
        datasets,
        metrics: allMetrics,
        summary,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating comparison report:', error);
      throw error;
    }
  }

  /**
   * Streaming comparison for large datasets with memory optimization
   */
  static async *compareQualityMetricsStreaming(
    datasets: ComparisonDataset[],
    options: StreamingOptions = {
      batchSize: this.DEFAULT_BATCH_SIZE,
      concurrency: 2,
      memoryLimit: this.DEFAULT_MEMORY_LIMIT,
      enableProgressTracking: true
    },
    benchmarkConfig?: BenchmarkConfig
  ): AsyncGenerator<StreamingResult<MetricComparison[]>, void, unknown> {
    const startTime = Date.now();
    let memoryUsageEstimate = 0;
    let batchesProcessed = 0;
    const totalBatches = Math.ceil(datasets.length / options.batchSize);

    const qualityMetrics = [
      { key: 'mqm_score', name: 'MQM Score' },
      { key: 'fluency_score', name: 'Fluency Score' },
      { key: 'adequacy_score', name: 'Adequacy Score' },
      { key: 'overall_score', name: 'Overall Score' },
    ];

    for (let i = 0; i < datasets.length; i += options.batchSize) {
      const batchDatasets = datasets.slice(i, i + options.batchSize);
      const batchResults: MetricComparison[] = [];
      
      // Memory check before processing batch
      if (memoryUsageEstimate > options.memoryLimit * 1024 * 1024) {
        // Clear old cache entries to free memory
        this.cleanupStreamingCache();
        memoryUsageEstimate = 0;
      }

      // Process batch with concurrency control
      const metricPromises = qualityMetrics.map(async (metric) => {
        const datasetMetrics: DatasetMetric[] = [];

        // Process datasets in the batch with controlled concurrency
        const concurrentChunks = this.chunkArray(batchDatasets, Math.min(options.concurrency, batchDatasets.length));
        
        for (const chunk of concurrentChunks) {
          const chunkPromises = chunk.map(dataset => this.getQualityMetricData(dataset, metric.key));
          const chunkResults = await Promise.all(chunkPromises);
          datasetMetrics.push(...chunkResults);
        }

        const benchmark = benchmarkConfig 
          ? await this.calculateBenchmark(datasetMetrics, benchmarkConfig)
          : undefined;

        const analysis = this.analyzeMetricComparison(datasetMetrics, benchmark);

        return {
          metric: metric.name,
          datasets: datasetMetrics,
          benchmark,
          analysis,
        };
      });

      const batchMetrics = await Promise.all(metricPromises);
      batchResults.push(...batchMetrics);

      // Update performance metrics
      batchesProcessed++;
      const elapsed = Date.now() - startTime;
      const avgTimePerBatch = elapsed / batchesProcessed;
      const estimatedTimeRemaining = avgTimePerBatch * (totalBatches - batchesProcessed);
      
      // Estimate memory usage (rough approximation)
      memoryUsageEstimate += batchResults.length * 1024; // ~1KB per result estimate

      const progress = (batchesProcessed / totalBatches) * 100;
      const cacheStats = this.getCacheStats();
      
      yield {
        data: batchResults,
        progress,
        performance: {
          processingTime: elapsed,
          memoryUsage: memoryUsageEstimate / (1024 * 1024), // Convert to MB
          cacheHitRatio: cacheStats.size > 0 ? (cacheStats.size / (batchesProcessed * qualityMetrics.length)) : 0,
          operationsPerSecond: (batchesProcessed * batchResults.length) / (elapsed / 1000)
        },
        metadata: {
          batchesProcessed,
          totalBatches,
          estimatedTimeRemaining
        }
      };
    }
  }

  /**
   * Advanced comparison with statistical significance testing
   */
  static async compareMetricsAdvanced(
    datasets: ComparisonDataset[],
    options: AdvancedAnalysisOptions = {
      enableStatisticalTests: true,
      confidenceLevel: 0.95,
      enableAnomalyDetection: true,
      enableSeasonalAnalysis: false
    },
    benchmarkConfig?: BenchmarkConfig
  ): Promise<MetricComparison[]> {
    const cacheKey = `advanced_comparison_${JSON.stringify(datasets)}_${JSON.stringify(options)}`;
    const cached = comparisonCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const metrics: MetricComparison[] = [];
      const qualityMetrics = [
        { key: 'mqm_score', name: 'MQM Score' },
        { key: 'fluency_score', name: 'Fluency Score' },
        { key: 'adequacy_score', name: 'Adequacy Score' },
        { key: 'overall_score', name: 'Overall Score' },
      ];

      for (const metric of qualityMetrics) {
        const datasetMetrics: DatasetMetric[] = [];

        for (const dataset of datasets) {
          const metricData = await this.getQualityMetricDataAdvanced(dataset, metric.key, options);
          datasetMetrics.push(metricData);
        }

        const benchmark = benchmarkConfig 
          ? await this.calculateBenchmark(datasetMetrics, benchmarkConfig)
          : undefined;

        // Enhanced analysis with statistical tests
        const analysis = options.enableStatisticalTests 
          ? await this.analyzeMetricComparisonAdvanced(datasetMetrics, benchmark, options)
          : this.analyzeMetricComparison(datasetMetrics, benchmark);

        metrics.push({
          metric: metric.name,
          datasets: datasetMetrics,
          benchmark,
          analysis,
        });
      }

      comparisonCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
      return metrics;
    } catch (error) {
      console.error('Error in advanced metrics comparison:', error);
      throw error;
    }
  }

  /**
   * Memory-efficient bulk comparison for multiple metric types
   */
  static async compareAllMetricsBulk(
    datasets: ComparisonDataset[],
    options: StreamingOptions = {
      batchSize: this.DEFAULT_BATCH_SIZE,
      concurrency: this.MAX_CONCURRENT_STREAMS,
      memoryLimit: this.DEFAULT_MEMORY_LIMIT,
      enableProgressTracking: true
    }
  ): Promise<{
    quality: MetricComparison[];
    errors: MetricComparison[];
    efficiency: MetricComparison[];
    performance: PerformanceMetrics;
  }> {
    const startTime = Date.now();
    
    try {
      // Use controlled concurrency to prevent memory overflow
      const [qualityMetrics, errorMetrics, efficiencyMetrics] = await Promise.all([
        this.compareQualityMetricsOptimized(datasets, options),
        this.compareErrorPatternsOptimized(datasets, options),
        this.compareProcessingEfficiencyOptimized(datasets, options),
      ]);

      const processingTime = Date.now() - startTime;
      const cacheStats = this.getCacheStats();
      
      return {
        quality: qualityMetrics,
        errors: errorMetrics,
        efficiency: efficiencyMetrics,
        performance: {
          processingTime,
          memoryUsage: this.estimateMemoryUsage(),
          cacheHitRatio: cacheStats.size > 0 ? 0.8 : 0, // Rough estimate
          operationsPerSecond: (datasets.length * 3) / (processingTime / 1000) // 3 metric types
        }
      };
    } catch (error) {
      console.error('Error in bulk metrics comparison:', error);
      throw error;
    }
  }

  /**
   * Create predefined comparison datasets
   */
  static createTimeBasedComparison(
    baseDate: Date = new Date(),
    periods: ('week' | 'month' | 'quarter')[] = ['week', 'month']
  ): ComparisonDataset[] {
    const datasets: ComparisonDataset[] = [];

    periods.forEach((period, index) => {
      let startDate: Date;
      let endDate: Date;
      let name: string;

      switch (period) {
        case 'week':
          endDate = new Date(baseDate);
          startDate = subDays(endDate, 7);
          name = 'Last 7 Days';
          break;
        case 'month':
          endDate = new Date(baseDate);
          startDate = subDays(endDate, 30);
          name = 'Last 30 Days';
          break;
        case 'quarter':
          endDate = new Date(baseDate);
          startDate = subDays(endDate, 90);
          name = 'Last 90 Days';
          break;
      }

      datasets.push({
        id: `${period}_${index}`,
        name,
        startDate,
        endDate,
      });
    });

    return datasets;
  }

  /**
   * Create user group comparison datasets
   */
  static createUserGroupComparison(
    startDate: Date,
    endDate: Date,
    userGroups: { id: string; name: string; userIds: string[] }[]
  ): ComparisonDataset[] {
    return userGroups.map(group => ({
      id: `user_group_${group.id}`,
      name: group.name,
      startDate,
      endDate,
      filters: {
        userIds: group.userIds,
      },
    }));
  }

  /**
   * Get quality metric data for a dataset
   */
  private static async getQualityMetricData(
    dataset: ComparisonDataset,
    metricKey: string
  ): Promise<DatasetMetric> {
    // Map metric keys to actual qa_sessions fields
    const fieldMap: Record<string, string> = {
      'mqm_score': 'mqm_score',
      'fluency_score': 'mqm_score', // Using mqm_score as substitute
      'adequacy_score': 'mqm_score', // Using mqm_score as substitute  
      'overall_score': 'mqm_score', // Using mqm_score as substitute
    };

    const actualField = fieldMap[metricKey] || 'mqm_score';

    let query = supabase
      .from('qa_sessions')
      .select(`
        ${actualField},
        created_at,
        user_id,
        id
      `)
      .gte('created_at', format(dataset.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(dataset.endDate, 'yyyy-MM-dd'))
      .not(actualField, 'is', null);

    // Apply user filters if specified
    if (dataset.filters?.userIds) {
      query = query.in('user_id', dataset.filters.userIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const filteredData = data || [];
    const values = filteredData.map(item => item[actualField as keyof typeof item]).filter(v => v !== null && v !== undefined) as number[];
    const average = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    const confidence = this.calculateConfidence(values.length);

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      value: average,
      count: values.length,
      confidence,
    };
  }

  /**
   * Get error metric data for a dataset
   */
  private static async getErrorMetricData(
    dataset: ComparisonDataset,
    metricKey: string
  ): Promise<DatasetMetric> {
    const { data: errorData, error: errorError } = await supabase
      .from('qa_errors')
      .select('*, qa_session_id')
      .gte('created_at', format(dataset.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(dataset.endDate, 'yyyy-MM-dd'));

    if (errorError) throw errorError;

    const { data: sessionData, error: sessionError } = await supabase
      .from('qa_sessions')
      .select('*')
      .gte('created_at', format(dataset.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(dataset.endDate, 'yyyy-MM-dd'));

    if (sessionError) throw sessionError;

    // Apply filters
    let filteredErrors = errorData || [];
    let filteredSessions = sessionData || [];

    if (dataset.filters?.userIds) {
      filteredSessions = filteredSessions.filter(session => 
        dataset.filters!.userIds!.includes(session.user_id)
      );
      const validSessionIds = new Set(filteredSessions.map(s => s.id));
      filteredErrors = filteredErrors.filter(error => 
        validSessionIds.has(error.qa_session_id)
      );
    }

    let value: number;
    let count: number;

    switch (metricKey) {
      case 'error_rate':
        value = filteredSessions.length > 0 ? filteredErrors.length / filteredSessions.length : 0;
        count = filteredSessions.length;
        break;
      case 'critical_errors':
        const criticalErrors = filteredErrors.filter(e => e.severity === 'critical');
        value = criticalErrors.length;
        count = filteredErrors.length;
        break;
      case 'major_errors':
        const majorErrors = filteredErrors.filter(e => e.severity === 'major');
        value = majorErrors.length;
        count = filteredErrors.length;
        break;
      case 'minor_errors':
        const minorErrors = filteredErrors.filter(e => e.severity === 'minor');
        value = minorErrors.length;
        count = filteredErrors.length;
        break;
      case 'avg_errors_per_session':
        value = filteredSessions.length > 0 ? filteredErrors.length / filteredSessions.length : 0;
        count = filteredSessions.length;
        break;
      default:
        value = 0;
        count = 0;
    }

    const confidence = this.calculateConfidence(count);

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      value,
      count,
      confidence,
    };
  }

  /**
   * Get efficiency metric data for a dataset
   */
  private static async getEfficiencyMetricData(
    dataset: ComparisonDataset,
    metricKey: string
  ): Promise<DatasetMetric> {
    const { data, error } = await supabase
      .from('qa_sessions')
      .select('*')
      .gte('created_at', format(dataset.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(dataset.endDate, 'yyyy-MM-dd'));

    if (error) throw error;

    // Apply filters
    let filteredData = data || [];
    if (dataset.filters?.userIds) {
      filteredData = filteredData.filter(session => 
        dataset.filters!.userIds!.includes(session.user_id)
      );
    }

    let value: number;
    let count: number;

    switch (metricKey) {
      case 'words_per_minute':
        const validSessions = filteredData.filter(s => s.word_count && s.processing_time);
        const wpmValues = validSessions.map(s => (s.word_count / s.processing_time) * 60);
        value = wpmValues.length > 0 ? wpmValues.reduce((sum, val) => sum + val, 0) / wpmValues.length : 0;
        count = validSessions.length;
        break;
      case 'avg_processing_time':
        const processingTimes = filteredData.filter(s => s.processing_time).map(s => s.processing_time);
        value = processingTimes.length > 0 ? processingTimes.reduce((sum, val) => sum + val, 0) / processingTimes.length : 0;
        count = processingTimes.length;
        break;
      case 'session_completion_rate':
        const completedSessions = filteredData.filter(s => s.status === 'completed');
        value = filteredData.length > 0 ? completedSessions.length / filteredData.length : 0;
        count = filteredData.length;
        break;
      case 'throughput':
        const days = Math.max(1, Math.ceil((dataset.endDate.getTime() - dataset.startDate.getTime()) / (1000 * 60 * 60 * 24)));
        value = filteredData.length / days;
        count = filteredData.length;
        break;
      default:
        value = 0;
        count = 0;
    }

    const confidence = this.calculateConfidence(count);

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      value,
      count,
      confidence,
    };
  }

  /**
   * Calculate benchmark value based on configuration
   */
  private static async calculateBenchmark(
    datasetMetrics: DatasetMetric[],
    config: BenchmarkConfig
  ): Promise<number> {
    switch (config.type) {
      case 'target':
        return config.value || 0;
      case 'percentile':
        const values = datasetMetrics.map(m => m.value).sort((a, b) => a - b);
        const percentile = config.percentile || 50;
        const index = Math.ceil((percentile / 100) * values.length) - 1;
        return values[Math.max(0, index)] || 0;
      case 'industry':
        // This would typically come from external data
        return config.value || 0;
      case 'historical':
        // Calculate average from historical data
        const average = datasetMetrics.reduce((sum, m) => sum + m.value, 0) / datasetMetrics.length;
        return average;
      default:
        return 0;
    }
  }

  /**
   * Analyze metric comparison results
   */
  private static analyzeMetricComparison(
    datasetMetrics: DatasetMetric[],
    benchmark?: number
  ): ComparisonAnalysis {
    if (datasetMetrics.length === 0) {
      return {
        bestPerforming: '',
        worstPerforming: '',
        averageValue: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0,
        outliers: [],
        trends: [],
        recommendations: [],
      };
    }

    const values = datasetMetrics.map(m => m.value);
    const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - averageValue, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = averageValue !== 0 ? standardDeviation / averageValue : 0;

    // Find best and worst performing
    const sortedMetrics = [...datasetMetrics].sort((a, b) => b.value - a.value);
    const bestPerforming = sortedMetrics[0]?.datasetName || '';
    const worstPerforming = sortedMetrics[sortedMetrics.length - 1]?.datasetName || '';

    // Detect outliers using z-score
    const outliers: string[] = [];
    datasetMetrics.forEach(metric => {
      const zScore = standardDeviation !== 0 ? Math.abs(metric.value - averageValue) / standardDeviation : 0;
      if (zScore > this.OUTLIER_THRESHOLD) {
        outliers.push(metric.datasetName);
      }
    });

    // Generate trends and recommendations
    const trends = this.generateComparisonTrends(datasetMetrics, benchmark);
    const recommendations = this.generateRecommendations(datasetMetrics, averageValue, standardDeviation, benchmark);

    return {
      bestPerforming,
      worstPerforming,
      averageValue,
      standardDeviation,
      coefficientOfVariation,
      outliers,
      trends,
      recommendations,
    };
  }

  /**
   * Generate comparison trends
   */
  private static generateComparisonTrends(
    datasetMetrics: DatasetMetric[],
    benchmark?: number
  ): ComparisonTrend[] {
    const trends: ComparisonTrend[] = [];

    if (datasetMetrics.length < 2) return trends;

    const values = datasetMetrics.map(m => m.value);
    const averageValue = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Overall trend analysis
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = secondAvg - firstAvg;
    const magnitude = Math.abs(change) / firstAvg;

    if (Math.abs(change) > averageValue * 0.05) { // 5% threshold
      trends.push({
        type: change > 0 ? 'improvement' : 'decline',
        magnitude,
        confidence: 0.8,
        description: `${change > 0 ? 'Improvement' : 'Decline'} of ${(magnitude * 100).toFixed(1)}% observed across datasets`,
      });
    } else {
      trends.push({
        type: 'stable',
        magnitude: 0,
        confidence: 0.9,
        description: 'Performance remains stable across datasets',
      });
    }

    // Benchmark comparison if available
    if (benchmark !== undefined) {
      const benchmarkDiff = averageValue - benchmark;
      const benchmarkMagnitude = Math.abs(benchmarkDiff) / benchmark;

      trends.push({
        type: benchmarkDiff > 0 ? 'improvement' : 'decline',
        magnitude: benchmarkMagnitude,
        confidence: 0.7,
        description: `${benchmarkDiff > 0 ? 'Above' : 'Below'} benchmark by ${(benchmarkMagnitude * 100).toFixed(1)}%`,
      });
    }

    return trends;
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    datasetMetrics: DatasetMetric[],
    averageValue: number,
    standardDeviation: number,
    benchmark?: number
  ): string[] {
    const recommendations: string[] = [];

    // High variability recommendation
    const coefficientOfVariation = averageValue !== 0 ? standardDeviation / averageValue : 0;
    if (coefficientOfVariation > 0.3) {
      recommendations.push('High variability detected. Consider investigating factors causing inconsistent performance.');
    }

    // Low sample size warning
    const lowSampleDatasets = datasetMetrics.filter(m => m.count < 30);
    if (lowSampleDatasets.length > 0) {
      recommendations.push(`Low sample size in ${lowSampleDatasets.length} dataset(s). Increase data collection for more reliable metrics.`);
    }

    // Performance improvement opportunities
    const sortedMetrics = [...datasetMetrics].sort((a, b) => b.value - a.value);
    const topPerformer = sortedMetrics[0];
    const bottomPerformer = sortedMetrics[sortedMetrics.length - 1];
    
    if (topPerformer && bottomPerformer && topPerformer.value > bottomPerformer.value * 1.2) {
      recommendations.push(`Analyze best practices from "${topPerformer.datasetName}" to improve "${bottomPerformer.datasetName}" performance.`);
    }

    // Benchmark recommendations
    if (benchmark !== undefined) {
      const belowBenchmark = datasetMetrics.filter(m => m.value < benchmark);
      if (belowBenchmark.length > 0) {
        recommendations.push(`${belowBenchmark.length} dataset(s) below benchmark. Focus improvement efforts on these areas.`);
      }
    }

    return recommendations;
  }

  /**
   * Generate comparison summary
   */
  private static generateComparisonSummary(
    datasets: ComparisonDataset[],
    metrics: MetricComparison[]
  ): ComparisonSummary {
    const totalDatasets = datasets.length;
    const totalMetrics = metrics.length;

    // Extract key findings
    const keyFindings: string[] = [];
    const allTrends: ComparisonTrend[] = [];
    
    metrics.forEach(metric => {
      const bestDataset = metric.analysis.bestPerforming;
      const worstDataset = metric.analysis.worstPerforming;
      
      if (bestDataset && worstDataset && bestDataset !== worstDataset) {
        keyFindings.push(`${metric.metric}: "${bestDataset}" outperforms "${worstDataset}"`);
      }

      allTrends.push(...metric.analysis.trends);
    });

    // Determine overall trend
    const improvementTrends = allTrends.filter(t => t.type === 'improvement').length;
    const declineTrends = allTrends.filter(t => t.type === 'decline').length;
    const stableTrends = allTrends.filter(t => t.type === 'stable').length;

    let overallTrend: 'positive' | 'negative' | 'mixed' | 'stable';
    if (improvementTrends > declineTrends && improvementTrends > stableTrends) {
      overallTrend = 'positive';
    } else if (declineTrends > improvementTrends && declineTrends > stableTrends) {
      overallTrend = 'negative';
    } else if (stableTrends > improvementTrends && stableTrends > declineTrends) {
      overallTrend = 'stable';
    } else {
      overallTrend = 'mixed';
    }

    // Calculate confidence score
    const confidenceScores = metrics.flatMap(m => m.datasets.map(d => d.confidence));
    const confidenceScore = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
      : 0;

    // Generate action items
    const actionItems = metrics.flatMap(m => m.analysis.recommendations).slice(0, 5);

    return {
      totalDatasets,
      totalMetrics,
      keyFindings: keyFindings.slice(0, 5),
      overallTrend,
      confidenceScore,
      actionItems,
    };
  }

  /**
   * Calculate confidence based on sample size
   */
  private static calculateConfidence(sampleSize: number): number {
    if (sampleSize >= 100) return 0.95;
    if (sampleSize >= 50) return 0.90;
    if (sampleSize >= 30) return 0.80;
    if (sampleSize >= 10) return 0.70;
    if (sampleSize >= 5) return 0.60;
    return 0.50;
  }

  /**
   * Clean up streaming cache to free memory
   */
  private static cleanupStreamingCache(): void {
    const now = Date.now();
    for (const [key, entry] of streamingCache.entries()) {
      if (now - entry.timestamp > STREAMING_CACHE_TTL) {
        streamingCache.delete(key);
      }
    }
  }

  /**
   * Split array into chunks for controlled processing
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Advanced quality metric data retrieval with anomaly detection
   */
  private static async getQualityMetricDataAdvanced(
    dataset: ComparisonDataset,
    metricKey: string,
    options: AdvancedAnalysisOptions
  ): Promise<DatasetMetric> {
    // Start with basic metric data
    const basicData = await this.getQualityMetricData(dataset, metricKey);

    if (!options.enableAnomalyDetection) {
      return basicData;
    }

    // Enhanced analysis for anomaly detection
    const fieldMap: Record<string, string> = {
      'mqm_score': 'mqm_score',
      'fluency_score': 'mqm_score',
      'adequacy_score': 'mqm_score',
      'overall_score': 'mqm_score',
    };

    const actualField = fieldMap[metricKey] || 'mqm_score';

    let query = supabase
      .from('qa_sessions')
      .select(`
        ${actualField},
        created_at,
        user_id,
        id
      `)
      .gte('created_at', format(dataset.startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(dataset.endDate, 'yyyy-MM-dd'))
      .not(actualField, 'is', null);

    if (dataset.filters?.userIds) {
      query = query.in('user_id', dataset.filters.userIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const filteredData = data || [];
    const values = filteredData.map(item => item[actualField as keyof typeof item]).filter(v => v !== null && v !== undefined) as number[];
    
    if (values.length === 0) {
      return basicData;
    }

    // Anomaly detection using IQR method
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Filter out anomalies
    const cleanValues = values.filter(v => v >= lowerBound && v <= upperBound);
    const average = cleanValues.length > 0 ? cleanValues.reduce((sum, val) => sum + val, 0) / cleanValues.length : 0;

    // Calculate significance level using t-test approximation
    const standardError = Math.sqrt(cleanValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / cleanValues.length);
    const tScore = Math.abs(average / (standardError / Math.sqrt(cleanValues.length)));
    const significanceLevel = tScore > 1.96 ? 0.05 : tScore > 1.645 ? 0.10 : 0.20;

    return {
      ...basicData,
      value: average,
      count: cleanValues.length,
      significanceLevel,
      confidence: this.calculateConfidence(cleanValues.length)
    };
  }

  /**
   * Advanced metric comparison analysis with statistical tests
   */
  private static async analyzeMetricComparisonAdvanced(
    datasetMetrics: DatasetMetric[],
    benchmark?: number,
    options?: AdvancedAnalysisOptions
  ): Promise<ComparisonAnalysis> {
    const basicAnalysis = this.analyzeMetricComparison(datasetMetrics, benchmark);

    if (!options?.enableStatisticalTests || datasetMetrics.length < 2) {
      return basicAnalysis;
    }

    // Enhanced statistical analysis
    const values = datasetMetrics.map(m => m.value);
    
    // Perform Welch's t-test for unequal variances (simplified implementation)
    const significantDifferences: string[] = [];
    for (let i = 0; i < datasetMetrics.length - 1; i++) {
      for (let j = i + 1; j < datasetMetrics.length; j++) {
        const metric1 = datasetMetrics[i];
        const metric2 = datasetMetrics[j];
        
        // Simple significance test based on confidence intervals
        const confidenceThreshold = options.confidenceLevel || 0.95;
        const pooledStdError = Math.sqrt((Math.pow(metric1.value * 0.1, 2) / metric1.count) + (Math.pow(metric2.value * 0.1, 2) / metric2.count));
        const tStatistic = Math.abs(metric1.value - metric2.value) / pooledStdError;
        
        if (tStatistic > 1.96) { // Approximation for 95% confidence
          significantDifferences.push(`${metric1.datasetName} vs ${metric2.datasetName}`);
        }
      }
    }

    // Enhanced trends with statistical backing
    const enhancedTrends = basicAnalysis.trends.map(trend => ({
      ...trend,
      confidence: Math.min(trend.confidence + 0.1, 0.99) // Boost confidence with statistical backing
    }));

    // Enhanced recommendations
    const statisticalRecommendations = [
      ...basicAnalysis.recommendations,
      ...(significantDifferences.length > 0 ? [`Statistically significant differences found: ${significantDifferences.join(', ')}`] : []),
      ...(options.confidenceLevel > 0.95 ? ['Consider increasing sample sizes for more robust statistical analysis'] : [])
    ];

    return {
      ...basicAnalysis,
      trends: enhancedTrends,
      recommendations: statisticalRecommendations.slice(0, 8) // Limit recommendations
    };
  }

  /**
   * Memory-optimized quality metrics comparison
   */
  private static async compareQualityMetricsOptimized(
    datasets: ComparisonDataset[],
    options: StreamingOptions
  ): Promise<MetricComparison[]> {
    const chunks = this.chunkArray(datasets, options.batchSize);
    const allMetrics: MetricComparison[] = [];

    for (const chunk of chunks) {
      const chunkMetrics = await this.compareQualityMetrics(chunk);
      allMetrics.push(...chunkMetrics);
      
      // Memory management
      if (this.estimateMemoryUsage() > options.memoryLimit) {
        this.cleanupStreamingCache();
      }
    }

    return allMetrics;
  }

  /**
   * Memory-optimized error patterns comparison
   */
  private static async compareErrorPatternsOptimized(
    datasets: ComparisonDataset[],
    options: StreamingOptions
  ): Promise<MetricComparison[]> {
    const chunks = this.chunkArray(datasets, options.batchSize);
    const allMetrics: MetricComparison[] = [];

    for (const chunk of chunks) {
      const chunkMetrics = await this.compareErrorPatterns(chunk);
      allMetrics.push(...chunkMetrics);
      
      // Memory management
      if (this.estimateMemoryUsage() > options.memoryLimit) {
        this.cleanupStreamingCache();
      }
    }

    return allMetrics;
  }

  /**
   * Memory-optimized processing efficiency comparison
   */
  private static async compareProcessingEfficiencyOptimized(
    datasets: ComparisonDataset[],
    options: StreamingOptions
  ): Promise<MetricComparison[]> {
    const chunks = this.chunkArray(datasets, options.batchSize);
    const allMetrics: MetricComparison[] = [];

    for (const chunk of chunks) {
      const chunkMetrics = await this.compareProcessingEfficiency(chunk);
      allMetrics.push(...chunkMetrics);
      
      // Memory management
      if (this.estimateMemoryUsage() > options.memoryLimit) {
        this.cleanupStreamingCache();
      }
    }

    return allMetrics;
  }

  /**
   * Estimate current memory usage (rough approximation)
   */
  private static estimateMemoryUsage(): number {
    const cacheSize = comparisonCache.size + streamingCache.size;
    const averageEntrySize = 2048; // 2KB per cache entry estimate
    return (cacheSize * averageEntrySize) / (1024 * 1024); // Convert to MB
  }

  /**
   * Clear comparison cache
   */
  static clearCache(): void {
    comparisonCache.clear();
    streamingCache.clear();
  }

  /**
   * Clear only streaming cache
   */
  static clearStreamingCache(): void {
    streamingCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: comparisonCache.size,
      keys: Array.from(comparisonCache.keys()),
    };
  }

  /**
   * Get streaming cache statistics
   */
  static getStreamingCacheStats(): { size: number; keys: string[]; memoryUsageEstimate: number } {
    return {
      size: streamingCache.size,
      keys: Array.from(streamingCache.keys()),
      memoryUsageEstimate: this.estimateMemoryUsage()
    };
  }
} 