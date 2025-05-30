// Enhanced Fallback Manager for LLM Services

import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMError,
  FallbackConfig,
  FallbackResult,
  FallbackNotification,
  HealthMonitoringMetrics,
  QualityAssessmentResponse,
  LinguisticAnalysisResponse,
  ParsedResponse
} from '../types/llm-types';

import { HealthMonitor } from './health-monitor';
import { DefaultResponseProvider } from './default-responses';
import { LLMClient } from '../clients/LLMClient';
import { LLMConfig } from '../config/LLMConfig';

export class FallbackManager {
  private healthMonitor: HealthMonitor;
  private defaultResponseProvider: DefaultResponseProvider;
  private config: FallbackConfig;
  private configManager: LLMConfig;
  private clients: Map<LLMProvider, LLMClient> = new Map();
  private notifications: FallbackNotification[] = [];

  constructor(config: Partial<FallbackConfig> = {}) {
    this.configManager = LLMConfig.getInstance();
    
    // Initialize with default config
    this.config = {
      enableCircuitBreaker: true,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        halfOpenMaxRequests: 3
      },
      healthCheckInterval: 60000, // 1 minute
      fallbackChain: [
        LLMProvider.OPENAI,
        LLMProvider.ANTHROPIC,
        LLMProvider.GOOGLE,
        LLMProvider.AZURE_OPENAI
      ],
      defaultResponses: {},
      degradedModeConfig: {
        enableOfflineMode: true,
        cacheOnlyMode: false,
        reduceComplexity: true
      },
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        exponentialFactor: 2
      },
      ...config
    };

    this.initializeServices();
  }

  /**
   * Initialize all fallback services
   */
  private initializeServices(): void {
    const availableProviders = this.configManager.getAvailableProviders();
    
    // Filter fallback chain to only include available providers
    this.config.fallbackChain = this.config.fallbackChain.filter(provider => 
      availableProviders.includes(provider)
    );

    // Initialize health monitor
    this.healthMonitor = new HealthMonitor(
      this.config.fallbackChain,
      this.config.healthCheckInterval
    );

    // Initialize default response provider
    this.defaultResponseProvider = DefaultResponseProvider.getInstance();

    // Initialize clients for each provider
    this.initializeClients();

    // Start health monitoring
    this.healthMonitor.startMonitoring();
  }

  /**
   * Initialize LLM clients for each provider
   */
  private initializeClients(): void {
    this.config.fallbackChain.forEach(provider => {
      const providerConfig = this.configManager.getConfig(provider);
      if (providerConfig) {
        const client = new LLMClient(providerConfig, this.configManager.getCacheConfig());
        this.clients.set(provider, client);
      }
    });
  }

  /**
   * Send request with comprehensive fallback support
   */
  public async sendRequestWithFallback<T = any>(
    request: LLMRequest,
    requestType: string = 'general'
  ): Promise<FallbackResult<T>> {
    const healthyProviders = this.healthMonitor.getHealthyProviders();
    
    // If no providers are healthy, return default response
    if (healthyProviders.length === 0) {
      return this.handleCompleteServiceFailure<T>(request, requestType);
    }

    // Try each healthy provider in order
    for (let i = 0; i < healthyProviders.length; i++) {
      const provider = healthyProviders[i];
      
      try {
        const startTime = Date.now();
        const client = this.clients.get(provider);
        
        if (!client) {
          continue; // Skip if client not available
        }

        // Check if we can use this provider (circuit breaker)
        if (!this.healthMonitor.canUseProvider(provider)) {
          continue;
        }

        const response = await this.executeWithRetry(client, request, provider);
        const responseTime = Date.now() - startTime;

        // Record success
        this.healthMonitor.recordSuccess(provider, responseTime);

        return {
          data: response.content as T,
          provider,
          wasFromFallback: i > 0,
          fallbackLevel: i,
          degradedMode: false,
          fromCache: false,
          warnings: i > 0 ? [`Primary provider unavailable, using ${provider}`] : undefined
        };

      } catch (error) {
        const llmError: LLMError = {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          provider,
          retryable: true,
          timestamp: new Date().toISOString()
        };

        // Record failure
        this.healthMonitor.recordFailure(provider, llmError);

        // Log the failure attempt
        console.warn(`Provider ${provider} failed (attempt ${i + 1}):`, error);

        // Continue to next provider
        continue;
      }
    }

    // All providers failed, return default response
    return this.handleCompleteServiceFailure<T>(request, requestType);
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    client: LLMClient,
    request: LLMRequest,
    provider: LLMProvider
  ): Promise<LLMResponse> {
    const { maxRetries, baseDelay, exponentialFactor, maxDelay } = this.config.retryConfig;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await client.sendRequest(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelay * Math.pow(exponentialFactor, attempt),
          maxDelay
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Handle complete service failure with default responses
   */
  private handleCompleteServiceFailure<T>(
    request: LLMRequest,
    requestType: string
  ): FallbackResult<T> {
    this.addNotification({
      type: 'degraded_mode',
      severity: 'error',
      message: 'All LLM services unavailable, using default responses',
      timestamp: new Date().toISOString(),
      metadata: { requestType }
    });

    // Return appropriate default response based on request type
    let defaultResponse: ParsedResponse<any>;

    switch (requestType) {
      case 'quality_assessment':
        defaultResponse = this.defaultResponseProvider.getDefaultQualityAssessment('', '');
        break;
      case 'linguistic_analysis':
        defaultResponse = this.defaultResponseProvider.getDefaultLinguisticAnalysis('', 'en', ['grammar']);
        break;
      case 'error_detection':
        defaultResponse = this.defaultResponseProvider.getDefaultErrorDetection();
        break;
      case 'fluency_assessment':
        defaultResponse = this.defaultResponseProvider.getDefaultFluencyAssessment();
        break;
      case 'adequacy_assessment':
        defaultResponse = this.defaultResponseProvider.getDefaultAdequacyAssessment();
        break;
      case 'mqm_assessment':
        defaultResponse = this.defaultResponseProvider.getDefaultMQMAssessment();
        break;
      default:
        // Generic default response
        defaultResponse = {
          success: false,
          error: 'All LLM services are currently unavailable',
          confidence: 0,
          metadata: { defaultResponse: true }
        };
    }

    return {
      data: defaultResponse.data as T,
      provider: LLMProvider.OPENAI, // Fallback to first provider for tracking
      wasFromFallback: true,
      fallbackLevel: 999, // Special level for complete failure
      degradedMode: true,
      fromCache: false,
      warnings: [
        'All LLM services unavailable',
        'Default response provided',
        'Manual review recommended'
      ]
    };
  }

  /**
   * Get quality assessment with fallback
   */
  public async getQualityAssessmentWithFallback(
    sourceText: string,
    targetText: string,
    context?: string
  ): Promise<FallbackResult<QualityAssessmentResponse>> {
    const request: LLMRequest = {
      prompt: `Assess the quality of this translation:\n\nSource: ${sourceText}\nTarget: ${targetText}${context ? `\nContext: ${context}` : ''}`,
      systemPrompt: 'You are a professional translation quality assessor.',
      temperature: 0.1,
      maxTokens: 2048,
      metadata: { assessmentType: 'quality_assessment' }
    };

    return this.sendRequestWithFallback<QualityAssessmentResponse>(request, 'quality_assessment');
  }

  /**
   * Get linguistic analysis with fallback
   */
  public async getLinguisticAnalysisWithFallback(
    text: string,
    language: string,
    analysisTypes: Array<'grammar' | 'style' | 'terminology' | 'consistency' | 'fluency'>
  ): Promise<FallbackResult<LinguisticAnalysisResponse>> {
    const request: LLMRequest = {
      prompt: `Perform linguistic analysis on this ${language} text: ${text}\nAnalysis types: ${analysisTypes.join(', ')}`,
      systemPrompt: 'You are a linguistic analysis expert.',
      temperature: 0.1,
      maxTokens: 2048,
      metadata: { analysisType: 'linguistic_analysis', language, analysisTypes }
    };

    return this.sendRequestWithFallback<LinguisticAnalysisResponse>(request, 'linguistic_analysis');
  }

  /**
   * Get health metrics
   */
  public getHealthMetrics(): HealthMonitoringMetrics {
    return this.healthMonitor.getHealthMetrics();
  }

  /**
   * Get service status summary
   */
  public getServiceStatus(): {
    isHealthy: boolean;
    availableProviders: LLMProvider[];
    degradedMode: boolean;
    notifications: FallbackNotification[];
    uptime: Record<LLMProvider, number>;
  } {
    const metrics = this.healthMonitor.getHealthMetrics();
    const healthyProviders = this.healthMonitor.getHealthyProviders();
    
    const uptime: Record<LLMProvider, number> = {} as Record<LLMProvider, number>;
    Object.entries(metrics.providers).forEach(([provider, status]) => {
      uptime[provider as LLMProvider] = status.availability;
    });

    return {
      isHealthy: healthyProviders.length > 0,
      availableProviders: healthyProviders,
      degradedMode: healthyProviders.length === 0,
      notifications: this.notifications.slice(-10), // Last 10 notifications
      uptime
    };
  }

  /**
   * Force provider recovery (for testing/admin)
   */
  public forceProviderRecovery(provider: LLMProvider): void {
    this.healthMonitor.resetProviderHealth(provider);
    
    this.addNotification({
      type: 'service_recovery',
      severity: 'info',
      message: `Provider ${provider} manually recovered`,
      provider,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add notification
   */
  private addNotification(notification: FallbackNotification): void {
    this.notifications.push(notification);
    
    // Keep only recent notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(-100);
    }
  }

  /**
   * Get recent notifications
   */
  public getNotifications(limit: number = 20): FallbackNotification[] {
    return this.notifications.slice(-limit);
  }

  /**
   * Check if system is in degraded mode
   */
  public isDegraded(): boolean {
    return this.healthMonitor.getHealthyProviders().length === 0;
  }

  /**
   * Get user-friendly service degradation notice
   */
  public getServiceDegradationNotice() {
    return this.defaultResponseProvider.createServiceDegradationNotice();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.healthMonitor.stopMonitoring();
    this.clients.clear();
    this.notifications = [];
  }
} 