/**
 * MQM Weighting Profiles and Configuration Templates
 * Predefined weighting schemes for different project contexts and stakeholder priorities
 */

import {
  MQMDimension,
  MQMSeverity,
  MQMTerminologyCategory,
  MQMAccuracyCategory,
  MQLinguisticConventionsCategory,
  MQMStyleCategory,
  MQMLocaleConventionsCategory,
  MQMAudienceAppropriatenessCategory,
  MQMDesignAndMarkupCategory,
  ProjectContext,
  StakeholderPriority,
  MQMWeightingProfile,
  MQMCategoryWeights,
  MQMDynamicWeightConfig,
  WeightValidationResult
} from '../types/assessment';

import { DEFAULT_MQM_PENALTIES, DEFAULT_DIMENSION_WEIGHTS } from './mqm-taxonomy';

/**
 * Predefined MQM Weighting Profiles
 * Each profile is optimized for specific project contexts and stakeholder priorities
 */

// ACCURACY-FOCUSED PROFILE
export const ACCURACY_FOCUSED_PROFILE: MQMWeightingProfile = {
  id: 'accuracy_focused',
  name: 'Accuracy-Focused',
  description: 'Prioritizes factual correctness and content accuracy over stylistic concerns',
  context: [ProjectContext.TECHNICAL_DOCUMENTATION, ProjectContext.MEDICAL_CONTENT, ProjectContext.FINANCIAL_CONTENT],
  stakeholder_priority: StakeholderPriority.ACCURACY_FOCUSED,
  severity_weights: {
    [MQMSeverity.MINOR]: 1,
    [MQMSeverity.MAJOR]: 6,    // Increased from 5
    [MQMSeverity.CRITICAL]: 12, // Increased from 10
    [MQMSeverity.NEUTRAL]: 0
  },
  dimension_weights: {
    [MQMDimension.ACCURACY]: 2.0,
    [MQMDimension.TERMINOLOGY]: 1.8,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.0,
    [MQMDimension.STYLE]: 0.5,
    [MQMDimension.LOCALE_CONVENTIONS]: 1.2,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 0.8,
    [MQMDimension.DESIGN_AND_MARKUP]: 1.5
  },
  category_weights: {
    // High priority on factual errors
    [MQMAccuracyCategory.MISTRANSLATION]: 2.0,
    [MQMAccuracyCategory.OMISSION]: 2.0,
    [MQMAccuracyCategory.ADDITION]: 1.8,
    [MQMAccuracyCategory.UNTRANSLATED]: 2.5,
    
    // High priority on domain-specific terminology
    [MQMTerminologyCategory.WRONG_TERM]: 2.0,
    [MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN]: 2.2,
    [MQMTerminologyCategory.INCONSISTENT_USE]: 1.5,
    
    // Lower priority on style unless it affects clarity
    [MQMStyleCategory.UNCLEAR]: 1.5,
    [MQMStyleCategory.AWKWARD]: 0.5,
    [MQMStyleCategory.UNNATURAL]: 0.5,
    [MQMStyleCategory.INCONSISTENT]: 0.8
  },
  rationale: 'Designed for content where factual accuracy is paramount. Heavily penalizes mistranslations, omissions, and domain-inappropriate terminology while being more lenient on stylistic issues that don\'t affect meaning.',
  use_cases: [
    'Technical documentation translation',
    'Medical content localization', 
    'Financial reports and statements',
    'Legal document translation',
    'Safety-critical content'
  ],
  recommended_for: [
    'High-stakes technical content',
    'Regulatory compliance materials',
    'Content with potential safety implications'
  ],
  is_system_profile: true
};

