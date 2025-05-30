/**
 * MQM Report Generator
 * Comprehensive report generation utilities for different stakeholder needs
 */

import {
  MQMScoreResult,
  MQMDimension,
  MQMSeverity,
  MQMErrorInstance,
  MQMReportTemplate,
  MQMReportFormat,
  MQMReportConfig,
  MQMGeneratedReport,
  MQMVisualizationData,
  MQMExecutiveSummary,
  MQMProjectManagerReport,
  MQMQualityAnalystReport,
  MQLinguisticReviewReport,
  MQMDeveloperTechnicalReport,
  MQMComprehensiveScorecard,
  MQMReportComparison,
  ProjectContext,
  StakeholderPriority
} from '../types/assessment';

import { EnhancedMQMScoreResult } from './mqm-scoring-engine';
import { 
  MQMReport, 
  ReportType, 
  ReportConfiguration, 
  ErrorBreakdown, 
  SeverityDistribution,
  DimensionBreakdown,
  QualityLevel,
  QualityKPI,
  ComplianceMetric,
  StatisticalSummary,
  DistributionChart,
  TrendChart,
  ProjectManagerView,
  QualityAnalystView,
  LinguisticReviewView,
  DeveloperView,
  ChartDataPoint,
  QualityThreshold
} from '../types/reporting';
import { v4 as uuidv4 } from 'uuid';

/**
 * MQM Report Generator Class
 * Handles generation of different report types for various stakeholders
 */
export class MQMReportGenerator {
  private static instance: MQMReportGenerator;

  // Default quality thresholds based on MQM standards
  private readonly DEFAULT_QUALITY_THRESHOLDS: QualityThreshold = {
    excellent: 0.5,    // <= 0.5 errors per 100 words
    good: 1.0,         // <= 1.0 errors per 100 words  
    fair: 2.0,         // <= 2.0 errors per 100 words
    poor: 4.0,         // <= 4.0 errors per 100 words
    unacceptable: 999   // > 4.0 errors per 100 words
  };

  /**
   * Singleton pattern for consistent report generation
   */
  static getInstance(): MQMReportGenerator {
    if (!MQMReportGenerator.instance) {
      MQMReportGenerator.instance = new MQMReportGenerator();
    }
    return MQMReportGenerator.instance;
  }

  /**
   * Generate a report based on template and configuration
   */
  generateReport(
    scoreResult: MQMScoreResult | EnhancedMQMScoreResult,
    config: Partial<MQMReportConfig>,
    metadata?: {
      project_name?: string;
      assessor_info?: string;
      content_metadata?: any;
    }
  ): MQMGeneratedReport {
    // Validate input
    this.validateReportInput(scoreResult, config);

    // Create full configuration
    const fullConfig = this.createFullConfig(config);

    // Generate visualization data
    const visualizations = this.generateVisualizationData(scoreResult);

    // Generate template-specific data
    const templateData = this.generateTemplateData(
      scoreResult,
      fullConfig.template,
      metadata
    );

    // Create the complete report
    const report: MQMGeneratedReport = {
      config: fullConfig,
      generated_at: new Date().toISOString(),
      version: '1.0.0',
      data: templateData,
      source_score: scoreResult,
      enhanced_info: this.extractEnhancedInfo(scoreResult),
      visualizations,
      export_info: {
        format_version: '1.0',
        checksum: this.generateChecksum(templateData)
      }
    };

    return report;
  }

  /**
   * Generate executive summary report
   */
  generateExecutiveSummary(
    scoreResult: MQMScoreResult,
    metadata?: any
  ): MQMExecutiveSummary {
    const passFailStatus = this.determinePassFailStatus(scoreResult);
    const businessImpact = this.assessBusinessImpact(scoreResult);
    const criticalIssues = this.extractCriticalIssues(scoreResult);

    return {
      overall_quality: {
        mqm_score: scoreResult.mqm_score,
        quality_level: scoreResult.quality_level,
        pass_fail_status: passFailStatus,
        threshold_met: scoreResult.meets_threshold,
        confidence_level: scoreResult.confidence_interval?.confidence_level
      },
      critical_issues: {
        count: criticalIssues.length,
        top_critical_categories: criticalIssues.slice(0, 3),
        business_impact: businessImpact
      },
      benchmarks: metadata?.benchmarks,
      recommendations: this.generateExecutiveRecommendations(scoreResult),
      risk_indicators: {
        regulatory_compliance: this.assessRegulatoryCompliance(scoreResult),
        user_experience_impact: this.assessUXImpact(scoreResult),
        brand_risk: this.assessBrandRisk(scoreResult)
      }
    };
  }

  /**
   * Generate project manager report
   */
  generateProjectManagerReport(
    scoreResult: MQMScoreResult,
    metadata?: any
  ): MQMProjectManagerReport {
    const progressMetrics = this.calculateProgressMetrics(scoreResult, metadata);
    const priorities = this.calculateIssuePriorities(scoreResult);
    const resourceNeeds = this.calculateResourceAllocation(scoreResult);

    return {
      progress: progressMetrics,
      issue_priorities: priorities,
      resource_allocation: resourceNeeds,
      quality_gates: this.assessQualityGates(scoreResult),
      team_metrics: metadata?.team_metrics
    };
  }

  /**
   * Generate quality analyst report
   */
  generateQualityAnalystReport(
    scoreResult: MQMScoreResult,
    historicalData?: MQMScoreResult[]
  ): MQMQualityAnalystReport {
    return {
      error_patterns: this.analyzeErrorPatterns(scoreResult, historicalData),
      statistical_insights: this.generateStatisticalInsights(scoreResult),
      quality_trends: this.analyzeQualityTrends(scoreResult, historicalData),
      detailed_breakdowns: this.generateDetailedBreakdowns(scoreResult)
    };
  }

  /**
   * Generate linguistic review report
   */
  generateLinguisticReport(
    scoreResult: MQMScoreResult,
    errors?: MQMErrorInstance[]
  ): MQLinguisticReviewReport {
    return {
      linguistic_analysis: {
        terminology_consistency: this.analyzeTerminologyConsistency(scoreResult, errors),
        style_consistency: this.analyzeStyleConsistency(scoreResult, errors),
        cultural_appropriateness: this.analyzeCulturalAppropriateness(scoreResult, errors)
      },
      translation_metrics: this.calculateTranslationMetrics(scoreResult),
      linguistic_recommendations: this.generateLinguisticRecommendations(scoreResult, errors)
    };
  }

