/**
 * MQM Scoring Engine
 * Implements MQM 2.0 scoring algorithms for translation quality assessment
 */

import {
  MQMDimension,
  MQMSeverity,
  MQMErrorInstance,
  MQMAssessmentConfig,
  MQMScoreResult,
  MQMErrorCategory
} from '../types/assessment';

import {
  DEFAULT_MQM_PENALTIES,
  MQM_QUALITY_THRESHOLDS,
  DEFAULT_MQM_CONFIG
} from '../constants/mqm-taxonomy';

import {
  MQMScoringEngine as ExistingMQMScoringEngine,
  MQMScoringInput,
  StatisticalConfig
} from './mqm-scoring-engine';

import {
  MQMWeightingManager,
  getWeightingManager,
  EnhancedMQMScoringInput,
  ComputedWeights,
  WeightApplicationResult
} from './mqm-weighting-manager';

import {
  MQMEnhancedAssessmentConfig,
  MQMScoreResult
} from '../types/assessment';

/**
 * Scoring input data structure
 */
export interface MQMScoringInput {
  errors: MQMErrorInstance[];
  word_count: number;
  reference_word_count?: number;
  segment_count?: number;
  config?: Partial<MQMAssessmentConfig>;
  content_metadata?: {
    domain?: string;
    content_type?: string;
    criticality?: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Statistical confidence calculation parameters
 */
export interface StatisticalConfig {
  confidence_level: number; // e.g., 0.95 for 95% confidence
  bootstrap_iterations?: number;
  include_confidence_intervals: boolean;
}

/**
 * MQM Scoring Engine - Core implementation
 */
export class MQMScoringEngine {
  private config: MQMAssessmentConfig;
  
  constructor(config: Partial<MQMAssessmentConfig> = {}) {
    this.config = { ...DEFAULT_MQM_CONFIG, ...config };
  }

  /**
   * Calculate MQM score using linear model
   * Basic penalty-based calculation: Score = 100 - (total_penalty / unit_count * 100)
   */
  calculateLinearScore(input: MQMScoringInput): MQMScoreResult {
    const { errors, word_count } = input;
    const mergedConfig = { ...this.config, ...input.config };
    
    // Calculate unit count based on scoring unit
    const unit_count = this.calculateUnitCount(word_count, input.reference_word_count, mergedConfig);
    
    // Calculate total penalty
    const total_penalty = this.calculateTotalPenalty(errors, mergedConfig);
    
    // Calculate error rate (errors per unit)
    const error_rate = total_penalty / unit_count;
    
    // Calculate basic MQM score
    const raw_score = Math.max(0, 100 - error_rate);
    
    // Generate comprehensive breakdown
    const dimension_breakdown = this.calculateDimensionBreakdown(errors, mergedConfig);
    const severity_breakdown = this.calculateSeverityBreakdown(errors, mergedConfig);
    
    // Determine quality level
    const quality_level = this.determineQualityLevel(error_rate);
    const meets_threshold = error_rate <= (mergedConfig.quality_threshold || MQM_QUALITY_THRESHOLDS.good);
    
    return {
      total_errors: errors.length,
      total_penalty,
      error_rate,
      mqm_score: Math.round(raw_score * 100) / 100, // Round to 2 decimal places
      dimension_breakdown,
      severity_breakdown,
      quality_level,
      meets_threshold,
      assessment_date: new Date().toISOString(),
      assessor_id: '', // To be filled by calling code
      unit_count,
      scoring_unit: mergedConfig.scoring_unit
    };
  }

  /**
   * Calculate MQM score using calibrated model
   * Includes normalization factors and statistical adjustments
   */
  calculateCalibratedScore(
    input: MQMScoringInput,
    statistical_config?: StatisticalConfig
  ): MQMScoreResult {
    // Start with linear score
    const linear_result = this.calculateLinearScore(input);
    
    // Apply calibration factors
    const calibrated_score = this.applyCalibrationalFactors(
      linear_result.mqm_score,
      input,
      this.config
    );
    
    // Calculate confidence intervals if requested
    let confidence_interval;
    if (statistical_config?.include_confidence_intervals) {
      confidence_interval = this.calculateConfidenceInterval(
        input.errors,
        input.word_count,
        statistical_config
      );
    }
    
    return {
      ...linear_result,
      mqm_score: Math.round(calibrated_score * 100) / 100,
      confidence_interval
    };
  }

  /**
   * Batch scoring for multiple assessment segments
   */
  calculateBatchScore(inputs: MQMScoringInput[]): {
    individual_scores: MQMScoreResult[];
    aggregate_score: MQMScoreResult;
    inter_segment_variance: number;
  } {
    const individual_scores = inputs.map(input => this.calculateCalibratedScore(input));
    
    // Aggregate all errors and metrics
    const all_errors = inputs.flatMap(input => input.errors);
    const total_word_count = inputs.reduce((sum, input) => sum + input.word_count, 0);
    const total_reference_count = inputs.reduce((sum, input) => sum + (input.reference_word_count || input.word_count), 0);
    
    const aggregate_input: MQMScoringInput = {
      errors: all_errors,
      word_count: total_word_count,
      reference_word_count: total_reference_count,
      segment_count: inputs.length,
      config: this.config
    };
    
    const aggregate_score = this.calculateCalibratedScore(aggregate_input);
    
    // Calculate inter-segment variance
    const scores = individual_scores.map(score => score.mqm_score);
    const mean_score = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean_score, 2), 0) / scores.length;
    
    return {
      individual_scores,
      aggregate_score,
      inter_segment_variance: Math.round(variance * 100) / 100
    };
  }

