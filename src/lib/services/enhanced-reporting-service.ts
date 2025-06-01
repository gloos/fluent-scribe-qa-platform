/**
 * Enhanced Reporting Service
 * 
 * Provides comprehensive data integration for enhanced reporting components,
 * connecting real assessment data with visualizations and analytics.
 */

import { 
  MQMErrorInstance, 
  MQMDimension, 
  MQMSeverity,
  AssessmentResult,
  AssessmentResultWithDetails,
  AssessmentStats,
  QAError,
  ErrorSeverity,
  MQMErrorCategory,
  MQMAccuracyCategory
} from '@/lib/types/assessment';
import { 
  ExpandedErrorCategory, 
  ErrorDomain, 
  CategoryLevel,
  HierarchicalErrorPath,
  TaxonomyExpansionResult
} from '@/lib/types/mqm-taxonomy-expansion';
import { MQMTaxonomyExpansionEngine } from '@/lib/utils/mqm-taxonomy-expansion';
import { MQMSeverityClassifier } from '@/lib/utils/mqm-severity-classifier';

export interface EnhancedReportingData {
  errors: MQMErrorInstance[];
  expandedCategories: ExpandedErrorCategory[];
  timeSeriesData: TimeSeriesDataPoint[];
  severityDistribution: SeverityDistribution[];
  dimensionBreakdown: DimensionBreakdown[];
  trends: TrendAnalysis;
  recommendations: AutomatedRecommendation[];
  metadata: ReportingMetadata;
}

export interface TimeSeriesDataPoint {
  date: string;
  timestamp: number;
  totalErrors: number;
  criticalErrors: number;
  majorErrors: number;
  minorErrors: number;
  neutralErrors: number;
  avgSeverity: number;
  qualityScore: number;
  dimensions: Record<MQMDimension, number>;
  errorRate: number; // errors per 100 segments
  trend: 'improving' | 'declining' | 'stable';
}

export interface SeverityDistribution {
  severity: MQMSeverity;
  count: number;
  percentage: number;
  avgPenalty: number;
  totalPenalty: number;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;
}

export interface DimensionBreakdown {
  dimension: MQMDimension;
  totalErrors: number;
  percentage: number;
  avgSeverity: number;
  categories: Array<{
    category: string;
    count: number;
    percentage: number;
    avgSeverity: number;
  }>;
}

export interface TrendAnalysis {
  overall: 'improving' | 'declining' | 'stable';
  errorRateTrend: number; // percentage change
  qualityScoreTrend: number; // percentage change
  severityTrend: Record<MQMSeverity, number>;
  dimensionTrends: Record<MQMDimension, number>;
  emergingPatterns: string[];
  significantChanges: Array<{
    type: 'improvement' | 'degradation';
    area: string;
    change: number;
    description: string;
  }>;
}

export interface AutomatedRecommendation {
  id: string;
  type: 'critical' | 'improvement' | 'optimization' | 'training';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  impactEstimate: string;
  timeframe: string;
  resourcesNeeded: string[];
  successMetrics: string[];
  relatedErrors: MQMErrorInstance[];
  domain?: ErrorDomain;
  dimension?: MQMDimension;
}

export interface ReportingMetadata {
  dataRange: {
    from: string;
    to: string;
  };
  totalAssessments: number;
  totalSegments: number;
  totalErrors: number;
  lastUpdate: string;
  dataQuality: {
    completeness: number; // percentage
    consistency: number; // percentage
    warnings: string[];
  };
}

export interface ReportingFilters {
  dateRange?: {
    from: string;
    to: string;
  };
  domains?: ErrorDomain[];
  severities?: MQMSeverity[];
  dimensions?: MQMDimension[];
  assessorIds?: string[];
  projectIds?: string[];
  minQualityScore?: number;
  maxQualityScore?: number;
}

export interface ReportingConfig {
  enableCaching: boolean;
  cacheTimeout: number; // milliseconds
  enableRealTimeUpdates: boolean;
  batchSize: number;
  enablePerformanceOptimization: boolean;
}

/**
 * Enhanced Reporting Service Class
 */
export class EnhancedReportingService {
  private static instance: EnhancedReportingService;
  private taxonomyEngine: MQMTaxonomyExpansionEngine;
  private severityClassifier: MQMSeverityClassifier;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private config: ReportingConfig;

