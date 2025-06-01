/**
 * MQM Categorization Rules Framework
 * Provides comprehensive rules for consistent error categorization across domains
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
import { ErrorDomain, HierarchicalErrorPath } from '../types/mqm-taxonomy-expansion';
import { DomainCategorizationProtocols } from './domain-categorization-protocols';

/**
 * Decision node for categorization flowcharts
 */
export interface DecisionNode {
  id: string;
  type: 'condition' | 'category' | 'multi_category';
  question: string;
  condition?: (context: ErrorContext) => boolean;
  result?: CategoryDecision;
  children?: DecisionNode[];
  confidence_modifier?: number;
}

/**
 * Context for error categorization decisions
 */
export interface ErrorContext {
  error_text: string;
  source_text: string;
  target_text: string;
  domain: ErrorDomain;
  content_type: string;
  user_feedback?: string;
  previous_annotations?: MQMErrorCategory[];
  linguistic_features?: {
    pos_tags: string[];
    entities: Array<{ text: string; type: string }>;
    complexity_score: number;
  };
}

/**
 * Category decision result
 */
export interface CategoryDecision {
  primary_category: {
    dimension: MQMDimension;
    category: MQMErrorCategory;
    subcategory?: string;
  };
  alternative_categories?: Array<{
    dimension: MQMDimension;
    category: MQMErrorCategory;
    subcategory?: string;
    confidence: number;
    reasoning: string;
  }>;
  confidence: number;
  reasoning: string[];
  flags: CategoryFlag[];
}

/**
 * Flags for special categorization cases
 */
export type CategoryFlag = 
  | 'ambiguous'
  | 'multi_category'
  | 'domain_specific'
  | 'edge_case'
  | 'requires_human_review'
  | 'cultural_context_dependent';

/**
 * Multi-category error configuration
 */
export interface MultiCategoryError {
  primary_category: { dimension: MQMDimension; category: MQMErrorCategory };
  secondary_categories: Array<{ 
    dimension: MQMDimension; 
    category: MQMErrorCategory;
    weight: number;
    relationship: 'compound' | 'cascade' | 'overlapping';
  }>;
  resolution_strategy: 'split' | 'merge' | 'prioritize' | 'context_dependent';
  examples: string[];
}

/**
 * Domain-specific categorization protocol
 */
export interface DomainProtocol {
  domain: ErrorDomain;
  priority_dimensions: MQMDimension[];
  specialized_categories: Record<string, {
    standard_category: MQMErrorCategory;
    domain_adaptation: string;
    severity_modifier: number;
    examples: string[];
  }>;
  edge_case_handlers: EdgeCaseHandler[];
}

/**
 * Edge case handler configuration
 */
export interface EdgeCaseHandler {
  id: string;
  pattern: string | RegExp;
  description: string;
  resolution: CategoryDecision;
  training_examples: Array<{
    error_text: string;
    context: string;
    correct_categorization: string;
    common_mistakes: string[];
    explanation: string;
  }>;
}

/**
 * Main categorization rules engine
 */
export class MQMCategorizationRulesEngine {
  private decisionTrees: Map<string, DecisionNode> = new Map();
  private multiCategoryRules: Map<string, MultiCategoryError> = new Map();
  private domainProtocols: Map<ErrorDomain, DomainProtocol> = new Map();
  private edgeCaseHandlers: Map<string, EdgeCaseHandler> = new Map();
  private domainCategorizationProtocols: DomainCategorizationProtocols;

  constructor() {
    this.domainCategorizationProtocols = new DomainCategorizationProtocols();
    this.initializeDecisionTrees();
    this.initializeMultiCategoryRules();
    this.initializeDomainProtocols();
    this.initializeEdgeCaseHandlers();
  }

  /**
   * Main categorization method
   */
  public categorizeError(context: ErrorContext): CategoryDecision {
    // Step 1: Check for edge cases
    const edgeCase = this.checkEdgeCases(context);
    if (edgeCase) {
      return {
        ...edgeCase,
        flags: [...edgeCase.flags, 'edge_case']
      };
    }

    // Step 2: Apply domain-specific protocols
    const domainDecision = this.applyDomainProtocol(context);
    if (domainDecision) {
      return domainDecision;
    }

    // Step 3: Use decision trees for standard categorization
    const treeDecision = this.traverseDecisionTree('main', context);
    
    // Step 4: Check for multi-category scenarios
    const multiCategoryCheck = this.checkMultiCategory(treeDecision, context);
    
    return multiCategoryCheck || treeDecision;
  }