  /**
   * Calculate dimension-specific breakdown
   */
  private calculateDimensionBreakdown(
    errors: MQMErrorInstance[],
    config: MQMAssessmentConfig
  ): MQMScoreResult['dimension_breakdown'] {
    const breakdown: MQMScoreResult['dimension_breakdown'] = {} as any;
    
    // Initialize all dimensions
    Object.values(MQMDimension).forEach(dimension => {
      breakdown[dimension] = {
        error_count: 0,
        penalty: 0,
        categories: {}
      };
    });
    
    // Process each error
    errors.forEach(error => {
      const dimension = error.dimension;
      const category = error.category;
      const weight = config.dimension_weights?.[dimension] || 1.0;
      const weighted_penalty = error.penalty * weight;
      
      // Update dimension totals
      breakdown[dimension].error_count++;
      breakdown[dimension].penalty += weighted_penalty;
      
      // Update category breakdown
      if (!breakdown[dimension].categories[category]) {
        breakdown[dimension].categories[category] = {
          error_count: 0,
          penalty: 0,
          severity_distribution: {
            [MQMSeverity.NEUTRAL]: 0,
            [MQMSeverity.MINOR]: 0,
            [MQMSeverity.MAJOR]: 0,
            [MQMSeverity.CRITICAL]: 0
          }
        };
      }
      
      breakdown[dimension].categories[category].error_count++;
      breakdown[dimension].categories[category].penalty += weighted_penalty;
      breakdown[dimension].categories[category].severity_distribution[error.severity]++;
    });
    
    return breakdown;
  }

  /**
   * Calculate severity-specific breakdown
   */
  private calculateSeverityBreakdown(
    errors: MQMErrorInstance[],
    config: MQMAssessmentConfig
  ): MQMScoreResult['severity_breakdown'] {
    const breakdown: MQMScoreResult['severity_breakdown'] = {
      [MQMSeverity.NEUTRAL]: { count: 0, penalty: 0, percentage: 0 },
      [MQMSeverity.MINOR]: { count: 0, penalty: 0, percentage: 0 },
      [MQMSeverity.MAJOR]: { count: 0, penalty: 0, percentage: 0 },
      [MQMSeverity.CRITICAL]: { count: 0, penalty: 0, percentage: 0 }
    };
    
    const total_errors = errors.length;
    
    errors.forEach(error => {
      const severity = error.severity;
      const weight = config.dimension_weights?.[error.dimension] || 1.0;
      const weighted_penalty = error.penalty * weight;
      
      breakdown[severity].count++;
      breakdown[severity].penalty += weighted_penalty;
    });
    
    // Calculate percentages
    Object.values(MQMSeverity).forEach(severity => {
      breakdown[severity].percentage = total_errors > 0 
        ? Math.round((breakdown[severity].count / total_errors) * 100 * 100) / 100
        : 0;
    });
    
    return breakdown;
  }

  /**
   * Calculate total penalty with weights applied
   */
  private calculateTotalPenalty(
    errors: MQMErrorInstance[],
    config: MQMAssessmentConfig
  ): number {
    return errors.reduce((total, error) => {
      const dimension_weight = config.dimension_weights?.[error.dimension] || 1.0;
      const severity_weight = config.severity_weights[error.severity];
      return total + (severity_weight * dimension_weight);
    }, 0);
  }

