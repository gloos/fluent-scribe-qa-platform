import { supabase } from "@/lib/supabase";

// Basic type definitions for our analytics data
interface QASession {
  id: string;
  user_id: string;
  project_id?: string;
  mqm_score?: number;
  error_count?: number;
  analysis_status: string;
  created_at: string;
  updated_at?: string;
  upload_timestamp?: string;
  file_size?: number;
  assessment_results?: AssessmentResult[];
  file_uploads?: FileUpload[];
}

interface QAError {
  id: string;
  session_id: string;
  error_category?: string;
  error_type: string;
  severity: 'minor' | 'major' | 'critical';
  created_at: string;
  confidence_score?: number;
  mqm_category?: string;
  is_critical?: boolean;
}

interface AssessmentResult {
  id: string;
  session_id: string;
  overall_score?: number;
  fluency_score?: number;
  adequacy_score?: number;
  total_segments?: number;
  assessed_segments?: number;
  error_count?: number;
  warning_count?: number;
}

interface UserFeedback {
  id: string;
  user_id: string;
  rating?: number;
  feedback_type: string;
  created_at: string;
}

interface FileUpload {
  id: string;
  session_id: string;
  file_size: number;
  upload_status: string;
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface QualityTrendData {
  period: string;
  avgMqmScore: number;
  avgOverallScore: number;
  avgFluencyScore: number;
  avgAdequacyScore: number;
  totalSessions: number;
  errorCount: number;
  timestamp: Date;
}

export interface ErrorDistributionData {
  category: string;
  count: number;
  percentage: number;
  severity: 'minor' | 'major' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ProcessingEfficiencyData {
  period: string;
  avgProcessingTime: number;
  avgFileSize: number;
  successRate: number;
  throughput: number;
  timestamp: Date;
}

export interface UserEngagementData {
  period: string;
  activeUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  feedbackCount: number;
  avgRating: number;
  timestamp: Date;
}

export interface AnalyticsAggregationOptions {
  organizationId?: string;
  projectId?: string;
  userId?: string;
  timeRange: AnalyticsTimeRange;
  includeCache?: boolean;
  forceRefresh?: boolean;
}

class AnalyticsAggregationService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get quality trends over time with comprehensive scoring metrics
   */
  async getQualityTrends(options: AnalyticsAggregationOptions): Promise<QualityTrendData[]> {
    const cacheKey = `quality_trends_${JSON.stringify(options)}`;
    
    if (options.includeCache && this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const { start, end, period } = options.timeRange;
      
      // Build the aggregation query based on period
      const dateFormat = this.getDateFormat(period);
      
      let query = supabase
        .from('qa_sessions')
        .select(`
          created_at,
          mqm_score,
          analysis_status,
          error_count,
          assessment_results!inner(
            overall_score,
            fluency_score,
            adequacy_score,
            total_segments,
            assessed_segments,
            error_count,
            warning_count
          )
        `)
        .eq('analysis_status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Add organization/project filters if specified
      if (options.organizationId) {
        query = query.eq('profiles.organization_id', options.organizationId);
      }
      if (options.projectId) {
        query = query.eq('project_id', options.projectId);
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate data by time period
      const aggregatedData = this.aggregateByTimePeriod(data, period, (sessions, periodKey) => {
        const validSessions = sessions.filter(s => s.mqm_score !== null);
        const assessmentResults = sessions.flatMap(s => s.assessment_results || []);
        
        return {
          period: periodKey,
          avgMqmScore: this.calculateAverage(validSessions.map(s => s.mqm_score)),
          avgOverallScore: this.calculateAverage(assessmentResults.map(r => r.overall_score)),
          avgFluencyScore: this.calculateAverage(assessmentResults.map(r => r.fluency_score)),
          avgAdequacyScore: this.calculateAverage(assessmentResults.map(r => r.adequacy_score)),
          totalSessions: sessions.length,
          errorCount: sessions.reduce((sum, s) => sum + (s.error_count || 0), 0),
          timestamp: new Date(periodKey)
        };
      });

      this.setCacheData(cacheKey, aggregatedData);
      return aggregatedData;

    } catch (error) {
      console.error('Error fetching quality trends:', error);
      throw new Error('Failed to fetch quality trends data');
    }
  }

  /**
   * Get error distribution analysis with pattern recognition
   */
  async getErrorDistribution(options: AnalyticsAggregationOptions): Promise<ErrorDistributionData[]> {
    const cacheKey = `error_distribution_${JSON.stringify(options)}`;
    
    if (options.includeCache && this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const { start, end } = options.timeRange;
      
      let query = supabase
        .from('qa_errors')
        .select(`
          error_category,
          error_type,
          severity,
          created_at,
          confidence_score,
          mqm_category,
          is_critical
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      // Group by category and calculate metrics
      const categoryGroups = data.reduce((acc, error) => {
        const key = error.error_category || 'uncategorized';
        if (!acc[key]) {
          acc[key] = {
            count: 0,
            severity: error.severity,
            errors: []
          };
        }
        acc[key].count++;
        acc[key].errors.push(error);
        return acc;
      }, {} as Record<string, any>);

      const totalErrors = data.length;
      
      // Calculate trends by comparing with previous period
      const previousPeriodData = await this.getPreviousPeriodErrors(options);
      
      const distributionData: ErrorDistributionData[] = Object.entries(categoryGroups).map(([category, data]) => {
        const percentage = totalErrors > 0 ? (data.count / totalErrors) * 100 : 0;
        const trend = this.calculateTrend(data.count, previousPeriodData[category] || 0);
        
        return {
          category,
          count: data.count,
          percentage: Math.round(percentage * 100) / 100,
          severity: data.severity,
          trend
        };
      });

      this.setCacheData(cacheKey, distributionData);
      return distributionData;

    } catch (error) {
      console.error('Error fetching error distribution:', error);
      throw new Error('Failed to fetch error distribution data');
    }
  }

  /**
   * Get processing efficiency metrics
   */
  async getProcessingEfficiency(options: AnalyticsAggregationOptions): Promise<ProcessingEfficiencyData[]> {
    const cacheKey = `processing_efficiency_${JSON.stringify(options)}`;
    
    if (options.includeCache && this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const { start, end, period } = options.timeRange;
      
      let query = supabase
        .from('qa_sessions')
        .select(`
          created_at,
          updated_at,
          file_size,
          analysis_status,
          upload_timestamp,
          file_uploads!inner(
            file_size,
            upload_status
          )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const aggregatedData = this.aggregateByTimePeriod(data, period, (sessions, periodKey) => {
        const completedSessions = sessions.filter(s => s.analysis_status === 'completed');
        const totalSessions = sessions.length;
        
        // Calculate processing times
        const processingTimes = completedSessions
          .map(s => {
            if (s.updated_at && s.upload_timestamp) {
              return new Date(s.updated_at).getTime() - new Date(s.upload_timestamp).getTime();
            }
            return null;
          })
          .filter(time => time !== null);

        const avgProcessingTime = this.calculateAverage(processingTimes) / 1000; // Convert to seconds
        const avgFileSize = this.calculateAverage(completedSessions.map(s => s.file_size));
        const successRate = totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;
        const throughput = completedSessions.length; // Files processed in this period

        return {
          period: periodKey,
          avgProcessingTime,
          avgFileSize,
          successRate: Math.round(successRate * 100) / 100,
          throughput,
          timestamp: new Date(periodKey)
        };
      });

      this.setCacheData(cacheKey, aggregatedData);
      return aggregatedData;

    } catch (error) {
      console.error('Error fetching processing efficiency:', error);
      throw new Error('Failed to fetch processing efficiency data');
    }
  }

  /**
   * Get user engagement analytics
   */
  async getUserEngagement(options: AnalyticsAggregationOptions): Promise<UserEngagementData[]> {
    const cacheKey = `user_engagement_${JSON.stringify(options)}`;
    
    if (options.includeCache && this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const { start, end, period } = options.timeRange;
      
      // Get session data
      let sessionQuery = supabase
        .from('qa_sessions')
        .select(`
          created_at,
          updated_at,
          user_id,
          analysis_status
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Get feedback data
      let feedbackQuery = supabase
        .from('user_feedback')
        .select(`
          created_at,
          user_id,
          rating,
          feedback_type
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const [sessionResult, feedbackResult] = await Promise.all([
        sessionQuery,
        feedbackQuery
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (feedbackResult.error) throw feedbackResult.error;

      const sessions = sessionResult.data;
      const feedback = feedbackResult.data;

      const aggregatedData = this.aggregateByTimePeriod(sessions, period, (periodSessions, periodKey) => {
        const periodFeedback = feedback.filter(f => 
          this.isInSamePeriod(new Date(f.created_at), new Date(periodKey), period)
        );

        const uniqueUsers = new Set(periodSessions.map(s => s.user_id)).size;
        const totalSessions = periodSessions.length;
        
        // Calculate average session duration
        const sessionDurations = periodSessions
          .map(s => {
            if (s.updated_at && s.created_at) {
              return new Date(s.updated_at).getTime() - new Date(s.created_at).getTime();
            }
            return null;
          })
          .filter(duration => duration !== null);

        const avgSessionDuration = this.calculateAverage(sessionDurations) / 1000 / 60; // Convert to minutes
        const feedbackCount = periodFeedback.length;
        const avgRating = this.calculateAverage(periodFeedback.map(f => f.rating).filter(r => r !== null));

        return {
          period: periodKey,
          activeUsers: uniqueUsers,
          totalSessions,
          avgSessionDuration: Math.round(avgSessionDuration * 100) / 100,
          feedbackCount,
          avgRating: Math.round(avgRating * 100) / 100,
          timestamp: new Date(periodKey)
        };
      });

      this.setCacheData(cacheKey, aggregatedData);
      return aggregatedData;

    } catch (error) {
      console.error('Error fetching user engagement:', error);
      throw new Error('Failed to fetch user engagement data');
    }
  }

  // Utility methods

  private getDateFormat(period: string): string {
    switch (period) {
      case 'daily': return 'YYYY-MM-DD';
      case 'weekly': return 'YYYY-WW';
      case 'monthly': return 'YYYY-MM';
      case 'quarterly': return 'YYYY-Q';
      case 'yearly': return 'YYYY';
      default: return 'YYYY-MM-DD';
    }
  }

  private aggregateByTimePeriod<T, R>(
    data: T[], 
    period: string, 
    aggregator: (items: T[], periodKey: string) => R
  ): R[] {
    const grouped = data.reduce((acc, item: any) => {
      const date = new Date(item.created_at);
      const periodKey = this.getPeriodKey(date, period);
      
      if (!acc[periodKey]) {
        acc[periodKey] = [];
      }
      acc[periodKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);

    return Object.entries(grouped).map(([periodKey, items]) => 
      aggregator(items, periodKey)
    );
  }

  private getPeriodKey(date: Date, period: string): string {
    switch (period) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toISOString().split('T')[0];
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'quarterly':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      case 'yearly':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private isInSamePeriod(date1: Date, date2: Date, period: string): boolean {
    return this.getPeriodKey(date1, period) === this.getPeriodKey(date2, period);
  }

  private calculateAverage(values: (number | null)[]): number {
    const validValues = values.filter(v => v !== null && !isNaN(v)) as number[];
    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

  private calculateTrend(current: number, previous: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.05; // 5% threshold for considering changes significant
    const change = previous > 0 ? (current - previous) / previous : 0;
    
    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  private async getPreviousPeriodErrors(options: AnalyticsAggregationOptions): Promise<Record<string, number>> {
    // Calculate previous period timerange
    const { start, end, period } = options.timeRange;
    const timeDiff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime());
    const prevStart = new Date(start.getTime() - timeDiff);

    try {
      const { data, error } = await supabase
        .from('qa_errors')
        .select('error_category')
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString());

      if (error) return {};

      return data.reduce((acc, error) => {
        const category = error.error_category || 'uncategorized';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    } catch {
      return {};
    }
  }

  // Cache management
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCacheData(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const analyticsAggregationService = new AnalyticsAggregationService(); 