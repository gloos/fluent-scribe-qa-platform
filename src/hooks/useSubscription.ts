import { useState, useEffect, useCallback } from 'react';
import { subscriptionService, type SubscriptionPlan, type UsageBasedBilling } from '@/lib/services/subscription-service';
import type { BillingSubscription, BillingUsageRecord } from '@/lib/types/billing';

export interface UseSubscriptionState {
  subscription: BillingSubscription | null;
  currentPlan: SubscriptionPlan | null;
  availablePlans: SubscriptionPlan[];
  usageBilling: UsageBasedBilling | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseSubscriptionActions {
  createSubscription: (customerId: string, planId: string, options?: {
    trialDays?: number;
    paymentMethodId?: string;
    metadata?: Record<string, string>;
  }) => Promise<void>;
  changePlan: (newPlanId: string) => Promise<void>;
  cancelSubscription: (options?: { cancelAtPeriodEnd?: boolean; reason?: string }) => Promise<void>;
  checkWordQuota: (requestedWords: number) => { allowed: boolean; reason?: string; remainingWords?: number };
  getRecommendations: (averageMonthlyWords: number, growthRate?: number) => {
    recommendedPlan: SubscriptionPlan;
    reason: string;
    savings?: number;
  } | null;
  refreshSubscription: () => Promise<void>;
}

export interface UseSubscriptionReturn extends UseSubscriptionState, UseSubscriptionActions {}

export function useSubscription(
  initialSubscription?: BillingSubscription,
  usageRecords: BillingUsageRecord[] = []
): UseSubscriptionReturn {
  const [state, setState] = useState<UseSubscriptionState>({
    subscription: initialSubscription || null,
    currentPlan: null,
    availablePlans: [],
    usageBilling: null,
    isLoading: false,
    error: null,
  });

  // Initialize available plans
  useEffect(() => {
    const plans = subscriptionService.getAvailablePlans();
    setState(prev => ({ ...prev, availablePlans: plans }));
  }, []);

  // Update current plan when subscription changes
  useEffect(() => {
    if (state.subscription) {
      const plan = subscriptionService.getPlan(state.subscription.pricing_plan);
      setState(prev => ({ ...prev, currentPlan: plan }));
    } else {
      setState(prev => ({ ...prev, currentPlan: null }));
    }
  }, [state.subscription]);

  // Calculate usage billing when subscription or usage records change
  useEffect(() => {
    if (state.subscription && usageRecords.length > 0) {
      try {
        const billing = subscriptionService.calculateUsageBilling(state.subscription, usageRecords);
        setState(prev => ({ ...prev, usageBilling: billing }));
      } catch (error) {
        console.error('Failed to calculate usage billing:', error);
        setState(prev => ({ 
          ...prev, 
          usageBilling: null,
          error: error instanceof Error ? error.message : 'Failed to calculate usage'
        }));
      }
    } else {
      setState(prev => ({ ...prev, usageBilling: null }));
    }
  }, [state.subscription, usageRecords]);

  const createSubscription = useCallback(async (
    customerId: string,
    planId: string,
    options?: {
      trialDays?: number;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
    }
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const subscription = await subscriptionService.createSubscription(customerId, planId, options);
      setState(prev => ({ 
        ...prev, 
        subscription, 
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to create subscription'
      }));
      throw error;
    }
  }, []);

  const changePlan = useCallback(async (newPlanId: string) => {
    if (!state.subscription) {
      throw new Error('No active subscription to change');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const updatedSubscription = await subscriptionService.changeSubscriptionPlan(
        state.subscription.stripe_subscription_id,
        { newPlanId }
      );
      setState(prev => ({ 
        ...prev, 
        subscription: updatedSubscription, 
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to change plan'
      }));
      throw error;
    }
  }, [state.subscription]);

  const cancelSubscription = useCallback(async (options?: { 
    cancelAtPeriodEnd?: boolean; 
    reason?: string 
  }) => {
    if (!state.subscription) {
      throw new Error('No active subscription to cancel');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const canceledSubscription = await subscriptionService.cancelSubscription(
        state.subscription.stripe_subscription_id,
        options
      );
      setState(prev => ({ 
        ...prev, 
        subscription: canceledSubscription, 
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      }));
      throw error;
    }
  }, [state.subscription]);

  const checkWordQuota = useCallback((requestedWords: number) => {
    if (!state.subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    return subscriptionService.canProcessWords(state.subscription, usageRecords, requestedWords);
  }, [state.subscription, usageRecords]);

  const getRecommendations = useCallback((
    averageMonthlyWords: number, 
    growthRate: number = 0
  ) => {
    if (!state.currentPlan) {
      return null;
    }

    return subscriptionService.getSubscriptionRecommendations(
      state.currentPlan.id,
      averageMonthlyWords,
      growthRate
    );
  }, [state.currentPlan]);

  const refreshSubscription = useCallback(async () => {
    // This would typically fetch the latest subscription data from the server
    // For now, we'll just recalculate the usage billing
    if (state.subscription && usageRecords.length > 0) {
      try {
        const billing = subscriptionService.calculateUsageBilling(state.subscription, usageRecords);
        setState(prev => ({ ...prev, usageBilling: billing }));
      } catch (error) {
        console.error('Failed to refresh subscription data:', error);
      }
    }
  }, [state.subscription, usageRecords]);

  return {
    // State
    subscription: state.subscription,
    currentPlan: state.currentPlan,
    availablePlans: state.availablePlans,
    usageBilling: state.usageBilling,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    createSubscription,
    changePlan,
    cancelSubscription,
    checkWordQuota,
    getRecommendations,
    refreshSubscription,
  };
}

// Helper hook for plan comparison
export function usePlanComparison() {
  const plans = subscriptionService.getAvailablePlans();
  
  const comparePlans = useCallback((planIds: string[]) => {
    return planIds.map(id => subscriptionService.getPlan(id)).filter(Boolean) as SubscriptionPlan[];
  }, []);

  const findBestPlan = useCallback((monthlyWords: number) => {
    let bestPlan = plans[0];
    let bestCost = Infinity;

    for (const plan of plans) {
      if (plan.monthlyWordLimit && monthlyWords > plan.monthlyWordLimit) {
        continue;
      }

      const cost = monthlyWords * plan.pricePerWord;
      if (cost < bestCost) {
        bestCost = cost;
        bestPlan = plan;
      }
    }

    return { plan: bestPlan, estimatedCost: bestCost };
  }, [plans]);

  return {
    plans,
    comparePlans,
    findBestPlan,
  };
} 