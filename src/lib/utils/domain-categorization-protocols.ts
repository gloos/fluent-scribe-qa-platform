/**
 * Domain-Specific Categorization Protocols
 * Provides structured adaptation rules for different domains and content types
 */

import {
  MQMDimension,
  MQMSeverity,
  MQMErrorCategory,
  MQMTerminologyCategory,
  MQMAccuracyCategory,
  MQLinguisticConventionsCategory,
  MQMStyleCategory,
  MQMLocaleConventionsCategory,
  MQMAudienceAppropriatenessCategory,
  MQMDesignAndMarkupCategory
} from '../types/assessment';
import { ErrorDomain } from '../types/mqm-taxonomy-expansion';
import { CategoryDecision, ErrorContext } from './mqm-categorization-rules';

/**
 * Domain-specific categorization configuration
 */
export interface DomainCategorizationConfig {
  domain: ErrorDomain;
  priority_ranking: MQMDimension[];
  severity_multipliers: Record<MQMDimension, number>;
  category_mappings: Record<string, DomainCategoryMapping>;
  content_type_modifiers: Record<string, ContentTypeModifier>;
  glossary_requirements: GlossaryRequirement[];
  cultural_adaptation_rules: CulturalAdaptationRule[];
}

/**
 * Domain-specific category mapping
 */
export interface DomainCategoryMapping {
  standard_category: MQMErrorCategory;
  domain_specific_label: string;
  description: string;
  severity_adjustment: number;
  detection_patterns: string[];
  examples: DomainExample[];
  common_mistakes: string[];
}

/**
 * Content type modifier for categorization
 */
export interface ContentTypeModifier {
  content_type: string;
  affected_dimensions: MQMDimension[];
  severity_impact: 'increase' | 'decrease' | 'neutral';
  impact_factor: number;
  special_rules: string[];
}

/**
 * Glossary requirements for domains
 */
export interface GlossaryRequirement {
  term_type: string;
  required_consistency: number; // 0-1 scale
  penalty_severity: MQMSeverity;
  validation_patterns: string[];
}

/**
 * Cultural adaptation rules
 */
export interface CulturalAdaptationRule {
  id: string;
  source_pattern: string | RegExp;
  target_expectation: string;
  category_override?: MQMErrorCategory;
  severity_adjustment: number;
  justification: string;
}

/**
 * Domain-specific example
 */
export interface DomainExample {
  error_text: string;
  source_context: string;
  target_context: string;
  correct_categorization: string;
  incorrect_categorizations: string[];
  explanation: string;
  severity_rationale: string;
}

/**
 * Domain categorization protocols manager
 */
export class DomainCategorizationProtocols {
  private domainConfigs: Map<ErrorDomain, DomainCategorizationConfig> = new Map();
  
  constructor() {
    this.initializeDomainConfigs();
  }

  /**
   * Get domain-specific categorization
   */
  public getDomainCategorization(
    context: ErrorContext,
    baseDecision: CategoryDecision
  ): CategoryDecision {
    const config = this.domainConfigs.get(context.domain);
    if (!config) return baseDecision;

    // Apply domain-specific mapping
    const mappedCategory = this.applyDomainMapping(baseDecision, config);
    
    // Apply content type modifiers
    const modifiedDecision = this.applyContentTypeModifiers(mappedCategory, context, config);
    
    // Apply cultural adaptation rules
    const culturallyAdapted = this.applyCulturalAdaptation(modifiedDecision, context, config);

    return culturallyAdapted;
  }

