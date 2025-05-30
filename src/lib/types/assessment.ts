// Assessment-related type definitions for the QA Platform

// Enums for assessment-related fields
export enum AssessmentFramework {
  MQM = 'MQM',
  DQF = 'DQF',
  CUSTOM = 'CUSTOM',
  LISA_QA = 'LISA_QA',
  SAE_J2450 = 'SAE_J2450'
}

export enum AssessmentType {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  HYBRID = 'hybrid',
  REVIEW = 'review'
}

export enum ReviewStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ErrorStatus {
  OPEN = 'open',
  FIXED = 'fixed',
  ACCEPTED = 'accepted',
  DISPUTED = 'disputed',
  WONT_FIX = 'wont_fix'
}

export enum ErrorSeverity {
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export enum ComparisonType {
  BEFORE_AFTER = 'before_after',
  AB_TEST = 'ab_test',
  MULTI_VERSION = 'multi_version',
  ASSESSOR_AGREEMENT = 'assessor_agreement'
}

// === MQM Error Taxonomy (Based on MQM 2.0 / ISO DIS 5060:2024) ===

/**
 * MQM Main Error Dimensions
 * Based on MQM 2.0 specification with 7 high-level dimensions
 */
export enum MQMDimension {
  TERMINOLOGY = 'terminology',
  ACCURACY = 'accuracy', 
  LINGUISTIC_CONVENTIONS = 'linguistic_conventions',
  STYLE = 'style',
  LOCALE_CONVENTIONS = 'locale_conventions',
  AUDIENCE_APPROPRIATENESS = 'audience_appropriateness',
  DESIGN_AND_MARKUP = 'design_and_markup'
}

/**
 * MQM Error Categories for each dimension
 */
export enum MQMTerminologyCategory {
  INCONSISTENT_USE = 'inconsistent_use',
  WRONG_TERM = 'wrong_term',
  INAPPROPRIATE_FOR_DOMAIN = 'inappropriate_for_domain'
}

export enum MQMAccuracyCategory {
  MISTRANSLATION = 'mistranslation',
  OMISSION = 'omission',
  ADDITION = 'addition',
  UNTRANSLATED = 'untranslated',
  DO_NOT_TRANSLATE_MISTRANSLATED = 'do_not_translate_mistranslated'
}

export enum MQLinguisticConventionsCategory {
  GRAMMAR = 'grammar',
  SPELLING = 'spelling',
  PUNCTUATION = 'punctuation',
  CAPITALIZATION = 'capitalization',
  WORD_ORDER = 'word_order',
  FUNCTION_WORDS = 'function_words',
  TENSE_MOOD_ASPECT = 'tense_mood_aspect',
  AGREEMENT = 'agreement',
  WORD_FORM = 'word_form',
  PART_OF_SPEECH = 'part_of_speech'
}

export enum MQMStyleCategory {
  AWKWARD = 'awkward',
  UNNATURAL = 'unnatural',
  INCONSISTENT = 'inconsistent',
  UNCLEAR = 'unclear'
}

export enum MQMLocaleConventionsCategory {
  DATE_TIME = 'date_time',
  CURRENCY = 'currency',
  ADDRESS = 'address',
  TELEPHONE = 'telephone',
  NAME = 'name',
  SORTING = 'sorting',
  MEASUREMENT = 'measurement'
}

export enum MQMAudienceAppropriatenessCategory {
  INAPPROPRIATE_STYLE = 'inappropriate_style',
  INAPPROPRIATE_VARIETY = 'inappropriate_variety',
  INAPPROPRIATE_REGISTER = 'inappropriate_register'
}

export enum MQMDesignAndMarkupCategory {
  CHARACTER_ENCODING = 'character_encoding',
  MARKUP = 'markup',
  MISSING_TEXT = 'missing_text',
  WHITESPACE = 'whitespace',
  TRUNCATION = 'truncation',
  OVERLAP = 'overlap'
}

/**
 * MQM Severity Levels
 * Following MQM standard penalty system
 */
export enum MQMSeverity {
  MINOR = 'minor',        // 1 point penalty
  MAJOR = 'major',        // 5 point penalty  
  CRITICAL = 'critical',  // 10 point penalty
  NEUTRAL = 'neutral'     // 0 point penalty (for positive annotations)
}

/**
 * MQM Error Type Union - combines all category enums
 */
export type MQMErrorCategory = 
  | MQMTerminologyCategory
  | MQMAccuracyCategory  
  | MQLinguisticConventionsCategory
  | MQMStyleCategory
  | MQMLocaleConventionsCategory
  | MQMAudienceAppropriatenessCategory
  | MQMDesignAndMarkupCategory;

/**
 * MQM Error Definition Interface
 * Comprehensive structure for defining MQM errors
 */
export interface MQMErrorDefinition {
  dimension: MQMDimension;
  category: MQMErrorCategory;
  severity: MQMSeverity;
  penalty: number; // Calculated penalty based on severity
  description: string;
  examples?: {
    source: string;
    target_incorrect: string;
    target_correct: string;
    explanation: string;
  }[];
  guidelines?: string;
}

/**
 * MQM Error Instance
 * Represents a specific error found during assessment
 */
export interface MQMErrorInstance {
  id: string;
  dimension: MQMDimension;
  category: MQMErrorCategory;
  severity: MQMSeverity;
  penalty: number;
  
