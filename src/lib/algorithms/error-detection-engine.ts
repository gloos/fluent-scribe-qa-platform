/**
 * Enhanced Error Detection Engine
 * Implements advanced algorithms for automatic error identification and classification
 * Integrates with expanded MQM taxonomy for precise categorization
 */

import { 
  ErrorDomain,
  ExpandedErrorCategory,
  HierarchicalErrorPath,
  ExpandedMQMErrorInstance
} from '../types/mqm-taxonomy-expansion';

import { 
  MQMDimension,
  MQMErrorCategory,
  MQMSeverity,
  ErrorSeverity
} from '../types/assessment';

import { MQMTaxonomyExpansionEngine } from '../utils/mqm-taxonomy-expansion';
import { DetectedError, ErrorPattern, ErrorAnalysis } from '../../integrations/llm/utils/error-detector';

// Import NLP libraries with proper type annotations
// @ts-ignore - Natural has incomplete TypeScript definitions
import * as natural from 'natural';
// @ts-ignore - Stopword doesn't have TypeScript definitions 
import { removeStopwords } from 'stopword';
// @ts-ignore - Compromise doesn't have perfect TypeScript support
import nlp from 'compromise';

/**
 * Linguistic features extracted from text
 */
export interface LinguisticFeatures {
  tokens: string[];
  sentences: string[];
  posTagged: Array<{ word: string; tag: string }>;
  namedEntities: Array<{ text: string; type: string; confidence: number }>;
  semanticField?: string;
  registerLevel?: 'formal' | 'informal' | 'neutral';
  grammarComplexity: number;
  readabilityScore: number;
  keyTerms: string[];
}

/**
 * Error detection pattern with ML features
 */
export interface MLErrorPattern {
  pattern_id: string;
  pattern_type: 'semantic' | 'syntactic' | 'pragmatic' | 'lexical' | 'morphological';
  linguistic_features: string[];
  error_indicators: string[];
  confidence_threshold: number;
  domain_specific: boolean;
  applicable_domains: ErrorDomain[];
  mqm_mapping: HierarchicalErrorPath;
}

/**
 * Context information for error detection
 */
export interface ErrorDetectionContext {
  domain: ErrorDomain;
  source_language?: string;
  target_language?: string;
  text_type?: 'technical' | 'marketing' | 'literary' | 'legal' | 'medical' | 'general';
  quality_threshold?: number;
  enable_semantic_analysis?: boolean;
  enable_contextual_analysis?: boolean;
}

/**
 * Validation result against human annotations
 */
export interface ValidationResult {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  category_accuracy: Record<string, number>;
  severity_accuracy: Record<ErrorSeverity, number>;
  false_positives: DetectedError[];
  false_negatives: DetectedError[];
  confidence_distribution: Record<string, number>;
}

// Helper function to convert MQM severity to error severity
function convertMQMSeverityToErrorSeverity(mqmSeverity: MQMSeverity): ErrorSeverity {
  switch (mqmSeverity) {
    case MQMSeverity.MINOR:
      return ErrorSeverity.MINOR;
    case MQMSeverity.MAJOR:
      return ErrorSeverity.MAJOR;
    case MQMSeverity.CRITICAL:
      return ErrorSeverity.CRITICAL;
    default:
      return ErrorSeverity.MINOR;
  }
}

/**
 * Enhanced Error Detection Engine
 */
export class ErrorDetectionEngine {
  private taxonomyEngine: MQMTaxonomyExpansionEngine;
  private stemmer: typeof natural.PorterStemmer;
  private tokenizer: natural.WordTokenizer;
  private mlPatterns: Map<string, MLErrorPattern>;
  private domainTerminologies: Map<ErrorDomain, Set<string>>;
  private semanticEmbeddings: Map<string, number[]>;

  constructor() {
    this.taxonomyEngine = new MQMTaxonomyExpansionEngine();
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.mlPatterns = new Map();
    this.domainTerminologies = new Map();
    this.semanticEmbeddings = new Map();
    
    this.initializeMLPatterns();
    this.initializeDomainTerminologies();
  }

