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