  // Location and content
  segment_id: string;
  start_position?: number;
  end_position?: number;
  source_text: string;
  target_text: string;
  highlighted_text?: string;
  
  // Error details
  description: string;
  correction?: string;
  comment?: string;
  confidence?: number;
  
  // Assessment metadata
  assessor_id: string;
  timestamp: string;
  status: ErrorStatus;
}

/**
 * MQM Assessment Configuration
 * Defines how MQM scoring should be applied
 */
export interface MQMAssessmentConfig {
  // Scoring method
  scoring_unit: 'words' | 'segments' | 'characters';
  unit_count: number;
  
  // Penalty weights (can override defaults)
  severity_weights: {
    [MQMSeverity.MINOR]: number;
    [MQMSeverity.MAJOR]: number; 
    [MQMSeverity.CRITICAL]: number;
    [MQMSeverity.NEUTRAL]: number;
  };
  
  // Dimension weights (for weighted scoring)
  dimension_weights?: {
    [key in MQMDimension]?: number;
  };
  
  // Quality threshold (errors per unit)
  quality_threshold?: number;
  
  // Enabled dimensions/categories  
  enabled_dimensions: MQMDimension[];
  enabled_categories?: MQMErrorCategory[];
  
  // Reporting preferences
  show_neutral_annotations: boolean;
  aggregate_by_dimension: boolean;
  include_confidence_intervals: boolean;
}

/**
 * MQM Score Result
 * Complete scoring breakdown for MQM assessment
 */
export interface MQMScoreResult {
  // Overall metrics
  total_errors: number;
  total_penalty: number;
  error_rate: number; // errors per unit
  mqm_score: number; // 100 - (total_penalty / unit_count * 100)
  
  // Breakdown by dimension
  dimension_breakdown: {
    [key in MQMDimension]: {
      error_count: number;
      penalty: number;
      categories: {
        [category: string]: {
          error_count: number;
          penalty: number;
          severity_distribution: {
            [key in MQMSeverity]: number;
          };
        };
      };
    };
  };
  
  // Breakdown by severity
  severity_breakdown: {
    [key in MQMSeverity]: {
      count: number;
      penalty: number;
      percentage: number;
    };
  };
  
  // Quality assessment
  quality_level: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';
  meets_threshold: boolean;
  
  // Statistical data
  confidence_interval?: {
    lower: number;
    upper: number;
    confidence_level: number;
  };
  
  // Assessment metadata
  assessment_date: string;
  assessor_id: string;
  unit_count: number;
  scoring_unit: string;
}

// Assessment criteria interface
export interface AssessmentCriteria {
  id: string;
  name: string;
  description?: string;
  framework: AssessmentFramework;
  version: string;
  
  // Ownership and scope
  organization_id?: string;
  project_id?: string;
  is_global: boolean;
  is_active: boolean;
  