// USER EXPERIENCE PROFILE
export const USER_EXPERIENCE_PROFILE: MQMWeightingProfile = {
  id: 'user_experience',
  name: 'User Experience',
  description: 'Optimizes for readability, usability, and user comprehension',
  context: [ProjectContext.UI_CONTENT, ProjectContext.CUSTOMER_FACING, ProjectContext.MARKETING_CONTENT],
  stakeholder_priority: StakeholderPriority.USER_EXPERIENCE,
  severity_weights: DEFAULT_MQM_PENALTIES,
  dimension_weights: {
    [MQMDimension.STYLE]: 1.8,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 2.0,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.5,
    [MQMDimension.LOCALE_CONVENTIONS]: 1.8,
    [MQMDimension.DESIGN_AND_MARKUP]: 2.2,
    [MQMDimension.ACCURACY]: 1.2,
    [MQMDimension.TERMINOLOGY]: 1.0
  },
  category_weights: {
    // High priority on user-facing issues
    [MQMStyleCategory.UNCLEAR]: 2.0,
    [MQMStyleCategory.UNNATURAL]: 1.8,
    [MQMStyleCategory.AWKWARD]: 1.5,
    
    // Critical UI and formatting issues
    [MQMDesignAndMarkupCategory.TRUNCATION]: 2.5,
    [MQMDesignAndMarkupCategory.OVERLAP]: 2.2,
    [MQMDesignAndMarkupCategory.MARKUP]: 2.0,
    [MQMDesignAndMarkupCategory.MISSING_TEXT]: 2.5,
    
    // Audience appropriateness is crucial
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE]: 2.0,
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_REGISTER]: 1.8,
    
    // Locale conventions for user-friendly experience
    [MQMLocaleConventionsCategory.DATE_TIME]: 1.5,
    [MQMLocaleConventionsCategory.CURRENCY]: 1.8,
    [MQMLocaleConventionsCategory.ADDRESS]: 1.5
  },
  rationale: 'Focuses on creating a smooth, intuitive user experience. Prioritizes clarity, natural language flow, appropriate tone, and proper UI formatting while maintaining reasonable accuracy standards.',
  use_cases: [
    'Website and app localization',
    'User interface text',
    'Customer support materials',
    'Product descriptions',
    'Marketing copy'
  ],
  recommended_for: [
    'Consumer-facing applications',
    'E-commerce platforms',
    'SaaS product interfaces'
  ],
  is_system_profile: true
};

// BRAND CONSISTENCY PROFILE
export const BRAND_CONSISTENCY_PROFILE: MQMWeightingProfile = {
  id: 'brand_consistency',
  name: 'Brand Consistency',
  description: 'Emphasizes terminology consistency and brand voice alignment',
  context: [ProjectContext.MARKETING_CONTENT, ProjectContext.CUSTOMER_FACING],
  stakeholder_priority: StakeholderPriority.BRAND_CONSISTENCY,
  severity_weights: DEFAULT_MQM_PENALTIES,
  dimension_weights: {
    [MQMDimension.TERMINOLOGY]: 2.5,
    [MQMDimension.STYLE]: 2.0,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.8,
    [MQMDimension.ACCURACY]: 1.2,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.0,
    [MQMDimension.LOCALE_CONVENTIONS]: 1.2,
    [MQMDimension.DESIGN_AND_MARKUP]: 1.0
  },
  category_weights: {
    // Maximum priority on terminology consistency
    [MQMTerminologyCategory.INCONSISTENT_USE]: 3.0,
    [MQMTerminologyCategory.WRONG_TERM]: 2.5,
    [MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN]: 2.0,
    
    // Style consistency is crucial for brand voice
    [MQMStyleCategory.INCONSISTENT]: 2.5,
    [MQMStyleCategory.UNCLEAR]: 1.5,
    [MQMStyleCategory.UNNATURAL]: 1.2,
    
    // Audience appropriateness for brand alignment
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE]: 2.2,
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_REGISTER]: 2.0,
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_VARIETY]: 1.8
  },
  rationale: 'Designed for maintaining consistent brand voice and terminology across all touchpoints. Heavily penalizes inconsistencies that could dilute brand identity while ensuring accuracy.',
  use_cases: [
    'Brand guideline implementation',
    'Marketing campaign localization',
    'Brand website translation',
    'Corporate communications',
    'Product naming consistency'
  ],
  recommended_for: [
    'Global brand campaigns',
    'Franchise operations',
    'Multi-market product launches'
  ],
  is_system_profile: true
};