  /**
   * Calculate unit count based on scoring configuration
   */
  private calculateUnitCount(
    word_count: number,
    reference_word_count?: number,
    config: MQMAssessmentConfig = this.config
  ): number {
    switch (config.scoring_unit) {
      case 'words':
        // Use evaluation word count or reference word count as fallback
        return reference_word_count || word_count;
      case 'segments':
        return 1; // Per segment scoring
      case 'characters':
        return Math.round(word_count * 5.5); // Approximate character count
      default:
        return word_count;
    }
  }

  /**
   * Apply calibration factors for adjusted scoring
   */
  private applyCalibrationalFactors(
    raw_score: number,
    input: MQMScoringInput,
    config: MQMAssessmentConfig
  ): number {
    let calibrated_score = raw_score;
    
    // Content type calibration
    if (input.content_metadata?.content_type) {
      calibrated_score = this.applyContentTypeCalibration(calibrated_score, input.content_metadata.content_type);
    }
    
    // Domain-specific calibration
    if (input.content_metadata?.domain) {
      calibrated_score = this.applyDomainCalibration(calibrated_score, input.content_metadata.domain);
    }
    
    // Criticality adjustment
    if (input.content_metadata?.criticality) {
      calibrated_score = this.applyCriticalityCalibration(calibrated_score, input.content_metadata.criticality);
    }
    
    // Text length normalization
    calibrated_score = this.applyLengthNormalization(calibrated_score, input.word_count);
    
    return Math.max(0, Math.min(100, calibrated_score));
  }

  /**
   * Content type-specific calibration
   */
  private applyContentTypeCalibration(score: number, content_type: string): number {
    const calibration_factors: Record<string, number> = {
      'technical_documentation': 0.95, // Stricter standards
      'legal_content': 0.90,           // Very strict standards
      'marketing_content': 1.05,       // More lenient standards
      'ui_content': 0.98,              // Moderately strict
      'general_content': 1.0           // Baseline
    };
    
    const factor = calibration_factors[content_type] || 1.0;
    return score * factor;
  }

  /**
   * Domain-specific calibration
   */
  private applyDomainCalibration(score: number, domain: string): number {
    const domain_factors: Record<string, number> = {
      'medical': 0.85,      // Very strict
      'legal': 0.90,        // Strict
      'financial': 0.92,    // Strict
      'technical': 0.95,    // Moderately strict
      'marketing': 1.05,    // More lenient
      'entertainment': 1.10 // Most lenient
    };
    
    const factor = domain_factors[domain] || 1.0;
    return score * factor;
  }

  /**
   * Criticality-based calibration
   */
  private applyCriticalityCalibration(score: number, criticality: string): number {
    const criticality_factors: Record<string, number> = {
      'critical': 0.85,  // Very strict
      'high': 0.92,      // Strict
      'medium': 1.0,     // Baseline
      'low': 1.08        // More lenient
    };
    
    const factor = criticality_factors[criticality] || 1.0;
    return score * factor;
  }

  /**
   * Text length normalization
   */
  private applyLengthNormalization(score: number, word_count: number): number {
    // Adjust for very short or very long texts
    if (word_count < 50) {
      return score * 0.95; // Penalty for very short texts (less reliable)
    } else if (word_count > 5000) {
      return score * 1.02; // Slight boost for long texts (more stable statistics)
    }
    return score;
  }

  /**
   * Determine quality level based on error rate
   */
  private determineQualityLevel(error_rate: number): MQMScoreResult['quality_level'] {
    if (error_rate <= MQM_QUALITY_THRESHOLDS.excellent) {
      return 'excellent';
    } else if (error_rate <= MQM_QUALITY_THRESHOLDS.good) {
      return 'good';
    } else if (error_rate <= MQM_QUALITY_THRESHOLDS.fair) {
      return 'fair';
    } else if (error_rate <= MQM_QUALITY_THRESHOLDS.poor) {
      return 'poor';
    } else {
      return 'unacceptable';
    }
  }