  /**
   * Validate categorization consistency
   */
  public validateCategorization(
    decision: CategoryDecision,
    context: ErrorContext
  ): {
    is_valid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let is_valid = true;

    // Check domain compatibility
    const domainProtocol = this.domainProtocols.get(context.domain);
    if (domainProtocol) {
      const isPriorityDimension = domainProtocol.priority_dimensions.includes(
        decision.primary_category.dimension
      );
      
      if (!isPriorityDimension && decision.confidence > 0.8) {
        warnings.push(`Category not in priority dimensions for ${context.domain} domain`);
        suggestions.push('Consider domain-specific alternative categories');
      }
    }

    // Check for common misclassifications
    if (this.isCommonMisclassification(decision, context)) {
      warnings.push('This categorization pattern has been frequently corrected');
      suggestions.push('Review similar examples in training data');
      is_valid = false;
    }

    // Check confidence thresholds
    if (decision.confidence < 0.6 && !decision.flags.includes('ambiguous')) {
      warnings.push('Low confidence categorization without ambiguous flag');
      suggestions.push('Consider marking as ambiguous or requiring human review');
    }

    return { is_valid, warnings, suggestions };
  }

  /**
   * Get training examples for a category
   */
  public getTrainingExamples(
    dimension: MQMDimension,
    category: MQMErrorCategory,
    domain?: ErrorDomain
  ): Array<{
    error_text: string;
    context: string;
    categorization: CategoryDecision;
    explanation: string;
    common_mistakes: string[];
  }> {
    const examples: Array<{
      error_text: string;
      context: string;
      categorization: CategoryDecision;
      explanation: string;
      common_mistakes: string[];
    }> = [];

    // Get examples from edge case handlers
    this.edgeCaseHandlers.forEach(handler => {
      if (handler.resolution.primary_category.dimension === dimension &&
          handler.resolution.primary_category.category === category) {
        examples.push(...handler.training_examples.map(example => ({
          error_text: example.error_text,
          context: example.context,
          categorization: handler.resolution,
          explanation: example.explanation,
          common_mistakes: example.common_mistakes
        })));
      }
    });

    // Get domain-specific examples
    if (domain) {
      const domainProtocol = this.domainProtocols.get(domain);
      if (domainProtocol) {
        Object.values(domainProtocol.specialized_categories).forEach(spec => {
          if (spec.standard_category === category) {
            examples.push(...spec.examples.map(example => ({
              error_text: example,
              context: `${domain} domain context`,
              categorization: {
                primary_category: { dimension, category },
                confidence: 0.9,
                reasoning: [`Domain-specific adaptation for ${domain}`],
                flags: ['domain_specific' as CategoryFlag]
              },
              explanation: spec.domain_adaptation,
              common_mistakes: ['Using generic categorization instead of domain-specific']
            })));
          }
        });
      }
    }

    return examples;
  }