  // Criteria definition
  criteria_config: {
    dimensions?: Array<{
      name: string;
      weight: number;
      subcriteria?: Array<{
        name: string;
        weight: number;
        description: string;
      }>;
    }>;
    error_types?: Array<{
      type: string;
      severity: ErrorSeverity;
      weight: number;
      description: string;
    }>;
    scoring_rules?: {
      penalty_per_error: number;
      word_count_based: boolean;
      segment_level_scoring: boolean;
    };
  };
  
  weight_distribution: Record<string, number>;
  
  // Scoring configuration
  max_score: number;
  passing_threshold: number;
  
  // Metadata
  tags?: string[];
  metadata: Record<string, any>;
  
  // Audit fields
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

// Assessment template interface
export interface AssessmentTemplate {
  id: string;
  name: string;
  description?: string;
  
  // Template configuration
  criteria_id: string;
  criteria?: AssessmentCriteria;
  template_config: {
    workflow_steps?: Array<{
      step: string;
      required: boolean;
      description: string;
    }>;
    auto_assign?: boolean;
    review_required?: boolean;
    approval_required?: boolean;
    notification_settings?: {
      on_completion: boolean;
      on_approval: boolean;
      reviewers: string[];
    };
  };
  
  // Scope and usage
  organization_id?: string;
  is_public: boolean;
  usage_count: number;
  
  // Audit fields
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Assessment result interface
export interface AssessmentResult {
  id: string;
  session_id: string;
  criteria_id?: string;
  criteria?: AssessmentCriteria;
  
  // Assessment metadata
  assessment_type: AssessmentType;
  assessor_id?: string;
  review_status: ReviewStatus;
  
  // Overall scores
  overall_score?: number;
  mqm_score?: number;
  fluency_score?: number;
  adequacy_score?: number;
  
  // Detailed metrics
  total_segments: number;
  assessed_segments: number;
  error_count: number;
  warning_count: number;
  suggestion_count: number;
  
  // Score breakdown
  score_breakdown: {
    dimension_scores?: Record<string, number>;
    category_scores?: Record<string, number>;
    segment_scores?: Record<string, number>;
  };
  
  quality_metrics: {
    word_count?: number;
    character_count?: number;
    translation_speed?: number; // words per minute
    consistency_score?: number;
    terminology_adherence?: number;
  };
  
  // Assessment metadata
  assessment_duration?: number; // seconds
  confidence_level: number;
  
  // Workflow tracking
  submitted_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  approved_by?: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

// Assessment segment interface
export interface AssessmentSegment {
  id: string;
  assessment_result_id: string;
  session_id: string;
  
  // Segment identification
  segment_id: string; // XLIFF segment ID
  segment_index?: number;
  
  // Content
  source_text: string;
  target_text: string;
  context_text?: string;
  
  // Segment-level scores
  segment_score?: number;
  fluency_score?: number;
  adequacy_score?: number;
  
  // Metrics
  word_count: number;
  character_count: number;
  error_count: number;
  warning_count: number;
  
  // Assessment details
  issues_found: Array<{
    type: string;
    severity: ErrorSeverity;
    description: string;
    category?: string;
    weight?: number;
  }>;
  
  suggestions: Array<{
    type: string;
    text: string;
    confidence?: number;
    source?: 'automatic' | 'manual';
  }>;
  
  notes?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit fields
  assessed_at: string;
  assessed_by?: string;
}

// Enhanced QA error interface
export interface QAError {
  id: string;
  session_id: string;
  assessment_result_id?: string;
  assessment_segment_id?: string;
  
  // Error identification
  segment_id: string;
  error_type: string;
  error_category: string;
  severity: ErrorSeverity;
  
  // Content
  source_text: string;
  target_text: string;
  error_description: string;
  suggestion?: string;
  
  // Assessment details
  confidence_score?: number;
  error_weight: number;
  mqm_category?: string;
  mqm_severity?: string;
  is_critical: boolean;
  
  // Workflow
  status: ErrorStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  
  // Audit fields
  created_at: string;
}

// Assessment comparison interface
export interface AssessmentComparison {
  id: string;
  name: string;
  description?: string;
  
  // Comparison configuration
  comparison_type: ComparisonType;
  
  // Related assessments
  baseline_result_id?: string;
  target_result_id?: string;
  baseline_result?: AssessmentResult;
  target_result?: AssessmentResult;
  
