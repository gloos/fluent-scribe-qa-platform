/**
 * MQM Taxonomy Expansion Framework Implementation
 * Core functionality for expanding MQM taxonomy with enhanced granularity
 */

import {
  MQMDimension,
  MQMAccuracyCategory,
  MQMStyleCategory,
  MQMErrorCategory,
  MQMSeverity,
  MQMErrorDefinition
} from '../types/assessment';

import {
  ErrorDomain,
  CategoryLevel,
  SubstitutionSubcategory,
  AccuracySubcategory,
  StyleSubcategory,
  ExpandedErrorCategory,
  DomainSpecificErrorDefinition,
  HierarchicalErrorPath,
  TaxonomyExpansionConfig,
  ExpandedMQMErrorInstance,
  TaxonomyExpansionResult,
  CategoryRecommendation
} from '../types/mqm-taxonomy-expansion';

import { MQM_ERROR_DEFINITIONS } from '../constants/mqm-taxonomy';

/**
 * Default configuration for taxonomy expansion
 */
export const DEFAULT_EXPANSION_CONFIG: TaxonomyExpansionConfig = {
  enable_subcategories: true,
  enable_domain_specific: true,
  enabled_domains: [
    ErrorDomain.GENERAL,
    ErrorDomain.TECHNICAL,
    ErrorDomain.MEDICAL,
    ErrorDomain.LEGAL,
    ErrorDomain.FINANCIAL,
    ErrorDomain.SOFTWARE_UI
  ],
  max_hierarchy_depth: 4,
  default_domain: ErrorDomain.GENERAL,
  fallback_to_general: true
};

/**
 * MQM Taxonomy Expansion Engine
 * Main class for managing and applying taxonomy expansion
 */
export class MQMTaxonomyExpansionEngine {
  private config: TaxonomyExpansionConfig;
  private expandedCategories: Map<string, ExpandedErrorCategory> = new Map();
  private domainMappings: Map<ErrorDomain, ExpandedErrorCategory[]> = new Map();
  private hierarchyCache: Map<string, HierarchicalErrorPath> = new Map();

  constructor(config: Partial<TaxonomyExpansionConfig> = {}) {
    this.config = { ...DEFAULT_EXPANSION_CONFIG, ...config };
    this.initializeExpandedTaxonomy();
  }

  /**
   * Initialize the expanded taxonomy structure
   */
  private initializeExpandedTaxonomy(): void {
    // Initialize base categories from existing MQM structure
    this.initializeBaseMQMCategories();
    
    // Add expanded subcategories
    if (this.config.enable_subcategories) {
      this.addSubstitutionSubcategories();
      this.addAccuracySubcategories();
      this.addStyleSubcategories();
    }
    
    // Create domain-specific mappings
    if (this.config.enable_domain_specific) {
      this.createDomainSpecificMappings();
    }
  }

  /**
   * Initialize base MQM categories as expanded categories
   */
  private initializeBaseMQMCategories(): void {
    // Convert existing MQM categories to expanded format
    Object.values(MQMDimension).forEach(dimension => {
      const dimensionCategory: ExpandedErrorCategory = {
        id: dimension,
        level: CategoryLevel.DIMENSION,
        dimension: dimension,
        name: this.formatDimensionName(dimension),
        description: `MQM ${this.formatDimensionName(dimension)} dimension`,
        domain_specific: false,
        children: []
      };
      this.expandedCategories.set(dimension, dimensionCategory);
    });

    // Add existing categories as subcategories
    Object.entries(MQM_ERROR_DEFINITIONS).forEach(([key, definition]) => {
      const categoryId = `${definition.dimension}/${definition.category}`;
      const expandedCategory: ExpandedErrorCategory = {
        id: categoryId,
        level: CategoryLevel.CATEGORY,
        dimension: definition.dimension,
        parent_category: definition.dimension,
        name: this.formatCategoryName(definition.category),
        description: definition.description,
        domain_specific: false,
        applicable_domains: Object.values(ErrorDomain)
      };
      
      this.expandedCategories.set(categoryId, expandedCategory);
      
      // Add to parent dimension
      const parentDimension = this.expandedCategories.get(definition.dimension);
      if (parentDimension?.children) {
        parentDimension.children.push(expandedCategory);
      }
    });
  }