// REGULATORY COMPLIANCE PROFILE
export const REGULATORY_COMPLIANCE_PROFILE: MQMWeightingProfile = {
  id: 'regulatory_compliance',
  name: 'Regulatory Compliance',
  description: 'Strict standards for legally and regulatory sensitive content',
  context: [ProjectContext.LEGAL_CONTENT, ProjectContext.MEDICAL_CONTENT, ProjectContext.FINANCIAL_CONTENT, ProjectContext.SAFETY_CRITICAL],
  stakeholder_priority: StakeholderPriority.REGULATORY_COMPLIANCE,
  severity_weights: {
    [MQMSeverity.MINOR]: 2,    // Even minor errors are more serious
    [MQMSeverity.MAJOR]: 8,    // Significantly increased
    [MQMSeverity.CRITICAL]: 15, // Maximum penalty
    [MQMSeverity.NEUTRAL]: 0
  },
  dimension_weights: {
    [MQMDimension.ACCURACY]: 3.0,
    [MQMDimension.TERMINOLOGY]: 2.8,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.5,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 2.0,
    [MQMDimension.LOCALE_CONVENTIONS]: 1.8,
    [MQMDimension.STYLE]: 1.2,
    [MQMDimension.DESIGN_AND_MARKUP]: 1.8
  },
  category_weights: {
    // Zero tolerance for accuracy issues
    [MQMAccuracyCategory.MISTRANSLATION]: 3.0,
    [MQMAccuracyCategory.OMISSION]: 3.0,
    [MQMAccuracyCategory.ADDITION]: 2.5,
    [MQMAccuracyCategory.UNTRANSLATED]: 4.0,
    
    // Strict terminology requirements
    [MQMTerminologyCategory.WRONG_TERM]: 3.0,
    [MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN]: 3.5,
    [MQMTerminologyCategory.INCONSISTENT_USE]: 2.5,
    
    // Legal language precision
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_STYLE]: 2.5,
    [MQMAudienceAppropriatenessCategory.INAPPROPRIATE_REGISTER]: 2.2
  },
  rationale: 'Maximum scrutiny for content that must meet regulatory standards. Any accuracy or terminology error could have legal or safety implications, so penalties are severe.',
  use_cases: [
    'Legal document translation',
    'Medical device documentation',
    'Pharmaceutical labeling',
    'Financial compliance reports',
    'Safety warnings and instructions'
  ],
  recommended_for: [
    'FDA submissions',
    'Legal contracts and agreements',
    'Medical trial documentation',
    'Financial audit materials'
  ],
  is_system_profile: true
};