  // Results
  comparison_results: {
    score_improvement?: number;
    error_reduction?: number;
    time_improvement?: number;
    quality_trends?: Array<{
      metric: string;
      baseline: number;
      target: number;
      improvement_percentage: number;
    }>;
    segment_analysis?: {
      improved_segments: number;
      degraded_segments: number;
      unchanged_segments: number;
    };
  };
  
  improvement_percentage?: number;
  statistical_significance?: number;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit fields
  created_by?: string;
  created_at: string;
}

// Extended interfaces with related data
export interface AssessmentResultWithDetails extends AssessmentResult {
  session?: {
    id: string;
    file_name: string;
    project?: {
      id: string;
      name: string;
    };
  };
  
  assessor?: {
    id: string;
    full_name?: string;
    email: string;
  };
  
  segments?: AssessmentSegment[];
  errors?: QAError[];
  comparisons?: AssessmentComparison[];
  
  // Computed fields
  quality_score?: number;
  productivity_score?: number;
  consistency_score?: number;
}

// Types for creating/updating assessments
export interface CreateAssessmentCriteriaData {
  name: string;
  description?: string;
  framework?: AssessmentFramework;
  version?: string;
  organization_id?: string;
  project_id?: string;
  is_global?: boolean;
  criteria_config: AssessmentCriteria['criteria_config'];
  weight_distribution?: Record<string, number>;
  max_score?: number;
  passing_threshold?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAssessmentCriteriaData extends Partial<CreateAssessmentCriteriaData> {
  is_active?: boolean;
}

export interface CreateAssessmentResultData {
  session_id: string;
  criteria_id?: string;
  assessment_type?: AssessmentType;
  assessor_id?: string;
  overall_score?: number;
  mqm_score?: number;
  fluency_score?: number;
  adequacy_score?: number;
  total_segments: number;
  assessed_segments?: number;
  error_count?: number;
  warning_count?: number;
  suggestion_count?: number;
  score_breakdown?: AssessmentResult['score_breakdown'];
  quality_metrics?: AssessmentResult['quality_metrics'];
  assessment_duration?: number;
  confidence_level?: number;
}

export interface UpdateAssessmentResultData extends Partial<CreateAssessmentResultData> {
  review_status?: ReviewStatus;
  submitted_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  approved_by?: string;
}

// Assessment statistics interface
export interface AssessmentStats {
  total_assessments: number;
  completed_assessments: number;
  pending_assessments: number;
  average_quality_score: number;
  average_assessment_time: number; // minutes
  assessments_by_type: Record<AssessmentType, number>;
  assessments_by_status: Record<ReviewStatus, number>;
  quality_trends: Array<{
    date: string;
    average_score: number;
    assessment_count: number;
  }>;
  top_error_categories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
}

// Assessment filter and search interfaces
export interface AssessmentFilters {
  assessment_type?: AssessmentType[];
  review_status?: ReviewStatus[];
  assessor_id?: string;
  criteria_id?: string;
  project_id?: string;
  score_range?: {
    min: number;
    max: number;
  };
  date_range?: {
    from: string;
    to: string;
  };
  search?: string; // Search in file names, error descriptions
}

export interface AssessmentSortOptions {
  field: 'created_at' | 'overall_score' | 'error_count' | 'assessment_duration';
  direction: 'asc' | 'desc';
}

/**
 * Enhanced MQM Weighting System
 * Provides granular control over error type and category weights
 */

/**
 * Project Context - influences weighting decisions
 */
export enum ProjectContext {
  GENERAL = 'general',
  TECHNICAL_DOCUMENTATION = 'technical_documentation',
  LEGAL_CONTENT = 'legal_content', 
  MARKETING_CONTENT = 'marketing_content',
  UI_CONTENT = 'ui_content',
  MEDICAL_CONTENT = 'medical_content',
  FINANCIAL_CONTENT = 'financial_content',
  SAFETY_CRITICAL = 'safety_critical',
  CUSTOMER_FACING = 'customer_facing',
  INTERNAL_COMMUNICATION = 'internal_communication'
}

/**
 * Stakeholder Priority - business priorities that influence weighting
 */
export enum StakeholderPriority {
  ACCURACY_FOCUSED = 'accuracy_focused',      // Prioritize factual correctness
  USER_EXPERIENCE = 'user_experience',       // Prioritize readability and usability
  BRAND_CONSISTENCY = 'brand_consistency',   // Prioritize terminology and style
  TECHNICAL_PRECISION = 'technical_precision', // Prioritize technical accuracy
  REGULATORY_COMPLIANCE = 'regulatory_compliance', // Prioritize legal/compliance accuracy
  SPEED_TO_MARKET = 'speed_to_market',       // More lenient on minor issues
  QUALITY_EXCELLENCE = 'quality_excellence'   // Strict on all aspects
}

/**
 * Category-level weight configuration
 */
export interface MQMCategoryWeights {
  // Terminology categories
  [MQMTerminologyCategory.INCONSISTENT_USE]?: number;
  [MQMTerminologyCategory.WRONG_TERM]?: number;
  [MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN]?: number;
  