  /**
   * Add enhanced substitution subcategories to mistranslation
   */
  private addSubstitutionSubcategories(): void {
    const mistranslationKey = `${MQMDimension.ACCURACY}/${MQMAccuracyCategory.MISTRANSLATION}`;
    const mistranslationCategory = this.expandedCategories.get(mistranslationKey);
    
    if (!mistranslationCategory) return;

    // Create substitution intermediate category
    const substitutionCategory: ExpandedErrorCategory = {
      id: `${mistranslationKey}/substitution`,
      level: CategoryLevel.SUBCATEGORY,
      dimension: MQMDimension.ACCURACY,
      parent_category: mistranslationKey,
      subcategory: 'substitution',
      name: 'Substitution Errors',
      description: 'Errors where source content is replaced with incorrect target content',
      domain_specific: false,
      children: []
    };

    // Add detailed substitution subcategories
    Object.values(SubstitutionSubcategory).forEach(subcategory => {
      const leafCategory: ExpandedErrorCategory = {
        id: `${substitutionCategory.id}/${subcategory}`,
        level: CategoryLevel.LEAF,
        dimension: MQMDimension.ACCURACY,
        parent_category: substitutionCategory.id,
        subcategory: subcategory,
        name: this.formatSubcategoryName(subcategory),
        description: this.getSubstitutionDescription(subcategory),
        domain_specific: this.isSubstitutionDomainSpecific(subcategory),
        applicable_domains: this.getApplicableDomains(subcategory)
      };
      
      this.expandedCategories.set(leafCategory.id, leafCategory);
      substitutionCategory.children!.push(leafCategory);
    });

    this.expandedCategories.set(substitutionCategory.id, substitutionCategory);
    mistranslationCategory.children = mistranslationCategory.children || [];
    mistranslationCategory.children.push(substitutionCategory);
  }

  /**
   * Add enhanced accuracy subcategories
   */
  private addAccuracySubcategories(): void {
    const accuracyCategories = [
      MQMAccuracyCategory.MISTRANSLATION,
      MQMAccuracyCategory.OMISSION,
      MQMAccuracyCategory.ADDITION
    ];

    accuracyCategories.forEach(category => {
      const categoryKey = `${MQMDimension.ACCURACY}/${category}`;
      const parentCategory = this.expandedCategories.get(categoryKey);
      
      if (!parentCategory) return;

      const relevantSubcategories = this.getAccuracySubcategoriesForCategory(category);
      
      relevantSubcategories.forEach(subcategory => {
        const leafCategory: ExpandedErrorCategory = {
          id: `${categoryKey}/${subcategory}`,
          level: CategoryLevel.LEAF,
          dimension: MQMDimension.ACCURACY,
          parent_category: categoryKey,
          subcategory: subcategory,
          name: this.formatSubcategoryName(subcategory),
          description: this.getAccuracySubcategoryDescription(subcategory),
          domain_specific: this.isAccuracySubcategoryDomainSpecific(subcategory),
          applicable_domains: this.getApplicableDomains(subcategory)
        };
        
        this.expandedCategories.set(leafCategory.id, leafCategory);
        parentCategory.children = parentCategory.children || [];
        parentCategory.children.push(leafCategory);
      });
    });
  }

  /**
   * Add enhanced style subcategories
   */
  private addStyleSubcategories(): void {
    const styleCategories = [
      MQMStyleCategory.AWKWARD,
      MQMStyleCategory.UNNATURAL,
      MQMStyleCategory.INCONSISTENT,
      MQMStyleCategory.UNCLEAR
    ];

    styleCategories.forEach(category => {
      const categoryKey = `${MQMDimension.STYLE}/${category}`;
      const parentCategory = this.expandedCategories.get(categoryKey);
      
      if (!parentCategory) return;

      const relevantSubcategories = this.getStyleSubcategoriesForCategory(category);
      
      relevantSubcategories.forEach(subcategory => {
        const leafCategory: ExpandedErrorCategory = {
          id: `${categoryKey}/${subcategory}`,
          level: CategoryLevel.LEAF,
          dimension: MQMDimension.STYLE,
          parent_category: categoryKey,
          subcategory: subcategory,
          name: this.formatSubcategoryName(subcategory),
          description: this.getStyleSubcategoryDescription(subcategory),
          domain_specific: this.isStyleSubcategoryDomainSpecific(subcategory),
          applicable_domains: this.getApplicableDomains(subcategory)
        };
        
        this.expandedCategories.set(leafCategory.id, leafCategory);
        parentCategory.children = parentCategory.children || [];
        parentCategory.children.push(leafCategory);
      });
    });
  }

