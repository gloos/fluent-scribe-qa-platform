import { StripeService } from '@/integrations/stripe/stripe-service';
import { STRIPE_CONFIG, getPriceIdByPlan } from '@/lib/config/stripe';
import type { 
  BillingSubscription, 
  BillingCustomer, 
  PricingPlan, 
  BillingUsageRecord,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest
} from '@/lib/types/billing';
import type Stripe from 'stripe';

export interface SubscriptionPlan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  pricePerWord: number;
  monthlyWordLimit: number | null; // null for unlimited
  features: string[];
  trialDays: number;
  isPopular?: boolean;
}

export interface SubscriptionChangeRequest {
  newPlanId: string;
  effectiveDate?: Date;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface UsageBasedBilling {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  wordsProcessed: number;
  estimatedCost: number;
  remainingWords?: number;
}

export class SubscriptionService {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  // Subscription Plans Configuration
  static readonly PLANS: Record<string, SubscriptionPlan> = {
    starter: {
      id: 'starter',
      name: 'Starter',
      pricePerWord: 0.0005,
      monthlyWordLimit: 50000,
      features: [
        'Up to 50,000 words/month',
        'Basic error detection',
        'Email support',
        'Standard processing speed'
      ],
      trialDays: STRIPE_CONFIG.trialPeriods.starter,
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      pricePerWord: 0.0004,
      monthlyWordLimit: 200000,
      features: [
        'Up to 200,000 words/month',
        'Advanced error categorization',
        'Priority support',
        'Fast processing speed',
        'Custom style guides'
      ],
      trialDays: STRIPE_CONFIG.trialPeriods.professional,
      isPopular: true,
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      pricePerWord: 0.0003,
      monthlyWordLimit: null, // unlimited
      features: [
        'Unlimited words',
        'Full MQM compliance',
        'Dedicated support',
        'Fastest processing',
        'API access',
        'Custom integrations'
      ],
      trialDays: STRIPE_CONFIG.trialPeriods.enterprise,
    },
  };

  /**
   * Get all available subscription plans
   */
  getAvailablePlans(): SubscriptionPlan[] {
    return Object.values(SubscriptionService.PLANS);
  }

  /**
   * Get a specific plan by ID
   */
  getPlan(planId: string): SubscriptionPlan | null {
    return SubscriptionService.PLANS[planId] || null;
  }