  // Accuracy categories
  [MQMAccuracyCategory.MISTRANSLATION]?: number;
  [MQMAccuracyCategory.OMISSION]?: number;
  [MQMAccuracyCategory.ADDITION]?: number;
  [MQMAccuracyCategory.UNTRANSLATED]?: number;
  [MQMAccuracyCategory.DO_NOT_TRANSLATE_MISTRANSLATED]?: number;
  
  // Linguistic conventions categories
  [MQLinguisticConventionsCategory.GRAMMAR]?: number;
  [MQLinguisticConventionsCategory.SPELLING]?: number;
  [MQLinguisticConventionsCategory.PUNCTUATION]?: number;
  [MQLinguisticConventionsCategory.CAPITALIZATION]?: number;
  [MQLinguisticConventionsCategory.WORD_ORDER]?: number;
  [MQLinguisticConventionsCategory.FUNCTION_WORDS]?: number;
  [MQLinguisticConventionsCategory.TENSE_MOOD_ASPECT]?: number;
  [MQLinguisticConventionsCategory.AGREEMENT]?: number;
  [MQLinguisticConventionsCategory.WORD_FORM]?: number;
  [MQLinguisticConventionsCategory.PART_OF_SPEECH]?: number;
  
  // Style categories
  [MQMStyleCategory.AWKWARD]?: number;
  [MQMStyleCategory.UNNATURAL]?: number;
  [MQMStyleCategory.INCONSISTENT]?: number;
  [MQMStyleCategory.UNCLEAR]?: number;
  
  // Locale conventions categories
  [MQMLocaleConventionsCategory.DATE_TIME]?: number;
  [MQMLocaleConventionsCategory.CURRENCY]?: number;
  [MQMLocaleConventionsCategory.ADDRESS]?: number;
  [MQMLocaleConventionsCategory.TELEPHONE]?: number;
  [MQMLocaleConventionsCategory.NAME]?: number;
  [MQMLocaleConventionsCategory.SORTING]?: number;
  [MQMLocaleConventionsCategory.MEASUREMENT]?: number;
  
  // Audience appropriateness categories
  [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE]?: number;
  [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_VARIETY]?: number;
  [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_REGISTER]?: number;
  
  // Design and markup categories
  [MQMDesignAndMarkupCategory.CHARACTER_ENCODING]?: number;
  [MQMDesignAndMarkupCategory.MARKUP]?: number;
  [MQMDesignAndMarkupCategory.MISSING_TEXT]?: number;
  [MQMDesignAndMarkupCategory.WHITESPACE]?: number;
  [MQMDesignAndMarkupCategory.TRUNCATION]?: number;
  [MQMDesignAndMarkupCategory.OVERLAP]?: number;
}

/**
 * Weighting profile with context and rationale
 */
export interface MQMWeightingProfile {
  id: string;
  name: string;
  description: string;
  context: ProjectContext[];
  stakeholder_priority: StakeholderPriority;
  
  // Weight configurations
  severity_weights?: {
    [MQMSeverity.MINOR]: number;
    [MQMSeverity.MAJOR]: number;
    [MQMSeverity.CRITICAL]: number;
    [MQMSeverity.NEUTRAL]: number;
  };
  
