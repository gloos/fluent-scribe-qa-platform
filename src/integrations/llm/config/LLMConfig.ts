// LLM Configuration Management

import { LLMProvider, LLMModel, LLMConfig as ILLMConfig, LLMCacheConfig } from '../types/llm-types';

export class LLMConfig {
  private static instance: LLMConfig;
  private config: Map<LLMProvider, ILLMConfig> = new Map();
  private cacheConfig: LLMCacheConfig;

  private constructor() {
    this.loadConfiguration();
    this.cacheConfig = this.loadCacheConfiguration();
  }

  public static getInstance(): LLMConfig {
    if (!LLMConfig.instance) {
      LLMConfig.instance = new LLMConfig();
    }
    return LLMConfig.instance;
  }

  private loadConfiguration(): void {
    // Load OpenAI configuration
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      this.config.set(LLMProvider.OPENAI, {
        provider: LLMProvider.OPENAI,
        model: LLMModel.GPT_4_TURBO,
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
        temperature: 0.1,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      });
    }

    // Load Anthropic configuration
    if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
      this.config.set(LLMProvider.ANTHROPIC, {
        provider: LLMProvider.ANTHROPIC,
        model: LLMModel.CLAUDE_3_SONNET,
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        baseUrl: import.meta.env.VITE_ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        temperature: 0.1,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      });
    }

    // Load Google configuration
    if (import.meta.env.VITE_GOOGLE_API_KEY) {
      this.config.set(LLMProvider.GOOGLE, {
        provider: LLMProvider.GOOGLE,
        model: LLMModel.GEMINI_PRO,
        apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
        baseUrl: import.meta.env.VITE_GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com/v1',
        temperature: 0.1,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      });
    }

    // Load Azure OpenAI configuration
    if (import.meta.env.VITE_AZURE_OPENAI_API_KEY && import.meta.env.VITE_AZURE_OPENAI_ENDPOINT) {
      this.config.set(LLMProvider.AZURE_OPENAI, {
        provider: LLMProvider.AZURE_OPENAI,
        model: LLMModel.GPT_4,
        apiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY,
        baseUrl: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT,
        temperature: 0.1,
        maxTokens: 4096,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      });
    }
  }

  private loadCacheConfiguration(): LLMCacheConfig {
    return {
      enabled: import.meta.env.VITE_LLM_CACHE_ENABLED === 'true' || true,
      ttl: parseInt(import.meta.env.VITE_LLM_CACHE_TTL) || 3600, // 1 hour
      maxSize: parseInt(import.meta.env.VITE_LLM_CACHE_MAX_SIZE) || 1000,
      strategy: (import.meta.env.VITE_LLM_CACHE_STRATEGY as 'lru' | 'fifo' | 'lfu') || 'lru'
    };
  }

  public getConfig(provider: LLMProvider): ILLMConfig | undefined {
    return this.config.get(provider);
  }

  public getDefaultProvider(): LLMProvider {
    // Priority order: OpenAI > Anthropic > Google > Azure OpenAI
    const providers = [LLMProvider.OPENAI, LLMProvider.ANTHROPIC, LLMProvider.GOOGLE, LLMProvider.AZURE_OPENAI];
    
    for (const provider of providers) {
      if (this.config.has(provider)) {
        return provider;
      }
    }
    
    throw new Error('No LLM provider configured. Please set at least one API key in environment variables.');
  }

  public getAvailableProviders(): LLMProvider[] {
    return Array.from(this.config.keys());
  }

  public updateConfig(provider: LLMProvider, config: Partial<ILLMConfig>): void {
    const existingConfig = this.config.get(provider);
    if (existingConfig) {
      this.config.set(provider, { ...existingConfig, ...config });
    }
  }

  public getCacheConfig(): LLMCacheConfig {
    return this.cacheConfig;
  }

  public updateCacheConfig(config: Partial<LLMCacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  public validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.size === 0) {
      errors.push('No LLM providers configured. Please set at least one API key.');
    }

    for (const [provider, config] of this.config) {
      if (!config.apiKey) {
        errors.push(`Missing API key for ${provider}`);
      }

      if (!config.baseUrl) {
        errors.push(`Missing base URL for ${provider}`);
      }

      if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
        errors.push(`Invalid temperature for ${provider}. Must be between 0 and 2.`);
      }

      if (config.maxTokens !== undefined && config.maxTokens <= 0) {
        errors.push(`Invalid maxTokens for ${provider}. Must be greater than 0.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getConfigSummary(): Record<LLMProvider, { model: string; hasApiKey: boolean; baseUrl: string }> {
    const summary: Record<string, any> = {};

    for (const [provider, config] of this.config) {
      summary[provider] = {
        model: config.model,
        hasApiKey: !!config.apiKey,
        baseUrl: config.baseUrl
      };
    }

    return summary;
  }

  // Environment variable helpers
  public static getRequiredEnvVars(): Record<LLMProvider, string[]> {
    return {
      [LLMProvider.OPENAI]: ['VITE_OPENAI_API_KEY'],
      [LLMProvider.ANTHROPIC]: ['VITE_ANTHROPIC_API_KEY'],
      [LLMProvider.GOOGLE]: ['VITE_GOOGLE_API_KEY'],
      [LLMProvider.AZURE_OPENAI]: ['VITE_AZURE_OPENAI_API_KEY', 'VITE_AZURE_OPENAI_ENDPOINT'],
      [LLMProvider.HUGGING_FACE]: ['VITE_HUGGING_FACE_API_KEY']
    };
  }

  public static getOptionalEnvVars(): string[] {
    return [
      'VITE_OPENAI_BASE_URL',
      'VITE_ANTHROPIC_BASE_URL',
      'VITE_GOOGLE_BASE_URL',
      'VITE_LLM_CACHE_ENABLED',
      'VITE_LLM_CACHE_TTL',
      'VITE_LLM_CACHE_MAX_SIZE',
      'VITE_LLM_CACHE_STRATEGY'
    ];
  }
} 