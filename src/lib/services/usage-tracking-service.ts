import { createClient } from '@supabase/supabase-js';
import type { 
  BillingUsageRecord, 
  BillingSubscription, 
  RecordUsageRequest 
} from '@/lib/types/billing';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface UsageTrackingOptions {
  enableRealTimeTracking?: boolean;
  enableStripeReporting?: boolean;
  enableUsageLimits?: boolean;
  batchReportingInterval?: number; // minutes
}

export interface WordCountResult {
  totalWords: number;
  sourceWords: number;
  targetWords: number;
  segmentCount: number;
}

export interface UsageValidationResult {
  allowed: boolean;
  reason?: string;
  remainingWords?: number;
  quotaExceeded?: boolean;
  subscriptionStatus?: string;
}

export class UsageTrackingService {
  private options: UsageTrackingOptions;
  private pendingUsageRecords: BillingUsageRecord[] = [];

  constructor(options: Partial<UsageTrackingOptions> = {}) {
    this.options = {
      enableRealTimeTracking: true,
      enableStripeReporting: true,
      enableUsageLimits: true,
      batchReportingInterval: 15, // 15 minutes
      ...options
    };

    // Start batch reporting if enabled
    if (this.options.enableStripeReporting) {
      this.startBatchReporting();
    }
  }

  /**
   * Record usage for a QA session
   */
  async recordQASessionUsage(
    qaSessionId: string,
    subscriptionId: string,
    wordCount: WordCountResult,
    metadata: Record<string, any> = {}
  ): Promise<BillingUsageRecord> {
    return this.recordUsage({
      subscription_id: subscriptionId,
      qa_session_id: qaSessionId,
      words_processed: wordCount.totalWords,
      processing_type: 'qa_analysis'
    }, {
      sourceWords: wordCount.sourceWords,
      targetWords: wordCount.targetWords,
      segmentCount: wordCount.segmentCount,
      ...metadata
    });
  }

  /**
   * Record usage for batch processing
   */
  async recordBatchProcessingUsage(
    subscriptionId: string,
    wordsProcessed: number,
    batchId?: string,
    metadata: Record<string, any> = {}
  ): Promise<BillingUsageRecord> {
    return this.recordUsage({
      subscription_id: subscriptionId,
      words_processed: wordsProcessed,
      processing_type: 'batch_processing'
    }, {
      batchId,
      ...metadata
    });
  }

  /**
   * Record usage for API calls
   */
  async recordAPIUsage(
    subscriptionId: string,
    wordsProcessed: number,
    apiEndpoint?: string,
    metadata: Record<string, any> = {}
  ): Promise<BillingUsageRecord> {
    return this.recordUsage({
      subscription_id: subscriptionId,
      words_processed: wordsProcessed,
      processing_type: 'api_call'
    }, {
      apiEndpoint,
      ...metadata
    });
  }

