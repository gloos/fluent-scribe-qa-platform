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
import { 
  MQMScoreResult, 
  MQMDimension, 
  MQMErrorCategory, 
  MQMSeverity,
  MQMErrorInstance,
  MQMAssessmentConfig
} from '../types/assessment';
import { v4 as uuidv4 } from 'uuid';

/**
 * Comprehensive MQM Report Generator
 * 
 * Transforms MQM assessment results into detailed reports for different stakeholders.
 * Supports multiple output formats and customizable report configurations.
 */
export class ReportGenerator {
  private static instance: ReportGenerator;
  
  // Default quality thresholds based on MQM standards
  private readonly DEFAULT_QUALITY_THRESHOLDS: QualityThreshold = {
    excellent: 0.5,    // <= 0.5 errors per 100 words
    good: 1.0,         // <= 1.0 errors per 100 words  
    fair: 2.0,         // <= 2.0 errors per 100 words
    poor: 4.0,         // <= 4.0 errors per 100 words
    unacceptable: 999   // > 4.0 errors per 100 words
  };

  private constructor() {}

  public static getInstance(): ReportGenerator {
    if (!ReportGenerator.instance) {
      ReportGenerator.instance = new ReportGenerator();
    }
    return ReportGenerator.instance;
  }

  /**
   * Generate a comprehensive MQM report from assessment results
   */
  public generateReport(
    scoreResult: MQMScoreResult,
    errors: MQMErrorInstance[],
    config: MQMAssessmentConfig,
    reportConfig: ReportConfiguration,
    projectName: string = 'MQM Assessment'
  ): MQMReport {
    const reportId = uuidv4();
    const createdAt = new Date().toISOString();

    // Transform data into report structures
    const errorBreakdown = this.createErrorBreakdown(errors);
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
        generatedBy: 'MQM Report Generator v2.0',
        version: '2.0.0',
        configuration: reportConfig,
        exportFormats: ['json', 'html', 'pdf', 'csv']
      }
    };

    return report;
  }

  /**
   * Create error breakdown from error instances
   */
  private createErrorBreakdown(errors: MQMErrorInstance[]): ErrorBreakdown[] {
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

  /**
   * Create severity distribution analysis
   */
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

  /**
   * Create dimension breakdown analysis
   */
  private createDimensionBreakdown(errorBreakdown: ErrorBreakdown[]): DimensionBreakdown[] {
    const dimensionMap = new Map<MQMDimension, DimensionBreakdown>();

    errorBreakdown.forEach(error => {
      if (!dimensionMap.has(error.dimension)) {
        dimensionMap.set(error.dimension, {
          dimension: error.dimension,
          totalErrors: 0,
          weightedScore: 0,
          percentage: 0,
          categories: [],
          impact: 'low'
        });
      }

      const breakdown = dimensionMap.get(error.dimension)!;
      breakdown.totalErrors += error.count;
      breakdown.weightedScore += error.weightedImpact;
      breakdown.categories.push(error);
    });

    // Calculate percentages and impact levels
    const totalErrors = Array.from(dimensionMap.values()).reduce((sum, dim) => sum + dim.totalErrors, 0);
    dimensionMap.forEach(breakdown => {
      breakdown.percentage = totalErrors > 0 ? (breakdown.totalErrors / totalErrors) * 100 : 0;
      breakdown.impact = this.calculateImpactLevel(breakdown.weightedScore, breakdown.totalErrors);
    });

    return Array.from(dimensionMap.values()).sort((a, b) => b.weightedScore - a.weightedScore);
  }

  /**
   * Assess overall quality level based on score result
   */
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

  /**
   * Create report overview section
   */
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

  /**
   * Create report summary section
   */
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

  /**
   * Create detailed analysis section
   */
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

  /**
   * Create visualization charts
   */
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

  /**
   * Create stakeholder-specific views
   */
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

  // Helper methods for stakeholder views, charts, and utilities

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