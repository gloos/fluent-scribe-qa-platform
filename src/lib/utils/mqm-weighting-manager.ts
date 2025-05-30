/**
 * MQM Weighting Manager
 * Advanced weighting system management and application utilities
 */

import {
  MQMDimension,
  MQMSeverity,
  MQMErrorInstance,
  MQMAssessmentConfig,
  MQMEnhancedAssessmentConfig,
  MQMWeightingProfile,
  MQMCategoryWeights,
  MQMDynamicWeightConfig,
  ProjectContext,
  StakeholderPriority,
  WeightValidationResult,
  MQMErrorCategory
} from '../types/assessment';

import {
  MQM_WEIGHTING_PROFILES,
  DEFAULT_DYNAMIC_WEIGHT_CONFIG,
  getRecommendedProfile,
  validateWeights,
  normalizeWeights,
  mergeWeightConfigs
} from '../constants/mqm-weighting-profiles';

import { DEFAULT_MQM_PENALTIES, DEFAULT_DIMENSION_WEIGHTS } from '../constants/mqm-taxonomy';

/**
 * Enhanced scoring input with weighting context
 */
export interface EnhancedMQMScoringInput {
  errors: MQMErrorInstance[];
  word_count: number;
  reference_word_count?: number;
  segment_count?: number;
  config?: Partial<MQMEnhancedAssessmentConfig>;
  content_metadata?: {
    domain?: string;
    content_type?: string;
    criticality?: 'low' | 'medium' | 'high' | 'critical';
    audience_type?: string;
    project_phase?: string;
  };
}

/**
 * Computed weights for scoring
 */
export interface ComputedWeights {
  severity_weights: Record<MQMSeverity, number>;
  dimension_weights: Record<MQMDimension, number>;
  category_weights: Partial<MQMCategoryWeights>;
  dynamic_multipliers: {
    content_type: number;
    domain: number;
    criticality: number;
    audience: number;
    phase: number;
  };
  final_penalties: Record<string, number>; // error_key -> final penalty
}

/**
 * Weight application result
 */
export interface WeightApplicationResult {
  computed_weights: ComputedWeights;
  profile_used?: MQMWeightingProfile;
  adjustments_applied: string[];
  validation_result: WeightValidationResult;
}

/**
 * MQM Weighting Manager Class
 * Handles all weighting configuration, validation, and application logic
 */
export class MQMWeightingManager {
  private static instance: MQMWeightingManager;
  
  /**
   * Singleton pattern for consistent weighting behavior
   */
  static getInstance(): MQMWeightingManager {
    if (!MQMWeightingManager.instance) {
      MQMWeightingManager.instance = new MQMWeightingManager();
    }
    return MQMWeightingManager.instance;
  }

  /**
   * Get all available weighting profiles
   */
  getAvailableProfiles(): MQMWeightingProfile[] {
    return Object.values(MQM_WEIGHTING_PROFILES);
  }

  /**
   * Get profile by ID
   */
  getProfile(profileId: string): MQMWeightingProfile | undefined {
    return MQM_WEIGHTING_PROFILES[profileId];
  }

  /**
   * Get recommended profiles for given context and priority
   */
  getRecommendedProfiles(
    context: ProjectContext,
    priority?: StakeholderPriority
  ): MQMWeightingProfile[] {
    if (priority) {
      return getRecommendedProfile(context, priority);
    }
    
    // Filter by context only
    return Object.values(MQM_WEIGHTING_PROFILES).filter(profile => 
      profile.context.includes(context)
    );
  }