  // Private initialization methods
  private initializeDecisionTrees(): void {
    // Main decision tree for standard categorization
    const mainTree: DecisionNode = {
      id: 'root',
      type: 'condition',
      question: 'What type of error is this?',
      children: [
        {
          id: 'accuracy_check',
          type: 'condition',
          question: 'Does the error affect meaning or content accuracy?',
          condition: (context) => this.checkMeaningImpact(context),
          children: [
            {
              id: 'mistranslation_check',
              type: 'condition', 
              question: 'Is content incorrectly translated?',
              condition: (context) => this.checkMistranslation(context),
              result: {
                primary_category: {
                  dimension: MQMDimension.ACCURACY,
                  category: MQMAccuracyCategory.MISTRANSLATION
                },
                confidence: 0.85,
                reasoning: ['Content meaning is altered incorrectly'],
                flags: []
              }
            },
            {
              id: 'omission_check',
              type: 'condition',
              question: 'Is content missing?',
              condition: (context) => this.checkOmission(context),
              result: {
                primary_category: {
                  dimension: MQMDimension.ACCURACY,
                  category: MQMAccuracyCategory.OMISSION
                },
                confidence: 0.9,
                reasoning: ['Essential content is missing'],
                flags: []
              }
            }
          ]
        },
        {
          id: 'terminology_check',
          type: 'condition',
          question: 'Does the error involve domain-specific terminology?',
          condition: (context) => this.checkTerminology(context),
          children: [
            {
              id: 'wrong_term_check',
              type: 'condition',
              question: 'Is a specific term used incorrectly?',
              condition: (context) => this.checkWrongTerm(context),
              result: {
                primary_category: {
                  dimension: MQMDimension.TERMINOLOGY,
                  category: MQMTerminologyCategory.WRONG_TERM
                },
                confidence: 0.8,
                reasoning: ['Incorrect terminology usage detected'],
                flags: []
              }
            }
          ]
        },
        {
          id: 'linguistic_check',
          type: 'condition',
          question: 'Does the error involve grammar, spelling, or punctuation?',
          condition: (context) => this.checkLinguistic(context),
          result: {
            primary_category: {
              dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
              category: MQLinguisticConventionsCategory.GRAMMAR
            },
            confidence: 0.75,
            reasoning: ['Linguistic convention violation'],
            flags: []
          }
        }
      ]
    };

    this.decisionTrees.set('main', mainTree);
  }

  private initializeMultiCategoryRules(): void {
    // Grammar error that also affects style
    this.multiCategoryRules.set('grammar_style', {
      primary_category: {
        dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
        category: MQLinguisticConventionsCategory.GRAMMAR
      },
      secondary_categories: [{
        dimension: MQMDimension.STYLE,
        category: MQMStyleCategory.AWKWARD,
        weight: 0.6,
        relationship: 'compound'
      }],
      resolution_strategy: 'prioritize',
      examples: [
        'Grammatically incorrect sentence that also sounds awkward',
        'Wrong verb form that affects natural flow'
      ]
    });

    // Terminology error in accuracy context
    this.multiCategoryRules.set('terminology_accuracy', {
      primary_category: {
        dimension: MQMDimension.ACCURACY,
        category: MQMAccuracyCategory.MISTRANSLATION
      },
      secondary_categories: [{
        dimension: MQMDimension.TERMINOLOGY,
        category: MQMTerminologyCategory.WRONG_TERM,
        weight: 0.8,
        relationship: 'overlapping'
      }],
      resolution_strategy: 'context_dependent',
      examples: [
        'Technical term translated incorrectly changing meaning',
        'Medical terminology error affecting safety'
      ]
    });
  }

  private initializeDomainProtocols(): void {
    // Technical domain protocol
    this.domainProtocols.set(ErrorDomain.TECHNICAL, {
      domain: ErrorDomain.TECHNICAL,
      priority_dimensions: [
        MQMDimension.TERMINOLOGY,
        MQMDimension.ACCURACY,
        MQMDimension.LINGUISTIC_CONVENTIONS
      ],
      specialized_categories: {
        'api_terminology': {
          standard_category: MQMTerminologyCategory.WRONG_TERM,
          domain_adaptation: 'API and programming terminology requires exact precision',
          severity_modifier: 1.2,
          examples: ['method vs function', 'parameter vs argument', 'library vs framework']
        }
      },
      edge_case_handlers: []
    });

    // Medical domain protocol
    this.domainProtocols.set(ErrorDomain.MEDICAL, {
      domain: ErrorDomain.MEDICAL,
      priority_dimensions: [
        MQMDimension.ACCURACY,
        MQMDimension.TERMINOLOGY,
        MQMDimension.AUDIENCE_APPROPRIATENESS
      ],
      specialized_categories: {
        'medical_safety': {
          standard_category: MQMAccuracyCategory.MISTRANSLATION,
          domain_adaptation: 'Medical errors can have safety implications',
          severity_modifier: 1.5,
          examples: ['dosage instructions', 'contraindications', 'symptoms']
        }
      },
      edge_case_handlers: []
    });
  }