// SPEED TO MARKET PROFILE
export const SPEED_TO_MARKET_PROFILE: MQMWeightingProfile = {
  id: 'speed_to_market',
  name: 'Speed to Market',
  description: 'Balanced approach prioritizing delivery speed while maintaining acceptable quality',
  context: [ProjectContext.GENERAL, ProjectContext.INTERNAL_COMMUNICATION],
  stakeholder_priority: StakeholderPriority.SPEED_TO_MARKET,
  severity_weights: {
    [MQMSeverity.MINOR]: 0.5,   // Reduced penalties for minor issues
    [MQMSeverity.MAJOR]: 3,     // Reduced from 5
    [MQMSeverity.CRITICAL]: 8,  // Reduced from 10
    [MQMSeverity.NEUTRAL]: 0
  },
  dimension_weights: {
    [MQMDimension.ACCURACY]: 1.5,
    [MQMDimension.TERMINOLOGY]: 1.2,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 0.8,
    [MQMDimension.STYLE]: 0.6,
    [MQMDimension.LOCALE_CONVENTIONS]: 0.8,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.0,
    [MQMDimension.DESIGN_AND_MARKUP]: 1.2
  },
  category_weights: {
    // Focus on critical accuracy issues only
    [MQMAccuracyCategory.MISTRANSLATION]: 1.5,
    [MQMAccuracyCategory.OMISSION]: 1.8,
    [MQMAccuracyCategory.UNTRANSLATED]: 2.0,
    
    // Reduced style penalties
    [MQMStyleCategory.AWKWARD]: 0.3,
    [MQMStyleCategory.UNNATURAL]: 0.4,
    [MQMStyleCategory.UNCLEAR]: 1.0,
    
    // Focus on functional issues
    [MQMDesignAndMarkupCategory.TRUNCATION]: 1.5,
    [MQMDesignAndMarkupCategory.MISSING_TEXT]: 2.0
  },
  rationale: 'Optimized for rapid delivery cycles where perfect polish is less important than functional accuracy. Focuses on critical errors while being lenient on stylistic refinements.',
  use_cases: [
    'Agile development cycles',
    'Beta testing content',
    'Internal documentation',
    'Rapid prototyping',
    'Time-sensitive releases'
  ],
  recommended_for: [
    'Startup environments',
    'MVP launches',
    'Internal tools and documentation'
  ],
  is_system_profile: true
};