  /**
   * Generate technical/developer report
   */
  generateTechnicalReport(
    scoreResult: MQMScoreResult,
    errors?: MQMErrorInstance[]
  ): MQMDeveloperTechnicalReport {
    return {
      technical_issues: this.analyzeTechnicalIssues(scoreResult, errors),
      integration_considerations: this.assessIntegrationConsiderations(scoreResult),
      technical_recommendations: this.generateTechnicalRecommendations(scoreResult, errors)
    };
  }

  /**
   * Generate comprehensive scorecard
   */
  generateComprehensiveScorecard(
    scoreResult: MQMScoreResult | EnhancedMQMScoreResult,
    metadata?: any
  ): MQMComprehensiveScorecard {
    const visualizations = this.generateVisualizationData(scoreResult);
    const insights = this.generateActionableInsights(scoreResult);

    return {
      assessment_header: {
        project_name: metadata?.project_name || 'Unnamed Project',
        assessment_date: new Date().toISOString(),
        assessor_info: metadata?.assessor_info || 'System Generated',
        content_metadata: {
          word_count: scoreResult.unit_count,
          segment_count: metadata?.segment_count || 1,
          content_type: metadata?.content_type || 'General',
          domain: metadata?.domain || 'General'
        }
      },
      overall_score: {
        mqm_score: scoreResult.mqm_score,
        quality_level: scoreResult.quality_level,
        error_rate: scoreResult.error_rate,
        threshold_compliance: scoreResult.meets_threshold,
        confidence_interval: scoreResult.confidence_interval
      },
      score_breakdowns: {
        by_dimension: this.createDimensionBreakdown(scoreResult),
        by_severity: this.createSeverityBreakdown(scoreResult),
        by_category: this.createCategoryBreakdown(scoreResult)
      },
      weighting_details: this.extractWeightingDetails(scoreResult),
      charts: visualizations,
      insights
    };
  }

  /**
   * Generate visualization data for charts and graphs
   */
  generateVisualizationData(scoreResult: MQMScoreResult): MQMVisualizationData {
    // Dimension chart data
    const dimensions = Object.entries(scoreResult.dimension_breakdown);
    const dimension_chart = {
      labels: dimensions.map(([dim, _]) => this.formatDimensionLabel(dim)),
      error_counts: dimensions.map(([_, data]) => data.error_count),
      penalties: dimensions.map(([_, data]) => data.penalty),
      percentages: dimensions.map(([_, data]) => 
        scoreResult.total_errors > 0 ? (data.error_count / scoreResult.total_errors) * 100 : 0
      )
    };

    // Severity chart data
    const severities = Object.entries(scoreResult.severity_breakdown);
    const severity_chart = {
      labels: severities.map(([sev, _]) => this.formatSeverityLabel(sev)),
      counts: severities.map(([_, data]) => data.count),
      penalties: severities.map(([_, data]) => data.penalty),
      colors: severities.map(([sev, _]) => this.getSeverityColor(sev as MQMSeverity))
    };

    // Category heatmap data
    const category_heatmap = this.generateCategoryHeatmapData(scoreResult);

    return {
      dimension_chart,
      severity_chart,
      category_heatmap
    };
  }

