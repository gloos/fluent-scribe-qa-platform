/**
 * Error Detection Service Integration
 * Connects the Enhanced Error Detection Engine with existing LLM services
 * Provides a unified interface for error detection across the platform
 */

import { ErrorDetectionEngine, ErrorDetectionContext, LinguisticFeatures } from '../algorithms/error-detection-engine';
import { LLMService } from '../../integrations/llm/services/LLMService';
import { LLMErrorDetector, DetectedError } from '../../integrations/llm/utils/error-detector';
import { MQMTaxonomyExpansionEngine } from '../utils/mqm-taxonomy-expansion';
import { ErrorDomain } from '../types/mqm-taxonomy-expansion';
import { ErrorSeverity } from '../types/assessment';

/**
 * Configuration for error detection service
 */
export interface ErrorDetectionConfig {
  // AI-powered detection settings
  enableLLMDetection: boolean;
  enableHybridMode: boolean; // Combine AI and algorithmic detection
  
  // Algorithmic detection settings
  enableSemanticAnalysis: boolean;
  enableContextualAnalysis: boolean;
  qualityThreshold: number; // 0-100
  
  // Domain-specific settings
  domain: ErrorDomain;
  textType?: 'technical' | 'marketing' | 'literary' | 'legal' | 'medical' | 'general';
  
  // Language settings
  sourceLanguage?: string;
  targetLanguage?: string;
  
  // Performance settings
  enableCaching: boolean;
  batchSize?: number;
  maxProcessingTime?: number; // milliseconds
}

/**
 * Comprehensive error detection result
 */
export interface ErrorDetectionResult {
  // Core results
  errors: DetectedError[];
  totalErrors: number;
  
  // Analysis metrics
  overallScore: number; // 0-100 quality score
  confidenceScore: number; // 0-100 confidence in detection
  
  // Categorization
  errorsByCategory: Record<string, DetectedError[]>;
  errorsBySeverity: Record<ErrorSeverity, DetectedError[]>;
  
  // Performance metrics
  processingTime: number;
  methodsUsed: string[];
  
  // Linguistic analysis
  linguisticFeatures?: LinguisticFeatures;
  
  // Metadata
  detectionConfig: ErrorDetectionConfig;
  timestamp: Date;
}

/**
 * Error Detection Service
 * Orchestrates multiple detection methods for comprehensive error analysis
 */
export class ErrorDetectionService {
  private algorithmicEngine: ErrorDetectionEngine;
  private llmService: LLMService;
  private llmErrorDetector: LLMErrorDetector;
  private taxonomyEngine: MQMTaxonomyExpansionEngine;
  private cache: Map<string, ErrorDetectionResult>;

  constructor() {
    this.algorithmicEngine = new ErrorDetectionEngine();
    this.llmService = new LLMService();
    this.llmErrorDetector = new LLMErrorDetector();
    this.taxonomyEngine = new MQMTaxonomyExpansionEngine();
    this.cache = new Map();
  }

  /**
   * Main error detection method with unified interface
   */
  public async detectErrors(
    sourceText: string,
    targetText: string,
    config: ErrorDetectionConfig
  ): Promise<ErrorDetectionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(sourceText, targetText, config);
    
    // Check cache if enabled
    if (config.enableCaching && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return {
        ...cached,
        timestamp: new Date()
      };
    }

    const methodsUsed: string[] = [];
    let allErrors: DetectedError[] = [];

    try {
      // 1. Algorithmic detection (always enabled for base analysis)
      const algorithmicErrors = await this.runAlgorithmicDetection(
        sourceText, 
        targetText, 
        config
      );
      allErrors.push(...algorithmicErrors);
      methodsUsed.push('algorithmic');

      // 2. LLM-powered detection (if enabled)
      if (config.enableLLMDetection) {
        const llmErrors = await this.runLLMDetection(
          sourceText, 
          targetText, 
          config
        );
        allErrors.push(...llmErrors);
        methodsUsed.push('llm');
      }

      // 3. Hybrid mode processing (combine and deduplicate)
      if (config.enableHybridMode && config.enableLLMDetection) {
        allErrors = this.mergeAndDeduplicateErrors(allErrors);
        methodsUsed.push('hybrid_deduplication');
      }

      // 4. Enhanced classification and scoring
      const enrichedErrors = await this.enrichErrorsWithTaxonomy(allErrors, config);
      methodsUsed.push('taxonomy_enrichment');

      // 5. Generate comprehensive result
      const result = this.buildDetectionResult(
        enrichedErrors,
        sourceText,
        targetText,
        config,
        methodsUsed,
        Date.now() - startTime
      );

      // Cache result if enabled
      if (config.enableCaching) {
        this.cache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      console.error('Error detection failed:', error);
      
      // Return fallback result
      return this.buildEmptyResult(config, methodsUsed, Date.now() - startTime);
    }
  }

