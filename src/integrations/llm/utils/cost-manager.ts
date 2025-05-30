// Cost Management System for LLM Services

import { 
  LLMProvider, 
  LLMModel, 
  LLMResponse,
  LLMRequest,
  LLMPerformanceMetrics 
} from '../types/llm-types';

export interface CostConfig {
  dailyLimit: number;
  monthlyLimit: number;
  alertThresholds: number[]; // Percentage thresholds (e.g., [50, 75, 90])
  enableOptimization: boolean;
  enableAutoScaling: boolean;
  costTrackingEnabled: boolean;
  budgetNotifications: boolean;
}

export interface PricingModel {
  provider: LLMProvider;
  model: LLMModel;
  inputTokenPrice: number; // Price per 1K input tokens
  outputTokenPrice: number; // Price per 1K output tokens
  currency: string;
  effectiveDate: string;
}

export interface CostAlert {
  id: string;
  type: 'threshold' | 'limit' | 'spike' | 'quota';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentSpend: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface UsageQuota {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'total';
  limit: number; // Dollar amount
  currentUsage: number;
  resetDate: string;
  status: 'active' | 'exceeded' | 'warning' | 'disabled';
  actions: QuotaAction[];
}

export interface QuotaAction {
  trigger: 'warning' | 'limit';
  action: 'alert' | 'throttle' | 'block' | 'fallback';
  threshold: number; // Percentage of quota
  enabled: boolean;
}

export interface CostBreakdown {
  provider: LLMProvider;
  model: LLMModel;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  averageCostPerRequest: number;
  timeframe: {
    start: string;
    end: string;
  };
}

export interface CostOptimization {
  recommendationType: 'model' | 'provider' | 'prompt' | 'batching' | 'caching';
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  implementation: string[];
}

export interface CostMetrics {
  totalSpend: number;
  dailySpend: number;
  monthlySpend: number;
  averageCostPerRequest: number;
  mostExpensiveProvider: LLMProvider;
  mostExpensiveModel: LLMModel;
  costTrend: 'increasing' | 'decreasing' | 'stable';
  efficiency: number; // Cost per useful token
  breakdown: CostBreakdown[];
  alerts: CostAlert[];
  quotas: UsageQuota[];
  optimizations: CostOptimization[];
  lastUpdated: string;
}

export class CostManager {
  private config: CostConfig;
  private pricingModels: Map<string, PricingModel> = new Map();
  private usageHistory: Array<{
    timestamp: string;
    provider: LLMProvider;
    model: LLMModel;
    cost: number;
    tokens: { input: number; output: number; total: number };
    request: Partial<LLMRequest>;
  }> = [];
  private quotas: Map<string, UsageQuota> = new Map();
  private alerts: CostAlert[] = [];
  private optimizationCache: Map<string, CostOptimization[]> = new Map();

  constructor(config: Partial<CostConfig> = {}) {
    this.config = {
      dailyLimit: 50.0, // $50 per day
      monthlyLimit: 1000.0, // $1000 per month
      alertThresholds: [50, 75, 90, 95],
      enableOptimization: true,
      enableAutoScaling: false,
      costTrackingEnabled: true,
      budgetNotifications: true,
      ...config
    };

    this.initializePricingModels();
    this.initializeDefaultQuotas();
  }

