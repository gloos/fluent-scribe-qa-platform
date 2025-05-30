// LLM Client for API Communication

import { 
  LLMProvider, 
  LLMConfig, 
  LLMRequest, 
  LLMResponse, 
  LLMError,
  LLMPerformanceMetrics,
  LLMCacheEntry,
  LLMCacheConfig
} from '../types/llm-types';

export class LLMClient {
  private config: LLMConfig;
  private cache: Map<string, LLMCacheEntry> = new Map();
  private cacheConfig: LLMCacheConfig;
  private metrics: LLMPerformanceMetrics;

  constructor(config: LLMConfig, cacheConfig?: LLMCacheConfig) {
    this.config = config;
    this.cacheConfig = cacheConfig || {
      enabled: true,
      ttl: 3600,
      maxSize: 1000,
      strategy: 'lru'
    };
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      errorRate: 0,
      tokenUsage: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0
      },
      costEstimate: 0,
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      }
    };
  }

  public async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check cache first
      if (this.cacheConfig.enabled) {
        const cachedResponse = this.getCachedResponse(request);
        if (cachedResponse) {
          this.updateCacheHit(cachedResponse);
          return cachedResponse.response;
        }
      }

      // Make API request based on provider
      const response = await this.makeProviderRequest(request, requestId);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, response, false);

      // Cache response
      if (this.cacheConfig.enabled) {
        this.cacheResponse(request, response);
      }

      return response;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, null, true);
      
      if (error instanceof Error) {
        throw this.createLLMError(error, requestId);
      }
      throw error;
    }
  }

  private async makeProviderRequest(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    switch (this.config.provider) {
      case LLMProvider.OPENAI:
        return this.makeOpenAIRequest(request, requestId);
      case LLMProvider.ANTHROPIC:
        return this.makeAnthropicRequest(request, requestId);
      case LLMProvider.GOOGLE:
        return this.makeGoogleRequest(request, requestId);
      case LLMProvider.AZURE_OPENAI:
        return this.makeAzureOpenAIRequest(request, requestId);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async makeOpenAIRequest(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: this.config.model,
      messages: [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        ...(request.context ? [{ role: 'user', content: request.context }] : []),
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Request-ID': requestId
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      provider: LLMProvider.OPENAI,
      timestamp: new Date().toISOString(),
      requestId,
      metadata: request.metadata
    };
  }

  private async makeAnthropicRequest(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/v1/messages`;
    
    const messages = [
      ...(request.context ? [{ role: 'user', content: request.context }] : []),
      { role: 'user', content: request.prompt }
    ];

    const body = {
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      system: request.systemPrompt,
      messages
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model,
      provider: LLMProvider.ANTHROPIC,
      timestamp: new Date().toISOString(),
      requestId,
      metadata: request.metadata
    };
  }

  private async makeGoogleRequest(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    const prompt = [
      request.systemPrompt,
      request.context,
      request.prompt
    ].filter(Boolean).join('\n\n');

    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens
      }
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Google API error: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: this.config.model,
      provider: LLMProvider.GOOGLE,
      timestamp: new Date().toISOString(),
      requestId,
      metadata: request.metadata
    };
  }

  private async makeAzureOpenAIRequest(request: LLMRequest, requestId: string): Promise<LLMResponse> {
    // Azure OpenAI uses a different URL structure
    const url = `${this.config.baseUrl}/openai/deployments/${this.config.model}/chat/completions?api-version=2024-02-15-preview`;
    
    const body = {
      messages: [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        ...(request.context ? [{ role: 'user', content: request.context }] : []),
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
        'X-Request-ID': requestId
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: this.config.model,
      provider: LLMProvider.AZURE_OPENAI,
      timestamp: new Date().toISOString(),
      requestId,
      metadata: request.metadata
    };
  }

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= (this.config.retryAttempts || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Retry on 429 (rate limit) or 5xx errors
        if (response.status === 429 || response.status >= 500) {
          if (attempt < (this.config.retryAttempts || 3)) {
            await this.delay((this.config.retryDelay || 1000) * Math.pow(2, attempt));
            continue;
          }
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < (this.config.retryAttempts || 3)) {
          await this.delay((this.config.retryDelay || 1000) * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLLMError(error: Error, requestId: string): LLMError {
    return {
      code: 'LLM_REQUEST_FAILED',
      message: error.message,
      provider: this.config.provider,
      retryable: true,
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  // Cache management
  private getCacheKey(request: LLMRequest): string {
    const key = {
      provider: this.config.provider,
      model: this.config.model,
      prompt: request.prompt,
      context: request.context,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature ?? this.config.temperature,
      maxTokens: request.maxTokens ?? this.config.maxTokens
    };
    return btoa(JSON.stringify(key));
  }

  private getCachedResponse(request: LLMRequest): LLMCacheEntry | null {
    const key = this.getCacheKey(request);
    const entry = this.cache.get(key);
    
    if (entry && new Date(entry.expiresAt) > new Date()) {
      return entry;
    }
    
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  private cacheResponse(request: LLMRequest, response: LLMResponse): void {
    if (this.cache.size >= this.cacheConfig.maxSize) {
      this.evictCacheEntry();
    }

    const key = this.getCacheKey(request);
    const expiresAt = new Date(Date.now() + this.cacheConfig.ttl * 1000);

    this.cache.set(key, {
      key,
      request,
      response,
      timestamp: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0
    });
  }

  private updateCacheHit(entry: LLMCacheEntry): void {
    entry.hitCount++;
  }

  private evictCacheEntry(): void {
    if (this.cache.size === 0) return;

    switch (this.cacheConfig.strategy) {
      case 'lru':
        // Remove oldest entry
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
        break;
      case 'lfu':
        // Remove least frequently used entry
        let leastUsedKey = '';
        let leastHits = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.hitCount < leastHits) {
            leastHits = entry.hitCount;
            leastUsedKey = key;
          }
        }
        this.cache.delete(leastUsedKey);
        break;
      case 'fifo':
      default:
        // Remove first entry
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
        break;
    }
  }

  // Metrics
  private updateMetrics(latency: number, response: LLMResponse | null, isError: boolean): void {
    this.metrics.requestCount++;
    this.metrics.totalLatency += latency;
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.requestCount;
    
    if (isError) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestCount - 1) + 1) / this.metrics.requestCount;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestCount - 1)) / this.metrics.requestCount;
    }

    if (response?.usage) {
      this.metrics.tokenUsage.totalPromptTokens += response.usage.promptTokens;
      this.metrics.tokenUsage.totalCompletionTokens += response.usage.completionTokens;
      this.metrics.tokenUsage.totalTokens += response.usage.totalTokens;
    }

    this.metrics.period.end = new Date().toISOString();
  }

  public getMetrics(): LLMPerformanceMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.initializeMetrics();
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; hitRate: number } {
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hitCount, 0);
    const hitRate = this.metrics.requestCount > 0 ? totalHits / this.metrics.requestCount : 0;
    
    return {
      size: this.cache.size,
      hitRate
    };
  }
} 