  dimension_weights?: {
    [key in MQMDimension]?: number;
  };
  
  category_weights?: Partial<MQMCategoryWeights>;
  
  // Configuration metadata
  rationale: string;
  use_cases: string[];
  recommended_for: string[];
  created_by?: string;
  created_at?: string;
  is_system_profile: boolean;
}

/**
 * Dynamic weight adjustment based on project metadata
 */
export interface MQMDynamicWeightConfig {
  // Content-based adjustments
  content_type_multipliers?: {
    [content_type: string]: number;
  };
  
  // Domain-specific adjustments
  domain_multipliers?: {
    [domain: string]: number;
  };
  
  // Criticality-based adjustments
  criticality_multipliers?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  
  // Audience-based adjustments
  audience_multipliers?: {
    [audience_type: string]: number;
  };
  
  // Temporal adjustments (for project phases)
  phase_multipliers?: {
    [phase: string]: number;
  };
}

/**
 * Weight validation result
 */
export interface WeightValidationResult {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
  normalized_weights?: any;
  total_weight?: number;
}

/**
 * Enhanced MQM Assessment Configuration with advanced weighting
 */
export interface MQMEnhancedAssessmentConfig extends MQMAssessmentConfig {
  // Enhanced weighting options
  weighting_profile?: MQMWeightingProfile;
  category_weights?: Partial<MQMCategoryWeights>;
  dynamic_weight_config?: MQMDynamicWeightConfig;
  
  // Weight normalization options
  normalize_weights?: boolean;
  weight_total_target?: number; // Target sum for normalized weights
  
  // Context for dynamic adjustments
  project_context?: ProjectContext;
  stakeholder_priority?: StakeholderPriority;
  content_metadata?: {
    domain?: string;
    content_type?: string;
    criticality?: 'low' | 'medium' | 'high' | 'critical';
    audience_type?: string;
    project_phase?: string;
  };
}

/**
 * MQM Reporting System
 * Comprehensive report templates and data structures for different stakeholders
 */

/**
 * Report format types
 */
export enum MQMReportFormat {
  JSON = 'json',
  HTML = 'html',
  PDF = 'pdf',
  CSV = 'csv',
  XLSX = 'xlsx'
}

/**
 * Report template types for different stakeholders
 */
export enum MQMReportTemplate {
  EXECUTIVE_SUMMARY = 'executive_summary',
  PROJECT_MANAGER = 'project_manager',
  QUALITY_ANALYST = 'quality_analyst',
  LINGUISTIC_REVIEW = 'linguistic_review',
  DEVELOPER_TECHNICAL = 'developer_technical',
  COMPREHENSIVE_SCORECARD = 'comprehensive_scorecard',
  DETAILED_ANALYSIS = 'detailed_analysis',
  COMPARISON_REPORT = 'comparison_report'
}

/**
 * Visualization data for charts and graphs
 */
export interface MQMVisualizationData {
  // Dimension breakdown chart data
  dimension_chart: {
    labels: string[];
    error_counts: number[];
    penalties: number[];
    percentages: number[];
  };
  
  // Severity distribution chart data
  severity_chart: {
    labels: string[];
    counts: number[];
    penalties: number[];
    colors: string[];
  };
  
  // Quality trend data (for historical comparison)
  quality_trend?: {
    dates: string[];
    scores: number[];
    error_rates: number[];
  };
  
  // Category heatmap data
  category_heatmap: {
    dimensions: string[];
    categories: string[];
    values: number[][]; // 2D array for heatmap
  };
}

/**
 * Executive summary report data
 */
export interface MQMExecutiveSummary {
  // Key metrics
  overall_quality: {
    mqm_score: number;
    quality_level: string;
    pass_fail_status: 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
    threshold_met: boolean;
    confidence_level?: number;
  };
  
