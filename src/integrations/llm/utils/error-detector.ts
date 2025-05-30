// Error Detection and Pattern Analysis for LLM Quality Assessment

import { ErrorSeverity } from '../../../lib/types/assessment';

export interface DetectedError {
  id: string;
  type: string;
  category: 'linguistic' | 'transfer' | 'style' | 'cultural' | 'technical';
  severity: ErrorSeverity;
  description: string;
  suggestion?: string;
  confidence: number;
  position?: {
    start: number;
    end: number;
  };
  affectedText: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface ErrorPattern {
  pattern: string;
  type: string;
  description: string;
  frequency: number;
  examples: string[];
  severity: ErrorSeverity;
  confidence: number;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  patterns: ErrorPattern[];
  recommendations: string[];
  confidence: number;
}

export class LLMErrorDetector {
  private commonPatterns: Map<string, ErrorPattern> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Grammar patterns
    this.addPattern({
      pattern: 'verb_tense_inconsistency',
      type: 'grammar',
      description: 'Inconsistent verb tenses within the same context',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MAJOR,
      confidence: 80
    });

    this.addPattern({
      pattern: 'subject_verb_disagreement',
      type: 'grammar',
      description: 'Subject and verb do not agree in number',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MAJOR,
      confidence: 85
    });

    this.addPattern({
      pattern: 'article_misuse',
      type: 'grammar',
      description: 'Incorrect use of definite/indefinite articles',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MINOR,
      confidence: 70
    });

    // Translation patterns
    this.addPattern({
      pattern: 'literal_translation',
      type: 'transfer',
      description: 'Overly literal translation that sounds unnatural',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MAJOR,
      confidence: 75
    });

    this.addPattern({
      pattern: 'false_friend',
      type: 'lexical',
      description: 'Use of false cognates or false friends',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MAJOR,
      confidence: 90
    });

    this.addPattern({
      pattern: 'cultural_reference_error',
      type: 'cultural',
      description: 'Inappropriate cultural references or adaptations',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MINOR,
      confidence: 65
    });

    // Style patterns
    this.addPattern({
      pattern: 'register_inconsistency',
      type: 'style',
      description: 'Inconsistent formality level throughout the text',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MINOR,
      confidence: 70
    });

    this.addPattern({
      pattern: 'terminology_inconsistency',
      type: 'terminology',
      description: 'Same concept translated differently in different contexts',
      frequency: 0,
      examples: [],
      severity: ErrorSeverity.MAJOR,
      confidence: 85
    });
  }

  private addPattern(pattern: ErrorPattern): void {
    this.commonPatterns.set(pattern.pattern, pattern);
  }