  constructor(config?: Partial<ReportingConfig>) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      enableRealTimeUpdates: false,
      batchSize: 1000,
      enablePerformanceOptimization: true,
      ...config
    };

    this.taxonomyEngine = new MQMTaxonomyExpansionEngine();
    this.severityClassifier = new MQMSeverityClassifier();
  }

  static getInstance(config?: Partial<ReportingConfig>): EnhancedReportingService {
    if (!EnhancedReportingService.instance) {
      EnhancedReportingService.instance = new EnhancedReportingService(config);
    }
    return EnhancedReportingService.instance;
  }

  /**
   * Generate comprehensive reporting data from assessment results
   */
  async generateReportingData(
    assessments: AssessmentResultWithDetails[],
    filters?: ReportingFilters
  ): Promise<EnhancedReportingData> {
    const cacheKey = this.generateCacheKey('reporting-data', filters);
    
    if (this.config.enableCaching) {
      const cached = this.getFromCache<EnhancedReportingData>(cacheKey);
      if (cached) return cached;
    }

    // Transform assessments to MQM errors
    const errors = await this.transformAssessmentsToErrors(assessments, filters);
    
    // Generate expanded categories
    const expandedTaxonomy = this.taxonomyEngine.getExpandedTaxonomy();
    const expandedCategories = expandedTaxonomy.expanded_categories;

    // Generate time series data
    const timeSeriesData = this.generateTimeSeriesData(assessments, filters);

    // Generate severity distribution
    const severityDistribution = this.generateSeverityDistribution(errors);

    // Generate dimension breakdown
    const dimensionBreakdown = this.generateDimensionBreakdown(errors);

    // Generate trend analysis
    const trends = this.generateTrendAnalysis(timeSeriesData, errors);

    // Generate automated recommendations
    const recommendations = await this.generateAutomatedRecommendations(errors, trends);

    // Generate metadata
    const metadata = this.generateReportingMetadata(assessments, errors, filters);

    const result: EnhancedReportingData = {
      errors,
      expandedCategories,
      timeSeriesData,
      severityDistribution,
      dimensionBreakdown,
      trends,
      recommendations,
      metadata
    };

    if (this.config.enableCaching) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Transform assessment results to MQM error instances
   */
  private async transformAssessmentsToErrors(
    assessments: AssessmentResultWithDetails[],
    filters?: ReportingFilters
  ): Promise<MQMErrorInstance[]> {
    const errors: MQMErrorInstance[] = [];

    for (const assessment of assessments) {
      if (!assessment.errors) continue;

      for (const error of assessment.errors) {
        // Apply filters
        if (filters) {
          if (filters.dateRange) {
            const errorDate = error.created_at || assessment.created_at || new Date().toISOString();
            if (errorDate < filters.dateRange.from || errorDate > filters.dateRange.to) {
              continue;
            }
          }

          if (filters.severities && error.severity && !filters.severities.includes(error.severity as MQMSeverity)) {
            continue;
          }

          if (filters.dimensions && error.mqm_category && !filters.dimensions.includes(this.extractDimensionFromCategory(error.mqm_category))) {
            continue;
          }

          if (filters.assessorIds && !filters.assessorIds.includes(assessment.assessor?.id || '')) {
            continue;
          }

          if (filters.minQualityScore && assessment.overall_score && assessment.overall_score < filters.minQualityScore) {
            continue;
          }

          if (filters.maxQualityScore && assessment.overall_score && assessment.overall_score > filters.maxQualityScore) {
            continue;
          }
        }

        // Transform QAError to MQMErrorInstance
        const mqmError: MQMErrorInstance = {
          id: error.id,
          category: (error.error_category as MQMErrorCategory) || MQMAccuracyCategory.MISTRANSLATION,
          dimension: this.extractDimensionFromCategory(error.mqm_category) || MQMDimension.ACCURACY,
          severity: this.mapErrorSeverityToMQM(error.severity) || MQMSeverity.MINOR,
          description: error.error_description || 'No description provided',
          penalty: error.error_weight || 0,
          timestamp: error.created_at || assessment.created_at || new Date().toISOString(),
          segment_id: error.segment_id || `${assessment.session_id}-unknown`,
          start_position: 0,
          end_position: 0,
          source_text: error.source_text || '',
          target_text: error.target_text || '',
          assessor_id: assessment.assessor?.id || 'unknown',
          status: error.status || 'OPEN' as any
        };

        // Apply enhanced severity classification if available
        if (this.severityClassifier) {
          const suggestion = MQMSeverityClassifier.suggestSeverity(
            mqmError.dimension,
            mqmError.category,
            {
              content_type: 'general',
              criticality: 'medium' as any
            }
          );

          if (suggestion.suggested_severity) {
            mqmError.severity = suggestion.suggested_severity;
          }
        }

        errors.push(mqmError);
      }
    }

    return errors;
  }

  /**
   * Generate time series data for trend analysis
   */
  private generateTimeSeriesData(
    assessments: AssessmentResultWithDetails[],
    filters?: ReportingFilters
  ): TimeSeriesDataPoint[] {
    // Group assessments by date
    const dateGroups = new Map<string, AssessmentResultWithDetails[]>();
    
    assessments.forEach(assessment => {
      const date = (assessment.created_at || new Date().toISOString()).split('T')[0];
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      dateGroups.get(date)!.push(assessment);
    });

    // Generate time series points
    const timeSeriesData: TimeSeriesDataPoint[] = [];
    
    for (const [date, dayAssessments] of dateGroups.entries()) {
      const allErrors = dayAssessments.flatMap(a => a.errors || []);
      const totalSegments = dayAssessments.reduce((sum, a) => sum + (a.total_segments || 0), 0);
      
      const severityCounts = {
        [MQMSeverity.CRITICAL]: 0,
        [MQMSeverity.MAJOR]: 0,
        [MQMSeverity.MINOR]: 0,
        [MQMSeverity.NEUTRAL]: 0
      };

      const dimensionCounts: Record<MQMDimension, number> = {
        [MQMDimension.ACCURACY]: 0,
        [MQMDimension.TERMINOLOGY]: 0,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 0,
        [MQMDimension.STYLE]: 0,
        [MQMDimension.LOCALE_CONVENTIONS]: 0,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 0,
        [MQMDimension.DESIGN_AND_MARKUP]: 0
      };

      allErrors.forEach(error => {
        if (error.severity) {
          severityCounts[error.severity as MQMSeverity]++;
        }
        if (error.dimension) {
          dimensionCounts[error.dimension as MQMDimension]++;
        }
      });

      const avgQualityScore = dayAssessments.length > 0
        ? dayAssessments.reduce((sum, a) => sum + (a.overall_score || 0), 0) / dayAssessments.length
        : 0;

      const avgSeverity = this.calculateAverageSeverity(allErrors);
      const errorRate = totalSegments > 0 ? (allErrors.length / totalSegments) * 100 : 0;

      timeSeriesData.push({
        date,
        timestamp: new Date(date).getTime(),
        totalErrors: allErrors.length,
        criticalErrors: severityCounts[MQMSeverity.CRITICAL],
        majorErrors: severityCounts[MQMSeverity.MAJOR],
        minorErrors: severityCounts[MQMSeverity.MINOR],
        neutralErrors: severityCounts[MQMSeverity.NEUTRAL],
        avgSeverity,
        qualityScore: avgQualityScore,
        dimensions: dimensionCounts,
        errorRate,
        trend: 'stable' // Will be calculated in trend analysis
      });
    }

    return timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate severity distribution analysis
   */
  private generateSeverityDistribution(errors: MQMErrorInstance[]): SeverityDistribution[] {
    const severityGroups = new Map<MQMSeverity, MQMErrorInstance[]>();
    
    errors.forEach(error => {
      if (!severityGroups.has(error.severity)) {
        severityGroups.set(error.severity, []);
      }
      severityGroups.get(error.severity)!.push(error);
    });

    return Array.from(severityGroups.entries()).map(([severity, severityErrors]) => {
      const count = severityErrors.length;
      const percentage = errors.length > 0 ? (count / errors.length) * 100 : 0;
      const penalties = severityErrors.map(e => e.penalty || 0);
      const avgPenalty = penalties.length > 0 ? penalties.reduce((sum, p) => sum + p, 0) / penalties.length : 0;
      const totalPenalty = penalties.reduce((sum, p) => sum + p, 0);

      // Get impact level from severity classifier
      const impactLevel = this.getSeverityImpactLevel(severity);
      const businessImpact = this.getSeverityBusinessImpact(severity);

      return {
        severity,
        count,
        percentage,
        avgPenalty,
        totalPenalty,
        impactLevel,
        businessImpact
      };
    }).sort((a, b) => {
      const severityOrder = [MQMSeverity.CRITICAL, MQMSeverity.MAJOR, MQMSeverity.MINOR, MQMSeverity.NEUTRAL];
      return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    });
  }

  /**
   * Generate dimension breakdown analysis
   */
  private generateDimensionBreakdown(errors: MQMErrorInstance[]): DimensionBreakdown[] {
    const dimensionGroups = new Map<MQMDimension, MQMErrorInstance[]>();
    
    errors.forEach(error => {
      if (!dimensionGroups.has(error.dimension)) {
        dimensionGroups.set(error.dimension, []);
      }
      dimensionGroups.get(error.dimension)!.push(error);
    });

    return Array.from(dimensionGroups.entries()).map(([dimension, dimensionErrors]) => {
      const totalErrors = dimensionErrors.length;
      const percentage = errors.length > 0 ? (totalErrors / errors.length) * 100 : 0;
      const avgSeverity = this.calculateAverageSeverity(dimensionErrors);

      // Group by category within dimension
      const categoryGroups = new Map<string, MQMErrorInstance[]>();
      dimensionErrors.forEach(error => {
        if (!categoryGroups.has(error.category)) {
          categoryGroups.set(error.category, []);
        }
        categoryGroups.get(error.category)!.push(error);
      });

      const categories = Array.from(categoryGroups.entries()).map(([category, categoryErrors]) => ({
        category,
        count: categoryErrors.length,
        percentage: (categoryErrors.length / totalErrors) * 100,
        avgSeverity: this.calculateAverageSeverity(categoryErrors)
      }));

      return {
        dimension,
        totalErrors,
        percentage,
        avgSeverity,
        categories
      };
    }).sort((a, b) => b.totalErrors - a.totalErrors);
  }

  /**
   * Generate trend analysis
   */
  private generateTrendAnalysis(timeSeriesData: TimeSeriesDataPoint[], errors: MQMErrorInstance[]): TrendAnalysis {
    if (timeSeriesData.length < 2) {
      return {
        overall: 'stable',
        errorRateTrend: 0,
        qualityScoreTrend: 0,
        severityTrend: {} as Record<MQMSeverity, number>,
        dimensionTrends: {} as Record<MQMDimension, number>,
        emergingPatterns: [],
        significantChanges: []
      };
    }

    // Calculate trends
    const latest = timeSeriesData[timeSeriesData.length - 1];
    const previous = timeSeriesData[timeSeriesData.length - 2];

    const errorRateTrend = this.calculatePercentageChange(previous.errorRate, latest.errorRate);
    const qualityScoreTrend = this.calculatePercentageChange(previous.qualityScore, latest.qualityScore);

    // Determine overall trend
    let overall: 'improving' | 'declining' | 'stable' = 'stable';
    if (qualityScoreTrend > 5 && errorRateTrend < -10) {
      overall = 'improving';
    } else if (qualityScoreTrend < -5 && errorRateTrend > 10) {
      overall = 'declining';
    }

    // Calculate severity trends
    const severityTrend: Record<MQMSeverity, number> = {
      [MQMSeverity.CRITICAL]: this.calculatePercentageChange(previous.criticalErrors, latest.criticalErrors),
      [MQMSeverity.MAJOR]: this.calculatePercentageChange(previous.majorErrors, latest.majorErrors),
      [MQMSeverity.MINOR]: this.calculatePercentageChange(previous.minorErrors, latest.minorErrors),
      [MQMSeverity.NEUTRAL]: this.calculatePercentageChange(previous.neutralErrors, latest.neutralErrors)
    };

    // Calculate dimension trends
    const dimensionTrends: Record<MQMDimension, number> = {} as any;
    Object.values(MQMDimension).forEach(dimension => {
      dimensionTrends[dimension] = this.calculatePercentageChange(
        previous.dimensions[dimension] || 0,
        latest.dimensions[dimension] || 0
      );
    });

    // Identify emerging patterns and significant changes
    const emergingPatterns = this.identifyEmergingPatterns(timeSeriesData, errors);
    const significantChanges = this.identifySignificantChanges(severityTrend, dimensionTrends, errorRateTrend, qualityScoreTrend);

    return {
      overall,
      errorRateTrend,
      qualityScoreTrend,
      severityTrend,
      dimensionTrends,
      emergingPatterns,
      significantChanges
    };
  }

  /**
   * Generate automated recommendations based on error patterns
   */
  private async generateAutomatedRecommendations(
    errors: MQMErrorInstance[],
    trends: TrendAnalysis
  ): Promise<AutomatedRecommendation[]> {
    const recommendations: AutomatedRecommendation[] = [];

    // Critical errors recommendation
    const criticalErrors = errors.filter(e => e.severity === MQMSeverity.CRITICAL);
    if (criticalErrors.length > 0) {
      recommendations.push({
        id: 'critical-immediate',
        type: 'critical',
        priority: 'high',
        title: 'Address Critical Issues Immediately',
        description: `${criticalErrors.length} critical errors require immediate attention to prevent serious business impact.`,
        actionItems: [
          'Review all critical errors with the quality team',
          'Implement immediate fixes for safety-related issues',
          'Escalate to technical leadership if needed',
          'Document root causes and preventive measures'
        ],
        impactEstimate: 'High - Prevents potential safety, legal, or financial risks',
        timeframe: 'Immediate (within 24 hours)',
        resourcesNeeded: ['Quality team', 'Technical leads', 'Domain experts'],
        successMetrics: ['Zero critical errors remaining', 'Root cause analysis completed'],
        relatedErrors: criticalErrors
      });
    }

    // Add more recommendation logic based on patterns...
    // This would include dimension-specific recommendations, trend-based recommendations, etc.

    return recommendations;
  }

  // Helper methods
  private generateCacheKey(operation: string, filters?: ReportingFilters): string {
    return `${operation}-${JSON.stringify(filters || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.config.cacheTimeout;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    if (!this.config.enableCaching) return;
    
    this.cache.set(key, {
      data: data as unknown,
      timestamp: Date.now()
    });
  }

  private calculateAverageSeverity(errors: (MQMErrorInstance | QAError)[]): number {
    if (errors.length === 0) return 0;
    
    const severityValues = {
      [MQMSeverity.NEUTRAL]: 1,
      [MQMSeverity.MINOR]: 2,
      [MQMSeverity.MAJOR]: 3,
      [MQMSeverity.CRITICAL]: 4
    };
    
    const sum = errors.reduce((acc, error) => {
      const severity = error.severity as MQMSeverity;
      return acc + (severityValues[severity] || 1);
    }, 0);
    
    return sum / errors.length;
  }

  private calculatePercentageChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getSeverityImpactLevel(severity: MQMSeverity): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case MQMSeverity.CRITICAL: return 'critical';
      case MQMSeverity.MAJOR: return 'high';
      case MQMSeverity.MINOR: return 'medium';
      case MQMSeverity.NEUTRAL: return 'low';
      default: return 'low';
    }
  }

  private getSeverityBusinessImpact(severity: MQMSeverity): string {
    switch (severity) {
      case MQMSeverity.CRITICAL: 
        return 'May cause serious user confusion, legal issues, or safety concerns';
      case MQMSeverity.MAJOR: 
        return 'Significantly impacts user experience and comprehension';
      case MQMSeverity.MINOR: 
        return 'Minor impact on readability and user experience';
      case MQMSeverity.NEUTRAL: 
        return 'Minimal impact, mostly stylistic improvements';
      default: 
        return 'Unknown impact';
    }
  }

  private inferDomain(assessment: AssessmentResultWithDetails): ErrorDomain {
    // Simple domain inference based on available data
    // This could be enhanced with more sophisticated logic
    const fileName = assessment.session?.file_name?.toLowerCase() || '';
    
    if (fileName.includes('medical') || fileName.includes('health')) {
      return ErrorDomain.MEDICAL;
    } else if (fileName.includes('legal') || fileName.includes('contract')) {
      return ErrorDomain.LEGAL;
    } else if (fileName.includes('tech') || fileName.includes('software') || fileName.includes('api')) {
      return ErrorDomain.TECHNICAL;
    } else if (fileName.includes('finance') || fileName.includes('bank')) {
      return ErrorDomain.FINANCIAL;
    } else if (fileName.includes('market') || fileName.includes('promo')) {
      return ErrorDomain.MARKETING;
    }
    
    return ErrorDomain.GENERAL;
  }

  private identifyEmergingPatterns(timeSeriesData: TimeSeriesDataPoint[], errors: MQMErrorInstance[]): string[] {
    const patterns: string[] = [];
    
    // Look for patterns in the time series data
    if (timeSeriesData.length >= 7) {
      const recentWeek = timeSeriesData.slice(-7);
      const avgErrorRate = recentWeek.reduce((sum, d) => sum + d.errorRate, 0) / recentWeek.length;
      
      if (avgErrorRate > 15) {
        patterns.push('High error rate trend detected in recent period');
      }
      
      // Look for specific dimension patterns
      const dimensionTrends = new Map<MQMDimension, number[]>();
      recentWeek.forEach(day => {
        Object.entries(day.dimensions).forEach(([dim, count]) => {
          const dimension = dim as MQMDimension;
          if (!dimensionTrends.has(dimension)) {
            dimensionTrends.set(dimension, []);
          }
          dimensionTrends.get(dimension)!.push(count);
        });
      });
      
      dimensionTrends.forEach((counts, dimension) => {
        if (counts.every(c => c > 0) && counts[counts.length - 1] > counts[0] * 1.5) {
          patterns.push(`Increasing ${dimension.replace('_', ' ')} errors detected`);
        }
      });
    }
    
    return patterns;
  }

  private identifySignificantChanges(
    severityTrend: Record<MQMSeverity, number>,
    dimensionTrends: Record<MQMDimension, number>,
    errorRateTrend: number,
    qualityScoreTrend: number
  ): Array<{ type: 'improvement' | 'degradation'; area: string; change: number; description: string; }> {
    const changes: Array<{ type: 'improvement' | 'degradation'; area: string; change: number; description: string; }> = [];
    
    // Check quality score changes
    if (Math.abs(qualityScoreTrend) > 10) {
      changes.push({
        type: qualityScoreTrend > 0 ? 'improvement' : 'degradation',
        area: 'Overall Quality',
        change: qualityScoreTrend,
        description: `Quality score ${qualityScoreTrend > 0 ? 'improved' : 'declined'} by ${Math.abs(qualityScoreTrend).toFixed(1)}%`
      });
    }
    
    // Check error rate changes
    if (Math.abs(errorRateTrend) > 20) {
      changes.push({
        type: errorRateTrend < 0 ? 'improvement' : 'degradation',
        area: 'Error Rate',
        change: errorRateTrend,
        description: `Error rate ${errorRateTrend < 0 ? 'decreased' : 'increased'} by ${Math.abs(errorRateTrend).toFixed(1)}%`
      });
    }
    
    // Check severity trends
    Object.entries(severityTrend).forEach(([severity, trend]) => {
      if (Math.abs(trend) > 30) {
        changes.push({
          type: severity === MQMSeverity.CRITICAL ? (trend < 0 ? 'improvement' : 'degradation') : (trend < 0 ? 'improvement' : 'degradation'),
          area: `${severity} Errors`,
          change: trend,
          description: `${severity} errors ${trend > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend).toFixed(1)}%`
        });
      }
    });
    
    return changes;
  }

  private generateReportingMetadata(
    assessments: AssessmentResultWithDetails[],
    errors: MQMErrorInstance[],
    filters?: ReportingFilters
  ): ReportingMetadata {
    const dates = assessments
      .map(a => a.created_at || new Date().toISOString())
      .sort();
    
    const totalSegments = assessments.reduce((sum, a) => sum + (a.total_segments || 0), 0);
    
    return {
      dataRange: {
        from: dates[0] || new Date().toISOString(),
        to: dates[dates.length - 1] || new Date().toISOString()
      },
      totalAssessments: assessments.length,
      totalSegments,
      totalErrors: errors.length,
      lastUpdate: new Date().toISOString(),
      dataQuality: {
        completeness: this.calculateDataCompleteness(assessments),
        consistency: this.calculateDataConsistency(assessments),
        warnings: this.generateDataQualityWarnings(assessments, errors)
      }
    };
  }

  private calculateDataCompleteness(assessments: AssessmentResultWithDetails[]): number {
    if (assessments.length === 0) return 0;
    
    let totalFields = 0;
    let completedFields = 0;
    
    assessments.forEach(assessment => {
      totalFields += 5; // Check key fields
      
      if (assessment.overall_score !== null && assessment.overall_score !== undefined) completedFields++;
      if (assessment.created_at) completedFields++;
      if (assessment.assessor_id) completedFields++;
      if (assessment.total_segments) completedFields++;
      if (assessment.errors && assessment.errors.length > 0) completedFields++;
    });
    
    return totalFields > 0 ? (completedFields / totalFields) * 100 : 0;
  }

  private calculateDataConsistency(assessments: AssessmentResultWithDetails[]): number {
    // Simple consistency check - this could be enhanced
    const assessorIds = new Set(assessments.map(a => a.assessor_id).filter(Boolean));
    const hasConsistentAssessors = assessorIds.size > 0;
    
    const dateRanges = assessments
      .map(a => a.created_at)
      .filter(Boolean)
      .map(d => new Date(d!).getTime());
    
    const hasConsistentDates = dateRanges.length > 0 && 
      Math.max(...dateRanges) - Math.min(...dateRanges) < 365 * 24 * 60 * 60 * 1000; // Within one year
    
    return (hasConsistentAssessors ? 50 : 0) + (hasConsistentDates ? 50 : 0);
  }

  private generateDataQualityWarnings(
    assessments: AssessmentResultWithDetails[],
    errors: MQMErrorInstance[]
  ): string[] {
    const warnings: string[] = [];
    
    const assessmentsWithoutScores = assessments.filter(a => 
      a.overall_score === null || a.overall_score === undefined
    ).length;
    
    if (assessmentsWithoutScores > 0) {
      warnings.push(`${assessmentsWithoutScores} assessments missing quality scores`);
    }
    
    const errorsWithoutSeverity = errors.filter(e => !e.severity).length;
    if (errorsWithoutSeverity > 0) {
      warnings.push(`${errorsWithoutSeverity} errors missing severity classification`);
    }
    
    const recentAssessments = assessments.filter(a => {
      if (!a.created_at) return false;
      const assessmentDate = new Date(a.created_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return assessmentDate > thirtyDaysAgo;
    });
    
    if (recentAssessments.length < 10) {
      warnings.push('Limited recent assessment data may affect trend analysis accuracy');
    }
    
    return warnings;
  }

  /**
   * Clear cache - useful for testing or when data structure changes
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReportingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private mapErrorSeverityToMQM(severity: ErrorSeverity): MQMSeverity {
    if (!severity) return MQMSeverity.MINOR;
    
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return MQMSeverity.CRITICAL;
      case ErrorSeverity.MAJOR:
        return MQMSeverity.MAJOR;
      case ErrorSeverity.MINOR:
        return MQMSeverity.MINOR;
      default:
        return MQMSeverity.MINOR;
    }
  }

  private extractDimensionFromCategory(mqmCategory?: string): MQMDimension | undefined {
    if (!mqmCategory) return undefined;
    
    // Simple mapping based on category names
    const lowerCategory = mqmCategory.toLowerCase();
    
    if (lowerCategory.includes('terminology') || lowerCategory.includes('term')) {
      return MQMDimension.TERMINOLOGY;
    } else if (lowerCategory.includes('accuracy') || lowerCategory.includes('mistranslation') || lowerCategory.includes('omission') || lowerCategory.includes('addition')) {
      return MQMDimension.ACCURACY;
    } else if (lowerCategory.includes('grammar') || lowerCategory.includes('spelling') || lowerCategory.includes('punctuation')) {
      return MQMDimension.LINGUISTIC_CONVENTIONS;
    } else if (lowerCategory.includes('style') || lowerCategory.includes('awkward') || lowerCategory.includes('unclear')) {
      return MQMDimension.STYLE;
    } else if (lowerCategory.includes('locale') || lowerCategory.includes('date') || lowerCategory.includes('currency')) {
      return MQMDimension.LOCALE_CONVENTIONS;
    } else if (lowerCategory.includes('audience') || lowerCategory.includes('register')) {
      return MQMDimension.AUDIENCE_APPROPRIATENESS;
    } else if (lowerCategory.includes('markup') || lowerCategory.includes('design') || lowerCategory.includes('encoding')) {
      return MQMDimension.DESIGN_AND_MARKUP;
    }
    
    return MQMDimension.ACCURACY; // Default fallback
  }
}

export default EnhancedReportingService; 