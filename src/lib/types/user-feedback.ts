// User Feedback System Types
// Supports structured feedback collection for error categorization improvement

export interface UserFeedback {
  id: string;
  
  // Feedback target
  target_type: FeedbackTargetType;
  target_id: string; // error_id, categorization_id, assessment_result_id, etc.
  
  // User information
  user_id: string;
  user_role: string;
  
  // Feedback content
  feedback_type: FeedbackType;
  rating?: FeedbackRating;
  category_suggestion?: CategorySuggestion;
  comment?: string;
  
  // Context
  session_id?: string;
  assessment_result_id?: string;
  original_categorization?: MQMErrorCategorization;
  suggested_categorization?: MQMErrorCategorization;
  
  // Metadata
  confidence_level: number; // 0-1 scale
  is_expert_feedback: boolean;
  feedback_source: FeedbackSource;
  
  // Processing status
  status: FeedbackStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution?: FeedbackResolution;
  resolution_notes?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export enum FeedbackTargetType {
  ERROR_CATEGORIZATION = 'error_categorization',
  CATEGORY_DEFINITION = 'category_definition',
  SEVERITY_ASSIGNMENT = 'severity_assignment',
  TAXONOMY_STRUCTURE = 'taxonomy_structure',
  ASSESSMENT_RESULT = 'assessment_result'
}

export enum FeedbackType {
  RATING = 'rating',
  CATEGORY_CORRECTION = 'category_correction',
  SEVERITY_CORRECTION = 'severity_correction',
  SUGGESTION = 'suggestion',
  COMPLAINT = 'complaint',
  GENERAL_COMMENT = 'general_comment'
}

export enum FeedbackRating {
  VERY_POOR = 1,
  POOR = 2,
  FAIR = 3,
  GOOD = 4,
  EXCELLENT = 5
}

export enum FeedbackSource {
  MANUAL_REVIEW = 'manual_review',
  GUIDED_FEEDBACK = 'guided_feedback',
  QUICK_RATING = 'quick_rating',
  DETAILED_FORM = 'detailed_form',
  EXPERT_REVIEW = 'expert_review'
}

export enum FeedbackStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented',
  DUPLICATE = 'duplicate'
}

export interface FeedbackResolution {
  action_taken: ResolutionAction;
  taxonomy_change_id?: string;
  change_description?: string;
  impact_assessment?: string;
}

export enum ResolutionAction {
  NO_ACTION = 'no_action',
  CATEGORY_UPDATED = 'category_updated',
  SEVERITY_UPDATED = 'severity_updated',
  DEFINITION_CLARIFIED = 'definition_clarified',
  TRAINING_MATERIAL_UPDATED = 'training_material_updated',
  TAXONOMY_RESTRUCTURED = 'taxonomy_restructured'
}

// Category suggestion structure
export interface CategorySuggestion {
  suggested_category: string;
  suggested_subcategory?: string;
  suggested_severity?: string;
  reasoning: string;
  confidence: number; // 0-1 scale
  supporting_evidence?: string[];
}

// MQM Error Categorization (referenced from existing types)
export interface MQMErrorCategorization {
  dimension: string;
  category: string;
  subcategory?: string;
  severity: string;
  hierarchical_path?: string[];
}

// Feedback collection form data
export interface FeedbackFormData {
  feedback_type: FeedbackType;
  rating?: FeedbackRating;
  category_suggestion?: Partial<CategorySuggestion>;
  comment?: string;
  confidence_level?: number;
  is_anonymous?: boolean;
}

// Feedback aggregation for analytics
export interface FeedbackAggregation {
  target_type: FeedbackTargetType;
  target_id: string;
  
  // Rating statistics
  rating_stats: {
    average_rating: number;
    rating_count: number;
    rating_distribution: Record<FeedbackRating, number>;
  };
  
  // Category suggestions
  category_suggestions: {
    suggestion_count: number;
    top_suggestions: CategorySuggestion[];
    consensus_level: number; // 0-1 scale
  };
  
  // Processing statistics
  resolution_stats: {
    total_feedback: number;
    pending_count: number;
    resolved_count: number;
    implementation_rate: number;
  };
  
  // Temporal data
  feedback_trend: {
    period: string;
    feedback_count: number;
    average_rating: number;
  }[];
  
  last_updated: string;
}

// Feedback effectiveness metrics
export interface FeedbackEffectivenessMetrics {
  overall_satisfaction: number; // Average rating across all feedback
  
  // Category accuracy improvement
  categorization_accuracy: {
    before_feedback: number;
    after_feedback: number;
    improvement_percentage: number;
  };
  
  // User engagement
  engagement_metrics: {
    feedback_participation_rate: number;
    expert_participation_rate: number;
    average_feedback_quality: number;
  };
  
  // Taxonomy evolution
  taxonomy_metrics: {
    changes_implemented: number;
    user_driven_changes: number;
    taxonomy_stability_score: number;
  };
  
  // Response time
  processing_metrics: {
    average_response_time_hours: number;
    resolution_rate: number;
    user_satisfaction_with_responses: number;
  };
  
  period: {
    start_date: string;
    end_date: string;
  };
}

// Feedback collection configuration
export interface FeedbackCollectionConfig {
  // Target configuration
  enabled_targets: FeedbackTargetType[];
  feedback_types: FeedbackType[];
  
  // User permissions
  allowed_roles: string[];
  require_authentication: boolean;
  allow_anonymous: boolean;
  
  // Collection rules
  max_feedback_per_user_per_target: number;
  require_minimum_confidence: boolean;
  minimum_confidence_level: number;
  
  // Review workflow
  auto_approve_expert_feedback: boolean;
  require_review_for_taxonomy_changes: boolean;
  notification_settings: {
    notify_on_feedback: boolean;
    notify_on_resolution: boolean;
    notification_threshold: number;
  };
}

// Feedback validation rules
export interface FeedbackValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  quality_score: number; // 0-1 scale
  suggestions: string[];
}

// Feedback processing workflow
export interface FeedbackWorkflowStep {
  step_id: string;
  step_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  due_date?: string;
  description: string;
  prerequisites: string[];
  outputs: string[];
}

export interface FeedbackWorkflow {
  feedback_id: string;
  workflow_type: 'standard' | 'expert_review' | 'taxonomy_change' | 'urgent';
  steps: FeedbackWorkflowStep[];
  current_step: string;
  estimated_completion: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
} 