  /**
   * Core method to record usage
   */
  async recordUsage(
    request: RecordUsageRequest,
    additionalMetadata: Record<string, any> = {}
  ): Promise<BillingUsageRecord> {
    try {
      // Get subscription details to determine billing period and pricing
      const subscription = await this.getSubscription(request.subscription_id);
      if (!subscription) {
        throw new Error(`Subscription not found: ${request.subscription_id}`);
      }

      // Validate usage is allowed (if limits are enabled)
      if (this.options.enableUsageLimits) {
        const validation = await this.validateUsage(subscription, request.words_processed);
        if (!validation.allowed) {
          throw new Error(`Usage not allowed: ${validation.reason}`);
        }
      }

      // Calculate billing period and pricing
      const billingPeriod = this.getCurrentBillingPeriod(subscription);
      const pricing = this.calculatePricing(subscription, request.words_processed);

      // Create usage record
      const usageRecord: Omit<BillingUsageRecord, 'id' | 'created_at' | 'processed_at'> = {
        billing_subscription_id: request.subscription_id,
        qa_session_id: request.qa_session_id,
        words_processed: request.words_processed,
        processing_type: request.processing_type,
        billing_period_start: billingPeriod.start,
        billing_period_end: billingPeriod.end,
        price_per_word: pricing.pricePerWord,
        total_cost: pricing.totalCost,
        stripe_usage_record_id: null,
        reported_to_stripe: false,
        reported_at: null,
        metadata: {
          subscriptionPlan: subscription.pricing_plan,
          currency: subscription.currency,
          ...additionalMetadata
        }
      };

      // Insert into database
      const { data, error } = await supabase
        .from('billing_usage_records')
        .insert(usageRecord)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record usage: ${error.message}`);
      }

      const createdRecord = data as BillingUsageRecord;

      // Add to pending records for Stripe reporting
      if (this.options.enableStripeReporting) {
        this.pendingUsageRecords.push(createdRecord);
      }

      return createdRecord;
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  /**
   * Count words in text content
   */
  countWords(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Remove HTML tags if present
    const plainText = text.replace(/<[^>]*>/g, '');
    
    // Split by whitespace and filter out empty strings
    const words = plainText
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    return words.length;
  }

  /**
   * Count words from QA segments
   */
  countWordsFromSegments(segments: Array<{ source_text?: string; target_text?: string }>): WordCountResult {
    let sourceWords = 0;
    let targetWords = 0;

    for (const segment of segments) {
      sourceWords += this.countWords(segment.source_text || '');
      targetWords += this.countWords(segment.target_text || '');
    }

    return {
      totalWords: sourceWords + targetWords,
      sourceWords,
      targetWords,
      segmentCount: segments.length
    };
  }

  /**
   * Validate if usage is allowed based on subscription limits
   */
  async validateUsage(
    subscription: BillingSubscription,
    requestedWords: number
  ): Promise<UsageValidationResult> {
    try {
      // Check subscription status
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return {
          allowed: false,
          reason: `Subscription is ${subscription.status}`,
          subscriptionStatus: subscription.status
        };
      }

      // Get current usage for billing period
      const currentUsage = await this.getCurrentPeriodUsage(subscription);
      
      // Get plan limits (if any)
      const planLimits = this.getPlanLimits(subscription.pricing_plan);
      
      if (planLimits?.monthlyWordLimit) {
        const remainingWords = planLimits.monthlyWordLimit - currentUsage.wordsProcessed;
        
        if (requestedWords > remainingWords) {
          return {
            allowed: false,
            reason: 'Monthly word limit would be exceeded',
            remainingWords,
            quotaExceeded: true
          };
        }

        return {
          allowed: true,
          remainingWords
        };
      }

      // No limits for unlimited plans
      return { allowed: true };
    } catch (error) {
      console.error('Error validating usage:', error);
      return {
        allowed: false,
        reason: 'Error validating usage limits'
      };
    }
  }

  /**
   * Get current usage for a billing period
   */
  async getCurrentPeriodUsage(subscription: BillingSubscription): Promise<{
    wordsProcessed: number;
    totalCost: number;
    recordCount: number;
  }> {
    const billingPeriod = this.getCurrentBillingPeriod(subscription);

    const { data, error } = await supabase
      .from('billing_usage_records')
      .select('words_processed, total_cost')
      .eq('billing_subscription_id', subscription.id)
      .gte('billing_period_start', billingPeriod.start)
      .lte('billing_period_end', billingPeriod.end);

    if (error) {
      throw new Error(`Failed to get current usage: ${error.message}`);
    }

    const wordsProcessed = data.reduce((sum, record) => sum + record.words_processed, 0);
    const totalCost = data.reduce((sum, record) => sum + record.total_cost, 0);

    return {
      wordsProcessed,
      totalCost,
      recordCount: data.length
    };
  }

  /**
   * Get subscription details
   */
  private async getSubscription(subscriptionId: string): Promise<BillingSubscription | null> {
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }

    return data as BillingSubscription;
  }

  /**
   * Calculate current billing period
   */
  private getCurrentBillingPeriod(subscription: BillingSubscription): {
    start: string;
    end: string;
  } {
    // Use subscription's current period or default to current month
    if (subscription.current_period_start && subscription.current_period_end) {
      return {
        start: subscription.current_period_start,
        end: subscription.current_period_end
      };
    }

    // Fallback to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    };
  }

  /**
   * Calculate pricing for usage
   */
  private calculatePricing(subscription: BillingSubscription, wordsProcessed: number): {
    pricePerWord: number;
    totalCost: number;
  } {
    const planLimits = this.getPlanLimits(subscription.pricing_plan);
    const pricePerWord = planLimits?.pricePerWord || 0.0004; // Default price
    const totalCost = wordsProcessed * pricePerWord;

    return {
      pricePerWord,
      totalCost: Math.round(totalCost * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Get plan limits and pricing
   */
  private getPlanLimits(planId: string): {
    monthlyWordLimit: number | null;
    pricePerWord: number;
  } | null {
    const plans = {
      starter: {
        monthlyWordLimit: 50000,
        pricePerWord: 0.0005
      },
      professional: {
        monthlyWordLimit: 200000,
        pricePerWord: 0.0004
      },
      enterprise: {
        monthlyWordLimit: null, // unlimited
        pricePerWord: 0.0003
      }
    };

    return plans[planId as keyof typeof plans] || null;
  }

  /**
   * Start batch reporting to Stripe
   */
  private startBatchReporting(): void {
    setInterval(() => {
      this.processPendingUsageRecords();
    }, this.options.batchReportingInterval! * 60 * 1000);
  }

  /**
   * Process pending usage records for Stripe reporting
   */
  private async processPendingUsageRecords(): Promise<void> {
    if (this.pendingUsageRecords.length === 0) {
      return;
    }

    const recordsToProcess = [...this.pendingUsageRecords];
    this.pendingUsageRecords = [];

    for (const record of recordsToProcess) {
      try {
        await this.reportToStripe(record);
      } catch (error) {
        console.error('Failed to report usage to Stripe:', error);
        // Re-add to pending records for retry
        this.pendingUsageRecords.push(record);
      }
    }
  }

  /**
   * Report usage record to Stripe
   */
  private async reportToStripe(record: BillingUsageRecord): Promise<void> {
    try {
      // This would integrate with Stripe API to report usage
      // For now, we'll just mark as reported
      const { error } = await supabase
        .from('billing_usage_records')
        .update({
          reported_to_stripe: true,
          reported_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (error) {
        throw new Error(`Failed to update Stripe reporting status: ${error.message}`);
      }

      console.log(`✅ Reported usage record ${record.id} to Stripe`);
    } catch (error) {
      console.error('Error reporting to Stripe:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for a subscription
   */
  async getUsageStatistics(
    subscriptionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalWords: number;
    totalCost: number;
    recordCount: number;
    byType: Record<string, { words: number; cost: number; count: number }>;
    averageCostPerWord: number;
  }> {
    let query = supabase
      .from('billing_usage_records')
      .select('words_processed, total_cost, processing_type')
      .eq('billing_subscription_id', subscriptionId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get usage statistics: ${error.message}`);
    }

    const totalWords = data.reduce((sum, record) => sum + record.words_processed, 0);
    const totalCost = data.reduce((sum, record) => sum + record.total_cost, 0);

    // Group by processing type
    const byType: Record<string, { words: number; cost: number; count: number }> = {};
    for (const record of data) {
      if (!byType[record.processing_type]) {
        byType[record.processing_type] = { words: 0, cost: 0, count: 0 };
      }
      byType[record.processing_type].words += record.words_processed;
      byType[record.processing_type].cost += record.total_cost;
      byType[record.processing_type].count += 1;
    }

    return {
      totalWords,
      totalCost,
      recordCount: data.length,
      byType,
      averageCostPerWord: totalWords > 0 ? totalCost / totalWords : 0
    };
  }
}

// Export singleton instance
export const usageTracker = new UsageTrackingService(); 