  /**
   * Batch error detection for multiple text pairs
   */
  public async detectErrorsBatch(
    textPairs: Array<{ source: string; target: string; id?: string }>,
    config: ErrorDetectionConfig
  ): Promise<Map<string, ErrorDetectionResult>> {
    const results = new Map<string, ErrorDetectionResult>();
    const batchSize = config.batchSize || 5;
    
    for (let i = 0; i < textPairs.length; i += batchSize) {
      const batch = textPairs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (pair, index) => {
        const id = pair.id || `${i + index}`;
        const result = await this.detectErrors(pair.source, pair.target, config);
        return { id, result };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, result }) => {
        results.set(id, result);
      });
    }

    return results;
  }

  /**
   * Quick error assessment (lightweight, faster analysis)
   */
  public async quickAssessment(
    sourceText: string,
    targetText: string,
    domain: ErrorDomain = ErrorDomain.GENERAL
  ): Promise<{ score: number; majorErrors: number; criticalErrors: number }> {
    const quickConfig: ErrorDetectionConfig = {
      enableLLMDetection: false,
      enableHybridMode: false,
      enableSemanticAnalysis: true,
      enableContextualAnalysis: false,
      qualityThreshold: 70,
      domain,
      enableCaching: true,
      maxProcessingTime: 5000 // 5 seconds max
    };

    const result = await this.detectErrors(sourceText, targetText, quickConfig);
    
    const majorErrors = result.errorsBySeverity[ErrorSeverity.MAJOR]?.length || 0;
    const criticalErrors = result.errorsBySeverity[ErrorSeverity.CRITICAL]?.length || 0;

    return {
      score: result.overallScore,
      majorErrors,
      criticalErrors
    };
  }

  // Private helper methods

  private async runAlgorithmicDetection(
    sourceText: string,
    targetText: string,
    config: ErrorDetectionConfig
  ): Promise<DetectedError[]> {
    const context: ErrorDetectionContext = {
      domain: config.domain,
      source_language: config.sourceLanguage,
      target_language: config.targetLanguage,
      text_type: config.textType,
      quality_threshold: config.qualityThreshold,
      enable_semantic_analysis: config.enableSemanticAnalysis,
      enable_contextual_analysis: config.enableContextualAnalysis
    };

    return await this.algorithmicEngine.detectErrors(sourceText, targetText, context);
  }

  private async runLLMDetection(
    sourceText: string,
    targetText: string,
    config: ErrorDetectionConfig
  ): Promise<DetectedError[]> {
    try {
      const llmResult = await this.llmService.detectErrors(targetText, config.targetLanguage);
      // The LLMService.detectErrors returns FallbackResult<DetectedError[]>, so we access .data
      return llmResult.data || [];
    } catch (error) {
      console.warn('LLM detection failed, falling back to algorithmic only:', error);
      return [];
    }
  }

  private mergeAndDeduplicateErrors(errors: DetectedError[]): DetectedError[] {
    const merged: DetectedError[] = [];
    const seen = new Set<string>();

    errors.forEach(error => {
      // Create a signature for deduplication
      const signature = `${error.type}_${error.category}_${error.affectedText?.substring(0, 50)}`;
      
      if (!seen.has(signature)) {
        seen.add(signature);
        merged.push(error);
      } else {
        // Find existing error and potentially merge confidence scores
        const existingIndex = merged.findIndex(e => 
          `${e.type}_${e.category}_${e.affectedText?.substring(0, 50)}` === signature
        );
        
        if (existingIndex >= 0) {
          // Boost confidence if detected by multiple methods
          merged[existingIndex].confidence = Math.min(100, 
            (merged[existingIndex].confidence + error.confidence) / 2 + 10
          );
          
          // Merge metadata
          merged[existingIndex].metadata = {
            ...merged[existingIndex].metadata,
            ...error.metadata,
            detection_methods: [
              ...(merged[existingIndex].metadata?.detection_methods || []),
              ...(error.metadata?.detection_methods || [])
            ]
          };
        }
      }
    });

    return merged;
  }

  private async enrichErrorsWithTaxonomy(
    errors: DetectedError[],
    config: ErrorDetectionConfig
  ): Promise<DetectedError[]> {
    return errors.map(error => {
      const recommendation = this.taxonomyEngine.recommendCategory(
        error.description,
        '', // Source would be provided in full implementation
        error.affectedText,
        config.domain
      );

      return {
        ...error,
        metadata: {
          ...error.metadata,
          hierarchical_path: recommendation.hierarchical_path,
          taxonomy_confidence: recommendation.confidence,
          categorization_reasoning: recommendation.reasoning,
          enrichment_timestamp: new Date().toISOString()
        }
      };
    });
  }

  private buildDetectionResult(
    errors: DetectedError[],
    sourceText: string,
    targetText: string,
    config: ErrorDetectionConfig,
    methodsUsed: string[],
    processingTime: number
  ): ErrorDetectionResult {
    // Categorize errors
    const errorsByCategory: Record<string, DetectedError[]> = {};
    const errorsBySeverity: Record<ErrorSeverity, DetectedError[]> = {
      [ErrorSeverity.MINOR]: [],
      [ErrorSeverity.MAJOR]: [],
      [ErrorSeverity.CRITICAL]: []
    };

    errors.forEach(error => {
      // By category
      if (!errorsByCategory[error.category]) {
        errorsByCategory[error.category] = [];
      }
      errorsByCategory[error.category].push(error);

      // By severity
      errorsBySeverity[error.severity].push(error);
    });

    // Calculate scores
    const overallScore = this.calculateOverallScore(errors, targetText.length);
    const confidenceScore = this.calculateAverageConfidence(errors);

    return {
      errors,
      totalErrors: errors.length,
      overallScore,
      confidenceScore,
      errorsByCategory,
      errorsBySeverity,
      processingTime,
      methodsUsed,
      detectionConfig: config,
      timestamp: new Date()
    };
  }

  private buildEmptyResult(
    config: ErrorDetectionConfig,
    methodsUsed: string[],
    processingTime: number
  ): ErrorDetectionResult {
    return {
      errors: [],
      totalErrors: 0,
      overallScore: 0,
      confidenceScore: 0,
      errorsByCategory: {},
      errorsBySeverity: {
        [ErrorSeverity.MINOR]: [],
        [ErrorSeverity.MAJOR]: [],
        [ErrorSeverity.CRITICAL]: []
      },
      processingTime,
      methodsUsed: [...methodsUsed, 'fallback'],
      detectionConfig: config,
      timestamp: new Date()
    };
  }

  private calculateOverallScore(errors: DetectedError[], textLength: number): number {
    if (errors.length === 0) return 100;

    // Weight errors by severity
    const severityWeights = {
      [ErrorSeverity.MINOR]: 1,
      [ErrorSeverity.MAJOR]: 3,
      [ErrorSeverity.CRITICAL]: 5
    };

    const totalWeight = errors.reduce((sum, error) => 
      sum + severityWeights[error.severity], 0
    );

    // Normalize by text length (errors per 100 characters)
    const errorDensity = (totalWeight / textLength) * 100;

    // Convert to 0-100 scale (lower error density = higher score)
    return Math.max(0, Math.min(100, 100 - (errorDensity * 20)));
  }

  private calculateAverageConfidence(errors: DetectedError[]): number {
    if (errors.length === 0) return 0;
    
    const totalConfidence = errors.reduce((sum, error) => sum + error.confidence, 0);
    return Math.round(totalConfidence / errors.length);
  }

  private generateCacheKey(
    sourceText: string,
    targetText: string,
    config: ErrorDetectionConfig
  ): string {
    const configStr = JSON.stringify({
      ...config,
      // Exclude non-deterministic fields
      timestamp: undefined
    });
    
    // Create a hash-like key
    return `${sourceText.substring(0, 100)}_${targetText.substring(0, 100)}_${configStr}`.replace(/\s/g, '_');
  }

  /**
   * Clear cache (useful for memory management)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Default configuration factory
 */