  /**
   * Create domain-specific category mappings
   */
  private createDomainSpecificMappings(): void {
    this.config.enabled_domains.forEach(domain => {
      const domainCategories: ExpandedErrorCategory[] = [];
      
      this.expandedCategories.forEach(category => {
        if (category.applicable_domains?.includes(domain) || 
            category.applicable_domains?.includes(ErrorDomain.GENERAL)) {
          domainCategories.push(category);
        }
      });
      
      this.domainMappings.set(domain, domainCategories);
    });
  }

  /**
   * Get expanded taxonomy result
   */
  public getExpandedTaxonomy(): TaxonomyExpansionResult {
    const allCategories = Array.from(this.expandedCategories.values());
    const domainMappingsObject: Record<ErrorDomain, ExpandedErrorCategory[]> = {} as Record<ErrorDomain, ExpandedErrorCategory[]>;
    
    this.domainMappings.forEach((categories, domain) => {
      domainMappingsObject[domain] = categories;
    });
    
    return {
      success: true,
      expanded_categories: allCategories,
      domain_mappings: domainMappingsObject,
      hierarchy_depth: this.config.max_hierarchy_depth,
      total_categories: allCategories.length,
      errors: []
    };
  }

  /**
   * Recommend category for error instance
   */
  public recommendCategory(
    errorText: string,
    sourceText: string,
    targetText: string,
    domain: ErrorDomain = this.config.default_domain
  ): CategoryRecommendation {
    // Simplified recommendation logic - in production this would use ML/NLP
    const path = this.analyzeErrorForCategorization(errorText, sourceText, targetText, domain);
    
    return {
      hierarchical_path: path,
      confidence: 0.85, // Placeholder confidence
      reasoning: 'Analyzed based on error patterns and domain context',
      domain_context: `Optimized for ${domain} domain`
    };
  }

  /**
   * Convert standard MQM error to expanded error instance
   */
  public expandErrorInstance(
    originalError: any,
    domain: ErrorDomain = this.config.default_domain
  ): ExpandedMQMErrorInstance {
    const hierarchicalPath = this.buildHierarchicalPath(
      originalError.dimension,
      originalError.category,
      undefined,
      domain
    );

    return {
      id: originalError.id,
      hierarchical_path: hierarchicalPath,
      severity: originalError.severity,
      penalty: originalError.penalty,
      domain: domain,
      domain_confidence: 0.9,
      segment_id: originalError.segment_id,
      start_position: originalError.start_position,
      end_position: originalError.end_position,
      source_text: originalError.source_text,
      target_text: originalError.target_text,
      highlighted_text: originalError.highlighted_text,
      description: originalError.description,
      correction: originalError.correction,
      comment: originalError.comment,
      confidence: originalError.confidence,
      assessor_id: originalError.assessor_id,
      timestamp: originalError.timestamp,
      auto_categorized: true,
      manual_override: false
    };
  }

  // Helper methods for formatting and categorization logic