  /**
   * Calculate statistical confidence interval
   */
  private calculateConfidenceInterval(
    errors: MQMErrorInstance[],
    word_count: number,
    config: StatisticalConfig
  ): NonNullable<MQMScoreResult['confidence_interval']> {
    // Simplified confidence interval calculation
    // In production, this would use more sophisticated statistical methods
    
    const error_count = errors.length;
    const error_rate = error_count / word_count * 100;
    
    // Calculate standard error (simplified)
    const standard_error = Math.sqrt((error_rate * (100 - error_rate)) / word_count);
    
    // Z-score for confidence level (95% = 1.96, 99% = 2.576)
    const z_score = config.confidence_level === 0.99 ? 2.576 : 1.96;
    
    const margin_of_error = z_score * standard_error;
    
    return {
      lower: Math.max(0, error_rate - margin_of_error),
      upper: Math.min(100, error_rate + margin_of_error),
      confidence_level: config.confidence_level
    };
  }

  /**
   * Validate scoring input
   */
  static validateScoringInput(input: MQMScoringInput): {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required field validation
    if (!input.errors || !Array.isArray(input.errors)) {
      errors.push('Errors array is required');
    }
    
    if (!input.word_count || input.word_count <= 0) {
      errors.push('Valid word count is required');
    }
    
    // Logical validation
    if (input.errors?.length > input.word_count) {
      warnings.push('Error count exceeds word count - verify error identification');
    }
    
    if (input.reference_word_count && Math.abs(input.reference_word_count - input.word_count) > input.word_count * 0.5) {
      warnings.push('Large discrepancy between reference and evaluation word counts');
    }
    
    // Error instance validation
    input.errors?.forEach((error, index) => {
      if (!error.dimension || !error.category || !error.severity) {
        errors.push(`Error ${index}: Missing required fields (dimension, category, severity)`);
      }
      
      if (error.penalty < 0) {
        errors.push(`Error ${index}: Penalty cannot be negative`);
      }
    });
    
    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Helper functions for common scoring operations
 */
export class MQMScoringHelpers {
  /**
   * Convert error rate to quality percentage
   */
  static errorRateToQualityScore(error_rate: number): number {
    return Math.max(0, 100 - error_rate);
  }

  /**
   * Compare two MQM scores and calculate improvement
   */
  static compareScores(baseline: MQMScoreResult, target: MQMScoreResult): {
    score_improvement: number;
    error_reduction: number;
    quality_improvement: string;
  } {
    const score_improvement = target.mqm_score - baseline.mqm_score;
    const error_reduction = ((baseline.error_rate - target.error_rate) / baseline.error_rate) * 100;
    
    let quality_improvement = 'No change';
    if (score_improvement > 5) {
      quality_improvement = 'Significant improvement';
    } else if (score_improvement > 2) {
      quality_improvement = 'Moderate improvement';
    } else if (score_improvement > 0) {
      quality_improvement = 'Slight improvement';
    } else if (score_improvement < -5) {
      quality_improvement = 'Significant decline';
    } else if (score_improvement < -2) {
      quality_improvement = 'Moderate decline';
    } else if (score_improvement < 0) {
      quality_improvement = 'Slight decline';
    }
    
    return {
      score_improvement: Math.round(score_improvement * 100) / 100,
      error_reduction: Math.round(error_reduction * 100) / 100,
      quality_improvement
    };
  }

  /**
   * Calculate recommended sample size for statistical significance
   */
  static calculateRecommendedSampleSize(
    expected_error_rate: number,
    confidence_level: number = 0.95,
    margin_of_error: number = 0.05
  ): number {
    // Simplified sample size calculation
    const z_score = confidence_level === 0.99 ? 2.576 : 1.96;
    const p = expected_error_rate / 100;
    const e = margin_of_error;
    
    return Math.ceil((z_score * z_score * p * (1 - p)) / (e * e));
  }
}

/**
 * Factory function to create pre-configured scoring engines
 */
export class MQMScoringEngineFactory {
  /**
   * Create engine for general content
   */
  static createGeneralEngine(): MQMScoringEngine {
    return new MQMScoringEngine(DEFAULT_MQM_CONFIG);
  }

  /**
   * Create engine for technical content (stricter standards)
   */
  static createTechnicalEngine(): MQMScoringEngine {
    const config: Partial<MQMAssessmentConfig> = {
      ...DEFAULT_MQM_CONFIG,
      quality_threshold: MQM_QUALITY_THRESHOLDS.excellent,
      dimension_weights: {
        [MQMDimension.TERMINOLOGY]: 1.2,
        [MQMDimension.ACCURACY]: 1.3,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.0,
        [MQMDimension.STYLE]: 0.8,
        [MQMDimension.LOCALE_CONVENTIONS]: 1.0,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 0.9,
        [MQMDimension.DESIGN_AND_MARKUP]: 1.1
      }
    };
    return new MQMScoringEngine(config);
  }

  /**
   * Create engine for creative content (more lenient standards)
   */
  static createCreativeEngine(): MQMScoringEngine {
    const config: Partial<MQMAssessmentConfig> = {
      ...DEFAULT_MQM_CONFIG,
      quality_threshold: MQM_QUALITY_THRESHOLDS.fair,
      dimension_weights: {
        [MQMDimension.TERMINOLOGY]: 0.8,
        [MQMDimension.ACCURACY]: 1.0,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 0.9,
        [MQMDimension.STYLE]: 1.2,
        [MQMDimension.LOCALE_CONVENTIONS]: 1.0,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.3,
        [MQMDimension.DESIGN_AND_MARKUP]: 0.7
      }
    };
    return new MQMScoringEngine(config);
  }
}

/**
 * Enhanced MQM Score Result with weighting information
 */
export interface EnhancedMQMScoreResult extends MQMScoreResult {
  weighting_info?: {
    profile_used?: string;
    adjustments_applied: string[];
    computed_weights: ComputedWeights;
    validation_warnings: string[];
  };
}

/**
 * Enhanced MQM Scoring Engine
 * Extends the base scoring engine with advanced weighting capabilities
 */
export class EnhancedMQMScoringEngine extends MQMScoringEngine {
  private weightingManager: MQMWeightingManager;

  constructor(config: Partial<MQMEnhancedAssessmentConfig> = {}) {
    // Convert enhanced config to standard config for base class
    const standardConfig = MQMWeightingManager.getInstance().convertToStandardConfig(config);
    super(standardConfig);
    
    this.weightingManager = getWeightingManager();
  }

  /**
   * Calculate MQM score with enhanced weighting
   */
  calculateEnhancedScore(input: EnhancedMQMScoringInput): EnhancedMQMScoreResult {
    // Compute enhanced weights
    const weightResult = this.weightingManager.computeWeights(
      input.config || {},
      input.content_metadata
    );

    // Validate weights
    if (!weightResult.validation_result.is_valid) {
      throw new Error(`Invalid weight configuration: ${weightResult.validation_result.errors.join(', ')}`);
    }

    // Apply computed weights to errors
    const enhancedErrors = this.applyComputedWeights(input.errors, weightResult.computed_weights);

    // Create standard input for base scoring
    const standardInput: MQMScoringInput = {
      errors: enhancedErrors,
      word_count: input.word_count,
      reference_word_count: input.reference_word_count,
      segment_count: input.segment_count,
      config: this.weightingManager.convertToStandardConfig(input.config || {}),
      content_metadata: input.content_metadata
    };

    // Calculate base score
    const baseResult = super.calculateCalibratedScore(standardInput);

    // Add weighting information
    const enhancedResult: EnhancedMQMScoreResult = {
      ...baseResult,
      weighting_info: {
        profile_used: weightResult.profile_used?.name,
        adjustments_applied: weightResult.adjustments_applied,
        computed_weights: weightResult.computed_weights,
        validation_warnings: weightResult.validation_result.warnings
      }
    };

    return enhancedResult;
  }

  /**
   * Apply computed weights to error instances
   */
  private applyComputedWeights(
    errors: MQMErrorInstance[],
    weights: ComputedWeights
  ): MQMErrorInstance[] {
    return errors.map(error => ({
      ...error,
      penalty: this.weightingManager.calculateErrorPenalty(error, weights)
    }));
  }

  /**
   * Batch scoring with enhanced weighting
   */
  calculateEnhancedBatchScore(inputs: EnhancedMQMScoringInput[]): {
    individual_scores: EnhancedMQMScoreResult[];
    aggregate_score: EnhancedMQMScoreResult;
    inter_segment_variance: number;
    weighting_consistency: {
      profiles_used: string[];
      weight_variance: number;
      consistent_weighting: boolean;
    };
  } {
    const individual_scores = inputs.map(input => this.calculateEnhancedScore(input));
    
    // Aggregate all errors and calculate weighted aggregate
    const all_errors = inputs.flatMap(input => input.errors);
    const total_word_count = inputs.reduce((sum, input) => sum + input.word_count, 0);
    
    // Use first input's config for aggregate (could be enhanced to merge configs)
    const aggregate_input: EnhancedMQMScoringInput = {
      errors: all_errors,
      word_count: total_word_count,
      reference_word_count: inputs.reduce((sum, input) => sum + (input.reference_word_count || input.word_count), 0),
      segment_count: inputs.length,
      config: inputs[0]?.config || {},
      content_metadata: inputs[0]?.content_metadata
    };

    const aggregate_score = this.calculateEnhancedScore(aggregate_input);

    // Calculate inter-segment variance
    const scores = individual_scores.map(score => score.mqm_score);
    const mean_score = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean_score, 2), 0) / scores.length;

    // Analyze weighting consistency
    const profiles_used = individual_scores
      .map(score => score.weighting_info?.profile_used)
      .filter((profile): profile is string => !!profile);
    
    const unique_profiles = [...new Set(profiles_used)];
    const consistent_weighting = unique_profiles.length <= 1;

    // Calculate weight variance (simplified)
    const weight_variance = consistent_weighting ? 0 : variance;

    return {
      individual_scores,
      aggregate_score,
      inter_segment_variance: Math.round(variance * 100) / 100,
      weighting_consistency: {
        profiles_used: unique_profiles,
        weight_variance: Math.round(weight_variance * 100) / 100,
        consistent_weighting
      }
    };
  }