export class ErrorDetectionConfigBuilder {
  private config: Partial<ErrorDetectionConfig> = {};

  public static create(): ErrorDetectionConfigBuilder {
    return new ErrorDetectionConfigBuilder();
  }

  public withDomain(domain: ErrorDomain): this {
    this.config.domain = domain;
    return this;
  }

  public withLanguages(source?: string, target?: string): this {
    this.config.sourceLanguage = source;
    this.config.targetLanguage = target;
    return this;
  }

  public withTextType(type: 'technical' | 'marketing' | 'literary' | 'legal' | 'medical' | 'general'): this {
    this.config.textType = type;
    return this;
  }

  public enableLLM(enable: boolean = true): this {
    this.config.enableLLMDetection = enable;
    return this;
  }

  public enableHybrid(enable: boolean = true): this {
    this.config.enableHybridMode = enable;
    return this;
  }

  public withQualityThreshold(threshold: number): this {
    this.config.qualityThreshold = Math.max(0, Math.min(100, threshold));
    return this;
  }

  public enableCaching(enable: boolean = true): this {
    this.config.enableCaching = enable;
    return this;
  }

  public build(): ErrorDetectionConfig {
    return {
      // Defaults
      enableLLMDetection: false,
      enableHybridMode: false,
      enableSemanticAnalysis: true,
      enableContextualAnalysis: true,
      qualityThreshold: 70,
      domain: ErrorDomain.GENERAL,
      enableCaching: true,
      // Overrides
      ...this.config
    } as ErrorDetectionConfig;
  }
} 