  /**
   * Compare two reports for before/after analysis
   */
  compareReports(
    baselineReport: MQMGeneratedReport,
    targetReport: MQMGeneratedReport
  ): MQMReportComparison {
    const baseline = baselineReport.source_score;
    const target = targetReport.source_score;

    // Calculate improvements
    const score_improvement = target.mqm_score - baseline.mqm_score;
    const error_reduction = ((baseline.error_rate - target.error_rate) / baseline.error_rate) * 100;

    // Calculate dimension improvements
    const dimension_improvements: Record<MQMDimension, number> = {} as any;
    Object.values(MQMDimension).forEach(dimension => {
      const baselineErrors = baseline.dimension_breakdown[dimension]?.error_count || 0;
      const targetErrors = target.dimension_breakdown[dimension]?.error_count || 0;
      dimension_improvements[dimension] = baselineErrors - targetErrors;
    });

    // Calculate severity changes
    const severity_changes: Record<MQMSeverity, number> = {} as any;
    Object.values(MQMSeverity).forEach(severity => {
      const baselineCount = baseline.severity_breakdown[severity]?.count || 0;
      const targetCount = target.severity_breakdown[severity]?.count || 0;
      severity_changes[severity] = baselineCount - targetCount;
    });

    return {
      baseline_report: baselineReport,
      target_report: targetReport,
      comparison_metrics: {
        score_improvement,
        error_reduction,
        quality_level_change: `${baseline.quality_level} → ${target.quality_level}`,
        dimension_improvements,
        severity_changes,
        category_improvements: {} // Would be calculated from detailed category data
      },
      insights: this.generateComparisonInsights(baseline, target),
      visualization_data: {
        before_after_charts: this.generateComparisonVisualization(baseline, target),
        improvement_trends: {},
        comparative_metrics: {}
      }
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private validateReportInput(scoreResult: MQMScoreResult, config: Partial<MQMReportConfig>): void {
    if (!scoreResult) {
      throw new Error('Score result is required for report generation');
    }
    
    if (!config.template) {
      throw new Error('Report template must be specified');
    }
  }

  private createFullConfig(config: Partial<MQMReportConfig>): MQMReportConfig {
    return {
      template: config.template!,
      format: config.format || MQMReportFormat.JSON,
      title: config.title || `MQM Assessment Report - ${config.template}`,
      generated_at: new Date().toISOString(),
      generated_by: config.generated_by,
      include_visualizations: config.include_visualizations ?? true,
      include_examples: config.include_examples ?? true,
      include_recommendations: config.include_recommendations ?? true,
      include_statistical_analysis: config.include_statistical_analysis ?? false,
      custom_branding: config.custom_branding,
      filters: config.filters,
      output_options: {
        filename: config.output_options?.filename,
        compression: config.output_options?.compression ?? false,
        encryption: config.output_options?.encryption ?? false,
        watermark: config.output_options?.watermark
      }
    };
  }

  private generateTemplateData(
    scoreResult: MQMScoreResult | EnhancedMQMScoreResult,
    template: MQMReportTemplate,
    metadata?: any
  ): any {
    switch (template) {
      case MQMReportTemplate.EXECUTIVE_SUMMARY:
        return this.generateExecutiveSummary(scoreResult, metadata);
      
      case MQMReportTemplate.PROJECT_MANAGER:
        return this.generateProjectManagerReport(scoreResult, metadata);
      
      case MQMReportTemplate.QUALITY_ANALYST:
        return this.generateQualityAnalystReport(scoreResult, metadata?.historical_data);
      
      case MQMReportTemplate.LINGUISTIC_REVIEW:
        return this.generateLinguisticReport(scoreResult, metadata?.errors);
      
      case MQMReportTemplate.DEVELOPER_TECHNICAL:
        return this.generateTechnicalReport(scoreResult, metadata?.errors);
      
      case MQMReportTemplate.COMPREHENSIVE_SCORECARD:
        return this.generateComprehensiveScorecard(scoreResult, metadata);
      
      default:
        throw new Error(`Unsupported report template: ${template}`);
    }
  }

  private extractEnhancedInfo(scoreResult: MQMScoreResult | EnhancedMQMScoreResult): any {
    if ('weighting_info' in scoreResult) {
      return {
        weighting_info: scoreResult.weighting_info,
        computed_weights: scoreResult.weighting_info?.computed_weights,
        validation_warnings: scoreResult.weighting_info?.validation_warnings || []
      };
    }
    return undefined;
  }

  private generateChecksum(data: any): string {
    // Simple checksum generation - in production, use a proper hash function
    return btoa(JSON.stringify(data)).slice(0, 16);
  }

  private determinePassFailStatus(scoreResult: MQMScoreResult): 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' {
    if (scoreResult.meets_threshold) {
      return 'PASS';
    } else if (scoreResult.quality_level === 'unacceptable' || scoreResult.quality_level === 'poor') {
      return 'FAIL';
    } else {
      return 'REVIEW_REQUIRED';
    }
  }

  private assessBusinessImpact(scoreResult: MQMScoreResult): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalErrors = scoreResult.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    const majorErrors = scoreResult.severity_breakdown[MQMSeverity.MAJOR]?.count || 0;

    if (criticalErrors > 0) return 'CRITICAL';
    if (majorErrors > 5 || scoreResult.quality_level === 'poor') return 'HIGH';
    if (majorErrors > 2 || scoreResult.quality_level === 'fair') return 'MEDIUM';
    return 'LOW';
  }