  private initializePricingModels(): void {
    // OpenAI Pricing (as of 2024)
    this.addPricingModel({
      provider: LLMProvider.OPENAI,
      model: LLMModel.GPT_4_TURBO,
      inputTokenPrice: 0.01, // $0.01 per 1K input tokens
      outputTokenPrice: 0.03, // $0.03 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });

    this.addPricingModel({
      provider: LLMProvider.OPENAI,
      model: LLMModel.GPT_4,
      inputTokenPrice: 0.03, // $0.03 per 1K input tokens
      outputTokenPrice: 0.06, // $0.06 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });

    this.addPricingModel({
      provider: LLMProvider.OPENAI,
      model: LLMModel.GPT_3_5_TURBO,
      inputTokenPrice: 0.0015, // $0.0015 per 1K input tokens
      outputTokenPrice: 0.002, // $0.002 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });

    // Anthropic Pricing
    this.addPricingModel({
      provider: LLMProvider.ANTHROPIC,
      model: LLMModel.CLAUDE_3_SONNET,
      inputTokenPrice: 0.003, // $0.003 per 1K input tokens
      outputTokenPrice: 0.015, // $0.015 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });

    this.addPricingModel({
      provider: LLMProvider.ANTHROPIC,
      model: LLMModel.CLAUDE_3_HAIKU,
      inputTokenPrice: 0.00025, // $0.00025 per 1K input tokens
      outputTokenPrice: 0.00125, // $0.00125 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });

    // Google Pricing
    this.addPricingModel({
      provider: LLMProvider.GOOGLE,
      model: LLMModel.GEMINI_PRO,
      inputTokenPrice: 0.0005, // $0.0005 per 1K input tokens
      outputTokenPrice: 0.0015, // $0.0015 per 1K output tokens
      currency: 'USD',
      effectiveDate: '2024-01-01'
    });
  }

  private initializeDefaultQuotas(): void {
    // Daily quota
    this.addQuota({
      id: 'daily-quota',
      name: 'Daily Spending Limit',
      type: 'daily',
      limit: this.config.dailyLimit,
      currentUsage: 0,
      resetDate: this.getNextResetDate('daily'),
      status: 'active',
      actions: [
        { trigger: 'warning', action: 'alert', threshold: 75, enabled: true },
        { trigger: 'limit', action: 'throttle', threshold: 90, enabled: true },
        { trigger: 'limit', action: 'block', threshold: 100, enabled: true }
      ]
    });

    // Monthly quota
    this.addQuota({
      id: 'monthly-quota',
      name: 'Monthly Spending Limit',
      type: 'monthly',
      limit: this.config.monthlyLimit,
      currentUsage: 0,
      resetDate: this.getNextResetDate('monthly'),
      status: 'active',
      actions: [
        { trigger: 'warning', action: 'alert', threshold: 80, enabled: true },
        { trigger: 'limit', action: 'fallback', threshold: 95, enabled: true },
        { trigger: 'limit', action: 'block', threshold: 100, enabled: true }
      ]
    });
  }

  private addPricingModel(model: PricingModel): void {
    const key = `${model.provider}-${model.model}`;
    this.pricingModels.set(key, model);
  }

  private addQuota(quota: UsageQuota): void {
    this.quotas.set(quota.id, quota);
  }

  /**
   * Calculate cost for a request/response pair
   */
  public calculateCost(
    provider: LLMProvider,
    model: LLMModel,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  ): number {
    const key = `${provider}-${model}`;
    const pricing = this.pricingModels.get(key);

    if (!pricing) {
      console.warn(`No pricing model found for ${provider}-${model}`);
      return 0;
    }

    const inputCost = (usage.promptTokens / 1000) * pricing.inputTokenPrice;
    const outputCost = (usage.completionTokens / 1000) * pricing.outputTokenPrice;

    return inputCost + outputCost;
  }

  /**
   * Track usage and cost for a request
   */
  public async trackUsage(
    provider: LLMProvider,
    model: LLMModel,
    response: LLMResponse,
    request?: Partial<LLMRequest>
  ): Promise<void> {
    if (!this.config.costTrackingEnabled || !response.usage) {
      return;
    }

    const cost = this.calculateCost(provider, model, response.usage);

    // Store usage record
    this.usageHistory.push({
      timestamp: new Date().toISOString(),
      provider,
      model,
      cost,
      tokens: {
        input: response.usage.promptTokens,
        output: response.usage.completionTokens,
        total: response.usage.totalTokens
      },
      request: request ? {
        prompt: request.prompt?.substring(0, 100), // Store truncated for debugging
        systemPrompt: request.systemPrompt?.substring(0, 50),
        temperature: request.temperature,
        maxTokens: request.maxTokens
      } : {}
    });

    // Update quotas
    await this.updateQuotas(cost);

    // Check for alerts
    await this.checkAlerts();

    // Clean old usage data (keep last 30 days)
    this.cleanOldUsageData();
  }

  /**
   * Update quota usage
   */
  private async updateQuotas(cost: number): Promise<void> {
    for (const [id, quota] of this.quotas) {
      if (quota.status === 'disabled') continue;

      // Check if quota needs reset
      if (new Date() >= new Date(quota.resetDate)) {
        quota.currentUsage = 0;
        quota.resetDate = this.getNextResetDate(quota.type);
        quota.status = 'active';
      }

      // Update usage
      quota.currentUsage += cost;

      // Check quota status
      const usagePercentage = (quota.currentUsage / quota.limit) * 100;

      // Update status and trigger actions
      if (usagePercentage >= 100) {
        quota.status = 'exceeded';
        await this.triggerQuotaActions(quota, 'limit');
      } else {
        // Check for warning thresholds
        for (const action of quota.actions) {
          if (action.trigger === 'warning' && 
              usagePercentage >= action.threshold && 
              quota.status !== 'warning') {
            quota.status = 'warning';
            await this.triggerQuotaActions(quota, 'warning');
            break;
          }
        }
      }
    }
  }

  /**
   * Trigger quota actions
   */
  private async triggerQuotaActions(quota: UsageQuota, trigger: 'warning' | 'limit'): Promise<void> {
    const actions = quota.actions.filter(a => a.trigger === trigger && a.enabled);

    for (const action of actions) {
      switch (action.action) {
        case 'alert':
          await this.createAlert({
            type: 'quota',
            severity: trigger === 'limit' ? 'critical' : 'medium',
            message: `Quota "${quota.name}" ${trigger} reached: ${quota.currentUsage.toFixed(2)}/${quota.limit.toFixed(2)} USD`,
            currentSpend: quota.currentUsage,
            threshold: quota.limit,
            metadata: { quotaId: quota.id, action: action.action }
          });
          break;

        case 'throttle':
          // Implement throttling logic (reduce request rate)
          console.warn(`Throttling enabled for quota: ${quota.name}`);
          break;

        case 'block':
          // Implement blocking logic (prevent new requests)
          console.error(`Requests blocked due to quota: ${quota.name}`);
          break;

        case 'fallback':
          // Switch to cheaper provider/model
          console.info(`Fallback activated for quota: ${quota.name}`);
          break;
      }
    }
  }

  /**
   * Check for cost alerts
   */
  private async checkAlerts(): Promise<void> {
    const currentMetrics = this.getCurrentMetrics();

    // Check threshold alerts
    for (const threshold of this.config.alertThresholds) {
      const dailyPercentage = (currentMetrics.dailySpend / this.config.dailyLimit) * 100;
      const monthlyPercentage = (currentMetrics.monthlySpend / this.config.monthlyLimit) * 100;

      if (dailyPercentage >= threshold && !this.hasRecentAlert('threshold', 'daily', threshold)) {
        await this.createAlert({
          type: 'threshold',
          severity: this.getSeverityFromThreshold(threshold),
          message: `Daily spending ${threshold}% threshold reached: $${currentMetrics.dailySpend.toFixed(2)}`,
          currentSpend: currentMetrics.dailySpend,
          threshold: this.config.dailyLimit,
          metadata: { type: 'daily', percentage: threshold }
        });
      }

      if (monthlyPercentage >= threshold && !this.hasRecentAlert('threshold', 'monthly', threshold)) {
        await this.createAlert({
          type: 'threshold',
          severity: this.getSeverityFromThreshold(threshold),
          message: `Monthly spending ${threshold}% threshold reached: $${currentMetrics.monthlySpend.toFixed(2)}`,
          currentSpend: currentMetrics.monthlySpend,
          threshold: this.config.monthlyLimit,
          metadata: { type: 'monthly', percentage: threshold }
        });
      }
    }

    // Check for cost spikes
    await this.checkCostSpikes();
  }

  /**
   * Check for unusual cost spikes
   */
  private async checkCostSpikes(): Promise<void> {
    const recentUsage = this.getRecentUsage(1); // Last hour
    const previousUsage = this.getRecentUsage(1, 1); // Previous hour

    if (recentUsage.length === 0 || previousUsage.length === 0) return;

    const recentCost = recentUsage.reduce((sum, record) => sum + record.cost, 0);
    const previousCost = previousUsage.reduce((sum, record) => sum + record.cost, 0);

    if (previousCost > 0) {
      const increasePercentage = ((recentCost - previousCost) / previousCost) * 100;
      
      if (increasePercentage > 200 && recentCost > 5) { // 200% increase and > $5
        await this.createAlert({
          type: 'spike',
          severity: 'high',
          message: `Cost spike detected: ${increasePercentage.toFixed(1)}% increase in last hour ($${recentCost.toFixed(2)})`,
          currentSpend: recentCost,
          threshold: previousCost,
          metadata: { increasePercentage, recentRequests: recentUsage.length }
        });
      }
    }
  }

  /**
   * Create cost alert
   */
  private async createAlert(alertData: Omit<CostAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: CostAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);

    // Trigger notification if enabled
    if (this.config.budgetNotifications) {
      await this.sendNotification(alert);
    }

    // Limit alerts history
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50); // Keep last 50 alerts
    }
  }

  /**
   * Generate cost optimization recommendations
   */
  public generateOptimizations(): CostOptimization[] {
    const cacheKey = `optimizations_${new Date().toDateString()}`;
    
    // Return cached optimizations if available
    if (this.optimizationCache.has(cacheKey)) {
      return this.optimizationCache.get(cacheKey)!;
    }

    const optimizations: CostOptimization[] = [];
    const currentMetrics = this.getCurrentMetrics();

    // Model optimization recommendations
    const modelOptimizations = this.analyzeModelUsage();
    optimizations.push(...modelOptimizations);

    // Prompt optimization recommendations
    const promptOptimizations = this.analyzePromptEfficiency();
    optimizations.push(...promptOptimizations);

    // Caching recommendations
    const cachingOptimizations = this.analyzeCachingOpportunities();
    optimizations.push(...cachingOptimizations);

    // Batching recommendations
    const batchingOptimizations = this.analyzeBatchingOpportunities();
    optimizations.push(...batchingOptimizations);

    // Cache the results
    this.optimizationCache.set(cacheKey, optimizations);

    return optimizations;
  }

  /**
   * Get current cost metrics
   */
  public getCurrentMetrics(): CostMetrics {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyUsage = this.usageHistory.filter(record => 
      new Date(record.timestamp) >= todayStart
    );
    const monthlyUsage = this.usageHistory.filter(record => 
      new Date(record.timestamp) >= monthStart
    );

    const dailySpend = dailyUsage.reduce((sum, record) => sum + record.cost, 0);
    const monthlySpend = monthlyUsage.reduce((sum, record) => sum + record.cost, 0);
    const totalSpend = this.usageHistory.reduce((sum, record) => sum + record.cost, 0);

    // Calculate breakdown by provider/model
    const breakdown = this.calculateCostBreakdown();

    // Find most expensive provider and model
    const mostExpensiveProvider = this.getMostExpensiveProvider(breakdown);
    const mostExpensiveModel = this.getMostExpensiveModel(breakdown);

    return {
      totalSpend,
      dailySpend,
      monthlySpend,
      averageCostPerRequest: this.usageHistory.length > 0 ? totalSpend / this.usageHistory.length : 0,
      mostExpensiveProvider,
      mostExpensiveModel,
      costTrend: this.calculateCostTrend(),
      efficiency: this.calculateEfficiency(),
      breakdown,
      alerts: [...this.alerts].reverse(), // Most recent first
      quotas: Array.from(this.quotas.values()),
      optimizations: this.generateOptimizations(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Helper methods
  private getNextResetDate(type: 'daily' | 'weekly' | 'monthly' | 'total'): string {
    const now = new Date();
    
    switch (type) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.toISOString();
      
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
        nextWeek.setHours(0, 0, 0, 0);
        return nextWeek.toISOString();
      
      case 'monthly':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toISOString();
      
      default:
        return new Date(2099, 11, 31).toISOString();
    }
  }

  private hasRecentAlert(type: string, subType: string, threshold: number): boolean {
    const recentThreshold = Date.now() - (30 * 60 * 1000); // 30 minutes
    return this.alerts.some(alert => 
      alert.type === type &&
      alert.metadata?.type === subType &&
      alert.metadata?.percentage === threshold &&
      new Date(alert.timestamp).getTime() > recentThreshold
    );
  }

  private getSeverityFromThreshold(threshold: number): CostAlert['severity'] {
    if (threshold >= 95) return 'critical';
    if (threshold >= 85) return 'high';
    if (threshold >= 70) return 'medium';
    return 'low';
  }

  private getRecentUsage(hours: number, offsetHours: number = 0): typeof this.usageHistory {
    const now = Date.now();
    const startTime = now - ((hours + offsetHours) * 60 * 60 * 1000);
    const endTime = now - (offsetHours * 60 * 60 * 1000);

    return this.usageHistory.filter(record => {
      const timestamp = new Date(record.timestamp).getTime();
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  private cleanOldUsageData(): void {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.usageHistory = this.usageHistory.filter(record => 
      new Date(record.timestamp).getTime() > thirtyDaysAgo
    );
  }

  private async sendNotification(alert: CostAlert): Promise<void> {
    // Implementation would depend on notification system
    console.log(`COST ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
  }

  private analyzeModelUsage(): CostOptimization[] {
    // Analyze if cheaper models could be used
    return [];
  }

  private analyzePromptEfficiency(): CostOptimization[] {
    // Analyze prompt length and suggest optimizations
    return [];
  }

  private analyzeCachingOpportunities(): CostOptimization[] {
    // Identify repeated requests that could be cached
    return [];
  }

  private analyzeBatchingOpportunities(): CostOptimization[] {
    // Identify opportunities for request batching
    return [];
  }

  private calculateCostBreakdown(): CostBreakdown[] {
    // Group usage by provider and model
    return [];
  }

  private getMostExpensiveProvider(breakdown: CostBreakdown[]): LLMProvider {
    return LLMProvider.OPENAI; // Placeholder
  }

  private getMostExpensiveModel(breakdown: CostBreakdown[]): LLMModel {
    return LLMModel.GPT_4; // Placeholder
  }

  private calculateCostTrend(): 'increasing' | 'decreasing' | 'stable' {
    return 'stable'; // Placeholder
  }

  private calculateEfficiency(): number {
    return 0.85; // Placeholder
  }

  /**
   * Check if request should be allowed based on quotas
   */
  public async checkRequestAllowed(): Promise<{ allowed: boolean; reason?: string }> {
    for (const [id, quota] of this.quotas) {
      if (quota.status === 'exceeded') {
        const blockAction = quota.actions.find(a => a.action === 'block' && a.enabled);
        if (blockAction) {
          return {
            allowed: false,
            reason: `Request blocked: ${quota.name} exceeded`
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Get quota information
   */
  public getQuotas(): UsageQuota[] {
    return Array.from(this.quotas.values());
  }

  /**
   * Update quota limits
   */
  public updateQuota(id: string, updates: Partial<UsageQuota>): boolean {
    const quota = this.quotas.get(id);
    if (!quota) return false;

    Object.assign(quota, updates);
    return true;
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    return true;
  }
} 