  private initializeEdgeCaseHandlers(): void {
    // Cultural references that don't translate
    this.edgeCaseHandlers.set('cultural_reference', {
      id: 'cultural_reference',
      pattern: /cultural|idiom|colloquial|slang/i,
      description: 'Cultural references requiring adaptation',
      resolution: {
        primary_category: {
          dimension: MQMDimension.STYLE,
          category: MQMStyleCategory.UNNATURAL
        },
        confidence: 0.7,
        reasoning: ['Cultural context requires adaptation'],
        flags: ['cultural_context_dependent', 'ambiguous']
      },
      training_examples: [{
        error_text: 'Direct translation of idiom makes no sense',
        context: 'Marketing content with cultural idioms',
        correct_categorization: 'Style/Unnatural with cultural flag',
        common_mistakes: ['Categorizing as pure accuracy error'],
        explanation: 'Cultural references need adaptation, not literal translation'
      }]
    });

    // Ambiguous pronoun reference
    this.edgeCaseHandlers.set('ambiguous_pronoun', {
      id: 'ambiguous_pronoun',
      pattern: /pronoun|reference|ambiguous.*it|unclear.*they/i,
      description: 'Ambiguous pronoun references',
      resolution: {
        primary_category: {
          dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
          category: MQLinguisticConventionsCategory.GRAMMAR
        },
        alternative_categories: [{
          dimension: MQMDimension.STYLE,
          category: MQMStyleCategory.AWKWARD,
          confidence: 0.6,
          reasoning: 'Could also be stylistic issue'
        }],
        confidence: 0.6,
        reasoning: ['Pronoun reference creates ambiguity'],
        flags: ['ambiguous', 'requires_human_review']
      },
      training_examples: [{
        error_text: 'Pronoun "it" could refer to multiple antecedents',
        context: 'Technical documentation with multiple referenced objects',
        correct_categorization: 'Grammar with ambiguous flag',
        common_mistakes: ['Treating as pure style issue'],
        explanation: 'Ambiguous pronouns are primarily grammar issues that affect clarity'
      }]
    });
  }

  // Helper methods for decision tree conditions
  private checkMeaningImpact(context: ErrorContext): boolean {
    return context.error_text.includes('meaning') || 
           context.error_text.includes('incorrect') ||
           context.error_text.includes('wrong');
  }

  private checkMistranslation(context: ErrorContext): boolean {
    return context.error_text.includes('mistranslat') ||
           context.error_text.includes('incorrectly translated');
  }

  private checkOmission(context: ErrorContext): boolean {
    return context.error_text.includes('missing') ||
           context.error_text.includes('omitted') ||
           context.error_text.includes('not translated');
  }

  private checkTerminology(context: ErrorContext): boolean {
    const terminologyIndicators = ['term', 'terminology', 'technical', 'domain-specific'];
    return terminologyIndicators.some(indicator => 
      context.error_text.toLowerCase().includes(indicator)
    );
  }

  private checkWrongTerm(context: ErrorContext): boolean {
    return context.error_text.includes('wrong term') ||
           context.error_text.includes('incorrect term');
  }

  private checkLinguistic(context: ErrorContext): boolean {
    const linguisticIndicators = ['grammar', 'spelling', 'punctuation', 'syntax'];
    return linguisticIndicators.some(indicator =>
      context.error_text.toLowerCase().includes(indicator)
    );
  }

  private traverseDecisionTree(treeId: string, context: ErrorContext): CategoryDecision {
    const tree = this.decisionTrees.get(treeId);
    if (!tree) {
      throw new Error(`Decision tree ${treeId} not found`);
    }

    return this.traverseNode(tree, context);
  }

  private traverseNode(node: DecisionNode, context: ErrorContext): CategoryDecision {
    if (node.type === 'category' && node.result) {
      return node.result;
    }

    if (node.type === 'condition' && node.children) {
      for (const child of node.children) {
        if (child.condition && child.condition(context)) {
          return this.traverseNode(child, context);
        }
      }
    }

    // Default fallback
    return {
      primary_category: {
        dimension: MQMDimension.LINGUISTIC_CONVENTIONS,
        category: MQLinguisticConventionsCategory.GRAMMAR
      },
      confidence: 0.5,
      reasoning: ['Default categorization - requires human review'],
      flags: ['requires_human_review']
    };
  }