  private formatDimensionName(dimension: string): string {
    return dimension.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private formatCategoryName(category: string): string {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private formatSubcategoryName(subcategory: string): string {
    return subcategory.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private getSubstitutionDescription(subcategory: SubstitutionSubcategory): string {
    const descriptions: Record<SubstitutionSubcategory, string> = {
      [SubstitutionSubcategory.SYNONYM_SUBSTITUTION]: 'Incorrect synonym used instead of appropriate term',
      [SubstitutionSubcategory.ANTONYM_SUBSTITUTION]: 'Opposite meaning substituted for source content',
      [SubstitutionSubcategory.HYPERNYM_SUBSTITUTION]: 'More general term used instead of specific term',
      [SubstitutionSubcategory.HYPONYM_SUBSTITUTION]: 'More specific term used instead of general term',
      [SubstitutionSubcategory.RELATED_CONCEPT_SUBSTITUTION]: 'Related but incorrect concept substituted',
      [SubstitutionSubcategory.UNRELATED_SUBSTITUTION]: 'Completely unrelated term substituted',
      [SubstitutionSubcategory.INFLECTIONAL_SUBSTITUTION]: 'Wrong inflectional form used',
      [SubstitutionSubcategory.DERIVATIONAL_SUBSTITUTION]: 'Wrong derivational form used',
      [SubstitutionSubcategory.COMPOUND_SUBSTITUTION]: 'Incorrect compound structure',
      [SubstitutionSubcategory.REGISTER_SUBSTITUTION]: 'Wrong register level used',
      [SubstitutionSubcategory.POLITENESS_SUBSTITUTION]: 'Inappropriate politeness level',
      [SubstitutionSubcategory.FORMALITY_SUBSTITUTION]: 'Wrong formality level',
      [SubstitutionSubcategory.FALSE_FRIEND_SUBSTITUTION]: 'False friend used incorrectly',
      [SubstitutionSubcategory.CALQUE_SUBSTITUTION]: 'Inappropriate calque structure',
      [SubstitutionSubcategory.INTERFERENCE_SUBSTITUTION]: 'Source language interference'
    };
    return descriptions[subcategory] || 'Substitution error subcategory';
  }

  private isSubstitutionDomainSpecific(subcategory: SubstitutionSubcategory): boolean {
    const domainSpecific = [
      SubstitutionSubcategory.REGISTER_SUBSTITUTION,
      SubstitutionSubcategory.FORMALITY_SUBSTITUTION
    ];
    return domainSpecific.includes(subcategory);
  }

  private getApplicableDomains(subcategory: string): ErrorDomain[] {
    // Domain mapping logic - simplified for now
    if (subcategory.includes('technical')) {
      return [ErrorDomain.TECHNICAL, ErrorDomain.SOFTWARE_UI];
    }
    if (subcategory.includes('formal') || subcategory.includes('register')) {
      return [ErrorDomain.LEGAL, ErrorDomain.FINANCIAL, ErrorDomain.ACADEMIC];
    }
    return Object.values(ErrorDomain);
  }

  private getAccuracySubcategoriesForCategory(category: MQMAccuracyCategory): AccuracySubcategory[] {
    const mappings: Record<MQMAccuracyCategory, AccuracySubcategory[]> = {
      [MQMAccuracyCategory.MISTRANSLATION]: [
        AccuracySubcategory.SEMANTIC_MISTRANSLATION,
        AccuracySubcategory.PRAGMATIC_MISTRANSLATION,
        AccuracySubcategory.CULTURAL_MISTRANSLATION,
        AccuracySubcategory.CONTEXTUAL_MISTRANSLATION,
        AccuracySubcategory.TECHNICAL_MISTRANSLATION
      ],
      [MQMAccuracyCategory.OMISSION]: [
        AccuracySubcategory.PARTIAL_OMISSION,
        AccuracySubcategory.COMPLETE_OMISSION,
        AccuracySubcategory.STRUCTURAL_OMISSION,
        AccuracySubcategory.FUNCTIONAL_OMISSION
      ],
      [MQMAccuracyCategory.ADDITION]: [
        AccuracySubcategory.EXPLANATORY_ADDITION,
        AccuracySubcategory.CULTURAL_ADDITION,
        AccuracySubcategory.REDUNDANT_ADDITION,
        AccuracySubcategory.INTERFERENCE_ADDITION
      ],
      [MQMAccuracyCategory.UNTRANSLATED]: [],
      [MQMAccuracyCategory.DO_NOT_TRANSLATE_MISTRANSLATED]: []
    };
    return mappings[category] || [];
  }

  private getAccuracySubcategoryDescription(subcategory: AccuracySubcategory): string {
    const descriptions: Record<AccuracySubcategory, string> = {
      [AccuracySubcategory.SEMANTIC_MISTRANSLATION]: 'Meaning incorrectly conveyed',
      [AccuracySubcategory.PRAGMATIC_MISTRANSLATION]: 'Pragmatic intent incorrectly conveyed',
      [AccuracySubcategory.CULTURAL_MISTRANSLATION]: 'Cultural context incorrectly handled',
      [AccuracySubcategory.CONTEXTUAL_MISTRANSLATION]: 'Context incorrectly interpreted',
      [AccuracySubcategory.TECHNICAL_MISTRANSLATION]: 'Technical content incorrectly translated',
      [AccuracySubcategory.PARTIAL_OMISSION]: 'Part of source content omitted',
      [AccuracySubcategory.COMPLETE_OMISSION]: 'Entire source segment omitted',
      [AccuracySubcategory.STRUCTURAL_OMISSION]: 'Structural element omitted',
      [AccuracySubcategory.FUNCTIONAL_OMISSION]: 'Functional element omitted',
      [AccuracySubcategory.EXPLANATORY_ADDITION]: 'Explanatory content added',
      [AccuracySubcategory.CULTURAL_ADDITION]: 'Cultural adaptation content added',
      [AccuracySubcategory.REDUNDANT_ADDITION]: 'Unnecessary content added',
      [AccuracySubcategory.INTERFERENCE_ADDITION]: 'Source language interference added'
    };
    return descriptions[subcategory] || 'Accuracy error subcategory';
  }

  private isAccuracySubcategoryDomainSpecific(subcategory: AccuracySubcategory): boolean {
    const domainSpecific = [
      AccuracySubcategory.TECHNICAL_MISTRANSLATION,
      AccuracySubcategory.CULTURAL_MISTRANSLATION
    ];
    return domainSpecific.includes(subcategory);
  }

  private getStyleSubcategoriesForCategory(category: MQMStyleCategory): StyleSubcategory[] {
    const mappings: Record<MQMStyleCategory, StyleSubcategory[]> = {
      [MQMStyleCategory.AWKWARD]: [
        StyleSubcategory.LITERAL_TRANSLATION,
        StyleSubcategory.INTERFERENCE,
        StyleSubcategory.UNNATURAL_COLLOCATION
      ],
      [MQMStyleCategory.UNNATURAL]: [
        StyleSubcategory.CALQUE,
        StyleSubcategory.INTERFERENCE,
        StyleSubcategory.LITERAL_TRANSLATION
      ],
      [MQMStyleCategory.INCONSISTENT]: [
        StyleSubcategory.TERMINOLOGY_INCONSISTENCY,
        StyleSubcategory.STYLE_INCONSISTENCY,
        StyleSubcategory.REGISTER_INCONSISTENCY
      ],
      [MQMStyleCategory.UNCLEAR]: [
        StyleSubcategory.AMBIGUOUS_REFERENCE,
        StyleSubcategory.UNCLEAR_STRUCTURE,
        StyleSubcategory.VERBOSE,
        StyleSubcategory.TOO_CONCISE
      ]
    };
    return mappings[category] || [];
  }

  private getStyleSubcategoryDescription(subcategory: StyleSubcategory): string {
    const descriptions: Record<StyleSubcategory, string> = {
      [StyleSubcategory.LITERAL_TRANSLATION]: 'Overly literal translation affecting naturalness',
      [StyleSubcategory.INTERFERENCE]: 'Source language interference in target text',
      [StyleSubcategory.CALQUE]: 'Inappropriate structural calque',
      [StyleSubcategory.UNNATURAL_COLLOCATION]: 'Unnatural word combinations',
      [StyleSubcategory.TERMINOLOGY_INCONSISTENCY]: 'Inconsistent terminology use',
      [StyleSubcategory.STYLE_INCONSISTENCY]: 'Inconsistent writing style',
      [StyleSubcategory.REGISTER_INCONSISTENCY]: 'Inconsistent register usage',
      [StyleSubcategory.AMBIGUOUS_REFERENCE]: 'Unclear reference or pronoun usage',
      [StyleSubcategory.UNCLEAR_STRUCTURE]: 'Confusing sentence or paragraph structure',
      [StyleSubcategory.VERBOSE]: 'Unnecessarily wordy expression',
      [StyleSubcategory.TOO_CONCISE]: 'Overly brief, missing important details'
    };
    return descriptions[subcategory] || 'Style error subcategory';
  }

  private isStyleSubcategoryDomainSpecific(subcategory: StyleSubcategory): boolean {
    const domainSpecific = [
      StyleSubcategory.REGISTER_INCONSISTENCY,
      StyleSubcategory.TERMINOLOGY_INCONSISTENCY
    ];
    return domainSpecific.includes(subcategory);
  }

  private analyzeErrorForCategorization(
    errorText: string,
    sourceText: string,
    targetText: string,
    domain: ErrorDomain
  ): HierarchicalErrorPath {
    // Simplified analysis - in production would use NLP/ML
    // For now, return a default substitution path
    return {
      dimension: MQMDimension.ACCURACY,
      category: MQMAccuracyCategory.MISTRANSLATION,
      subcategory: 'substitution',
      leaf_category: AccuracySubcategory.SEMANTIC_MISTRANSLATION,
      domain: domain,
      full_path: `accuracy/mistranslation/substitution/${AccuracySubcategory.SEMANTIC_MISTRANSLATION}`
    };
  }

  private buildHierarchicalPath(
    dimension: MQMDimension,
    category: MQMErrorCategory,
    subcategory?: string,
    domain?: ErrorDomain
  ): HierarchicalErrorPath {
    let fullPath = `${dimension}/${category}`;
    if (subcategory) {
      fullPath += `/${subcategory}`;
    }
    
    return {
      dimension,
      category,
      subcategory,
      domain,
      full_path: fullPath
    };
  }
}

// Export singleton instance
export const taxonomyExpansionEngine = new MQMTaxonomyExpansionEngine();

// Export re-exports from types
export {
  ErrorDomain,
  CategoryLevel,
  SubstitutionSubcategory,
  AccuracySubcategory,
  StyleSubcategory
} from '../types/mqm-taxonomy-expansion'; 