  /**
   * Compute final weights for scoring based on configuration
   */
  computeWeights(
    config: Partial<MQMEnhancedAssessmentConfig>,
    content_metadata?: EnhancedMQMScoringInput['content_metadata']
  ): WeightApplicationResult {
    const result: WeightApplicationResult = {
      computed_weights: {
        severity_weights: { ...DEFAULT_MQM_PENALTIES },
        dimension_weights: { ...DEFAULT_DIMENSION_WEIGHTS },
        category_weights: {},
        dynamic_multipliers: {
          content_type: 1.0,
          domain: 1.0,
          criticality: 1.0,
          audience: 1.0,
          phase: 1.0
        },
        final_penalties: {}
      },
      adjustments_applied: [],
      validation_result: { is_valid: true, warnings: [], errors: [] }
    };

    // 1. Start with profile weights if specified
    if (config.weighting_profile) {
      this.applyProfileWeights(result, config.weighting_profile);
    }

    // 2. Apply direct config overrides
    this.applyConfigWeights(result, config);

    // 3. Apply dynamic adjustments based on content metadata
    if (config.dynamic_weight_config && content_metadata) {
      this.applyDynamicWeights(result, config.dynamic_weight_config, content_metadata);
    }

    // 4. Normalize weights if requested
    if (config.normalize_weights) {
      this.normalizeComputedWeights(result, config.weight_total_target);
    }

    // 5. Validate final weights
    result.validation_result = this.validateComputedWeights(result.computed_weights);

    return result;
  }

  /**
   * Apply profile-based weights
   */
  private applyProfileWeights(
    result: WeightApplicationResult, 
    profile: MQMWeightingProfile
  ): void {
    result.profile_used = profile;
    result.adjustments_applied.push(`Applied profile: ${profile.name}`);

    // Apply severity weights
    if (profile.severity_weights) {
      Object.assign(result.computed_weights.severity_weights, profile.severity_weights);
      result.adjustments_applied.push('Applied profile severity weights');
    }

    // Apply dimension weights
    if (profile.dimension_weights) {
      Object.assign(result.computed_weights.dimension_weights, profile.dimension_weights);
      result.adjustments_applied.push('Applied profile dimension weights');
    }

    // Apply category weights
    if (profile.category_weights) {
      Object.assign(result.computed_weights.category_weights, profile.category_weights);
      result.adjustments_applied.push('Applied profile category weights');
    }
  }

  /**
   * Apply direct configuration weights
   */
  private applyConfigWeights(
    result: WeightApplicationResult,
    config: Partial<MQMEnhancedAssessmentConfig>
  ): void {
    // Apply severity weight overrides
    if (config.severity_weights) {
      Object.assign(result.computed_weights.severity_weights, config.severity_weights);
      result.adjustments_applied.push('Applied config severity weight overrides');
    }

    // Apply dimension weight overrides
    if (config.dimension_weights) {
      Object.assign(result.computed_weights.dimension_weights, config.dimension_weights);
      result.adjustments_applied.push('Applied config dimension weight overrides');
    }

    // Apply category weight overrides
    if (config.category_weights) {
      Object.assign(result.computed_weights.category_weights, config.category_weights);
      result.adjustments_applied.push('Applied config category weight overrides');
    }
  }