  /**
   * Generate comprehensive weighting report
   */
  generateWeightingReport(
    config: Partial<MQMEnhancedAssessmentConfig>,
    content_metadata?: EnhancedMQMScoringInput['content_metadata']
  ): {
    weight_application: WeightApplicationResult;
    weight_summary: ReturnType<MQMWeightingManager['createWeightingSummary']>;
    recommendations: string[];
    alternative_profiles: string[];
  } {
    const weightResult = this.weightingManager.computeWeights(config, content_metadata);
    const weightSummary = this.weightingManager.createWeightingSummary(
      weightResult.computed_weights,
      weightResult.profile_used
    );

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (weightResult.validation_result.warnings.length > 0) {
      recommendations.push('Review weight configuration warnings');
    }
    
    if (weightSummary.total_adjustments > 2.0) {
      recommendations.push('Consider using a more conservative weighting profile');
    }
    
    if (!weightResult.profile_used) {
      recommendations.push('Consider using a predefined weighting profile for consistency');
    }

    // Get alternative profiles
    const alternative_profiles: string[] = [];
    if (config.project_context) {
      const alternatives = this.weightingManager.getRecommendedProfiles(config.project_context);
      alternative_profiles.push(...alternatives.map(p => p.name));
    }

    return {
      weight_application: weightResult,
      weight_summary: weightSummary,
      recommendations,
      alternative_profiles
    };
  }