  /**
   * Validate domain-specific requirements
   */
  public validateDomainRequirements(
    context: ErrorContext,
    decision: CategoryDecision
  ): {
    meets_requirements: boolean;
    violations: string[];
    recommendations: string[];
  } {
    const config = this.domainConfigs.get(context.domain);
    if (!config) {
      return { meets_requirements: true, violations: [], recommendations: [] };
    }

    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check priority dimension compliance
    const isPriorityDimension = config.priority_ranking
      .slice(0, 3) // Top 3 priority dimensions
      .includes(decision.primary_category.dimension);

    if (!isPriorityDimension && decision.confidence > 0.8) {
      violations.push(`Category not in top priority dimensions for ${context.domain}`);
      recommendations.push(`Consider categories in: ${config.priority_ranking.slice(0, 3).join(', ')}`);
    }

    // Check severity appropriateness
    const expectedSeverityMultiplier = config.severity_multipliers[decision.primary_category.dimension];
    if (expectedSeverityMultiplier > 1.2 && decision.confidence > 0.7) {
      recommendations.push(`Consider higher severity for ${context.domain} domain errors`);
    }

    // Check glossary requirements
    const glossaryViolations = this.checkGlossaryRequirements(context, config);
    violations.push(...glossaryViolations);

    return {
      meets_requirements: violations.length === 0,
      violations,
      recommendations
    };
  }

  /**
   * Get domain-specific training examples
   */
  public getDomainTrainingExamples(
    domain: ErrorDomain,
    dimension?: MQMDimension,
    category?: MQMErrorCategory
  ): DomainExample[] {
    const config = this.domainConfigs.get(domain);
    if (!config) return [];

    const examples: DomainExample[] = [];

    Object.values(config.category_mappings).forEach(mapping => {
      if (!dimension || this.getDimensionForCategory(mapping.standard_category) === dimension) {
        if (!category || mapping.standard_category === category) {
          examples.push(...mapping.examples);
        }
      }
    });

    return examples;
  }

  /**
   * Get content type guidance
   */
  public getContentTypeGuidance(
    domain: ErrorDomain,
    contentType: string
  ): ContentTypeModifier | null {
    const config = this.domainConfigs.get(domain);
    if (!config) return null;

    return config.content_type_modifiers[contentType] || null;
  }