// TECHNICAL PRECISION PROFILE
export const TECHNICAL_PRECISION_PROFILE: MQMWeightingProfile = {
  id: 'technical_precision',
  name: 'Technical Precision',
  description: 'Specialized for technical content requiring precise terminology and formatting',
  context: [ProjectContext.TECHNICAL_DOCUMENTATION],
  stakeholder_priority: StakeholderPriority.TECHNICAL_PRECISION,
  severity_weights: DEFAULT_MQM_PENALTIES,
  dimension_weights: {
    [MQMDimension.TERMINOLOGY]: 2.5,
    [MQMDimension.ACCURACY]: 2.2,
    [MQMDimension.DESIGN_AND_MARKUP]: 2.0,
    [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.5,
    [MQMDimension.STYLE]: 1.0,
    [MQMDimension.LOCALE_CONVENTIONS]: 1.2,
    [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.3
  },
  category_weights: {
    // Technical terminology is critical
    [MQMTerminologyCategory.INAPPROPRIATE_FOR_DOMAIN]: 3.0,
    [MQMTerminologyCategory.WRONG_TERM]: 2.5,
    [MQMTerminologyCategory.INCONSISTENT_USE]: 2.2,
    
    // Technical accuracy requirements
    [MQMAccuracyCategory.MISTRANSLATION]: 2.5,
    [MQMAccuracyCategory.OMISSION]: 2.2,
    
    // Code and markup preservation
    [MQMDesignAndMarkupCategory.MARKUP]: 2.5,
    [MQMDesignAndMarkupCategory.CHARACTER_ENCODING]: 2.0,
    
    // Technical style clarity
    [MQMStyleCategory.UNCLEAR]: 2.0,
    [MQMStyleCategory.INCONSISTENT]: 1.8
  },
  rationale: 'Tailored for technical documentation where precise terminology, accurate formatting, and clear instructions are essential for user success and safety.',
  use_cases: [
    'API documentation',
    'Software manuals',
    'Technical specifications',
    'Installation guides',
    'Troubleshooting documentation'
  ],
  recommended_for: [
    'Developer documentation',
    'Technical product manuals',
    'Engineering specifications'
  ],
  is_system_profile: true
};

/**
 * Profile registry for easy access
 */
export const MQM_WEIGHTING_PROFILES: Record<string, MQMWeightingProfile> = {
  [ACCURACY_FOCUSED_PROFILE.id]: ACCURACY_FOCUSED_PROFILE,
  [USER_EXPERIENCE_PROFILE.id]: USER_EXPERIENCE_PROFILE,
  [BRAND_CONSISTENCY_PROFILE.id]: BRAND_CONSISTENCY_PROFILE,
  [REGULATORY_COMPLIANCE_PROFILE.id]: REGULATORY_COMPLIANCE_PROFILE,
  [SPEED_TO_MARKET_PROFILE.id]: SPEED_TO_MARKET_PROFILE,
  [TECHNICAL_PRECISION_PROFILE.id]: TECHNICAL_PRECISION_PROFILE
};

/**
 * Dynamic weight configurations for different contexts
 */
export const DEFAULT_DYNAMIC_WEIGHT_CONFIG: MQMDynamicWeightConfig = {
  content_type_multipliers: {
    'technical_documentation': 1.2,
    'legal_content': 1.5,
    'marketing_content': 0.9,
    'ui_content': 1.1,
    'general_content': 1.0
  },
  
  domain_multipliers: {
    'medical': 1.5,
    'legal': 1.4,
    'financial': 1.3,
    'technical': 1.2,
    'marketing': 0.9,
    'general': 1.0
  },
  
  criticality_multipliers: {
    low: 0.8,
    medium: 1.0,
    high: 1.3,
    critical: 1.6
  },
  
  audience_multipliers: {
    'expert': 1.1,
    'professional': 1.0,
    'general_public': 0.9,
    'technical': 1.2,
    'regulatory': 1.4
  },
  
  phase_multipliers: {
    'development': 0.8,
    'testing': 0.9,
    'pre_release': 1.1,
    'production': 1.2,
    'maintenance': 1.0
  }
};

/**
 * Utility functions for weight management
 */

/**
 * Get recommended profile based on project context and stakeholder priority
 */
export function getRecommendedProfile(
  context: ProjectContext,
  priority: StakeholderPriority
): MQMWeightingProfile[] {
  return Object.values(MQM_WEIGHTING_PROFILES).filter(profile => 
    profile.context.includes(context) || profile.stakeholder_priority === priority
  );
}

/**
 * Validate weight configuration
 */
export function validateWeights(weights: any): WeightValidationResult {
  const result: WeightValidationResult = {
    is_valid: true,
    warnings: [],
    errors: []
  };
  
  // Check for negative weights
  const checkNegative = (obj: any, prefix: string) => {
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 0) {
        result.errors.push(`${prefix}.${key} cannot be negative: ${value}`);
        result.is_valid = false;
      }
    });
  };
  
  checkNegative(weights.severity_weights, 'severity_weights');
  checkNegative(weights.dimension_weights, 'dimension_weights');
  checkNegative(weights.category_weights, 'category_weights');
  
  // Check for extremely high weights
  const checkExtreme = (obj: any, prefix: string, max: number) => {
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (typeof value === 'number' && value > max) {
        result.warnings.push(`${prefix}.${key} is unusually high: ${value} (max recommended: ${max})`);
      }
    });
  };
  
  checkExtreme(weights.severity_weights, 'severity_weights', 20);
  checkExtreme(weights.dimension_weights, 'dimension_weights', 5);
  checkExtreme(weights.category_weights, 'category_weights', 5);
  
  return result;
}

/**
 * Normalize weights to sum to a target total
 */
export function normalizeWeights<T extends Record<string, number>>(
  weights: T, 
  target_total: number = 1.0
): T {
  const current_total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  
  if (current_total === 0) return weights;
  
  const factor = target_total / current_total;
  const normalized = {} as T;
  
  Object.entries(weights).forEach(([key, value]) => {
    normalized[key as keyof T] = (value * factor) as T[keyof T];
  });
  
  return normalized;
}

/**
 * Merge multiple weight configurations with priorities
 */
export function mergeWeightConfigs(
  base: Partial<MQMCategoryWeights>,
  override: Partial<MQMCategoryWeights>,
  profile?: MQMWeightingProfile
): MQMCategoryWeights {
  const merged = { ...base };
  
  // Apply profile weights first
  if (profile?.category_weights) {
    Object.assign(merged, profile.category_weights);
  }
  
  // Apply override weights last (highest priority)
  Object.assign(merged, override);
  
  return merged;
} 