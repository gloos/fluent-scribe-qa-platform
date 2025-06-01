/**
 * MQM Taxonomy Expansion Framework
 * Enhanced error categorization with increased granularity and domain-specific adaptations
 * Based on research and industry best practices for quality assessment
 */

import {
  MQMDimension,
  MQMErrorCategory,
  MQMSeverity,
  MQMErrorDefinition
} from './assessment';

/**
 * Domain-specific contexts for error categorization
 */
export enum ErrorDomain {
  GENERAL = 'general',
  TECHNICAL = 'technical',
  MEDICAL = 'medical',
  LEGAL = 'legal',
  FINANCIAL = 'financial',
  MARKETING = 'marketing',
  SOFTWARE_UI = 'software_ui',
  LITERARY = 'literary',
  ACADEMIC = 'academic',
  NEWS = 'news'
}

/**
 * Hierarchical category levels for expanded taxonomy
 */
export enum CategoryLevel {
  DIMENSION = 'dimension',     // Top level (existing)
  CATEGORY = 'category',       // Current level (existing)
  SUBCATEGORY = 'subcategory', // New intermediate level
  LEAF = 'leaf'               // Finest granularity level
}

/**
 * Enhanced substitution error subcategories
 * Based on linguistic analysis and translation quality research
 */
export enum SubstitutionSubcategory {
  // Semantic substitutions
  SYNONYM_SUBSTITUTION = 'synonym_substitution',
  ANTONYM_SUBSTITUTION = 'antonym_substitution',
  HYPERNYM_SUBSTITUTION = 'hypernym_substitution',
  HYPONYM_SUBSTITUTION = 'hyponym_substitution',
  RELATED_CONCEPT_SUBSTITUTION = 'related_concept_substitution',
  UNRELATED_SUBSTITUTION = 'unrelated_substitution',
  
  // Morphological substitutions
  INFLECTIONAL_SUBSTITUTION = 'inflectional_substitution',
  DERIVATIONAL_SUBSTITUTION = 'derivational_substitution',
  COMPOUND_SUBSTITUTION = 'compound_substitution',
  
  // Pragmatic substitutions
  REGISTER_SUBSTITUTION = 'register_substitution',
  POLITENESS_SUBSTITUTION = 'politeness_substitution',
  FORMALITY_SUBSTITUTION = 'formality_substitution',
  
  // Cross-linguistic substitutions
  FALSE_FRIEND_SUBSTITUTION = 'false_friend_substitution',
  CALQUE_SUBSTITUTION = 'calque_substitution',
  INTERFERENCE_SUBSTITUTION = 'interference_substitution'
}

/**
 * Enhanced accuracy subcategories for finer granularity
 */
export enum AccuracySubcategory {
  // Mistranslation subcategories
  SEMANTIC_MISTRANSLATION = 'semantic_mistranslation',
  PRAGMATIC_MISTRANSLATION = 'pragmatic_mistranslation',
  CULTURAL_MISTRANSLATION = 'cultural_mistranslation',
  CONTEXTUAL_MISTRANSLATION = 'contextual_mistranslation',
  TECHNICAL_MISTRANSLATION = 'technical_mistranslation',
  
  // Omission subcategories  
  PARTIAL_OMISSION = 'partial_omission',
  COMPLETE_OMISSION = 'complete_omission',
  STRUCTURAL_OMISSION = 'structural_omission',
  FUNCTIONAL_OMISSION = 'functional_omission',
  
  // Addition subcategories
  EXPLANATORY_ADDITION = 'explanatory_addition',
  CULTURAL_ADDITION = 'cultural_addition',
  REDUNDANT_ADDITION = 'redundant_addition',
  INTERFERENCE_ADDITION = 'interference_addition'
}

/**
 * Enhanced style subcategories
 */
export enum StyleSubcategory {
  // Naturalness issues
  LITERAL_TRANSLATION = 'literal_translation',
  INTERFERENCE = 'interference',
  CALQUE = 'calque',
  UNNATURAL_COLLOCATION = 'unnatural_collocation',
  
  // Consistency issues
  TERMINOLOGY_INCONSISTENCY = 'terminology_inconsistency',
  STYLE_INCONSISTENCY = 'style_inconsistency',
  REGISTER_INCONSISTENCY = 'register_inconsistency',
  
  // Clarity issues
  AMBIGUOUS_REFERENCE = 'ambiguous_reference',
  UNCLEAR_STRUCTURE = 'unclear_structure',
  VERBOSE = 'verbose',
  TOO_CONCISE = 'too_concise'
}

/**
 * Expanded error category structure with hierarchy
 */
export interface ExpandedErrorCategory {
  id: string;
  level: CategoryLevel;
  dimension: MQMDimension;
  parent_category?: string;
  subcategory?: string;
  name: string;
  description: string;
  domain_specific: boolean;
  applicable_domains?: ErrorDomain[];
  children?: ExpandedErrorCategory[];
}

/**
 * Domain-specific error definition
 */
export interface DomainSpecificErrorDefinition extends MQMErrorDefinition {
  domain: ErrorDomain;
  domain_context?: string;
  domain_specific_guidelines?: string;
  cross_domain_applicability?: ErrorDomain[];
}

/**
 * Hierarchical error path for expanded taxonomy
 */
export interface HierarchicalErrorPath {
  dimension: MQMDimension;
  category: MQMErrorCategory;
  subcategory?: string;
  leaf_category?: string;
  domain?: ErrorDomain;
  full_path: string; // e.g., "accuracy/mistranslation/semantic_mistranslation/cultural"
}

/**
 * Taxonomy expansion configuration
 */
export interface TaxonomyExpansionConfig {
  enable_subcategories: boolean;
  enable_domain_specific: boolean;
  enabled_domains: ErrorDomain[];
  max_hierarchy_depth: number;
  default_domain: ErrorDomain;
  fallback_to_general: boolean;
}

/**
 * Expanded MQM error instance with enhanced categorization
 */
export interface ExpandedMQMErrorInstance {
  id: string;
  hierarchical_path: HierarchicalErrorPath;
  severity: MQMSeverity;
  penalty: number;
  
  // Context information
  domain: ErrorDomain;
  domain_confidence?: number;
  subcategory_confidence?: number;
  
  // Content and location (same as original)
  segment_id: string;
  start_position?: number;
  end_position?: number;
  source_text: string;
  target_text: string;
  highlighted_text?: string;
  
  // Enhanced error details
  description: string;
  domain_specific_description?: string;
  correction?: string;
  comment?: string;
  confidence?: number;
  
  // Linguistic analysis
  linguistic_features?: {
    pos_tags?: string[];
    semantic_field?: string;
    register_level?: string;
    cultural_markers?: string[];
  };
  
  // Assessment metadata
  assessor_id: string;
  timestamp: string;
  auto_categorized: boolean;
  manual_override?: boolean;
}

/**
 * Taxonomy expansion result
 */
export interface TaxonomyExpansionResult {
  success: boolean;
  expanded_categories: ExpandedErrorCategory[];
  domain_mappings: Record<ErrorDomain, ExpandedErrorCategory[]>;
  hierarchy_depth: number;
  total_categories: number;
  errors?: string[];
}

/**
 * Category recommendation for error instances
 */
export interface CategoryRecommendation {
  hierarchical_path: HierarchicalErrorPath;
  confidence: number;
  reasoning: string;
  alternative_paths?: HierarchicalErrorPath[];
  domain_context?: string;
} 