  /**
   * Main error detection method
   */
  public async detectErrors(
    sourceText: string,
    targetText: string,
    context: ErrorDetectionContext
  ): Promise<DetectedError[]> {
    const errors: DetectedError[] = [];

    // Extract linguistic features
    const sourceLinguistics = this.extractLinguisticFeatures(sourceText, context.source_language);
    const targetLinguistics = this.extractLinguisticFeatures(targetText, context.target_language);

    // Pattern-based detection
    const patternErrors = await this.detectPatternBasedErrors(
      sourceText, 
      targetText, 
      sourceLinguistics, 
      targetLinguistics, 
      context
    );
    errors.push(...patternErrors);

    // Semantic analysis (if enabled)
    if (context.enable_semantic_analysis) {
      const semanticErrors = await this.detectSemanticErrors(
        sourceText, 
        targetText, 
        sourceLinguistics, 
        targetLinguistics, 
        context
      );
      errors.push(...semanticErrors);
    }

    // Contextual analysis (if enabled)
    if (context.enable_contextual_analysis) {
      const contextualErrors = await this.detectContextualErrors(
        sourceText, 
        targetText, 
        sourceLinguistics, 
        targetLinguistics, 
        context
      );
      errors.push(...contextualErrors);
    }

    // Domain-specific detection
    const domainErrors = await this.detectDomainSpecificErrors(
      sourceText, 
      targetText, 
      context
    );
    errors.push(...domainErrors);

    // Classify errors using expanded taxonomy
    const classifiedErrors = this.classifyErrorsWithTaxonomy(errors, context);

    // Apply confidence scoring and filtering
    return this.filterAndScoreErrors(classifiedErrors, context);
  }

  /**
   * Extract comprehensive linguistic features from text
   */
  private extractLinguisticFeatures(text: string, language?: string): LinguisticFeatures {
    // Tokenization
    const tokens = this.tokenizer.tokenize(text) || [];
    
    // Sentence segmentation
    const sentences = natural.SentenceTokenizer.tokenize(text);
    
    // POS tagging (using Compromise for more accurate results)
    const doc = nlp(text);
    const termsArray = doc.terms().out('array') as string[];
    const posTagged = termsArray.map((term: string) => ({
      word: term || '',
      tag: 'UNKNOWN' // Simplified for now - would use more sophisticated tagging
    }));

    // Named entity extraction
    const namedEntities = this.extractNamedEntities(text);
    
    // Calculate complexity metrics
    const grammarComplexity = this.calculateGrammarComplexity(text, posTagged);
    const readabilityScore = this.calculateReadabilityScore(text, sentences);
    
    // Extract key terms (content words without stop words)
    const contentWords = removeStopwords(tokens.map(t => t.toLowerCase())) as string[];
    const keyTerms = [...new Set(contentWords)].slice(0, 20); // Top 20 unique terms

    return {
      tokens,
      sentences,
      posTagged,
      namedEntities,
      grammarComplexity,
      readabilityScore,
      keyTerms,
      registerLevel: this.detectRegisterLevel(text),
      semanticField: this.detectSemanticField(keyTerms)
    };
  }