  /**
   * Create a new subscription for a customer
   */
  async createSubscription(
    customerId: string,
    planId: string,
    options: {
      trialDays?: number;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<BillingSubscription> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const priceId = getPriceIdByPlan(plan.id);
    const trialDays = options.trialDays ?? plan.trialDays;

    try {
      const response = await this.stripeService.createSubscription({
        customer_id: customerId,
        price_id: priceId,
        trial_period_days: trialDays,
        payment_method_id: options.paymentMethodId,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          ...options.metadata,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create subscription');
      }

      const stripeSubscription = response.data;

      // Convert Stripe subscription to our format
      const subscription: BillingSubscription = {
        id: stripeSubscription.id,
        billing_customer_id: customerId,
        stripe_subscription_id: stripeSubscription.id,
        pricing_plan: plan.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        collection_method: 'charge_automatically',
        currency: 'usd',
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : undefined,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : undefined,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : undefined,
        stripe_metadata: stripeSubscription.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return subscription;
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change subscription plan
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    request: SubscriptionChangeRequest
  ): Promise<BillingSubscription> {
    const newPlan = this.getPlan(request.newPlanId);
    if (!newPlan) {
      throw new Error(`Invalid plan ID: ${request.newPlanId}`);
    }

    const newPriceId = getPriceIdByPlan(newPlan.id);

    try {
      const response = await this.stripeService.updateSubscription(subscriptionId, {
        price_id: newPriceId,
        metadata: {
          planId: newPlan.id,
          planName: newPlan.name,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to update subscription');
      }

      const stripeSubscription = response.data;

      const subscription: BillingSubscription = {
        id: stripeSubscription.id,
        billing_customer_id: stripeSubscription.customer as string,
        stripe_subscription_id: stripeSubscription.id,
        pricing_plan: newPlan.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        collection_method: 'charge_automatically',
        currency: 'usd',
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : undefined,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : undefined,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : undefined,
        stripe_metadata: stripeSubscription.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return subscription;
    } catch (error) {
      throw new Error(`Failed to change subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    options: {
      cancelAtPeriodEnd?: boolean;
      reason?: string;
    } = {}
  ): Promise<BillingSubscription> {
    try {
      const response = await this.stripeService.cancelSubscription(
        subscriptionId,
        !(options.cancelAtPeriodEnd ?? true)
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to cancel subscription');
      }

      const stripeSubscription = response.data;

      const subscription: BillingSubscription = {
        id: stripeSubscription.id,
        billing_customer_id: stripeSubscription.customer as string,
        stripe_subscription_id: stripeSubscription.id,
        pricing_plan: (stripeSubscription.metadata?.planId as any) || 'starter',
        status: this.mapStripeStatus(stripeSubscription.status),
        collection_method: 'charge_automatically',
        currency: 'usd',
        current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : undefined,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : undefined,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : undefined,
        cancellation_reason: options.reason,
        stripe_metadata: stripeSubscription.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return subscription;
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate usage-based billing for current period
   */
  calculateUsageBilling(
    subscription: BillingSubscription,
    usageRecords: BillingUsageRecord[]
  ): UsageBasedBilling {
    const plan = this.getPlan(subscription.pricing_plan);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${subscription.pricing_plan}`);
    }

    const periodStart = new Date(subscription.current_period_start || '');
    const periodEnd = new Date(subscription.current_period_end || '');

    // Filter usage records for current billing period
    const currentPeriodUsage = usageRecords.filter(record => {
      const recordDate = new Date(record.created_at);
      return recordDate >= periodStart && recordDate <= periodEnd;
    });

    const totalWordsProcessed = currentPeriodUsage.reduce(
      (total, record) => total + record.words_processed, 
      0
    );

    const estimatedCost = totalWordsProcessed * plan.pricePerWord;
    
    const remainingWords = plan.monthlyWordLimit 
      ? Math.max(0, plan.monthlyWordLimit - totalWordsProcessed)
      : undefined;

    return {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      wordsProcessed: totalWordsProcessed,
      estimatedCost,
      remainingWords,
    };
  }

  /**
   * Check if subscription allows processing more words
   */
  canProcessWords(
    subscription: BillingSubscription,
    usageRecords: BillingUsageRecord[],
    requestedWords: number
  ): { allowed: boolean; reason?: string; remainingWords?: number } {
    const plan = this.getPlan(subscription.pricing_plan);
    if (!plan) {
      return { allowed: false, reason: 'Invalid subscription plan' };
    }

    // Check subscription status
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    // Enterprise plan has unlimited words
    if (plan.monthlyWordLimit === null) {
      return { allowed: true };
    }

    // Calculate current usage
    const usage = this.calculateUsageBilling(subscription, usageRecords);
    const remainingWords = usage.remainingWords || 0;

    if (requestedWords > remainingWords) {
      return { 
        allowed: false, 
        reason: 'Insufficient word quota remaining',
        remainingWords 
      };
    }

    return { allowed: true, remainingWords };
  }

  /**
   * Get subscription recommendations based on usage patterns
   */
  getSubscriptionRecommendations(
    currentPlan: string,
    averageMonthlyWords: number,
    growthRate: number = 0
  ): { recommendedPlan: SubscriptionPlan; reason: string; savings?: number } {
    const plans = this.getAvailablePlans();
    const projectedWords = averageMonthlyWords * (1 + growthRate);

    // Find the most cost-effective plan for projected usage
    let bestPlan = plans[0];
    let bestCost = Infinity;

    for (const plan of plans) {
      // Skip if plan can't handle the projected usage
      if (plan.monthlyWordLimit && projectedWords > plan.monthlyWordLimit) {
        continue;
      }

      const cost = projectedWords * plan.pricePerWord;
      if (cost < bestCost) {
        bestCost = cost;
        bestPlan = plan;
      }
    }

    const currentPlanObj = this.getPlan(currentPlan);
    const currentCost = currentPlanObj ? projectedWords * currentPlanObj.pricePerWord : 0;
    const savings = currentCost - bestCost;

    let reason = '';
    if (bestPlan.id === currentPlan) {
      reason = 'Your current plan is optimal for your usage patterns.';
    } else if (savings > 0) {
      reason = `Switching to ${bestPlan.name} could save you $${savings.toFixed(2)} per month.`;
    } else {
      reason = `${bestPlan.name} plan is recommended for your projected usage of ${projectedWords.toLocaleString()} words.`;
    }

    return {
      recommendedPlan: bestPlan,
      reason,
      savings: savings > 0 ? savings : undefined,
    };
  }

  /**
   * Map Stripe subscription status to our internal status
   */
  private mapStripeStatus(stripeStatus: string): BillingSubscription['status'] {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'trialing':
        return 'trialing';
      case 'past_due':
        return 'past_due';
      case 'canceled':
        return 'canceled';
      case 'unpaid':
        return 'unpaid';
      case 'incomplete':
        return 'incomplete';
      case 'incomplete_expired':
        return 'incomplete_expired';
      case 'paused':
        return 'paused';
      default:
        return 'incomplete';
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService(); 