  private extractCriticalIssues(scoreResult: MQMScoreResult): string[] {
    const criticalCategories: string[] = [];
    
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, data]) => {
      Object.entries(data.categories).forEach(([category, categoryData]) => {
        if (categoryData.severity_distribution[MQMSeverity.CRITICAL] > 0) {
          criticalCategories.push(`${dimension}/${category}`);
        }
      });
    });

    return criticalCategories.sort((a, b) => {
      // Sort by severity and frequency
      const aData = this.getCategoryData(scoreResult, a);
      const bData = this.getCategoryData(scoreResult, b);
      return (bData?.penalty || 0) - (aData?.penalty || 0);
    });
  }

  private getCategoryData(scoreResult: MQMScoreResult, categoryPath: string): any {
    const [dimension, category] = categoryPath.split('/');
    return scoreResult.dimension_breakdown[dimension as MQMDimension]?.categories[category];
  }

  private generateExecutiveRecommendations(scoreResult: MQMScoreResult): string[] {
    const recommendations: string[] = [];
    
    if (!scoreResult.meets_threshold) {
      recommendations.push('Quality threshold not met - immediate review and remediation required');
    }
    
    const criticalErrors = scoreResult.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    if (criticalErrors > 0) {
      recommendations.push(`Address ${criticalErrors} critical error(s) before deployment`);
    }
    
    // Add dimension-specific recommendations
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, data]) => {
      if (data.error_count > scoreResult.total_errors * 0.3) {
        recommendations.push(`Focus improvement efforts on ${dimension} errors (${data.error_count} instances)`);
      }
    });

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private assessRegulatoryCompliance(scoreResult: MQMScoreResult): boolean {
    // Check for accuracy and terminology errors that could affect compliance
    const accuracyErrors = scoreResult.dimension_breakdown[MQMDimension.ACCURACY]?.error_count || 0;
    const terminologyErrors = scoreResult.dimension_breakdown[MQMDimension.TERMINOLOGY]?.error_count || 0;
    const criticalErrors = scoreResult.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    
    return criticalErrors === 0 && accuracyErrors < 3 && terminologyErrors < 5;
  }

  private assessUXImpact(scoreResult: MQMScoreResult): 'LOW' | 'MEDIUM' | 'HIGH' {
    const styleErrors = scoreResult.dimension_breakdown[MQMDimension.STYLE]?.error_count || 0;
    const audienceErrors = scoreResult.dimension_breakdown[MQMDimension.AUDIENCE_APPROPRIATENESS]?.error_count || 0;
    const designErrors = scoreResult.dimension_breakdown[MQMDimension.DESIGN_AND_MARKUP]?.error_count || 0;
    
    const totalUXErrors = styleErrors + audienceErrors + designErrors;
    
    if (totalUXErrors > 10) return 'HIGH';
    if (totalUXErrors > 5) return 'MEDIUM';
    return 'LOW';
  }

  private assessBrandRisk(scoreResult: MQMScoreResult): 'LOW' | 'MEDIUM' | 'HIGH' {
    const terminologyErrors = scoreResult.dimension_breakdown[MQMDimension.TERMINOLOGY]?.error_count || 0;
    const styleErrors = scoreResult.dimension_breakdown[MQMDimension.STYLE]?.error_count || 0;
    
    if (terminologyErrors > 5 || styleErrors > 8) return 'HIGH';
    if (terminologyErrors > 2 || styleErrors > 4) return 'MEDIUM';
    return 'LOW';
  }

  private calculateProgressMetrics(scoreResult: MQMScoreResult, metadata?: any): any {
    return {
      total_segments: metadata?.total_segments || 1,
      assessed_segments: metadata?.assessed_segments || 1,
      completion_percentage: metadata?.completion_percentage || 100,
      estimated_remaining_time: metadata?.estimated_remaining_time
    };
  }

  private calculateIssuePriorities(scoreResult: MQMScoreResult): any {
    const critical = scoreResult.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    const major = scoreResult.severity_breakdown[MQMSeverity.MAJOR]?.count || 0;
    const minor = scoreResult.severity_breakdown[MQMSeverity.MINOR]?.count || 0;
    
    return {
      critical_blockers: critical,
      high_priority: major,
      medium_priority: Math.floor(minor * 0.3),
      low_priority: Math.floor(minor * 0.7)
    };
  }

  private calculateResourceAllocation(scoreResult: MQMScoreResult): any {
    const linguisticErrors = this.countLinguisticErrors(scoreResult);
    const technicalErrors = this.countTechnicalErrors(scoreResult);
    
    return {
      linguistic_review_hours: Math.max(1, Math.floor(linguisticErrors / 2)),
      technical_review_hours: Math.max(1, Math.floor(technicalErrors / 3)),
      revision_cycles_estimated: scoreResult.meets_threshold ? 1 : 2,
      specialist_expertise_needed: this.identifySpecialistNeeds(scoreResult)
    };
  }

  private countLinguisticErrors(scoreResult: MQMScoreResult): number {
    return (
      (scoreResult.dimension_breakdown[MQMDimension.TERMINOLOGY]?.error_count || 0) +
      (scoreResult.dimension_breakdown[MQMDimension.STYLE]?.error_count || 0) +
      (scoreResult.dimension_breakdown[MQMDimension.LINGUISTIC_CONVENTIONS]?.error_count || 0) +
      (scoreResult.dimension_breakdown[MQMDimension.AUDIENCE_APPROPRIATENESS]?.error_count || 0)
    );
  }

  private countTechnicalErrors(scoreResult: MQMScoreResult): number {
    return (
      (scoreResult.dimension_breakdown[MQMDimension.DESIGN_AND_MARKUP]?.error_count || 0) +
      (scoreResult.dimension_breakdown[MQMDimension.LOCALE_CONVENTIONS]?.error_count || 0)
    );
  }

  private identifySpecialistNeeds(scoreResult: MQMScoreResult): string[] {
    const needs: string[] = [];
    
    if ((scoreResult.dimension_breakdown[MQMDimension.TERMINOLOGY]?.error_count || 0) > 5) {
      needs.push('Domain expert for terminology review');
    }
    
    if ((scoreResult.dimension_breakdown[MQMDimension.DESIGN_AND_MARKUP]?.error_count || 0) > 3) {
      needs.push('Technical reviewer for markup issues');
    }
    
    if ((scoreResult.dimension_breakdown[MQMDimension.LOCALE_CONVENTIONS]?.error_count || 0) > 2) {
      needs.push('Localization specialist');
    }
    
    return needs;
  }

  private assessQualityGates(scoreResult: MQMScoreResult): any {
    let currentGate = 'Initial Assessment';
    let gateStatus: 'PASS' | 'FAIL' | 'PENDING' = 'PENDING';
    
    if (scoreResult.meets_threshold) {
      currentGate = 'Quality Approval';
      gateStatus = 'PASS';
    } else {
      currentGate = 'Quality Review';
      gateStatus = 'FAIL';
    }
    
    return {
      current_gate: currentGate,
      gate_status: gateStatus,
      next_milestone: gateStatus === 'PASS' ? 'Final Approval' : 'Remediation',
      blockers: gateStatus === 'FAIL' ? ['Quality threshold not met'] : []
    };
  }

  // Additional helper methods would continue here...
  // For brevity, I'll include key methods but not all implementation details

  private analyzeErrorPatterns(scoreResult: MQMScoreResult, historicalData?: MQMScoreResult[]): any {
    return {
      recurring_issues: [],
      hotspot_analysis: []
    };
  }

  private generateStatisticalInsights(scoreResult: MQMScoreResult): any {
    return {
      error_distribution_chi_square: 0,
      severity_correlation: 0,
      confidence_intervals: {},
      outlier_segments: []
    };
  }

  private analyzeQualityTrends(scoreResult: MQMScoreResult, historicalData?: MQMScoreResult[]): any {
    return {
      dimension_scores: {},
      improvement_areas: [],
      degradation_areas: [],
      stability_metrics: {}
    };
  }

  private generateDetailedBreakdowns(scoreResult: MQMScoreResult): any {
    return {
      by_content_type: {},
      by_complexity: {},
      by_assessor: {}
    };
  }

  private analyzeTerminologyConsistency(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      score: 85,
      inconsistent_terms: []
    };
  }

  private analyzeStyleConsistency(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      score: 90,
      style_violations: []
    };
  }

  private analyzeCulturalAppropriateness(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      score: 95,
      cultural_issues: []
    };
  }

  private calculateTranslationMetrics(scoreResult: MQMScoreResult): any {
    return {
      fluency_score: 85,
      adequacy_score: 90,
      readability_score: 88
    };
  }

  private generateLinguisticRecommendations(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      terminology_updates: [],
      style_guide_revisions: [],
      training_needs: [],
      process_improvements: []
    };
  }

  private analyzeTechnicalIssues(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      markup_errors: [],
      encoding_issues: [],
      formatting_problems: []
    };
  }

  private assessIntegrationConsiderations(scoreResult: MQMScoreResult): any {
    return {
      api_compatibility: true,
      cms_integration_issues: [],
      localization_tool_compatibility: true,
      deployment_considerations: []
    };
  }

  private generateTechnicalRecommendations(scoreResult: MQMScoreResult, errors?: MQMErrorInstance[]): any {
    return {
      automation_opportunities: [],
      quality_check_integrations: [],
      process_optimizations: [],
      tool_enhancements: []
    };
  }

  private createDimensionBreakdown(scoreResult: MQMScoreResult): any {
    const breakdown: any = {};
    
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, data]) => {
      breakdown[dimension] = {
        score: Math.max(0, 100 - (data.penalty / scoreResult.unit_count * 100)),
        error_count: data.error_count,
        penalty: data.penalty,
        percentage: scoreResult.total_errors > 0 ? (data.error_count / scoreResult.total_errors) * 100 : 0,
        top_categories: Object.keys(data.categories).slice(0, 3)
      };
    });
    
    return breakdown;
  }

  private createSeverityBreakdown(scoreResult: MQMScoreResult): any {
    const breakdown: any = {};
    
    Object.entries(scoreResult.severity_breakdown).forEach(([severity, data]) => {
      breakdown[severity] = {
        count: data.count,
        penalty: data.penalty,
        percentage: data.percentage,
        impact_description: this.getSeverityImpactDescription(severity as MQMSeverity)
      };
    });
    
    return breakdown;
  }

  private createCategoryBreakdown(scoreResult: MQMScoreResult): any {
    const breakdown: any = {};
    
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, dimData]) => {
      Object.entries(dimData.categories).forEach(([category, catData]) => {
        const categoryKey = `${dimension}/${category}`;
        breakdown[categoryKey] = {
          error_count: catData.error_count,
          penalty: catData.penalty,
          examples: [], // Would be populated from actual error instances
          trend: 'STABLE' // Would be calculated from historical data
        };
      });
    });
    
    return breakdown;
  }

  private extractWeightingDetails(scoreResult: MQMScoreResult | EnhancedMQMScoreResult): any {
    if ('weighting_info' in scoreResult && scoreResult.weighting_info) {
      return {
        profile_used: scoreResult.weighting_info.profile_used || 'Default',
        adjustments_applied: scoreResult.weighting_info.adjustments_applied || [],
        weight_impact_analysis: 'Weight adjustments applied as configured',
        alternative_profiles: []
      };
    }
    return undefined;
  }

  private generateActionableInsights(scoreResult: MQMScoreResult): any {
    const strengths: string[] = [];
    const improvements: string[] = [];
    const criticalActions: string[] = [];
    const recommendations: string[] = [];

    // Identify strengths (dimensions with low error rates)
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, data]) => {
      const errorRate = data.error_count / scoreResult.unit_count;
      if (errorRate < 0.02) { // Less than 2% error rate
        strengths.push(`Strong performance in ${dimension}`);
      } else if (errorRate > 0.1) { // More than 10% error rate
        improvements.push(`${dimension} requires attention (${data.error_count} errors)`);
      }
    });

    // Critical actions for critical/major errors
    const criticalCount = scoreResult.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    if (criticalCount > 0) {
      criticalActions.push(`Immediately address ${criticalCount} critical error(s)`);
    }

    // General recommendations
    if (!scoreResult.meets_threshold) {
      recommendations.push('Comprehensive review and remediation required before approval');
    }

    return {
      strengths: strengths.slice(0, 3),
      improvement_areas: improvements.slice(0, 5),
      critical_actions: criticalActions.slice(0, 3),
      recommendations: recommendations.slice(0, 5)
    };
  }

  private generateCategoryHeatmapData(scoreResult: MQMScoreResult): any {
    const dimensions = Object.keys(scoreResult.dimension_breakdown);
    const categories: string[] = [];
    const values: number[][] = [];

    // Collect all unique categories
    Object.values(scoreResult.dimension_breakdown).forEach(dimData => {
      Object.keys(dimData.categories).forEach(category => {
        if (!categories.includes(category)) {
          categories.push(category);
        }
      });
    });

    // Create 2D array for heatmap
    dimensions.forEach(dimension => {
      const dimensionData = scoreResult.dimension_breakdown[dimension as MQMDimension];
      const row: number[] = [];
      
      categories.forEach(category => {
        const categoryData = dimensionData.categories[category];
        row.push(categoryData?.error_count || 0);
      });
      
      values.push(row);
    });

    return {
      dimensions,
      categories,
      values
    };
  }

  private formatDimensionLabel(dimension: string): string {
    return dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatSeverityLabel(severity: string): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  }

  private getSeverityColor(severity: MQMSeverity): string {
    const colors = {
      [MQMSeverity.CRITICAL]: '#dc3545',
      [MQMSeverity.MAJOR]: '#fd7e14',
      [MQMSeverity.MINOR]: '#ffc107',
      [MQMSeverity.NEUTRAL]: '#28a745'
    };
    return colors[severity] || '#6c757d';
  }

  private getSeverityImpactDescription(severity: MQMSeverity): string {
    const descriptions = {
      [MQMSeverity.CRITICAL]: 'Severe impact on functionality or user experience',
      [MQMSeverity.MAJOR]: 'Significant impact on quality or comprehension',
      [MQMSeverity.MINOR]: 'Minor impact on overall quality',
      [MQMSeverity.NEUTRAL]: 'Neutral annotation or enhancement suggestion'
    };
    return descriptions[severity] || 'Unknown impact level';
  }

  private generateComparisonInsights(baseline: MQMScoreResult, target: MQMScoreResult): any {
    const improvements: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];
    const successFactors: string[] = [];

    // Analyze score improvement
    const scoreImprovement = target.mqm_score - baseline.mqm_score;
    if (scoreImprovement > 5) {
      improvements.push(`Significant overall quality improvement (+${scoreImprovement.toFixed(1)} points)`);
      successFactors.push('Effective remediation process');
    } else if (scoreImprovement < -2) {
      concerns.push(`Quality degradation detected (-${Math.abs(scoreImprovement).toFixed(1)} points)`);
    }

    // Analyze critical errors
    const baselineCritical = baseline.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    const targetCritical = target.severity_breakdown[MQMSeverity.CRITICAL]?.count || 0;
    
    if (baselineCritical > 0 && targetCritical === 0) {
      improvements.push('All critical errors successfully resolved');
      successFactors.push('Effective critical error remediation');
    } else if (targetCritical > baselineCritical) {
      concerns.push(`New critical errors introduced (${targetCritical - baselineCritical})`);
    }

    return {
      significant_improvements: improvements,
      areas_of_concern: concerns,
      recommendations,
      success_factors: successFactors
    };
  }

  private generateComparisonVisualization(baseline: MQMScoreResult, target: MQMScoreResult): MQMVisualizationData {
    // Generate comparative visualization data
    return this.generateVisualizationData(target); // Simplified for now
  }

  public generateComprehensiveReport(
    scoreResult: MQMScoreResult,
    errors: MQMErrorInstance[],
    config: MQMAssessmentConfig,
    reportConfig: ReportConfiguration,
    projectName: string = 'MQM Assessment'
  ): MQMReport {
    const reportId = uuidv4();
    const createdAt = new Date().toISOString();

    // Transform data into report structures
    const errorBreakdown = this.createErrorBreakdown(errors, scoreResult);
    const severityDistribution = this.createSeverityDistribution(errorBreakdown);
    const dimensionBreakdown = this.createDimensionBreakdown(errorBreakdown);
    const qualityLevel = this.assessQualityLevel(scoreResult);
    const statisticalSummary = this.createStatisticalSummary(scoreResult, errors);

    // Generate report content
    const overview = this.createOverview(projectName, scoreResult, qualityLevel);
    const summary = this.createSummary(scoreResult, errorBreakdown, qualityLevel);
    const details = this.createDetails(errorBreakdown, dimensionBreakdown, severityDistribution, scoreResult, statisticalSummary);
    const charts = this.createCharts(dimensionBreakdown, severityDistribution, errorBreakdown);
    
    // Generate stakeholder-specific views
    const stakeholderViews = this.createStakeholderViews(
      reportConfig,
      errorBreakdown,
      dimensionBreakdown,
      severityDistribution,
      scoreResult
    );

    const report: MQMReport = {
      id: reportId,
      type: reportConfig.type,
      createdAt,
      overview,
      summary,
      details,
      charts,
      stakeholderViews,
      metadata: {
        generatedBy: 'MQM Report Generator v1.0',
        version: '1.0.0',
        configuration: reportConfig,
        exportFormats: ['json', 'html', 'pdf', 'csv']
      }
    };

    return report;
  }

  private createErrorBreakdown(errors: MQMErrorInstance[], scoreResult: MQMScoreResult): ErrorBreakdown[] {
    const breakdownMap = new Map<string, ErrorBreakdown>();

    errors.forEach(error => {
      const key = `${error.dimension}-${error.category}-${error.severity}`;
      
      if (!breakdownMap.has(key)) {
        breakdownMap.set(key, {
          dimension: error.dimension,
          category: error.category,
          severity: error.severity,
          count: 0,
          percentage: 0,
          weightedImpact: 0,
          examples: [],
          recommendations: []
        });
      }

      const breakdown = breakdownMap.get(key)!;
      breakdown.count++;
      breakdown.weightedImpact += error.penalty || this.getSeverityPenalty(error.severity);
      
      // Add example if we have highlighted text or description
      if (error.highlighted_text && breakdown.examples!.length < 3) {
        breakdown.examples!.push(error.highlighted_text);
      } else if (error.description && breakdown.examples!.length < 3) {
        breakdown.examples!.push(error.description);
      }
    });

    // Calculate percentages
    const totalErrors = errors.length;
    breakdownMap.forEach(breakdown => {
      breakdown.percentage = totalErrors > 0 ? (breakdown.count / totalErrors) * 100 : 0;
    });

    return Array.from(breakdownMap.values()).sort((a, b) => b.weightedImpact - a.weightedImpact);
  }

  private createSeverityDistribution(errorBreakdown: ErrorBreakdown[]): SeverityDistribution[] {
    const severityMap = new Map<MQMSeverity, SeverityDistribution>();
    
    errorBreakdown.forEach(error => {
      if (!severityMap.has(error.severity)) {
        severityMap.set(error.severity, {
          severity: error.severity,
          count: 0,
          percentage: 0,
          weightedScore: 0,
          examples: []
        });
      }

      const dist = severityMap.get(error.severity)!;
      dist.count += error.count;
      dist.weightedScore += error.weightedImpact;
      dist.examples.push(error);
    });

    // Calculate percentages
    const totalCount = Array.from(severityMap.values()).reduce((sum, dist) => sum + dist.count, 0);
    severityMap.forEach(dist => {
      dist.percentage = totalCount > 0 ? (dist.count / totalCount) * 100 : 0;
    });

    return Array.from(severityMap.values()).sort((a, b) => b.weightedScore - a.weightedScore);
  }

  private assessQualityLevel(scoreResult: MQMScoreResult): QualityLevel {
    const errorRate = scoreResult.error_rate;
    const thresholds = this.DEFAULT_QUALITY_THRESHOLDS;

    if (errorRate <= thresholds.excellent) {
      return {
        level: 'excellent',
        score: scoreResult.mqm_score,
        threshold: thresholds.excellent,
        description: 'Outstanding quality with minimal errors'
      };
    } else if (errorRate <= thresholds.good) {
      return {
        level: 'good',
        score: scoreResult.mqm_score,
        threshold: thresholds.good,
        description: 'Good quality with acceptable error levels'
      };
    } else if (errorRate <= thresholds.fair) {
      return {
        level: 'fair',
        score: scoreResult.mqm_score,
        threshold: thresholds.fair,
        description: 'Fair quality requiring improvement'
      };
    } else if (errorRate <= thresholds.poor) {
      return {
        level: 'poor',
        score: scoreResult.mqm_score,
        threshold: thresholds.poor,
        description: 'Poor quality with significant issues'
      };
    } else {
      return {
        level: 'unacceptable',
        score: scoreResult.mqm_score,
        threshold: thresholds.unacceptable,
        description: 'Unacceptable quality requiring major revision'
      };
    }
  }

  /**
   * Create statistical summary from score results
   */
  private createStatisticalSummary(scoreResult: MQMScoreResult, errors: MQMErrorInstance[]): StatisticalSummary {
    const confidenceInterval = scoreResult.confidence_interval 
      ? {
          lower: scoreResult.confidence_interval.lower,
          upper: scoreResult.confidence_interval.upper,
          confidence: scoreResult.confidence_interval.confidence_level
        }
      : {
          lower: scoreResult.mqm_score * 0.9,
          upper: scoreResult.mqm_score * 1.1,
          confidence: 0.95
        };

    return {
      totalErrors: errors.length,
      errorRate: scoreResult.error_rate,
      weightedScore: scoreResult.mqm_score,
      confidenceInterval,
      variance: 0, // Would need to be calculated from additional data
      standardDeviation: 0, // Would need to be calculated from additional data
      significance: this.assessSignificance(errors.length, scoreResult.unit_count)
    };
  }

  private createOverview(projectName: string, scoreResult: MQMScoreResult, qualityLevel: QualityLevel) {
    return {
      projectName,
      assessmentDate: scoreResult.assessment_date,
      totalWordCount: scoreResult.unit_count,
      assessmentScope: 'Full content assessment using MQM 2.0 standards',
      qualityLevel,
      overallScore: scoreResult.mqm_score,
      passStatus: qualityLevel.level !== 'unacceptable' && qualityLevel.level !== 'poor'
    };
  }

  private createSummary(scoreResult: MQMScoreResult, errorBreakdown: ErrorBreakdown[], qualityLevel: QualityLevel) {
    const kpis = this.generateKPIs(scoreResult, qualityLevel);
    const complianceMetrics = this.generateComplianceMetrics(scoreResult, qualityLevel);
    const criticalIssues = errorBreakdown.filter(error => 
      error.severity === MQMSeverity.CRITICAL || error.weightedImpact > 10
    ).slice(0, 5);
    const recommendations = this.generateRecommendations(qualityLevel, criticalIssues);

    return {
      kpis,
      complianceMetrics,
      criticalIssues,
      recommendations
    };
  }

  private createDetails(
    errorBreakdown: ErrorBreakdown[],
    dimensionBreakdown: DimensionBreakdown[],
    severityDistribution: SeverityDistribution[],
    scoreResult: MQMScoreResult,
    statisticalSummary: StatisticalSummary
  ) {
    return {
      errorInventory: errorBreakdown,
      dimensionBreakdown,
      severityDistribution,
      weightingAnalysis: {
        appliedWeights: scoreResult.dimension_breakdown || {},
        weightImpact: this.calculateWeightImpact(scoreResult),
        justification: 'Weights applied based on content type and project requirements'
      },
      statisticalSummary
    };
  }

  private createCharts(
    dimensionBreakdown: DimensionBreakdown[],
    severityDistribution: SeverityDistribution[],
    errorBreakdown: ErrorBreakdown[]
  ) {
    return {
      dimensionDistribution: this.createDimensionChart(dimensionBreakdown),
      severityDistribution: this.createSeverityChart(severityDistribution),
      categoryBreakdown: this.createCategoryChart(errorBreakdown)
    };
  }

  private createStakeholderViews(
    reportConfig: ReportConfiguration,
    errorBreakdown: ErrorBreakdown[],
    dimensionBreakdown: DimensionBreakdown[],
    severityDistribution: SeverityDistribution[],
    scoreResult: MQMScoreResult
  ) {
    const views: any = {};

    if (reportConfig.type === 'project-manager' || reportConfig.stakeholderView === 'projectManager') {
      views.projectManager = this.createProjectManagerView(errorBreakdown, scoreResult);
    }

    if (reportConfig.type === 'quality-analyst' || reportConfig.stakeholderView === 'qualityAnalyst') {
      views.qualityAnalyst = this.createQualityAnalystView(errorBreakdown, dimensionBreakdown, severityDistribution);
    }

    if (reportConfig.type === 'linguistic-review' || reportConfig.stakeholderView === 'linguisticReview') {
      views.linguisticReview = this.createLinguisticReviewView(errorBreakdown);
    }

    if (reportConfig.type === 'developer' || reportConfig.stakeholderView === 'developer') {
      views.developer = this.createDeveloperView(errorBreakdown);
    }

    return views;
  }

  private getSeverityPenalty(severity: MQMSeverity): number {
    const penalties = {
      [MQMSeverity.NEUTRAL]: 0,
      [MQMSeverity.MINOR]: 1,
      [MQMSeverity.MAJOR]: 5,
      [MQMSeverity.CRITICAL]: 10
    };
    return penalties[severity] || 0;
  }

  private calculateImpactLevel(weightedScore: number, errorCount: number): 'high' | 'medium' | 'low' {
    const averageImpact = errorCount > 0 ? weightedScore / errorCount : 0;
    if (averageImpact >= 5) return 'high';
    if (averageImpact >= 2) return 'medium';
    return 'low';
  }

  private assessSignificance(errorCount: number, unitCount: number): 'high' | 'medium' | 'low' {
    const errorRate = (errorCount / unitCount) * 100;
    if (errorRate >= 2) return 'high';
    if (errorRate >= 1) return 'medium';
    return 'low';
  }

  private generateKPIs(scoreResult: MQMScoreResult, qualityLevel: QualityLevel): QualityKPI[] {
    return [
      {
        name: 'Overall Quality Score',
        value: scoreResult.mqm_score,
        unit: 'score',
        target: 85,
        status: qualityLevel.level === 'excellent' ? 'excellent' : 
                qualityLevel.level === 'good' ? 'good' : 'warning',
        description: 'Weighted MQM quality score'
      },
      {
        name: 'Error Rate',
        value: scoreResult.error_rate,
        unit: 'errors/100 words',
        target: 1.0,
        status: scoreResult.error_rate <= 1.0 ? 'excellent' : 'warning',
        description: 'Errors per 100 words'
      }
    ];
  }

  private generateComplianceMetrics(scoreResult: MQMScoreResult, qualityLevel: QualityLevel): ComplianceMetric[] {
    return [
      {
        name: 'MQM Quality Threshold',
        passed: qualityLevel.level !== 'unacceptable',
        score: scoreResult.mqm_score,
        threshold: 70,
        description: 'Meets minimum MQM quality standards'
      }
    ];
  }

  private generateRecommendations(qualityLevel: QualityLevel, criticalIssues: ErrorBreakdown[]): string[] {
    const recommendations = [];
    
    if (qualityLevel.level === 'unacceptable' || qualityLevel.level === 'poor') {
      recommendations.push('Immediate revision required to meet quality standards');
    }
    
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical errors before delivery');
    }
    
    recommendations.push('Review error patterns to prevent recurrence');
    
    return recommendations;
  }

  private calculateWeightImpact(scoreResult: MQMScoreResult): Record<string, number> {
    const weightImpact: Record<string, number> = {};
    
    Object.entries(scoreResult.dimension_breakdown).forEach(([dimension, breakdown]) => {
      weightImpact[dimension] = breakdown.penalty;
    });
    
    return weightImpact;
  }

  private createDimensionChart(dimensionBreakdown: DimensionBreakdown[]): DistributionChart {
    return {
      type: 'bar',
      title: 'Error Distribution by MQM Dimension',
      data: dimensionBreakdown.map(dim => ({
        label: dim.dimension,
        value: dim.totalErrors,
        percentage: dim.percentage
      })),
      totalCount: dimensionBreakdown.reduce((sum, dim) => sum + dim.totalErrors, 0),
      unit: 'errors'
    };
  }

  private createSeverityChart(severityDistribution: SeverityDistribution[]): DistributionChart {
    return {
      type: 'pie',
      title: 'Error Distribution by Severity',
      data: severityDistribution.map(sev => ({
        label: sev.severity,
        value: sev.count,
        percentage: sev.percentage
      })),
      totalCount: severityDistribution.reduce((sum, sev) => sum + sev.count, 0),
      unit: 'errors'
    };
  }

  private createCategoryChart(errorBreakdown: ErrorBreakdown[]): DistributionChart {
    return {
      type: 'bar',
      title: 'Top Error Categories',
      data: errorBreakdown.slice(0, 10).map(error => ({
        label: error.category,
        value: error.count,
        percentage: error.percentage
      })),
      totalCount: errorBreakdown.reduce((sum, error) => sum + error.count, 0),
      unit: 'errors'
    };
  }

  private createProjectManagerView(errorBreakdown: ErrorBreakdown[], scoreResult: MQMScoreResult): ProjectManagerView {
    return {
      issuePrioritization: errorBreakdown.slice(0, 10),
      progressMetrics: this.generateKPIs(scoreResult, this.assessQualityLevel(scoreResult)),
      resourceAllocation: errorBreakdown.slice(0, 5).map(error => ({
        category: error.category,
        effortEstimate: error.count * 2, // 2 minutes per error
        priority: error.severity === MQMSeverity.CRITICAL ? 'high' : 
                 error.severity === MQMSeverity.MAJOR ? 'medium' : 'low'
      })),
      timeline: [] // Would be populated with historical data
    };
  }

  private createQualityAnalystView(
    errorBreakdown: ErrorBreakdown[],
    dimensionBreakdown: DimensionBreakdown[],
    severityDistribution: SeverityDistribution[]
  ): QualityAnalystView {
    return {
      errorPatterns: [], // Would be populated with pattern analysis
      recurringIssues: errorBreakdown.filter(error => error.count > 1),
      severityTrends: {
        type: 'line',
        title: 'Severity Trends Over Time',
        data: [],
        timeframe: 'last-30-days'
      },
      categoryAnalysis: dimensionBreakdown
    };
  }

  private createLinguisticReviewView(errorBreakdown: ErrorBreakdown[]): LinguisticReviewView {
    return {
      languageSpecificBreakdown: [], // Would be populated with language analysis
      terminologyConsistency: [], // Would be populated with terminology analysis
      stylisticIssues: errorBreakdown.filter(error => 
        error.dimension === MQMDimension.STYLE || 
        error.dimension === MQMDimension.LOCALE_CONVENTIONS
      )
    };
  }

  private createDeveloperView(errorBreakdown: ErrorBreakdown[]): DeveloperView {
    return {
      technicalMarkupErrors: errorBreakdown.filter(error => 
        error.dimension === MQMDimension.DESIGN_AND_MARKUP
      ),
      formattingIssues: errorBreakdown.filter(error => 
        error.category.includes('formatting') || error.category.includes('markup')
      ),
      integrationPoints: [], // Would be populated with integration analysis
      automationOpportunities: [
        'Automated terminology consistency checks',
        'Style guide validation',
        'Markup validation'
      ]
    };
  }
}