  /**
   * Detect pattern-based errors using predefined ML patterns
   */
  private async detectPatternBasedErrors(
    sourceText: string,
    targetText: string,
    sourceLinguistics: LinguisticFeatures,
    targetLinguistics: LinguisticFeatures,
    context: ErrorDetectionContext
  ): Promise<DetectedError[]> {
    const errors: DetectedError[] = [];

    for (const [patternId, pattern] of this.mlPatterns) {
      // Skip if pattern not applicable to domain
      if (pattern.domain_specific && !pattern.applicable_domains.includes(context.domain)) {
        continue;
      }

      const confidence = this.evaluatePatternMatch(
        pattern,
        sourceText,
        targetText,
        sourceLinguistics,
        targetLinguistics
      );

      if (confidence >= pattern.confidence_threshold) {
        const error = this.createDetectedError(
          pattern,
          sourceText,
          targetText,
          confidence,
          context
        );
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Detect semantic errors using NLP analysis
   */
  private async detectSemanticErrors(
    sourceText: string,
    targetText: string,
    sourceLinguistics: LinguisticFeatures,
    targetLinguistics: LinguisticFeatures,
    context: ErrorDetectionContext
  ): Promise<DetectedError[]> {
    const errors: DetectedError[] = [];

    // Semantic similarity analysis
    const semanticSimilarity = this.calculateSemanticSimilarity(
      sourceLinguistics.keyTerms,
      targetLinguistics.keyTerms
    );

    if (semanticSimilarity < 0.6) { // Threshold for semantic inconsistency
      errors.push({
        id: `semantic_${Date.now()}`,
        type: 'semantic_inconsistency',
        category: 'transfer',
        severity: ErrorSeverity.MAJOR,
        description: 'Significant semantic divergence between source and target',
        confidence: (1 - semanticSimilarity) * 100,
        affectedText: targetText.substring(0, 100) + '...',
        metadata: {
          semantic_similarity: semanticSimilarity,
          analysis_type: 'semantic'
        }
      });
    }

    // Named entity consistency
    const entityErrors = this.detectEntityInconsistencies(
      sourceLinguistics.namedEntities,
      targetLinguistics.namedEntities
    );
    errors.push(...entityErrors);

    // Terminology consistency
    const terminologyErrors = this.detectTerminologyInconsistencies(
      sourceLinguistics.keyTerms,
      targetLinguistics.keyTerms,
      context.domain
    );
    errors.push(...terminologyErrors);

    return errors;
  }

  /**
   * Detect contextual errors using discourse analysis
   */
  private async detectContextualErrors(
    sourceText: string,
    targetText: string,
    sourceLinguistics: LinguisticFeatures,
    targetLinguistics: LinguisticFeatures,
    context: ErrorDetectionContext
  ): Promise<DetectedError[]> {
    const errors: DetectedError[] = [];

    // Register consistency
    if (sourceLinguistics.registerLevel !== targetLinguistics.registerLevel) {
      errors.push({
        id: `register_${Date.now()}`,
        type: 'register_inconsistency',
        category: 'style',
        severity: ErrorSeverity.MINOR,
        description: `Register mismatch: source is ${sourceLinguistics.registerLevel}, target is ${targetLinguistics.registerLevel}`,
        confidence: 85,
        affectedText: targetText,
        metadata: {
          source_register: sourceLinguistics.registerLevel,
          target_register: targetLinguistics.registerLevel,
          analysis_type: 'contextual'
        }
      });
    }

    // Complexity mismatch
    const complexityDiff = Math.abs(
      sourceLinguistics.grammarComplexity - targetLinguistics.grammarComplexity
    );
    
    if (complexityDiff > 2.0) { // Threshold for significant complexity difference
      errors.push({
        id: `complexity_${Date.now()}`,
        type: 'complexity_mismatch',
        category: 'style',
        severity: ErrorSeverity.MINOR,
        description: 'Significant difference in grammatical complexity between source and target',
        confidence: Math.min(95, complexityDiff * 20),
        affectedText: targetText,
        metadata: {
          source_complexity: sourceLinguistics.grammarComplexity,
          target_complexity: targetLinguistics.grammarComplexity,
          analysis_type: 'contextual'
        }
      });
    }

    return errors;
  }

  /**
   * Detect domain-specific errors
   */
  private async detectDomainSpecificErrors(
    sourceText: string,
    targetText: string,
    context: ErrorDetectionContext
  ): Promise<DetectedError[]> {
    const errors: DetectedError[] = [];
    const domainTerms = this.domainTerminologies.get(context.domain);
    
    if (!domainTerms) return errors;

    // Check for missing domain-specific terminology
    const sourceTokens = this.tokenizer.tokenize(sourceText.toLowerCase()) || [];
    const targetTokens = this.tokenizer.tokenize(targetText.toLowerCase()) || [];
    
    const sourceDomainTerms = sourceTokens.filter(token => domainTerms.has(token));
    const targetDomainTerms = targetTokens.filter(token => domainTerms.has(token));
    
    // Check for missing important domain terms
    const missingTerms = sourceDomainTerms.filter(term => !targetDomainTerms.includes(term));
    
    if (missingTerms.length > 0) {
      errors.push({
        id: `domain_terminology_${Date.now()}`,
        type: 'domain_terminology_omission',
        category: 'linguistic', // Changed from 'terminology' to match DetectedError interface
        severity: ErrorSeverity.MAJOR,
        description: `Missing domain-specific terminology: ${missingTerms.join(', ')}`,
        confidence: 90,
        affectedText: targetText,
        metadata: {
          missing_terms: missingTerms,
          domain: context.domain,
          analysis_type: 'domain_specific'
        }
      });
    }

    return errors;
  }

  /**
   * Classify errors using expanded MQM taxonomy
   */
  private classifyErrorsWithTaxonomy(
    errors: DetectedError[],
    context: ErrorDetectionContext
  ): DetectedError[] {
    return errors.map(error => {
      const recommendation = this.taxonomyEngine.recommendCategory(
        error.description,
        '', // Source text would be provided in real implementation
        error.affectedText,
        context.domain
      );

      return {
        ...error,
        metadata: {
          ...error.metadata,
          hierarchical_path: recommendation.hierarchical_path,
          taxonomy_confidence: recommendation.confidence,
          categorization_reasoning: recommendation.reasoning
        }
      };
    });
  }

  /**
   * Validate detection accuracy against human annotations
   */
  public validateAgainstAnnotations(
    detectedErrors: DetectedError[],
    humanAnnotations: DetectedError[]
  ): ValidationResult {
    // Implementation would compare detected errors with human annotations
    // This is a simplified version for demonstration
    
    const truePositives = detectedErrors.filter(detected =>
      humanAnnotations.some(human => 
        this.errorsMatch(detected, human)
      )
    );

    const falsePositives = detectedErrors.filter(detected =>
      !humanAnnotations.some(human => 
        this.errorsMatch(detected, human)
      )
    );

    const falseNegatives = humanAnnotations.filter(human =>
      !detectedErrors.some(detected => 
        this.errorsMatch(detected, human)
      )
    );

    const precision = truePositives.length / (truePositives.length + falsePositives.length) || 0;
    const recall = truePositives.length / (truePositives.length + falseNegatives.length) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const accuracy = truePositives.length / humanAnnotations.length || 0;

    return {
      accuracy,
      precision,
      recall,
      f1_score: f1Score,
      category_accuracy: this.calculateCategoryAccuracy(truePositives, humanAnnotations),
      severity_accuracy: this.calculateSeverityAccuracy(truePositives, humanAnnotations),
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      confidence_distribution: this.calculateConfidenceDistribution(detectedErrors)
    };
  }

  // Private helper methods
  private initializeMLPatterns(): void {
    // Initialize ML patterns for common error types
    // This would be loaded from a trained model or configuration
    
    this.mlPatterns.set('semantic_mistranslation', {
      pattern_id: 'semantic_mistranslation',
      pattern_type: 'semantic',
      linguistic_features: ['semantic_similarity', 'key_terms', 'named_entities'],
      error_indicators: ['low_semantic_overlap', 'missing_key_concepts'],
      confidence_threshold: 0.7,
      domain_specific: false,
      applicable_domains: Object.values(ErrorDomain),
      mqm_mapping: {
        dimension: MQMDimension.ACCURACY,
        category: 'mistranslation' as MQMErrorCategory,
        subcategory: 'substitution',
        leaf_category: 'semantic_mistranslation',
        domain: ErrorDomain.GENERAL,
        full_path: 'accuracy/mistranslation/substitution/semantic_mistranslation'
      }
    });

    // Add more patterns...
  }

  private initializeDomainTerminologies(): void {
    // Initialize domain-specific terminology sets
    this.domainTerminologies.set(ErrorDomain.TECHNICAL, new Set([
      'api', 'database', 'algorithm', 'framework', 'deployment', 'configuration',
      'server', 'client', 'authentication', 'encryption', 'protocol', 'interface'
    ]));

    this.domainTerminologies.set(ErrorDomain.MEDICAL, new Set([
      'diagnosis', 'treatment', 'medication', 'symptom', 'patient', 'clinical',
      'therapy', 'procedure', 'dosage', 'adverse', 'contraindication', 'prognosis'
    ]));

    this.domainTerminologies.set(ErrorDomain.LEGAL, new Set([
      'contract', 'clause', 'liability', 'jurisdiction', 'compliance', 'statute',
      'regulation', 'court', 'defendant', 'plaintiff', 'evidence', 'testimony'
    ]));

    // Add more domain terminologies...
  }

  private extractNamedEntities(text: string): Array<{ text: string; type: string; confidence: number }> {
    const doc = nlp(text);
    const entities: Array<{ text: string; type: string; confidence: number }> = [];

    // Extract people names
    doc.people().forEach((person: any) => {
      entities.push({
        text: person.text(),
        type: 'PERSON',
        confidence: 0.8
      });
    });

    // Extract places
    doc.places().forEach((place: any) => {
      entities.push({
        text: place.text(),
        type: 'PLACE',
        confidence: 0.8
      });
    });

    // Extract organizations
    doc.organizations().forEach((org: any) => {
      entities.push({
        text: org.text(),
        type: 'ORGANIZATION',
        confidence: 0.8
      });
    });

    return entities;
  }

  private calculateGrammarComplexity(text: string, posTagged: Array<{ word: string; tag: string }>): number {
    // Simplified complexity calculation based on POS tag diversity and sentence structure
    const uniquePosTags = new Set(posTagged.map(item => item.tag));
    const sentences = natural.SentenceTokenizer.tokenize(text);
    const avgSentenceLength = text.length / sentences.length;
    
    return (uniquePosTags.size / 10) + (avgSentenceLength / 50);
  }

  private calculateReadabilityScore(text: string, sentences: string[]): number {
    // Simplified Flesch Reading Ease approximation
    const words = this.tokenizer.tokenize(text) || [];
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  private countSyllables(word: string): number {
    // Simplified syllable counting
    const vowelMatches = word.toLowerCase().match(/[aeiouy]+/g);
    return vowelMatches ? vowelMatches.length : 1;
  }

  private detectRegisterLevel(text: string): 'formal' | 'informal' | 'neutral' {
    // Simplified register detection based on linguistic markers
    const formalMarkers = ['therefore', 'consequently', 'furthermore', 'nonetheless'];
    const informalMarkers = ['gonna', 'wanna', 'yeah', 'ok', 'hey'];
    
    const lowerText = text.toLowerCase();
    const formalCount = formalMarkers.filter(marker => lowerText.includes(marker)).length;
    const informalCount = informalMarkers.filter(marker => lowerText.includes(marker)).length;
    
    if (formalCount > informalCount) return 'formal';
    if (informalCount > formalCount) return 'informal';
    return 'neutral';
  }

  private detectSemanticField(keyTerms: string[]): string {
    // Simplified semantic field detection
    const technicalTerms = ['system', 'process', 'method', 'analysis', 'data'];
    const businessTerms = ['market', 'customer', 'revenue', 'strategy', 'profit'];
    const academicTerms = ['research', 'study', 'theory', 'analysis', 'methodology'];
    
    const technicalScore = keyTerms.filter(term => technicalTerms.includes(term)).length;
    const businessScore = keyTerms.filter(term => businessTerms.includes(term)).length;
    const academicScore = keyTerms.filter(term => academicTerms.includes(term)).length;
    
    const maxScore = Math.max(technicalScore, businessScore, academicScore);
    
    if (maxScore === technicalScore && technicalScore > 0) return 'technical';
    if (maxScore === businessScore && businessScore > 0) return 'business';
    if (maxScore === academicScore && academicScore > 0) return 'academic';
    
    return 'general';
  }

  private calculateSemanticSimilarity(sourceTerms: string[], targetTerms: string[]): number {
    // Simplified Jaccard similarity
    const sourceSet = new Set(sourceTerms);
    const targetSet = new Set(targetTerms);
    const intersection = new Set([...sourceSet].filter(term => targetSet.has(term)));
    const union = new Set([...sourceSet, ...targetSet]);
    
    return intersection.size / union.size;
  }

  private evaluatePatternMatch(
    pattern: MLErrorPattern,
    sourceText: string,
    targetText: string,
    sourceLinguistics: LinguisticFeatures,
    targetLinguistics: LinguisticFeatures
  ): number {
    // Simplified pattern matching - in production would use trained ML models
    let confidence = 0;
    
    if (pattern.error_indicators.includes('low_semantic_overlap')) {
      const similarity = this.calculateSemanticSimilarity(
        sourceLinguistics.keyTerms,
        targetLinguistics.keyTerms
      );
      if (similarity < 0.6) confidence += 0.4;
    }
    
    return confidence;
  }

  private createDetectedError(
    pattern: MLErrorPattern,
    sourceText: string,
    targetText: string,
    confidence: number,
    context: ErrorDetectionContext
  ): DetectedError {
    return {
      id: `${pattern.pattern_id}_${Date.now()}`,
      type: pattern.pattern_id,
      category: this.mapPatternTypeToCategory(pattern.pattern_type),
      severity: this.inferSeverityFromPattern(pattern),
      description: `Pattern-based detection: ${pattern.pattern_id}`,
      confidence: Math.round(confidence * 100),
      affectedText: targetText.substring(0, 100) + '...',
      metadata: {
        pattern_type: pattern.pattern_type,
        detection_method: 'ml_pattern',
        context_domain: context.domain
      }
    };
  }

  private mapPatternTypeToCategory(patternType: string): 'linguistic' | 'transfer' | 'style' | 'cultural' | 'technical' {
    const mapping: Record<string, 'linguistic' | 'transfer' | 'style' | 'cultural' | 'technical'> = {
      'semantic': 'transfer',
      'syntactic': 'linguistic',
      'pragmatic': 'cultural',
      'lexical': 'linguistic',
      'morphological': 'linguistic'
    };
    
    return mapping[patternType] || 'linguistic';
  }

  private inferSeverityFromPattern(pattern: MLErrorPattern): ErrorSeverity {
    // Simplified severity inference based on pattern type
    if (pattern.pattern_type === 'semantic') return ErrorSeverity.MAJOR;
    if (pattern.pattern_type === 'syntactic') return ErrorSeverity.MAJOR;
    return ErrorSeverity.MINOR;
  }

  private detectEntityInconsistencies(
    sourceEntities: Array<{ text: string; type: string; confidence: number }>,
    targetEntities: Array<{ text: string; type: string; confidence: number }>
  ): DetectedError[] {
    const errors: DetectedError[] = [];
    
    // Check for missing entities
    sourceEntities.forEach(sourceEntity => {
      const matchingTarget = targetEntities.find(targetEntity => 
        targetEntity.type === sourceEntity.type && 
        targetEntity.text.toLowerCase().includes(sourceEntity.text.toLowerCase())
      );
      
      if (!matchingTarget) {
        errors.push({
          id: `entity_missing_${Date.now()}`,
          type: 'entity_omission',
          category: 'transfer',
          severity: ErrorSeverity.MAJOR,
          description: `Missing ${sourceEntity.type}: ${sourceEntity.text}`,
          confidence: sourceEntity.confidence * 100,
          affectedText: sourceEntity.text,
          metadata: {
            entity_type: sourceEntity.type,
            analysis_type: 'entity_consistency'
          }
        });
      }
    });
    
    return errors;
  }

  private detectTerminologyInconsistencies(
    sourceTerms: string[],
    targetTerms: string[],
    domain: ErrorDomain
  ): DetectedError[] {
    const errors: DetectedError[] = [];
    const domainTerms = this.domainTerminologies.get(domain);
    
    if (!domainTerms) return errors;
    
    const sourceDomainTerms = sourceTerms.filter(term => domainTerms.has(term.toLowerCase()));
    const targetDomainTerms = targetTerms.filter(term => domainTerms.has(term.toLowerCase()));
    
    const missingTerms = sourceDomainTerms.filter(term => 
      !targetDomainTerms.some(targetTerm => 
        targetTerm.toLowerCase() === term.toLowerCase()
      )
    );
    
    if (missingTerms.length > 0) {
      errors.push({
        id: `terminology_inconsistency_${Date.now()}`,
        type: 'terminology_inconsistency',
        category: 'linguistic', // Changed from 'terminology' to match DetectedError interface
        severity: ErrorSeverity.MAJOR,
        description: `Inconsistent terminology usage: ${missingTerms.join(', ')}`,
        confidence: 85,
        affectedText: missingTerms.join(', '),
        metadata: {
          missing_terms: missingTerms,
          domain: domain,
          analysis_type: 'terminology_consistency'
        }
      });
    }
    
    return errors;
  }

  private filterAndScoreErrors(
    errors: DetectedError[],
    context: ErrorDetectionContext
  ): DetectedError[] {
    // Filter by quality threshold
    const threshold = context.quality_threshold || 60;
    
    return errors
      .filter(error => error.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending
  }

  private errorsMatch(error1: DetectedError, error2: DetectedError): boolean {
    // Simplified error matching for validation
    return error1.type === error2.type && 
           error1.category === error2.category &&
           Math.abs(error1.confidence - error2.confidence) < 20;
  }

  private calculateCategoryAccuracy(
    truePositives: DetectedError[],
    humanAnnotations: DetectedError[]
  ): Record<string, number> {
    const categoryAccuracy: Record<string, number> = {};
    
    const categories = [...new Set([
      ...truePositives.map(e => e.category),
      ...humanAnnotations.map(e => e.category)
    ])];
    
    categories.forEach(category => {
      const correctInCategory = truePositives.filter(e => e.category === category).length;
      const totalInCategory = humanAnnotations.filter(e => e.category === category).length;
      categoryAccuracy[category] = totalInCategory > 0 ? correctInCategory / totalInCategory : 0;
    });
    
    return categoryAccuracy;
  }

  private calculateSeverityAccuracy(
    truePositives: DetectedError[],
    humanAnnotations: DetectedError[]
  ): Record<ErrorSeverity, number> {
    const severityAccuracy: Record<ErrorSeverity, number> = {
      [ErrorSeverity.MINOR]: 0,
      [ErrorSeverity.MAJOR]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    const severityValues = [ErrorSeverity.MINOR, ErrorSeverity.MAJOR, ErrorSeverity.CRITICAL];
    severityValues.forEach(severity => {
      const correctInSeverity = truePositives.filter(e => e.severity === severity).length;
      const totalInSeverity = humanAnnotations.filter(e => e.severity === severity).length;
      severityAccuracy[severity] = totalInSeverity > 0 ? correctInSeverity / totalInSeverity : 0;
    });
    
    return severityAccuracy;
  }

  private calculateConfidenceDistribution(errors: DetectedError[]): Record<string, number> {
    const distribution: Record<string, number> = {
      'high': 0,    // 80-100
      'medium': 0,  // 60-79
      'low': 0      // 0-59
    };
    
    errors.forEach(error => {
      if (error.confidence >= 80) distribution.high++;
      else if (error.confidence >= 60) distribution.medium++;
      else distribution.low++;
    });
    
    const total = errors.length;
    if (total > 0) {
      distribution.high = Math.round((distribution.high / total) * 100);
      distribution.medium = Math.round((distribution.medium / total) * 100);
      distribution.low = Math.round((distribution.low / total) * 100);
    }
    
    return distribution;
  }
} 