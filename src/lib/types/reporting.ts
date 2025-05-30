import { MQMScoreResult, MQMDimension, MQMErrorCategory, MQMSeverity } from './assessment';

// Core reporting types
export type ReportType = 
  | 'comprehensive-scorecard'
  | 'executive-dashboard' 
  | 'detailed-analysis'
  | 'project-manager'
  | 'quality-analyst'
  | 'linguistic-review'
  | 'developer';

export type OutputFormat = 'json' | 'html' | 'pdf' | 'csv' | 'xlsx';

export type ReportSection = 
  | 'overview'
  | 'quality-metrics'
  | 'error-breakdown'
  | 'severity-analysis'
  | 'dimension-analysis'
  | 'category-analysis'
  | 'weighting-analysis'
  | 'statistical-summary'
  | 'recommendations'
  | 'trends'
  | 'benchmarks';

// Quality level definitions
export interface QualityThreshold {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  unacceptable: number;
}

export interface QualityLevel {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';
  score: number;
  threshold: number;
  description: string;
}

// Chart and visualization data structures
export interface ChartDataPoint {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface DistributionChart {
  type: 'bar' | 'pie' | 'line' | 'area' | 'scatter';
  title: string;
  data: ChartDataPoint[];
  totalCount?: number;
  unit?: string;
}

export interface TrendChart {
  type: 'line' | 'area' | 'bar';
  title: string;
  data: TrendDataPoint[];
  timeframe: string;
  unit?: string;
}

// Error analysis structures
export interface ErrorBreakdown {
  dimension: MQMDimension;
  category: MQMErrorCategory;
  severity: MQMSeverity;
  count: number;
  percentage: number;
  weightedImpact: number;
  examples?: string[];
  recommendations?: string[];
}

export interface SeverityDistribution {
  severity: MQMSeverity;
  count: number;
  percentage: number;
  weightedScore: number;
  examples: ErrorBreakdown[];
}

export interface DimensionBreakdown {
  dimension: MQMDimension;
  totalErrors: number;
  weightedScore: number;
  percentage: number;
  categories: ErrorBreakdown[];
  impact: 'high' | 'medium' | 'low';
}

// Statistical analysis
export interface StatisticalSummary {
  totalErrors: number;
  errorRate: number;
  weightedScore: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
  variance: number;
  standardDeviation: number;
  significance: 'high' | 'medium' | 'low';
}

// KPI and metrics
export interface QualityKPI {
  name: string;
  value: number;
  unit: string;
  target?: number;
  trend?: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
}

export interface ComplianceMetric {
  name: string;
  passed: boolean;
  score: number;
  threshold: number;
  description: string;
}

// Report content sections
export interface ReportOverview {
  projectName: string;
  assessmentDate: string;
  totalWordCount: number;
  assessmentScope: string;
  qualityLevel: QualityLevel;
  overallScore: number;
  passStatus: boolean;
}

export interface ReportSummary {
  kpis: QualityKPI[];
  complianceMetrics: ComplianceMetric[];
  criticalIssues: ErrorBreakdown[];
  recommendations: string[];
}

export interface ReportDetails {
  errorInventory: ErrorBreakdown[];
  dimensionBreakdown: DimensionBreakdown[];
  severityDistribution: SeverityDistribution[];
  weightingAnalysis: {
    appliedWeights: Record<string, number>;
    weightImpact: Record<string, number>;
    justification: string;
  };
  statisticalSummary: StatisticalSummary;
}

// Stakeholder-specific content
export interface ProjectManagerView {
  issuePrioritization: ErrorBreakdown[];
  progressMetrics: QualityKPI[];
  resourceAllocation: {
    category: string;
    effortEstimate: number;
    priority: 'high' | 'medium' | 'low';
  }[];
  timeline: TrendDataPoint[];
}

export interface QualityAnalystView {
  errorPatterns: {
    pattern: string;
    frequency: number;
    examples: string[];
    recommendation: string;
  }[];
  recurringIssues: ErrorBreakdown[];
  severityTrends: TrendChart;
  categoryAnalysis: DimensionBreakdown[];
}

export interface LinguisticReviewView {
  languageSpecificBreakdown: {
    language: string;
    errors: ErrorBreakdown[];
    linguisticPatterns: string[];
  }[];
  terminologyConsistency: {
    term: string;
    variations: string[];
    recommendation: string;
  }[];
  stylisticIssues: ErrorBreakdown[];
}

export interface DeveloperView {
  technicalMarkupErrors: ErrorBreakdown[];
  formattingIssues: ErrorBreakdown[];
  integrationPoints: {
    system: string;
    issues: string[];
    recommendations: string[];
  }[];
  automationOpportunities: string[];
}

// Main report structure
export interface MQMReport {
  id: string;
  type: ReportType;
  createdAt: string;
  overview: ReportOverview;
  summary: ReportSummary;
  details: ReportDetails;
  charts: {
    dimensionDistribution: DistributionChart;
    severityDistribution: DistributionChart;
    categoryBreakdown: DistributionChart;
    qualityTrends?: TrendChart;
  };
  stakeholderViews?: {
    projectManager?: ProjectManagerView;
    qualityAnalyst?: QualityAnalystView;
    linguisticReview?: LinguisticReviewView;
    developer?: DeveloperView;
  };
  metadata: {
    generatedBy: string;
    version: string;
    configuration: Record<string, any>;
    exportFormats: OutputFormat[];
  };
}

// Report configuration and customization
export interface ReportConfiguration {
  type: ReportType;
  sections: ReportSection[];
  outputFormat: OutputFormat;
  stakeholderView?: keyof MQMReport['stakeholderViews'];
  customization: {
    includeCharts: boolean;
    includeExamples: boolean;
    includeRecommendations: boolean;
    includeStatistics: boolean;
    detailLevel: 'summary' | 'standard' | 'detailed';
  };
  branding?: {
    logo?: string;
    colors?: Record<string, string>;
    company?: string;
  };
}

// Template definitions
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  sections: ReportSection[];
  defaultConfiguration: ReportConfiguration;
  requiredFields: string[];
  customFields?: Record<string, any>;
}

// Export and sharing
export interface ExportOptions {
  format: OutputFormat;
  includeRawData: boolean;
  compression?: 'none' | 'zip' | 'gzip';
  password?: string;
  watermark?: string;
}

export interface ReportExport {
  reportId: string;
  format: OutputFormat;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
  metadata: Record<string, any>;
} 