  private initializeDomainConfigs(): void {
    // Technical domain configuration
    this.domainConfigs.set(ErrorDomain.TECHNICAL, {
      domain: ErrorDomain.TECHNICAL,
      priority_ranking: [
        MQMDimension.TERMINOLOGY,
        MQMDimension.ACCURACY,
        MQMDimension.LINGUISTIC_CONVENTIONS,
        MQMDimension.STYLE,
        MQMDimension.AUDIENCE_APPROPRIATENESS,
        MQMDimension.LOCALE_CONVENTIONS,
        MQMDimension.DESIGN_AND_MARKUP
      ],
      severity_multipliers: {
        [MQMDimension.TERMINOLOGY]: 1.3,
        [MQMDimension.ACCURACY]: 1.2,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.1,
        [MQMDimension.STYLE]: 1.0,
        [MQMDimension.LOCALE_CONVENTIONS]: 0.9,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.0,
        [MQMDimension.DESIGN_AND_MARKUP]: 1.2
      },
      category_mappings: {
        'api_terminology': {
          standard_category: MQMTerminologyCategory.WRONG_TERM,
          domain_specific_label: 'API/Programming Terminology Error',
          description: 'Incorrect use of programming or API-specific terms',
          severity_adjustment: 1.3,
          detection_patterns: ['API', 'method', 'function', 'parameter', 'library', 'framework'],
          examples: [{
            error_text: 'Translated "method" as "way" instead of programming method',
            source_context: 'API documentation describing class methods',
            target_context: 'Technical documentation for developers',
            correct_categorization: 'TERMINOLOGY/WRONG_TERM with technical domain flag',
            incorrect_categorizations: ['STYLE/UNNATURAL', 'ACCURACY/MISTRANSLATION'],
            explanation: 'Programming terminology requires precise technical translation',
            severity_rationale: 'Wrong terminology can cause developer confusion and implementation errors'
          }],
          common_mistakes: ['Treating as style issue', 'Using generic translation']
        },
        'code_example_accuracy': {
          standard_category: MQMAccuracyCategory.MISTRANSLATION,
          domain_specific_label: 'Code Example Translation Error',
          description: 'Errors in translating code examples or syntax',
          severity_adjustment: 1.5,
          detection_patterns: ['code', 'syntax', 'example', 'snippet'],
          examples: [{
            error_text: 'Variable names translated instead of kept in English',
            source_context: 'Code example in programming tutorial',
            target_context: 'Localized programming tutorial',
            correct_categorization: 'ACCURACY/MISTRANSLATION with critical severity',
            incorrect_categorizations: ['TERMINOLOGY/WRONG_TERM'],
            explanation: 'Code must remain functional and executable',
            severity_rationale: 'Translated code examples break functionality'
          }],
          common_mistakes: ['Translating variable names', 'Localizing programming keywords']
        }
      },
      content_type_modifiers: {
        'api_documentation': {
          content_type: 'api_documentation',
          affected_dimensions: [MQMDimension.TERMINOLOGY, MQMDimension.ACCURACY],
          severity_impact: 'increase',
          impact_factor: 1.3,
          special_rules: [
            'All API endpoints must remain untranslated',
            'Parameter names must be consistent',
            'Response format examples must be accurate'
          ]
        },
        'code_comments': {
          content_type: 'code_comments',
          affected_dimensions: [MQMDimension.STYLE, MQMDimension.AUDIENCE_APPROPRIATENESS],
          severity_impact: 'neutral',
          impact_factor: 1.0,
          special_rules: [
            'Maintain developer-appropriate tone',
            'Keep technical precision while improving readability'
          ]
        }
      },
      glossary_requirements: [{
        term_type: 'programming_keywords',
        required_consistency: 1.0,
        penalty_severity: MQMSeverity.CRITICAL,
        validation_patterns: ['class', 'function', 'method', 'variable', 'API', 'endpoint']
      }],
      cultural_adaptation_rules: [{
        id: 'tech_metaphors',
        source_pattern: /stack|heap|queue|tree/i,
        target_expectation: 'Maintain technical meaning over cultural adaptation',
        severity_adjustment: 1.2,
        justification: 'Technical metaphors have specific CS meanings'
      }]
    });

    // Medical domain configuration
    this.domainConfigs.set(ErrorDomain.MEDICAL, {
      domain: ErrorDomain.MEDICAL,
      priority_ranking: [
        MQMDimension.ACCURACY,
        MQMDimension.TERMINOLOGY,
        MQMDimension.AUDIENCE_APPROPRIATENESS,
        MQMDimension.LINGUISTIC_CONVENTIONS,
        MQMDimension.STYLE,
        MQMDimension.LOCALE_CONVENTIONS,
        MQMDimension.DESIGN_AND_MARKUP
      ],
      severity_multipliers: {
        [MQMDimension.ACCURACY]: 1.5,
        [MQMDimension.TERMINOLOGY]: 1.4,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.2,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.1,
        [MQMDimension.STYLE]: 1.0,
        [MQMDimension.LOCALE_CONVENTIONS]: 1.0,
        [MQMDimension.DESIGN_AND_MARKUP]: 1.0
      },
      category_mappings: {
        'dosage_instructions': {
          standard_category: MQMAccuracyCategory.MISTRANSLATION,
          domain_specific_label: 'Dosage/Administration Error',
          description: 'Errors in medical dosage or administration instructions',
          severity_adjustment: 2.0,
          detection_patterns: ['dosage', 'mg', 'ml', 'daily', 'twice', 'morning', 'evening'],
          examples: [{
            error_text: 'Translated "twice daily" as "two times" without frequency context',
            source_context: 'Prescription medication instructions',
            target_context: 'Patient medication guide',
            correct_categorization: 'ACCURACY/MISTRANSLATION with critical severity',
            incorrect_categorizations: ['STYLE/UNNATURAL', 'LINGUISTIC_CONVENTIONS/GRAMMAR'],
            explanation: 'Medical dosage must be unambiguous for patient safety',
            severity_rationale: 'Ambiguous dosage instructions can cause harm'
          }],
          common_mistakes: ['Focusing on style over safety', 'Insufficient medical precision']
        },
        'medical_terminology': {
          standard_category: MQMTerminologyCategory.WRONG_TERM,
          domain_specific_label: 'Medical Term Precision Error',
          description: 'Incorrect use of medical terminology',
          severity_adjustment: 1.6,
          detection_patterns: ['diagnosis', 'symptom', 'treatment', 'condition', 'procedure'],
          examples: [{
            error_text: 'Used colloquial term instead of precise medical terminology',
            source_context: 'Medical consultation notes',
            target_context: 'Translated medical records',
            correct_categorization: 'TERMINOLOGY/WRONG_TERM with major severity',
            incorrect_categorizations: ['STYLE/REGISTER'],
            explanation: 'Medical terms must be professionally precise',
            severity_rationale: 'Imprecise terminology affects medical communication'
          }],
          common_mistakes: ['Using lay terms instead of medical terms']
        }
      },
      content_type_modifiers: {
        'prescription_label': {
          content_type: 'prescription_label',
          affected_dimensions: [MQMDimension.ACCURACY, MQMDimension.TERMINOLOGY],
          severity_impact: 'increase',
          impact_factor: 2.0,
          special_rules: [
            'All dosage information must be crystal clear',
            'Medical terminology must be precise',
            'No ambiguity allowed in instructions'
          ]
        },
        'patient_education': {
          content_type: 'patient_education',
          affected_dimensions: [MQMDimension.AUDIENCE_APPROPRIATENESS, MQMDimension.STYLE],
          severity_impact: 'increase',
          impact_factor: 1.2,
          special_rules: [
            'Must be accessible to lay audience',
            'Maintain medical accuracy while being understandable'
          ]
        }
      },
      glossary_requirements: [{
        term_type: 'medical_conditions',
        required_consistency: 0.95,
        penalty_severity: MQMSeverity.MAJOR,
        validation_patterns: ['diabetes', 'hypertension', 'infection', 'treatment']
      }],
      cultural_adaptation_rules: [{
        id: 'body_parts',
        source_pattern: /anatomy|body parts/i,
        target_expectation: 'Use medically appropriate terms respecting cultural sensitivities',
        severity_adjustment: 1.1,
        justification: 'Balance medical precision with cultural appropriateness'
      }]
    });

    // Legal domain configuration
    this.domainConfigs.set(ErrorDomain.LEGAL, {
      domain: ErrorDomain.LEGAL,
      priority_ranking: [
        MQMDimension.ACCURACY,
        MQMDimension.TERMINOLOGY,
        MQMDimension.STYLE,
        MQMDimension.LINGUISTIC_CONVENTIONS,
        MQMDimension.AUDIENCE_APPROPRIATENESS,
        MQMDimension.LOCALE_CONVENTIONS,
        MQMDimension.DESIGN_AND_MARKUP
      ],
      severity_multipliers: {
        [MQMDimension.ACCURACY]: 1.6,
        [MQMDimension.TERMINOLOGY]: 1.5,
        [MQMDimension.STYLE]: 1.2,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.2,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.1,
        [MQMDimension.LOCALE_CONVENTIONS]: 1.0,
        [MQMDimension.DESIGN_AND_MARKUP]: 1.0
      },
      category_mappings: {
        'legal_obligations': {
          standard_category: MQMAccuracyCategory.MISTRANSLATION,
          domain_specific_label: 'Legal Obligation Translation Error',
          description: 'Errors that change legal rights, obligations, or meanings',
          severity_adjustment: 2.0,
          detection_patterns: ['shall', 'must', 'may', 'obligation', 'right', 'liable'],
          examples: [{
            error_text: 'Translated "may" (permission) as "must" (obligation)',
            source_context: 'Contract clause about optional provisions',
            target_context: 'Translated legal agreement',
            correct_categorization: 'ACCURACY/MISTRANSLATION with critical severity',
            incorrect_categorizations: ['STYLE/REGISTER', 'LINGUISTIC_CONVENTIONS/GRAMMAR'],
            explanation: 'Legal modality changes create different legal obligations',
            severity_rationale: 'Changes legal meaning and enforceability'
          }],
          common_mistakes: ['Treating legal modals as style choice']
        }
      },
      content_type_modifiers: {
        'contract': {
          content_type: 'contract',
          affected_dimensions: [MQMDimension.ACCURACY, MQMDimension.TERMINOLOGY, MQMDimension.STYLE],
          severity_impact: 'increase',
          impact_factor: 1.8,
          special_rules: [
            'Legal terminology must be jurisdictionally appropriate',
            'Maintain formal legal register',
            'No ambiguity in obligations or rights'
          ]
        }
      },
      glossary_requirements: [{
        term_type: 'legal_concepts',
        required_consistency: 0.98,
        penalty_severity: MQMSeverity.CRITICAL,
        validation_patterns: ['contract', 'agreement', 'liability', 'indemnity']
      }],
      cultural_adaptation_rules: [{
        id: 'legal_concepts',
        source_pattern: /legal concepts/i,
        target_expectation: 'Adapt to target legal system while preserving source intent',
        severity_adjustment: 1.3,
        justification: 'Legal concepts may not have direct equivalents'
      }]
    });

    // Marketing domain configuration
    this.domainConfigs.set(ErrorDomain.MARKETING, {
      domain: ErrorDomain.MARKETING,
      priority_ranking: [
        MQMDimension.STYLE,
        MQMDimension.AUDIENCE_APPROPRIATENESS,
        MQMDimension.ACCURACY,
        MQMDimension.LINGUISTIC_CONVENTIONS,
        MQMDimension.TERMINOLOGY,
        MQMDimension.LOCALE_CONVENTIONS,
        MQMDimension.DESIGN_AND_MARKUP
      ],
      severity_multipliers: {
        [MQMDimension.STYLE]: 1.3,
        [MQMDimension.AUDIENCE_APPROPRIATENESS]: 1.3,
        [MQMDimension.ACCURACY]: 1.1,
        [MQMDimension.LINGUISTIC_CONVENTIONS]: 1.0,
        [MQMDimension.TERMINOLOGY]: 1.0,
        [MQMDimension.LOCALE_CONVENTIONS]: 1.2,
        [MQMDimension.DESIGN_AND_MARKUP]: 1.1
      },
      category_mappings: {
        'brand_voice': {
          standard_category: MQMStyleCategory.REGISTER,
          domain_specific_label: 'Brand Voice Inconsistency',
          description: 'Style that doesn\'t match brand personality or voice',
          severity_adjustment: 1.2,
          detection_patterns: ['brand', 'voice', 'tone', 'personality', 'casual', 'formal'],
          examples: [{
            error_text: 'Used formal tone for a casual, youth-oriented brand',
            source_context: 'Social media marketing copy',
            target_context: 'Localized social media content',
            correct_categorization: 'STYLE/REGISTER with major severity',
            incorrect_categorizations: ['LINGUISTIC_CONVENTIONS/GRAMMAR'],
            explanation: 'Brand voice must be consistent with target market expectations',
            severity_rationale: 'Wrong brand voice affects marketing effectiveness'
          }],
          common_mistakes: ['Ignoring brand guidelines', 'Over-formalizing casual brands']
        }
      },
      content_type_modifiers: {
        'advertising_copy': {
          content_type: 'advertising_copy',
          affected_dimensions: [MQMDimension.STYLE, MQMDimension.AUDIENCE_APPROPRIATENESS],
          severity_impact: 'increase',
          impact_factor: 1.2,
          special_rules: [
            'Must resonate with target demographic',
            'Cultural adaptation over literal translation',
            'Maintain persuasive impact'
          ]
        }
      },
      glossary_requirements: [{
        term_type: 'brand_terms',
        required_consistency: 0.9,
        penalty_severity: MQMSeverity.MAJOR,
        validation_patterns: ['product names', 'taglines', 'key messaging']
      }],
      cultural_adaptation_rules: [{
        id: 'cultural_references',
        source_pattern: /cultural references|humor|idioms/i,
        target_expectation: 'Adapt for cultural relevance and impact',
        severity_adjustment: 0.8, // Lower severity for creative adaptation
        justification: 'Marketing benefits from cultural adaptation over literal translation'
      }]
    });
  }