  // Critical insights
  critical_issues: {
    count: number;
    top_critical_categories: string[];
    business_impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  
  // Comparative metrics
  benchmarks?: {
    industry_average?: number;
    previous_assessment?: number;
    target_score?: number;
    improvement_percentage?: number;
  };
  
  // Key recommendations
  recommendations: string[];
  
  // Risk assessment
  risk_indicators: {
    regulatory_compliance: boolean;
    user_experience_impact: 'LOW' | 'MEDIUM' | 'HIGH';
    brand_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

/**
 * Project manager focused report data
 */
export interface MQMProjectManagerReport {
  // Progress metrics
  progress: {
    total_segments: number;
    assessed_segments: number;
    completion_percentage: number;
    estimated_remaining_time?: number;
  };
  
  // Issue prioritization
  issue_priorities: {
    critical_blockers: number;
    high_priority: number;
    medium_priority: number;
    low_priority: number;
  };
  
  // Resource allocation guidance
  resource_allocation: {
    linguistic_review_hours: number;
    technical_review_hours: number;
    revision_cycles_estimated: number;
    specialist_expertise_needed: string[];
  };
  
  // Quality gates
  quality_gates: {
    current_gate: string;
    gate_status: 'PASS' | 'FAIL' | 'PENDING';
    next_milestone: string;
    blockers: string[];
  };
  
  // Team performance metrics
  team_metrics?: {
    assessor_consistency: number;
    assessment_velocity: number; // segments per hour
    error_detection_accuracy: number;
  };
}

/**
 * Quality analyst detailed report data
 */
export interface MQMQualityAnalystReport {
  // Error pattern analysis
  error_patterns: {
    recurring_issues: Array<{
      category: string;
      frequency: number;
      trend: 'INCREASING' | 'STABLE' | 'DECREASING';
      root_cause?: string;
    }>;
    
    hotspot_analysis: Array<{
      content_section: string;
      error_density: number;
      primary_issues: string[];
    }>;
  };
  
  // Statistical analysis
  statistical_insights: {
    error_distribution_chi_square: number;
    severity_correlation: number;
    confidence_intervals: Record<string, { lower: number; upper: number }>;
    outlier_segments: string[];
  };
  
  // Quality trends
  quality_trends: {
    dimension_scores: Record<MQMDimension, number[]>;
    improvement_areas: string[];
    degradation_areas: string[];
    stability_metrics: Record<string, number>;
  };
  
  // Detailed breakdowns
  detailed_breakdowns: {
    by_content_type: Record<string, MQMScoreResult>;
    by_complexity: Record<string, MQMScoreResult>;
    by_assessor: Record<string, MQMScoreResult>;
  };
}

/**
 * Linguistic review focused report data
 */
export interface MQLinguisticReviewReport {
  // Language-specific analysis
  linguistic_analysis: {
    terminology_consistency: {
      score: number;
      inconsistent_terms: Array<{
        term: string;
        variations: string[];
        frequency: number;
        recommendation: string;
      }>;
    };
    
    style_consistency: {
      score: number;
      style_violations: Array<{
        category: string;
        examples: string[];
        impact: 'LOW' | 'MEDIUM' | 'HIGH';
      }>;
    };
    
    cultural_appropriateness: {
      score: number;
      cultural_issues: Array<{
        issue: string;
        context: string;
        severity: MQMSeverity;
        recommendation: string;
      }>;
    };
  };
  
  // Translation quality metrics
  translation_metrics?: {
    fluency_score: number;
    adequacy_score: number;
    creativity_score?: number;
    readability_score: number;
  };
  
  // Reviewer recommendations
  linguistic_recommendations: {
    terminology_updates: string[];
    style_guide_revisions: string[];
    training_needs: string[];
    process_improvements: string[];
  };
}

/**
 * Developer/technical focused report data
 */
export interface MQMDeveloperTechnicalReport {
  // Technical issue breakdown
  technical_issues: {
    markup_errors: Array<{
      type: string;
      count: number;
      severity: MQMSeverity;
      locations: string[];
      fix_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    
    encoding_issues: Array<{
      issue: string;
      affected_segments: number;
      character_ranges: string[];
      fix_priority: number;
    }>;
    
    formatting_problems: Array<{
      problem: string;
      frequency: number;
      ui_impact: boolean;
      automated_fix_available: boolean;
    }>;
  };
  
  // Integration points
  integration_considerations: {
    api_compatibility: boolean;
    cms_integration_issues: string[];
    localization_tool_compatibility: boolean;
    deployment_considerations: string[];
  };
  
  // Technical recommendations
  technical_recommendations: {
    automation_opportunities: string[];
    quality_check_integrations: string[];
    process_optimizations: string[];
    tool_enhancements: string[];
  };
}

/**
 * Comprehensive scorecard data structure
 */
export interface MQMComprehensiveScorecard {
  // Header information
  assessment_header: {
    project_name: string;
    assessment_date: string;
    assessor_info: string;
    content_metadata: {
      word_count: number;
      segment_count: number;
      content_type: string;
      domain: string;
    };
  };
  
  // Overall score section
  overall_score: {
    mqm_score: number;
    quality_level: string;
    error_rate: number;
    threshold_compliance: boolean;
    confidence_interval?: {
      lower: number;
      upper: number;
      confidence_level: number;
    };
  };
  
  // Detailed breakdowns
  score_breakdowns: {
    by_dimension: Record<MQMDimension, {
      score: number;
      error_count: number;
      penalty: number;
      percentage: number;
      top_categories: string[];
    }>;
    
    by_severity: Record<MQMSeverity, {
      count: number;
      penalty: number;
      percentage: number;
      impact_description: string;
    }>;
    
    by_category: Record<string, {
      error_count: number;
      penalty: number;
      examples: string[];
      trend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
    }>;
  };
  
  // Weighting information
  weighting_details?: {
    profile_used: string;
    adjustments_applied: string[];
    weight_impact_analysis: string;
    alternative_profiles: string[];
  };
  
  // Visualization data
  charts: MQMVisualizationData;
  
  // Actionable insights
  insights: {
    strengths: string[];
    improvement_areas: string[];
    critical_actions: string[];
    recommendations: string[];
  };
}

/**
 * Master report configuration and generation
 */
export interface MQMReportConfig {
  // Report metadata
  template: MQMReportTemplate;
  format: MQMReportFormat;
  title: string;
  generated_at: string;
  generated_by?: string;
  
  // Content configuration
  include_visualizations: boolean;
  include_examples: boolean;
  include_recommendations: boolean;
  include_statistical_analysis: boolean;
  
  // Customization options
  custom_branding?: {
    company_name: string;
    logo_url?: string;
    color_scheme?: string;
    custom_css?: string;
  };
  
  // Data filtering
  filters?: {
    dimension_filter?: MQMDimension[];
    severity_filter?: MQMSeverity[];
    date_range?: {
      start: string;
      end: string;
    };
  };
  
  // Output options
  output_options: {
    filename?: string;
    compression?: boolean;
    encryption?: boolean;
    watermark?: string;
  };
}

/**
 * Complete generated report structure
 */
export interface MQMGeneratedReport {
  // Report metadata
  config: MQMReportConfig;
  generated_at: string;
  version: string;
  
  // Core data (varies by template)
  data: 
    | MQMExecutiveSummary
    | MQMProjectManagerReport
    | MQMQualityAnalystReport
    | MQLinguisticReviewReport
    | MQMDeveloperTechnicalReport
    | MQMComprehensiveScorecard;
  
  // Source scoring data
  source_score: MQMScoreResult;
  
  // Enhanced scoring info (if available)
  enhanced_info?: {
    weighting_info: any;
    computed_weights: any;
    validation_warnings: string[];
  };
  
  // Report-specific visualizations
  visualizations: MQMVisualizationData;
  
  // Export metadata
  export_info: {
    file_size?: number;
    checksum?: string;
    format_version: string;
  };
}

/**
 * Report comparison data for before/after analysis
 */
export interface MQMReportComparison {
  baseline_report: MQMGeneratedReport;
  target_report: MQMGeneratedReport;
  
  comparison_metrics: {
    score_improvement: number;
    error_reduction: number;
    quality_level_change: string;
    
    dimension_improvements: Record<MQMDimension, number>;
    severity_changes: Record<MQMSeverity, number>;
    category_improvements: Record<string, number>;
  };
  
  insights: {
    significant_improvements: string[];
    areas_of_concern: string[];
    recommendations: string[];
    success_factors: string[];
  };
  
  visualization_data: {
    before_after_charts: MQMVisualizationData;
    improvement_trends: any;
    comparative_metrics: any;
  };
} 