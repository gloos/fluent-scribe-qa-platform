import { supabase } from '@/lib/supabase';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

// Types for trend analysis
export interface TrendPoint {
  date: string;
  value: number;
  predicted?: number;
  confidence?: number;
}

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  strength: number; // 0-1, how strong the trend is
  slope: number; // rate of change
  correlation: number; // R-squared value
  seasonality?: SeasonalPattern;
  anomalies: AnomalyPoint[];
  forecast: TrendPoint[];
}

export interface SeasonalPattern {
  period: 'daily' | 'weekly' | 'monthly';
  amplitude: number;
  phase: number;
  strength: number;
}

export interface AnomalyPoint {
  date: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'outlier';
}

export interface TrendConfig {
  smoothingWindow: number;
  confidenceLevel: number;
  anomalyThreshold: number;
  forecastPeriods: number;
  seasonalityDetection: boolean;
}

// Cache for trend analysis results
const trendCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export class TrendAnalysisService {
  private static defaultConfig: TrendConfig = {
    smoothingWindow: 7,
    confidenceLevel: 0.95,
    anomalyThreshold: 2.0,
    forecastPeriods: 14,
    seasonalityDetection: true,
  };

  /**
   * Analyze quality score trends over time
   */
  static async analyzeQualityTrends(
    startDate: Date,
    endDate: Date,
    config: Partial<TrendConfig> = {}
  ): Promise<TrendAnalysis> {
    const cacheKey = `quality_trends_${startDate.toISOString()}_${endDate.toISOString()}_${JSON.stringify(config)}`;
    
    // Check cache
    const cached = trendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Fetch quality data
      const { data: qualityData, error } = await supabase
        .from('qa_sessions')
        .select(`
          created_at,
          mqm_score,
          fluency_score,
          adequacy_score,
          overall_score
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at');

      if (error) throw error;

      // Aggregate by day
      const dailyData = this.aggregateByDay(qualityData, 'overall_score');
      
      // Perform trend analysis
      const analysis = this.performTrendAnalysis(dailyData, finalConfig);

      // Cache result
      trendCache.set(cacheKey, { data: analysis, timestamp: Date.now() });

      return analysis;
    } catch (error) {
      console.error('Error analyzing quality trends:', error);
      throw error;
    }
  }

  /**
   * Analyze error rate trends
   */
  static async analyzeErrorTrends(
    startDate: Date,
    endDate: Date,
    config: Partial<TrendConfig> = {}
  ): Promise<TrendAnalysis> {
    const cacheKey = `error_trends_${startDate.toISOString()}_${endDate.toISOString()}_${JSON.stringify(config)}`;
    
    const cached = trendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Fetch error data
      const { data: errorData, error } = await supabase
        .from('qa_errors')
        .select(`
          created_at,
          severity,
          category
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at');

      if (error) throw error;

      // Count errors by day
      const dailyErrorCounts = this.aggregateErrorsByDay(errorData);
      
      // Perform trend analysis
      const analysis = this.performTrendAnalysis(dailyErrorCounts, finalConfig);

      trendCache.set(cacheKey, { data: analysis, timestamp: Date.now() });

      return analysis;
    } catch (error) {
      console.error('Error analyzing error trends:', error);
      throw error;
    }
  }

  /**
   * Analyze processing efficiency trends
   */
  static async analyzeEfficiencyTrends(
    startDate: Date,
    endDate: Date,
    config: Partial<TrendConfig> = {}
  ): Promise<TrendAnalysis> {
    const cacheKey = `efficiency_trends_${startDate.toISOString()}_${endDate.toISOString()}_${JSON.stringify(config)}`;
    
    const cached = trendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Fetch processing data
      const { data: sessionData, error } = await supabase
        .from('qa_sessions')
        .select(`
          created_at,
          processing_time,
          word_count,
          status
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'completed')
        .order('created_at');

      if (error) throw error;

      // Calculate efficiency metrics (words per minute)
      const dailyEfficiency = this.calculateDailyEfficiency(sessionData);
      
      // Perform trend analysis
      const analysis = this.performTrendAnalysis(dailyEfficiency, finalConfig);

      trendCache.set(cacheKey, { data: analysis, timestamp: Date.now() });

      return analysis;
    } catch (error) {
      console.error('Error analyzing efficiency trends:', error);
      throw error;
    }
  }

  /**
   * Analyze user engagement trends
   */
  static async analyzeEngagementTrends(
    startDate: Date,
    endDate: Date,
    config: Partial<TrendConfig> = {}
  ): Promise<TrendAnalysis> {
    const cacheKey = `engagement_trends_${startDate.toISOString()}_${endDate.toISOString()}_${JSON.stringify(config)}`;
    
    const cached = trendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      // Fetch user activity data
      const { data: sessionData, error } = await supabase
        .from('qa_sessions')
        .select(`
          created_at,
          user_id,
          status
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at');

      if (error) throw error;

      // Calculate daily active users
      const dailyActiveUsers = this.calculateDailyActiveUsers(sessionData);
      
      // Perform trend analysis
      const analysis = this.performTrendAnalysis(dailyActiveUsers, finalConfig);

      trendCache.set(cacheKey, { data: analysis, timestamp: Date.now() });

      return analysis;
    } catch (error) {
      console.error('Error analyzing engagement trends:', error);
      throw error;
    }
  }

  /**
   * Core trend analysis algorithm
   */
  private static performTrendAnalysis(
    data: TrendPoint[],
    config: TrendConfig
  ): TrendAnalysis {
    if (data.length < 2) {
      return {
        trend: 'stable',
        strength: 0,
        slope: 0,
        correlation: 0,
        anomalies: [],
        forecast: [],
      };
    }

    // Apply smoothing
    const smoothedData = this.applyMovingAverage(data, config.smoothingWindow);
    
    // Linear regression for trend detection
    const regression = this.calculateLinearRegression(smoothedData);
    
    // Determine trend direction and strength
    const trend = this.determineTrend(regression.slope, regression.correlation);
    
    // Detect seasonality if enabled
    const seasonality = config.seasonalityDetection 
      ? this.detectSeasonality(data) 
      : undefined;
    
    // Detect anomalies
    const anomalies = this.detectAnomalies(data, smoothedData, config.anomalyThreshold);
    
    // Generate forecast
    const forecast = this.generateForecast(
      smoothedData,
      regression,
      seasonality,
      config.forecastPeriods
    );

    return {
      trend: trend.direction,
      strength: trend.strength,
      slope: regression.slope,
      correlation: regression.correlation,
      seasonality,
      anomalies,
      forecast,
    };
  }

  /**
   * Apply moving average smoothing
   */
  private static applyMovingAverage(data: TrendPoint[], window: number): TrendPoint[] {
    if (window <= 1) return data;

    const smoothed: TrendPoint[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.ceil(window / 2));
      
      const windowData = data.slice(start, end);
      const average = windowData.reduce((sum, point) => sum + point.value, 0) / windowData.length;
      
      smoothed.push({
        date: data[i].date,
        value: average,
      });
    }
    
    return smoothed;
  }

  /**
   * Calculate linear regression
   */
  private static calculateLinearRegression(data: TrendPoint[]): {
    slope: number;
    intercept: number;
    correlation: number;
  } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, correlation: 0 };

    // Convert dates to numeric values (days since first point)
    const firstDate = new Date(data[0].date).getTime();
    const x = data.map((_, i) => i);
    const y = data.map(point => point.value);

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    let ssTotal = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
      ssTotal += yDiff * yDiff;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    // Calculate R-squared
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += Math.pow(y[i] - predicted, 2);
    }

    const correlation = ssTotal === 0 ? 0 : 1 - (ssRes / ssTotal);

    return { slope, intercept, correlation: Math.max(0, correlation) };
  }

  /**
   * Determine trend direction and strength
   */
  private static determineTrend(slope: number, correlation: number): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
  } {
    const absSlope = Math.abs(slope);
    const strength = Math.min(1, correlation * absSlope);

    // Thresholds for trend detection
    const minSlope = 0.01;
    const minCorrelation = 0.1;

    if (absSlope < minSlope || correlation < minCorrelation) {
      return { direction: 'stable', strength: 0 };
    }

    return {
      direction: slope > 0 ? 'increasing' : 'decreasing',
      strength,
    };
  }

  /**
   * Detect seasonal patterns
   */
  private static detectSeasonality(data: TrendPoint[]): SeasonalPattern | undefined {
    if (data.length < 14) return undefined; // Need at least 2 weeks of data

    // Simple autocorrelation-based seasonality detection
    const periods = [7, 30]; // Weekly and monthly patterns
    let bestPeriod = 7;
    let bestCorrelation = 0;

    for (const period of periods) {
      if (data.length < period * 2) continue;

      const correlation = this.calculateAutocorrelation(data, period);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation < 0.3) return undefined; // Weak seasonality

    return {
      period: bestPeriod === 7 ? 'weekly' : 'monthly',
      amplitude: this.calculateSeasonalAmplitude(data, bestPeriod),
      phase: 0, // Simplified - could be enhanced
      strength: bestCorrelation,
    };
  }

  /**
   * Calculate autocorrelation for a given lag
   */
  private static calculateAutocorrelation(data: TrendPoint[], lag: number): number {
    if (data.length <= lag) return 0;

    const values = data.map(point => point.value);
    const n = values.length - lag;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate seasonal amplitude
   */
  private static calculateSeasonalAmplitude(data: TrendPoint[], period: number): number {
    const values = data.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    let maxDeviation = 0;
    
    for (let i = 0; i < values.length; i++) {
      const deviation = Math.abs(values[i] - mean);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    
    return maxDeviation;
  }

  /**
   * Detect anomalies using statistical methods
   */
  private static detectAnomalies(
    original: TrendPoint[],
    smoothed: TrendPoint[],
    threshold: number
  ): AnomalyPoint[] {
    const anomalies: AnomalyPoint[] = [];
    
    if (original.length !== smoothed.length) return anomalies;

    // Calculate residuals
    const residuals = original.map((point, i) => point.value - smoothed[i].value);
    
    // Calculate standard deviation of residuals
    const mean = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
    const variance = residuals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / residuals.length;
    const stdDev = Math.sqrt(variance);

    // Detect anomalies
    for (let i = 0; i < original.length; i++) {
      const residual = residuals[i];
      const zScore = Math.abs(residual) / stdDev;

      if (zScore > threshold) {
        const severity = zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low';
        const type = residual > 0 ? 'spike' : 'drop';

        anomalies.push({
          date: original[i].date,
          value: original[i].value,
          expected: smoothed[i].value,
          severity,
          type,
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate forecast using trend and seasonality
   */
  private static generateForecast(
    data: TrendPoint[],
    regression: { slope: number; intercept: number },
    seasonality: SeasonalPattern | undefined,
    periods: number
  ): TrendPoint[] {
    const forecast: TrendPoint[] = [];
    const lastIndex = data.length - 1;
    const lastDate = new Date(data[lastIndex].date);

    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + i);

      // Linear trend prediction
      const trendValue = regression.slope * (lastIndex + i) + regression.intercept;
      
      // Add seasonal component if detected
      let seasonalAdjustment = 0;
      if (seasonality) {
        const seasonalIndex = i % (seasonality.period === 'weekly' ? 7 : 30);
        seasonalAdjustment = seasonality.amplitude * Math.sin(
          (2 * Math.PI * seasonalIndex) / (seasonality.period === 'weekly' ? 7 : 30)
        );
      }

      const predictedValue = trendValue + seasonalAdjustment;

      forecast.push({
        date: format(futureDate, 'yyyy-MM-dd'),
        value: Math.max(0, predictedValue), // Ensure non-negative values
        predicted: 1, // Mark as predicted point
        confidence: Math.max(0.1, 1 - (i / periods) * 0.5), // Decreasing confidence
      });
    }

    return forecast;
  }

  /**
   * Helper method to aggregate data by day
   */
  private static aggregateByDay(data: any[], valueField: string): TrendPoint[] {
    const dailyData = new Map<string, number[]>();

    data.forEach(item => {
      const date = format(new Date(item.created_at), 'yyyy-MM-dd');
      const value = item[valueField];
      
      if (value !== null && value !== undefined) {
        if (!dailyData.has(date)) {
          dailyData.set(date, []);
        }
        dailyData.get(date)!.push(value);
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, values]) => ({
        date,
        value: values.reduce((sum, val) => sum + val, 0) / values.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Helper method to aggregate errors by day
   */
  private static aggregateErrorsByDay(data: any[]): TrendPoint[] {
    const dailyData = new Map<string, number>();

    data.forEach(item => {
      const date = format(new Date(item.created_at), 'yyyy-MM-dd');
      dailyData.set(date, (dailyData.get(date) || 0) + 1);
    });

    return Array.from(dailyData.entries())
      .map(([date, count]) => ({ date, value: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Helper method to calculate daily efficiency
   */
  private static calculateDailyEfficiency(data: any[]): TrendPoint[] {
    const dailyData = new Map<string, { totalWords: number; totalTime: number; count: number }>();

    data.forEach(item => {
      const date = format(new Date(item.created_at), 'yyyy-MM-dd');
      const words = item.word_count || 0;
      const time = item.processing_time || 0;

      if (words > 0 && time > 0) {
        if (!dailyData.has(date)) {
          dailyData.set(date, { totalWords: 0, totalTime: 0, count: 0 });
        }
        const dayData = dailyData.get(date)!;
        dayData.totalWords += words;
        dayData.totalTime += time;
        dayData.count += 1;
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, { totalWords, totalTime }]) => ({
        date,
        value: totalTime > 0 ? (totalWords / totalTime) * 60 : 0, // Words per minute
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Helper method to calculate daily active users
   */
  private static calculateDailyActiveUsers(data: any[]): TrendPoint[] {
    const dailyData = new Map<string, Set<string>>();

    data.forEach(item => {
      const date = format(new Date(item.created_at), 'yyyy-MM-dd');
      const userId = item.user_id;

      if (userId) {
        if (!dailyData.has(date)) {
          dailyData.set(date, new Set());
        }
        dailyData.get(date)!.add(userId);
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, userSet]) => ({ date, value: userSet.size }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Clear trend analysis cache
   */
  static clearCache(): void {
    trendCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: trendCache.size,
      keys: Array.from(trendCache.keys()),
    };
  }
} 