  /**
   * Apply dynamic weight adjustments
   */
  private applyDynamicWeights(
    result: WeightApplicationResult,
    dynamicConfig: MQMDynamicWeightConfig,
    metadata: EnhancedMQMScoringInput['content_metadata']
  ): void {
    const multipliers = result.computed_weights.dynamic_multipliers;

    // Content type multiplier
    if (metadata?.content_type && dynamicConfig.content_type_multipliers) {
      const multiplier = dynamicConfig.content_type_multipliers[metadata.content_type];
      if (multiplier !== undefined) {
        multipliers.content_type = multiplier;
        result.adjustments_applied.push(`Applied content type multiplier (${metadata.content_type}): ${multiplier}`);
      }
    }

    // Domain multiplier
    if (metadata?.domain && dynamicConfig.domain_multipliers) {
      const multiplier = dynamicConfig.domain_multipliers[metadata.domain];
      if (multiplier !== undefined) {
        multipliers.domain = multiplier;
        result.adjustments_applied.push(`Applied domain multiplier (${metadata.domain}): ${multiplier}`);
      }
    }

    // Criticality multiplier
    if (metadata?.criticality && dynamicConfig.criticality_multipliers) {
      const multiplier = dynamicConfig.criticality_multipliers[metadata.criticality];
      if (multiplier !== undefined) {
        multipliers.criticality = multiplier;
        result.adjustments_applied.push(`Applied criticality multiplier (${metadata.criticality}): ${multiplier}`);
      }
    }

    // Audience multiplier
    if (metadata?.audience_type && dynamicConfig.audience_multipliers) {
      const multiplier = dynamicConfig.audience_multipliers[metadata.audience_type];
      if (multiplier !== undefined) {
        multipliers.audience = multiplier;
        result.adjustments_applied.push(`Applied audience multiplier (${metadata.audience_type}): ${multiplier}`);
      }
    }

    // Phase multiplier
    if (metadata?.project_phase && dynamicConfig.phase_multipliers) {
      const multiplier = dynamicConfig.phase_multipliers[metadata.project_phase];
      if (multiplier !== undefined) {
        multipliers.phase = multiplier;
        result.adjustments_applied.push(`Applied phase multiplier (${metadata.project_phase}): ${multiplier}`);
      }
    }
  }

  /**
   * Normalize computed weights
   */
  private normalizeComputedWeights(
    result: WeightApplicationResult,
    target_total?: number
  ): void {
    const target = target_total || 1.0;

    // Normalize dimension weights
    result.computed_weights.dimension_weights = normalizeWeights(
      result.computed_weights.dimension_weights,
      target * Object.keys(result.computed_weights.dimension_weights).length
    );

    result.adjustments_applied.push(`Normalized weights to target total: ${target}`);
  }

  /**
   * Validate computed weights
   */
  private validateComputedWeights(weights: ComputedWeights): WeightValidationResult {
    return validateWeights({
      severity_weights: weights.severity_weights,
      dimension_weights: weights.dimension_weights,
      category_weights: weights.category_weights
    });
  }

