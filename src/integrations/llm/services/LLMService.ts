// Main LLM Service for Quality Assessment

import { LLMClient } from '../clients/LLMClient';
import { LLMConfig as LLMConfigManager } from '../config/LLMConfig';
import { LLMResponseParser } from '../utils/response-parser';
import { LLMErrorDetector, DetectedError, ErrorAnalysis } from '../utils/error-detector';
import { FallbackManager } from '../utils/fallback-manager';
import { 
  getQualityAssessmentPrompt,
  getFluencyAssessmentPrompt,
  getAdequacyAssessmentPrompt,
  getErrorDetectionPrompt,
  getMQMAssessmentPrompt,
  getTerminologyConsistencyPrompt
} from '../utils/prompt-templates';

import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  QualityAssessmentRequest,
  QualityAssessmentResponse,
  LinguisticAnalysisRequest,
  LinguisticAnalysisResponse,
  ParsedResponse,
  LLMPerformanceMetrics,
  FallbackResult,
  FallbackConfig,
  HealthMonitoringMetrics,
  FallbackNotification
} from '../types/llm-types';

import { AssessmentFramework } from '../../../lib/types/assessment';

export interface LLMServiceConfig {
  provider?: LLMProvider;
  fallbackProvider?: LLMProvider;
  enableCaching?: boolean;
  enableErrorDetection?: boolean;
  maxRetries?: number;
  timeout?: number;
  fallbackConfig?: Partial<FallbackConfig>;
}

export class LLMService {
  private client: LLMClient;
  private fallbackClient?: LLMClient;
  private configManager: LLMConfigManager;
  private errorDetector: LLMErrorDetector;
  private config: LLMServiceConfig;
  private fallbackManager: FallbackManager;

  constructor(config: LLMServiceConfig = {}) {
    this.configManager = LLMConfigManager.getInstance();
    this.config = {
      enableCaching: true,
      enableErrorDetection: true,
      maxRetries: 3,
      timeout: 30000,
      ...config
    };

    this.errorDetector = new LLMErrorDetector();
    
    // Initialize enhanced fallback system
    this.fallbackManager = new FallbackManager(config.fallbackConfig);
    
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize primary client
    const provider = this.config.provider || this.configManager.getDefaultProvider();
    const providerConfig = this.configManager.getConfig(provider);
    
    if (!providerConfig) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }

    this.client = new LLMClient(providerConfig, this.configManager.getCacheConfig());

