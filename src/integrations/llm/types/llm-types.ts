// LLM Integration Type Definitions

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  AZURE_OPENAI = 'azure_openai',
  HUGGING_FACE = 'hugging_face'
}

export enum LLMModel {
  // OpenAI models
  GPT_4_TURBO = 'gpt-4-turbo-preview',
  GPT_4 = 'gpt-4',
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  
  // Anthropic models
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
  
  // Google models
  GEMINI_PRO = 'gemini-pro',
  GEMINI_PRO_VISION = 'gemini-pro-vision'
}

export interface LLMConfig {
  provider: LLMProvider;
  model: LLMModel;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface LLMRequest {
  prompt: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: LLMProvider;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface LLMError {
  code: string;
  message: string;
  provider: LLMProvider;
  statusCode?: number;
  retryable: boolean;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

// Quality Assessment specific types
export interface QualityAssessmentRequest {
  sourceText: string;
  targetText: string;
  context?: string;
  criteria?: string[];
  framework?: string;
  language?: {
    source: string;
    target: string;
  };
  metadata?: Record<string, any>;
}

export interface QualityAssessmentResponse {
  overallScore: number;
  fluencyScore: number;
  adequacyScore: number;
  confidence: number;
  
  errors: Array<{
    type: string;
    severity: 'minor' | 'major' | 'critical';
    description: string;
    suggestion?: string;
    position?: {
      start: number;
      end: number;
    };
    confidence: number;
  }>;
  
  suggestions: Array<{
    type: string;
    text: string;
    confidence: number;
    reasoning?: string;
  }>;
  
  metrics: {
    wordCount: number;
    characterCount: number;
    consistencyScore?: number;
    terminologyAdherence?: number;
  };
  
  reasoning: string;
  metadata?: Record<string, any>;
}

export interface LinguisticAnalysisRequest {
  text: string;
  language: string;
  analysisTypes: Array<'grammar' | 'style' | 'terminology' | 'consistency' | 'fluency'>;
  context?: string;
  metadata?: Record<string, any>;
}

export interface LinguisticAnalysisResponse {
  language: string;
  
  grammar: {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      suggestion: string;
      position: { start: number; end: number };
      confidence: number;
    }>;
  };
  
  style: {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      suggestion: string;
      confidence: number;
    }>;
  };
  
  terminology: {
    score: number;
    issues: Array<{
      term: string;
      suggestion: string;
      confidence: number;
      category: string;
    }>;
  };
  
  consistency: {
    score: number;
    inconsistencies: Array<{
      type: string;
      instances: string[];
      suggestion: string;
    }>;
  };
  
  fluency: {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      suggestion: string;
      confidence: number;
    }>;
  };
  
  overallScore: number;
  metadata?: Record<string, any>;
}

// Prompt template types
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'quality_assessment' | 'linguistic_analysis' | 'error_detection' | 'general';
  version: string;
  metadata?: Record<string, any>;
}

// Response parsing types
export interface ParsedResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

// Performance monitoring types
export interface LLMPerformanceMetrics {
  requestCount: number;
  totalLatency: number;
  averageLatency: number;
  errorRate: number;
  tokenUsage: {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
  };
  costEstimate: number;
  period: {
    start: string;
    end: string;
  };
}

// Cache types
export interface LLMCacheEntry {
  key: string;
  request: LLMRequest;
  response: LLMResponse;
  timestamp: string;
  expiresAt: string;
  hitCount: number;
}

export interface LLMCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries
  strategy: 'lru' | 'fifo' | 'lfu';
}

// Enhanced Fallback System Types
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting recovery
  monitoringPeriod: number; // Time window for tracking failures
  halfOpenMaxRequests: number; // Max requests to test in half-open state
}

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailure?: string;
  nextAttemptTime?: string;
  totalRequests: number;
  successRate: number;
}

export interface ProviderHealthStatus {
  provider: LLMProvider;
  isHealthy: boolean;
  lastHealthCheck: string;
  responseTime: number;
  errorRate: number;
  consecutiveFailures: number;
  circuitBreaker: CircuitBreakerStatus;
  availability: number; // Percentage over monitoring period
}

export interface FallbackConfig {
  enableCircuitBreaker: boolean;
  circuitBreaker: CircuitBreakerConfig;
  healthCheckInterval: number; // ms between health checks
  fallbackChain: LLMProvider[]; // Ordered list of fallback providers
  defaultResponses: Record<string, string>; // Default responses by assessment type
  degradedModeConfig: {
    enableOfflineMode: boolean;
    cacheOnlyMode: boolean;
    reduceComplexity: boolean;
  };
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    exponentialFactor: number;
  };
}

export interface FallbackResult<T = any> {
  data: T;
  provider: LLMProvider;
  wasFromFallback: boolean;
  fallbackLevel: number; // 0 = primary, 1+ = fallback level
  degradedMode: boolean;
  fromCache: boolean;
  warnings?: string[];
}

export interface HealthMonitoringMetrics {
  providers: Partial<Record<LLMProvider, ProviderHealthStatus>>;
  globalStats: {
    totalRequests: number;
    successfulRequests: number;
    globalSuccessRate: number;
    averageResponseTime: number;
    lastUpdated: string;
  };
  alerts: FallbackNotification[];
}

export interface DefaultAssessmentResponses {
  quality_assessment: QualityAssessmentResponse;
  linguistic_analysis: LinguisticAnalysisResponse;
  error_detection: Array<{
    type: string;
    severity: 'minor' | 'major' | 'critical';
    description: string;
    confidence: number;
  }>;
  fluency_assessment: {
    score: number;
    issues: any[];
    confidence: number;
  };
  adequacy_assessment: {
    score: number;
    issues: any[];
    confidence: number;
  };
  mqm_assessment: {
    score: number;
    errors: any[];
    confidence: number;
  };
}

export interface FallbackNotification {
  type: 'provider_failure' | 'circuit_open' | 'degraded_mode' | 'service_recovery';
  severity: 'info' | 'warning' | 'error';
  message: string;
  provider?: LLMProvider;
  timestamp: string;
  metadata?: Record<string, any>;
} 