  private checkEdgeCases(context: ErrorContext): CategoryDecision | null {
    for (const handler of this.edgeCaseHandlers.values()) {
      if (typeof handler.pattern === 'string') {
        if (context.error_text.toLowerCase().includes(handler.pattern.toLowerCase())) {
          return handler.resolution;
        }
      } else if (handler.pattern instanceof RegExp) {
        if (handler.pattern.test(context.error_text)) {
          return handler.resolution;
        }
      }
    }
    return null;
  }

  private applyDomainProtocol(context: ErrorContext): CategoryDecision | null {
    // Use the comprehensive domain categorization protocols
    // This integrates with the detailed domain-specific framework
    const baseDecision = this.traverseDecisionTree('main', context);
    const domainDecision = this.domainCategorizationProtocols.getDomainCategorization(context, baseDecision);
    
    // If domain categorization made significant changes, return it
    if (domainDecision !== baseDecision) {
      return domainDecision;
    }
    
    return null;
  }

  private checkMultiCategory(decision: CategoryDecision, context: ErrorContext): CategoryDecision | null {
    // Check if this matches any multi-category patterns
    for (const rule of this.multiCategoryRules.values()) {
      if (rule.primary_category.dimension === decision.primary_category.dimension &&
          rule.primary_category.category === decision.primary_category.category) {
        
        return {
          ...decision,
          alternative_categories: rule.secondary_categories.map(sec => ({
            dimension: sec.dimension,
            category: sec.category,
            confidence: sec.weight * decision.confidence,
            reasoning: `Multi-category error: ${sec.relationship} relationship`
          })),
          flags: [...decision.flags, 'multi_category']
        };
      }
    }
    return null;
  }

  private isCommonMisclassification(decision: CategoryDecision, context: ErrorContext): boolean {
    // This would check against historical correction data
    // Simplified implementation for now
    return false;
  }
}

/**
 * Categorization consistency validator
 */
export class CategorizationConsistencyValidator {
  private rulesEngine: MQMCategorizationRulesEngine;

  constructor(rulesEngine: MQMCategorizationRulesEngine) {
    this.rulesEngine = rulesEngine;
  }

  /**
   * Validate a batch of categorization decisions
   */
  public validateBatch(
    decisions: Array<{ context: ErrorContext; decision: CategoryDecision }>
  ): {
    overall_consistency: number;
    inconsistencies: Array<{
      context: ErrorContext;
      decision: CategoryDecision;
      issues: string[];
      recommendations: string[];
    }>;
    recommendations: string[];
  } {
    const inconsistencies: Array<{
      context: ErrorContext;
      decision: CategoryDecision;
      issues: string[];
      recommendations: string[];
    }> = [];

    let consistentDecisions = 0;

    decisions.forEach(({ context, decision }) => {
      const validation = this.rulesEngine.validateCategorization(decision, context);
      
      if (!validation.is_valid) {
        inconsistencies.push({
          context,
          decision,
          issues: validation.warnings,
          recommendations: validation.suggestions
        });
      } else {
        consistentDecisions++;
      }
    });

    const overall_consistency = decisions.length > 0 ? 
      consistentDecisions / decisions.length : 1;

    const recommendations = this.generateBatchRecommendations(inconsistencies);

    return {
      overall_consistency,
      inconsistencies,
      recommendations
    };
  }

  private generateBatchRecommendations(
    inconsistencies: Array<{
      context: ErrorContext;
      decision: CategoryDecision;
      issues: string[];
      recommendations: string[];
    }>
  ): string[] {
    const recommendations: string[] = [];

    if (inconsistencies.length > 0) {
      const totalDecisions = inconsistencies.length;
      
      if (inconsistencies.length > totalDecisions * 0.3) {
        recommendations.push('High inconsistency rate detected - review categorization guidelines');
      }
    }

    const commonIssues = this.identifyCommonIssues(inconsistencies);
    commonIssues.forEach(issue => {
      recommendations.push(`Common issue identified: ${issue} - consider additional training`);
    });

    return recommendations;
  }

  private identifyCommonIssues(inconsistencies: any[]): string[] {
    const issueCount: Record<string, number> = {};

    inconsistencies.forEach(inc => {
      inc.issues.forEach((issue: string) => {
        issueCount[issue] = (issueCount[issue] || 0) + 1;
      });
    });

    return Object.entries(issueCount)
      .filter(([, count]) => count >= 2)
      .map(([issue]) => issue);
  }
} 