  private applyDomainMapping(
    baseDecision: CategoryDecision, 
    config: DomainCategorizationConfig
  ): CategoryDecision {
    // Find domain-specific mapping
    const mapping = Object.values(config.category_mappings).find(m => 
      m.standard_category === baseDecision.primary_category.category
    );

    if (mapping) {
      return {
        ...baseDecision,
        confidence: baseDecision.confidence * mapping.severity_adjustment,
        reasoning: [
          ...baseDecision.reasoning,
          `Domain-specific mapping: ${mapping.domain_specific_label}`
        ],
        flags: [...baseDecision.flags, 'domain_specific']
      };
    }

    return baseDecision;
  }

  private applyContentTypeModifiers(
    decision: CategoryDecision,
    context: ErrorContext,
    config: DomainCategorizationConfig
  ): CategoryDecision {
    const modifier = config.content_type_modifiers[context.content_type];
    if (!modifier) return decision;

    const affectedDimension = modifier.affected_dimensions.includes(
      decision.primary_category.dimension
    );

    if (affectedDimension) {
      let confidenceAdjustment = 1.0;
      
      if (modifier.severity_impact === 'increase') {
        confidenceAdjustment = modifier.impact_factor;
      } else if (modifier.severity_impact === 'decrease') {
        confidenceAdjustment = 1 / modifier.impact_factor;
      }

      return {
        ...decision,
        confidence: Math.min(1.0, decision.confidence * confidenceAdjustment),
        reasoning: [
          ...decision.reasoning,
          `Content type modifier applied: ${context.content_type}`
        ]
      };
    }

    return decision;
  }