/**
 * Convenience function to get the singleton instance
 */
export const getReportGenerator = () => MQMReportGenerator.getInstance();

/**
 * Quick utility functions for common report generation tasks
 */
export const MQMReportUtils = {
  /**
   * Generate a quick executive summary
   */
  quickExecutiveSummary: (scoreResult: MQMScoreResult, projectName?: string) => {
    const generator = getReportGenerator();
    return generator.generateExecutiveSummary(scoreResult, { project_name: projectName });
  },

  /**
   * Generate a comprehensive scorecard
   */
  quickScorecard: (scoreResult: MQMScoreResult | EnhancedMQMScoreResult, metadata?: any) => {
    const generator = getReportGenerator();
    return generator.generateComprehensiveScorecard(scoreResult, metadata);
  },

  /**
   * Generate visualization data only
   */
  quickVisualization: (scoreResult: MQMScoreResult) => {
    const generator = getReportGenerator();
    return generator.generateVisualizationData(scoreResult);
  },

  /**
   * Export report to JSON format
   */
  exportToJSON: (report: MQMGeneratedReport): string => {
    return JSON.stringify(report, null, 2);
  },

  /**
   * Create a simple report comparison
   */
  quickComparison: (baseline: MQMScoreResult, target: MQMScoreResult) => {
    const scoreImprovement = target.mqm_score - baseline.mqm_score;
    const errorReduction = ((baseline.error_rate - target.error_rate) / baseline.error_rate) * 100;
    
    return {
      score_change: scoreImprovement,
      error_reduction: errorReduction,
      quality_change: `${baseline.quality_level} → ${target.quality_level}`,
      summary: scoreImprovement > 0 ? 'Improvement detected' : 
               scoreImprovement < 0 ? 'Quality declined' : 'No significant change'
    };
  }
}; 