    // Initialize fallback client if specified
    if (this.config.fallbackProvider) {
      const fallbackConfig = this.configManager.getConfig(this.config.fallbackProvider);
      if (fallbackConfig) {
        this.fallbackClient = new LLMClient(fallbackConfig, this.configManager.getCacheConfig());
      }
    }
  }

  /**
   * Perform comprehensive quality assessment
   */
  public async assessQuality(
    sourceText: string,
    targetText: string,
    framework: string = 'comprehensive',
    context?: string
  ): Promise<FallbackResult<QualityAssessmentResponse>> {
    try {
      return await this.fallbackManager.getQualityAssessmentWithFallback(
        sourceText,
        targetText,
        context
      );
    } catch (error) {
      // Return error as fallback result
      return {
        data: {
          overallScore: 0,
          fluencyScore: 0,
          adequacyScore: 0,
          confidence: 0,
          errors: [{
            type: 'service_error',
            severity: 'critical',
            description: `Quality assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confidence: 100
          }],
          suggestions: [],
          metrics: { wordCount: 0, characterCount: 0 },
          reasoning: 'Assessment could not be completed due to service error'
        } as QualityAssessmentResponse,
        provider: LLMProvider.OPENAI,
        wasFromFallback: true,
        fallbackLevel: 999,
        degradedMode: true,
        fromCache: false,
        warnings: ['Service error occurred']
      };
    }
  }

  /**
   * Perform fluency assessment
   */
  public async assessFluency(
    text: string,
    language: string = 'auto'
  ): Promise<FallbackResult<any>> {
    try {
      const request: LLMRequest = {
        prompt: getFluencyAssessmentPrompt(text, language),
        systemPrompt: this.getSystemPrompt('fluency_assessment'),
        temperature: 0.1,
        maxTokens: 2048,
        metadata: {
          assessmentType: 'fluency',
          language
        }
      };

      return await this.fallbackManager.sendRequestWithFallback(request, 'fluency_assessment');
    } catch (error) {
      return this.createErrorFallbackResult('fluency_assessment', error);
    }
  }

  /**
   * Perform adequacy assessment
   */
  public async assessAdequacy(
    sourceText: string,
    targetText: string,
    context?: string
  ): Promise<FallbackResult<any>> {
    try {
      const request: LLMRequest = {
        prompt: getAdequacyAssessmentPrompt(sourceText, targetText, context),
        systemPrompt: this.getSystemPrompt('adequacy_assessment'),
        temperature: 0.1,
        maxTokens: 2048,
        metadata: {
          assessmentType: 'adequacy',
          sourceText: sourceText.slice(0, 100),
          targetText: targetText.slice(0, 100)
        }
      };

      return await this.fallbackManager.sendRequestWithFallback(request, 'adequacy_assessment');
    } catch (error) {
      return this.createErrorFallbackResult('adequacy_assessment', error);
    }
  }

  /**
   * Detect errors in text
   */
  public async detectErrors(
    text: string,
    language: string = 'auto',
    context?: string
  ): Promise<FallbackResult<DetectedError[]>> {
    try {
      const request: LLMRequest = {
        prompt: getErrorDetectionPrompt(text, '', undefined),
        systemPrompt: this.getSystemPrompt('error_detection'),
        temperature: 0.1,
        maxTokens: 2048,
        metadata: {
          assessmentType: 'error_detection',
          language,
          textLength: text.length
        }
      };

      const result = await this.fallbackManager.sendRequestWithFallback<string>(request, 'error_detection');
      
      // Parse the response to extract errors
      if (result.data && typeof result.data === 'string') {
        const parsedResponse = LLMResponseParser.parseErrorDetection(result.data);
        return {
          ...result,
          data: parsedResponse.success ? parsedResponse.data! : []
        };
      }

      return {
        ...result,
        data: []
      };
    } catch (error) {
      return this.createErrorFallbackResult('error_detection', error);
    }
  }

  /**
   * Perform linguistic analysis
   */
  public async analyzeLinguistic(
    request: LinguisticAnalysisRequest
  ): Promise<FallbackResult<LinguisticAnalysisResponse>> {
    try {
      return await this.fallbackManager.getLinguisticAnalysisWithFallback(
        request.text,
        request.language,
        request.analysisTypes
      );
    } catch (error) {
      return this.createErrorFallbackResult('linguistic_analysis', error);
    }
  }

  /**
   * Perform MQM assessment
   */
  public async assessMQM(
    sourceText: string,
    targetText: string,
    dimensions?: string[]
  ): Promise<FallbackResult<any>> {
    try {
      const request: LLMRequest = {
        prompt: getMQMAssessmentPrompt(sourceText, targetText, dimensions),
        systemPrompt: this.getSystemPrompt('mqm_assessment'),
        temperature: 0.1,
        maxTokens: 3072,
        metadata: {
          assessmentType: 'mqm',
          framework: 'MQM',
          dimensions
        }
      };

      return await this.fallbackManager.sendRequestWithFallback(request, 'mqm_assessment');
    } catch (error) {
      return this.createErrorFallbackResult('mqm_assessment', error);
    }
  }

  /**
   * Assess terminology consistency
   */
  public async assessTerminologyConsistency(
    texts: string[],
    domain?: string,
    language?: string
  ): Promise<FallbackResult<any>> {
    try {
      const request: LLMRequest = {
        prompt: getTerminologyConsistencyPrompt(texts.join('\n'), language, { domain }),
        systemPrompt: this.getSystemPrompt('terminology_assessment'),
        temperature: 0.1,
        maxTokens: 2048,
        metadata: {
          assessmentType: 'terminology_consistency',
          domain,
          language,
          textCount: texts.length
        }
      };

      return await this.fallbackManager.sendRequestWithFallback(request, 'terminology_consistency');
    } catch (error) {
      return this.createErrorFallbackResult('terminology_consistency', error);
    }
  }

  /**
   * Create error fallback result
   */
  private createErrorFallbackResult(assessmentType: string, error: any): FallbackResult<any> {
    return {
      data: null,
      provider: LLMProvider.OPENAI,
      wasFromFallback: true,
      fallbackLevel: 999,
      degradedMode: true,
      fromCache: false,
      warnings: [`${assessmentType} failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }

  /**
   * Get system prompt for different assessment types
   */
  private getSystemPrompt(assessmentType: string): string {
    const prompts = {
      quality_assessment: 'You are an expert translation quality assessor with extensive experience in linguistic analysis and translation evaluation. Provide thorough, objective assessments based on professional quality standards.',
      
      fluency_assessment: 'You are a linguistic expert specializing in fluency evaluation. Focus on naturalness, readability, and grammatical correctness. Provide detailed feedback on language quality.',
      
      adequacy_assessment: 'You are a translation adequacy specialist. Your expertise is in evaluating how completely and accurately meaning is transferred between languages. Focus on semantic equivalence and completeness.',
      
      error_detection: 'You are a quality assurance specialist focused on identifying and classifying translation and linguistic errors. Be systematic and thorough in your analysis.',
      
      mqm_assessment: 'You are an MQM (Multidimensional Quality Metrics) expert. Follow MQM guidelines precisely for error categorization and scoring. Be consistent with MQM standards.',
      
      terminology_assessment: 'You are a terminology specialist. Focus on consistency, accuracy, and appropriateness of domain-specific terms and technical vocabulary.'
    };

    return prompts[assessmentType] || 'You are a helpful language quality assessment assistant.';
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): LLMPerformanceMetrics {
    const primaryMetrics = this.client.getMetrics();
    
    if (this.fallbackClient) {
      const fallbackMetrics = this.fallbackClient.getMetrics();
      
      // Combine metrics
      return {
        ...primaryMetrics,
        requestCount: primaryMetrics.requestCount + fallbackMetrics.requestCount,
        totalLatency: primaryMetrics.totalLatency + fallbackMetrics.totalLatency,
        averageLatency: (primaryMetrics.totalLatency + fallbackMetrics.totalLatency) / 
                       (primaryMetrics.requestCount + fallbackMetrics.requestCount),
        tokenUsage: {
          totalPromptTokens: primaryMetrics.tokenUsage.totalPromptTokens + fallbackMetrics.tokenUsage.totalPromptTokens,
          totalCompletionTokens: primaryMetrics.tokenUsage.totalCompletionTokens + fallbackMetrics.tokenUsage.totalCompletionTokens,
          totalTokens: primaryMetrics.tokenUsage.totalTokens + fallbackMetrics.tokenUsage.totalTokens
        }
      };
    }
    
    return primaryMetrics;
  }

  /**
   * Get health metrics from fallback manager
   */
  public getHealthMetrics(): HealthMonitoringMetrics {
    return this.fallbackManager.getHealthMetrics();
  }

  /**
   * Get service status
   */
  public getServiceStatus() {
    return this.fallbackManager.getServiceStatus();
  }

  /**
   * Get recent notifications
   */
  public getNotifications(limit?: number): FallbackNotification[] {
    return this.fallbackManager.getNotifications(limit);
  }

  /**
   * Check if system is in degraded mode
   */
  public isDegraded(): boolean {
    return this.fallbackManager.isDegraded();
  }

  /**
   * Force provider recovery (admin function)
   */
  public forceProviderRecovery(provider: LLMProvider): void {
    this.fallbackManager.forceProviderRecovery(provider);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.client.clearCache();
    if (this.fallbackClient) {
      this.fallbackClient.clearCache();
    }
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
    if (this.fallbackClient) {
      this.fallbackClient.resetMetrics();
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { primary: { size: number; hitRate: number }; fallback?: { size: number; hitRate: number } } {
    const stats: { primary: { size: number; hitRate: number }; fallback?: { size: number; hitRate: number } } = {
      primary: this.client.getCacheStats()
    };
    
    if (this.fallbackClient) {
      stats.fallback = this.fallbackClient.getCacheStats();
    }
    
    return stats;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: string; details: any }> {
    const serviceStatus = this.fallbackManager.getServiceStatus();
    
    return {
      status: serviceStatus.isHealthy ? 'healthy' : 'degraded',
      details: {
        isHealthy: serviceStatus.isHealthy,
        availableProviders: serviceStatus.availableProviders,
        degradedMode: serviceStatus.degradedMode,
        notifications: serviceStatus.notifications.slice(0, 5), // Last 5 notifications
        uptime: serviceStatus.uptime,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.fallbackManager.destroy();
  }
} 