  private applyCulturalAdaptation(
    decision: CategoryDecision,
    context: ErrorContext,
    config: DomainCategorizationConfig
  ): CategoryDecision {
    for (const rule of config.cultural_adaptation_rules) {
      let matches = false;
      
      if (typeof rule.source_pattern === 'string') {
        matches = context.error_text.toLowerCase().includes(rule.source_pattern.toLowerCase());
      } else {
        matches = rule.source_pattern.test(context.error_text);
      }

      if (matches) {
        return {
          ...decision,
          confidence: decision.confidence * rule.severity_adjustment,
          reasoning: [
            ...decision.reasoning,
            `Cultural adaptation: ${rule.justification}`
          ],
          flags: [...decision.flags, 'cultural_context_dependent']
        };
      }
    }

    return decision;
  }

  private checkGlossaryRequirements(
    context: ErrorContext,
    config: DomainCategorizationConfig
  ): string[] {
    const violations: string[] = [];

    config.glossary_requirements.forEach(requirement => {
      const hasRequiredTerms = requirement.validation_patterns.some(pattern =>
        context.error_text.toLowerCase().includes(pattern.toLowerCase())
      );

      if (hasRequiredTerms && requirement.required_consistency > 0.9) {
        // This would need integration with actual glossary validation
        // For now, just flag potential issues
        violations.push(`High consistency required for ${requirement.term_type} terms`);
      }
    });

    return violations;
  }

  private getDimensionForCategory(category: MQMErrorCategory): MQMDimension {
    // This is a simplified mapping - in production would use proper category->dimension mapping
    if (Object.values(MQMTerminologyCategory).includes(category as any)) {
      return MQMDimension.TERMINOLOGY;
    }
    if (Object.values(MQMAccuracyCategory).includes(category as any)) {
      return MQMDimension.ACCURACY;
    }
    if (Object.values(MQLinguisticConventionsCategory).includes(category as any)) {
      return MQMDimension.LINGUISTIC_CONVENTIONS;
    }
    if (Object.values(MQMStyleCategory).includes(category as any)) {
      return MQMDimension.STYLE;
    }
    if (Object.values(MQMLocaleConventionsCategory).includes(category as any)) {
      return MQMDimension.LOCALE_CONVENTIONS;
    }
    if (Object.values(MQMAudienceAppropriatenessCategory).includes(category as any)) {
      return MQMDimension.AUDIENCE_APPROPRIATENESS;
    }
    if (Object.values(MQMDesignAndMarkupCategory).includes(category as any)) {
      return MQMDimension.DESIGN_AND_MARKUP;
    }
    return MQMDimension.LINGUISTIC_CONVENTIONS; // Default fallback
  }
} 