  /**
   * Compare scoring results with different weighting profiles
   */
  compareWeightingProfiles(
    input: EnhancedMQMScoringInput,
    profileIds: string[]
  ): {
    profile_comparisons: Array<{
      profile_id: string;
      profile_name: string;
      score_result: EnhancedMQMScoreResult;
      score_difference: number;
    }>;
    baseline_score: number;
    recommendations: string;
  } {
    // Calculate baseline score (no profile)
    const baselineInput = { ...input, config: { ...input.config, weighting_profile: undefined } };
    const baseline = this.calculateEnhancedScore(baselineInput);

    // Calculate scores for each profile
    const profile_comparisons = profileIds.map(profileId => {
      const profile = this.weightingManager.getProfile(profileId);
      if (!profile) {
        throw new Error(`Profile '${profileId}' not found`);
      }

      const profileInput = { 
        ...input, 
        config: { 
          ...input.config, 
          weighting_profile: profile 
        } 
      };
      
      const result = this.calculateEnhancedScore(profileInput);
      const score_difference = result.mqm_score - baseline.mqm_score;

      return {
        profile_id: profileId,
        profile_name: profile.name,
        score_result: result,
        score_difference: Math.round(score_difference * 100) / 100
      };
    });

    // Generate recommendations
    const score_differences = profile_comparisons.map(p => Math.abs(p.score_difference));
    const max_difference = Math.max(...score_differences);
    
    let recommendations = '';
    if (max_difference > 10) {
      recommendations = 'Significant score variations detected. Review weighting profiles for appropriateness.';
    } else if (max_difference > 5) {
      recommendations = 'Moderate score variations detected. Consider stakeholder priorities.';
    } else {
      recommendations = 'Score variations are minimal. Any profile would be suitable.';
    }

    return {
      profile_comparisons,
      baseline_score: baseline.mqm_score,
      recommendations
    };
  }
} 