  /**
   * Calculate final penalty for a specific error
   */
  calculateErrorPenalty(
    error: MQMErrorInstance,
    weights: ComputedWeights
  ): number {
    // Base penalty from severity
    const severity_penalty = weights.severity_weights[error.severity] || 0;
    
    // Dimension weight multiplier
    const dimension_weight = weights.dimension_weights[error.dimension] || 1.0;
    
    // Category weight multiplier
    const category_weight = weights.category_weights[error.category] || 1.0;
    
    // Apply dynamic multipliers
    const total_multiplier = 
      weights.dynamic_multipliers.content_type *
      weights.dynamic_multipliers.domain *
      weights.dynamic_multipliers.criticality *
      weights.dynamic_multipliers.audience *
      weights.dynamic_multipliers.phase;

    // Calculate final penalty
    const final_penalty = severity_penalty * dimension_weight * category_weight * total_multiplier;
    
    return Math.round(final_penalty * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Pre-compute penalties for all error types
   */
  precomputePenalties(
    weights: ComputedWeights,
    enabled_dimensions: MQMDimension[] = Object.values(MQMDimension)
  ): Record<string, number> {
    const penalties: Record<string, number> = {};

    // Generate all possible error combinations
    enabled_dimensions.forEach(dimension => {
      Object.values(MQMSeverity).forEach(severity => {
        // Create a mock error for penalty calculation
        const mockError: Partial<MQMErrorInstance> = {
          dimension,
          severity,
          category: 'placeholder' as any // Will be overridden by category weights
        };

        const errorKey = `${dimension}/${severity}`;
        penalties[errorKey] = this.calculateErrorPenalty(
          mockError as MQMErrorInstance,
          weights
        );
      });
    });

    return penalties;
  }

  /**
   * Convert enhanced config to standard config for backward compatibility
   */
  convertToStandardConfig(
    enhancedConfig: Partial<MQMEnhancedAssessmentConfig>
  ): MQMAssessmentConfig {
    // Extract base config properties
    const {
      weighting_profile,
      category_weights,
      dynamic_weight_config,
      normalize_weights,
      weight_total_target,
      project_context,
      stakeholder_priority,
      content_metadata,
      ...baseConfig
    } = enhancedConfig;

    // Ensure required fields have defaults
    return {
      scoring_unit: baseConfig.scoring_unit || 'words',
      unit_count: baseConfig.unit_count || 100,
      severity_weights: baseConfig.severity_weights || DEFAULT_MQM_PENALTIES,
      enabled_dimensions: baseConfig.enabled_dimensions || Object.values(MQMDimension),
      show_neutral_annotations: baseConfig.show_neutral_annotations ?? false,
      aggregate_by_dimension: baseConfig.aggregate_by_dimension ?? true,
      include_confidence_intervals: baseConfig.include_confidence_intervals ?? false,
      dimension_weights: baseConfig.dimension_weights,
      quality_threshold: baseConfig.quality_threshold,
      enabled_categories: baseConfig.enabled_categories
    };
  }

  /**
   * Create a weighting summary for reporting
   */
  createWeightingSummary(
    weights: ComputedWeights,
    profile?: MQMWeightingProfile
  ): {
    profile_info?: {
      name: string;
      description: string;
      context: ProjectContext[];
      rationale: string;
    };
    weight_summary: {
      severity_weights: Record<MQMSeverity, number>;
      top_weighted_dimensions: Array<{ dimension: MQMDimension; weight: number }>;
      top_weighted_categories: Array<{ category: MQMErrorCategory; weight: number }>;
      dynamic_adjustments: Record<string, number>;
    };
    total_adjustments: number;
  } {
    // Sort dimensions by weight
    const sortedDimensions = Object.entries(weights.dimension_weights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([dimension, weight]) => ({ 
        dimension: dimension as MQMDimension, 
        weight 
      }));

    // Sort categories by weight
    const sortedCategories = Object.entries(weights.category_weights)
      .sort(([, a], [, b]) => (b || 1) - (a || 1))
      .slice(0, 5)
      .map(([category, weight]) => ({ 
        category: category as MQMErrorCategory, 
        weight: weight || 1 
      }));

    // Calculate total adjustment factor
    const totalAdjustment = Object.values(weights.dynamic_multipliers)
      .reduce((product, multiplier) => product * multiplier, 1);

    return {
      profile_info: profile ? {
        name: profile.name,
        description: profile.description,
        context: profile.context,
        rationale: profile.rationale
      } : undefined,
      weight_summary: {
        severity_weights: weights.severity_weights,
        top_weighted_dimensions: sortedDimensions,
        top_weighted_categories: sortedCategories,
        dynamic_adjustments: weights.dynamic_multipliers
      },
      total_adjustments: Math.round(totalAdjustment * 100) / 100
    };
  }
}

/**
 * Convenience function to get the singleton instance
 */
export const getWeightingManager = () => MQMWeightingManager.getInstance();

/**
 * Quick utility to apply a weighting profile to a standard config
 */
export function applyWeightingProfile(
  baseConfig: Partial<MQMAssessmentConfig>,
  profileId: string
): MQMEnhancedAssessmentConfig {
  const profile = MQM_WEIGHTING_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Weighting profile '${profileId}' not found`);
  }

  return {
    ...baseConfig,
    weighting_profile: profile,
    severity_weights: profile.severity_weights || baseConfig.severity_weights,
    dimension_weights: profile.dimension_weights || baseConfig.dimension_weights,
    category_weights: profile.category_weights,
    project_context: profile.context[0], // Use first context as default
    stakeholder_priority: profile.stakeholder_priority
  } as MQMEnhancedAssessmentConfig;
} 