  /**
   * Analyze errors from LLM response and detect patterns
   */
  public analyzeErrors(errors: DetectedError[]): ErrorAnalysis {
    const analysis: ErrorAnalysis = {
      totalErrors: errors.length,
      errorsByCategory: {},
      errorsBySeverity: {
        [ErrorSeverity.MINOR]: 0,
        [ErrorSeverity.MAJOR]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      patterns: [],
      recommendations: [],
      confidence: 0
    };

    // Count errors by category and severity
    errors.forEach(error => {
      // Count by category
      analysis.errorsByCategory[error.category] = (analysis.errorsByCategory[error.category] || 0) + 1;
      
      // Count by severity
      analysis.errorsBySeverity[error.severity]++;
    });

    // Detect patterns
    analysis.patterns = this.detectPatterns(errors);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(errors, analysis.patterns);
    
    // Calculate overall confidence
    analysis.confidence = this.calculateAnalysisConfidence(errors, analysis.patterns);

    return analysis;
  }

  /**
   * Detect patterns in the error list
   */
  private detectPatterns(errors: DetectedError[]): ErrorPattern[] {
    const patternMap = new Map<string, ErrorPattern>();
    
    // Group errors by type and look for patterns
    const errorsByType = new Map<string, DetectedError[]>();
    errors.forEach(error => {
      const key = `${error.category}_${error.type}`;
      if (!errorsByType.has(key)) {
        errorsByType.set(key, []);
      }
      errorsByType.get(key)!.push(error);
    });

    // Analyze each type group
    errorsByType.forEach((typeErrors, key) => {
      if (typeErrors.length >= 2) { // Pattern requires at least 2 instances
        const pattern: ErrorPattern = {
          pattern: key,
          type: typeErrors[0].type,
          description: this.generatePatternDescription(typeErrors),
          frequency: typeErrors.length,
          examples: typeErrors.slice(0, 3).map(e => e.affectedText), // Max 3 examples
          severity: this.calculatePatternSeverity(typeErrors),
          confidence: this.calculatePatternConfidence(typeErrors)
        };
        patternMap.set(key, pattern);
      }
    });

    // Check for specific linguistic patterns
    this.detectLinguisticPatterns(errors, patternMap);
    
    // Check for consistency patterns
    this.detectConsistencyPatterns(errors, patternMap);

    return Array.from(patternMap.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect specific linguistic patterns
   */
  private detectLinguisticPatterns(errors: DetectedError[], patternMap: Map<string, ErrorPattern>): void {
    // Check for repeated grammatical errors
    const grammarErrors = errors.filter(e => e.category === 'linguistic' && e.type.includes('grammar'));
    
    if (grammarErrors.length >= 3) {
      const grammarTypes = grammarErrors.map(e => e.type);
      const uniqueTypes = [...new Set(grammarTypes)];
      
      if (uniqueTypes.length === 1) {
        // Same grammar error repeated
        patternMap.set('repeated_grammar_error', {
          pattern: 'repeated_grammar_error',
          type: 'grammar',
          description: `Repeated ${grammarErrors[0].type} errors throughout the text`,
          frequency: grammarErrors.length,
          examples: grammarErrors.slice(0, 3).map(e => e.affectedText),
          severity: ErrorSeverity.MAJOR,
          confidence: 85
        });
      }
    }

    // Check for lexical choice patterns
    const lexicalErrors = errors.filter(e => e.type.includes('lexical') || e.type.includes('word'));
    if (lexicalErrors.length >= 2) {
      patternMap.set('lexical_choice_pattern', {
        pattern: 'lexical_choice_pattern',
        type: 'lexical',
        description: 'Recurring issues with word choice and vocabulary selection',
        frequency: lexicalErrors.length,
        examples: lexicalErrors.slice(0, 3).map(e => e.affectedText),
        severity: this.calculatePatternSeverity(lexicalErrors),
        confidence: 75
      });
    }
  }

  /**
   * Detect consistency patterns
   */
  private detectConsistencyPatterns(errors: DetectedError[], patternMap: Map<string, ErrorPattern>): void {
    // Check for terminology inconsistencies
    const terminologyErrors = errors.filter(e => 
      e.type.includes('terminology') || 
      e.type.includes('consistency') ||
      e.description.toLowerCase().includes('inconsistent')
    );

    if (terminologyErrors.length >= 2) {
      patternMap.set('terminology_inconsistency_pattern', {
        pattern: 'terminology_inconsistency_pattern',
        type: 'terminology',
        description: 'Inconsistent use of terminology across the document',
        frequency: terminologyErrors.length,
        examples: terminologyErrors.slice(0, 3).map(e => e.affectedText),
        severity: ErrorSeverity.MAJOR,
        confidence: 80
      });
    }

    // Check for style inconsistencies
    const styleErrors = errors.filter(e => e.category === 'style');
    if (styleErrors.length >= 2) {
      patternMap.set('style_inconsistency_pattern', {
        pattern: 'style_inconsistency_pattern',
        type: 'style',
        description: 'Inconsistent writing style and register usage',
        frequency: styleErrors.length,
        examples: styleErrors.slice(0, 3).map(e => e.affectedText),
        severity: ErrorSeverity.MINOR,
        confidence: 70
      });
    }
  }

  /**
   * Generate pattern description based on error group
   */
  private generatePatternDescription(errors: DetectedError[]): string {
    const category = errors[0].category;
    const type = errors[0].type;
    const count = errors.length;

    const descriptions = {
      linguistic: `Repeated ${type} issues (${count} instances)`,
      transfer: `Translation transfer problems with ${type} (${count} instances)`,
      style: `Style inconsistencies related to ${type} (${count} instances)`,
      cultural: `Cultural adaptation issues with ${type} (${count} instances)`,
      technical: `Technical terminology problems with ${type} (${count} instances)`
    };

    return descriptions[category] || `Recurring ${type} issues (${count} instances)`;
  }

  /**
   * Calculate pattern severity based on constituent errors
   */
  private calculatePatternSeverity(errors: DetectedError[]): ErrorSeverity {
    const severityScores = {
      [ErrorSeverity.MINOR]: 1,
      [ErrorSeverity.MAJOR]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };

    const avgScore = errors.reduce((sum, error) => sum + severityScores[error.severity], 0) / errors.length;
    
    if (avgScore >= 2.5) return ErrorSeverity.CRITICAL;
    if (avgScore >= 1.5) return ErrorSeverity.MAJOR;
    return ErrorSeverity.MINOR;
  }

  /**
   * Calculate pattern confidence based on error consistency
   */
  private calculatePatternConfidence(errors: DetectedError[]): number {
    // Base confidence on frequency and consistency
    const frequency = errors.length;
    const avgConfidence = errors.reduce((sum, error) => sum + error.confidence, 0) / errors.length;
    
    // Frequency bonus
    const frequencyBonus = Math.min(20, frequency * 5);
    
    // Consistency bonus (if error types are similar)
    const types = [...new Set(errors.map(e => e.type))];
    const consistencyBonus = types.length === 1 ? 15 : Math.max(0, 15 - (types.length * 3));
    
    return Math.min(100, avgConfidence + frequencyBonus + consistencyBonus);
  }

  /**
   * Generate recommendations based on errors and patterns
   */
  private generateRecommendations(errors: DetectedError[], patterns: ErrorPattern[]): string[] {
    const recommendations: string[] = [];

    // General recommendations based on error count and severity
    const criticalErrors = errors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    const majorErrors = errors.filter(e => e.severity === ErrorSeverity.MAJOR);

    if (criticalErrors.length > 0) {
      recommendations.push(`Address ${criticalErrors.length} critical error(s) immediately as they significantly impact quality`);
    }

    if (majorErrors.length > 3) {
      recommendations.push(`Focus on the ${majorErrors.length} major errors which substantially affect readability and accuracy`);
    }

    // Pattern-specific recommendations
    patterns.forEach(pattern => {
      switch (pattern.type) {
        case 'grammar':
          if (pattern.frequency >= 3) {
            recommendations.push(`Review grammar rules for ${pattern.type} - ${pattern.frequency} similar errors detected`);
          }
          break;
        case 'terminology':
          if (pattern.frequency >= 2) {
            recommendations.push(`Establish and follow a consistent terminology glossary - inconsistencies found in ${pattern.frequency} instances`);
          }
          break;
        case 'style':
          if (pattern.frequency >= 2) {
            recommendations.push(`Maintain consistent writing style and register throughout the document`);
          }
          break;
        case 'transfer':
          recommendations.push(`Review translation approach to avoid overly literal translations that sound unnatural`);
          break;
        case 'cultural':
          recommendations.push(`Consider cultural adaptation and localization for better target audience fit`);
          break;
      }
    });

    // Category-specific recommendations
    const errorsByCategory = this.groupErrorsByCategory(errors);
    
    if (errorsByCategory.linguistic && errorsByCategory.linguistic.length > 5) {
      recommendations.push('Consider additional linguistic review as multiple grammar and language issues were detected');
    }

    if (errorsByCategory.transfer && errorsByCategory.transfer.length > 3) {
      recommendations.push('Review translation methodology to improve meaning transfer accuracy');
    }

    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  /**
   * Group errors by category
   */
  private groupErrorsByCategory(errors: DetectedError[]): Record<string, DetectedError[]> {
    return errors.reduce((groups, error) => {
      if (!groups[error.category]) {
        groups[error.category] = [];
      }
      groups[error.category].push(error);
      return groups;
    }, {} as Record<string, DetectedError[]>);
  }

  /**
   * Calculate overall analysis confidence
   */
  private calculateAnalysisConfidence(errors: DetectedError[], patterns: ErrorPattern[]): number {
    if (errors.length === 0) return 0;

    // Base confidence on error confidence scores
    const avgErrorConfidence = errors.reduce((sum, error) => sum + error.confidence, 0) / errors.length;
    
    // Pattern detection bonus
    const patternBonus = patterns.length > 0 ? Math.min(20, patterns.length * 5) : 0;
    
    // Sample size factor
    const sampleSizeFactor = errors.length >= 5 ? 10 : errors.length * 2;
    
    return Math.min(100, avgErrorConfidence + patternBonus + sampleSizeFactor);
  }

  /**
   * Get pattern statistics
   */
  public getPatternStatistics(patterns: ErrorPattern[]): Record<string, any> {
    return {
      totalPatterns: patterns.length,
      mostCommonPattern: patterns.length > 0 ? patterns[0] : null,
      averageFrequency: patterns.length > 0 ? 
        patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length : 0,
      severityDistribution: {
        critical: patterns.filter(p => p.severity === ErrorSeverity.CRITICAL).length,
        major: patterns.filter(p => p.severity === ErrorSeverity.MAJOR).length,
        minor: patterns.filter(p => p.severity === ErrorSeverity.MINOR).length
      },
      averageConfidence: patterns.length > 0 ?
        patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0
    };
  }

  /**
   * Filter errors by criteria
   */
  public filterErrors(
    errors: DetectedError[], 
    criteria: {
      minConfidence?: number;
      severity?: ErrorSeverity[];
      category?: string[];
      type?: string[];
    }
  ): DetectedError[] {
    return errors.filter(error => {
      if (criteria.minConfidence && error.confidence < criteria.minConfidence) {
        return false;
      }
      
      if (criteria.severity && !criteria.severity.includes(error.severity)) {
        return false;
      }
      
      if (criteria.category && !criteria.category.includes(error.category)) {
        return false;
      }
      
      if (criteria.type && !criteria.type.includes(error.type)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Merge similar errors to reduce noise
   */
  public mergeSimilarErrors(errors: DetectedError[]): DetectedError[] {
    const mergedErrors: DetectedError[] = [];
    const processed = new Set<string>();

    errors.forEach(error => {
      if (processed.has(error.id)) return;

      // Find similar errors
      const similar = errors.filter(other => 
        other.id !== error.id &&
        other.type === error.type &&
        other.category === error.category &&
        !processed.has(other.id) &&
        this.calculateTextSimilarity(error.affectedText, other.affectedText) > 0.7
      );

      if (similar.length > 0) {
        // Create merged error
        const mergedError: DetectedError = {
          ...error,
          id: `merged_${error.id}`,
          description: `${error.description} (${similar.length + 1} similar instances)`,
          confidence: Math.max(error.confidence, ...similar.map(s => s.confidence)),
          metadata: {
            ...error.metadata,
            mergedFrom: [error.id, ...similar.map(s => s.id)],
            instanceCount: similar.length + 1
          }
        };
        
        mergedErrors.push(mergedError);
        
        // Mark as processed
        processed.add(error.id);
        similar.forEach(s => processed.add(s.id));
      } else {
        mergedErrors.push(error);
        processed.add(error.id);
      }
    });

    return mergedErrors;
  }

  /**
   * Calculate text similarity for error merging
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);
    
    if (normalized1 === normalized2) return 1.0;
    
    // Simple Jaccard similarity for quick comparison
    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
} 