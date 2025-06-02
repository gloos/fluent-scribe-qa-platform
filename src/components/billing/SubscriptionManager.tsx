import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Shield,
  Star
} from 'lucide-react';
import { useSubscription, usePlanComparison } from '@/hooks/useSubscription';
import type { BillingSubscription, BillingUsageRecord } from '@/lib/types/billing';
import type { SubscriptionPlan } from '@/lib/services/subscription-service';

interface SubscriptionManagerProps {
  subscription?: BillingSubscription;
  usageRecords?: BillingUsageRecord[];
  customerId?: string;
  onSubscriptionChange?: (subscription: BillingSubscription) => void;
}

export function SubscriptionManager({
  subscription,
  usageRecords = [],
  customerId,
  onSubscriptionChange
}: SubscriptionManagerProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    currentPlan,
    availablePlans,
    usageBilling,
    isLoading,
    error,
    createSubscription,
    changePlan,
    cancelSubscription,
    checkWordQuota,
    getRecommendations
  } = useSubscription(subscription, usageRecords);

  const { findBestPlan } = usePlanComparison();

  const handlePlanChange = async (newPlanId: string) => {
    if (!subscription) {
      // Create new subscription
      if (!customerId) {
        console.error('Customer ID required to create subscription');
        return;
      }
      
      try {
        await createSubscription(customerId, newPlanId);
      } catch (error) {
        console.error('Failed to create subscription:', error);
      }
    } else {
      // Change existing subscription
      try {
        setIsChangingPlan(true);
        await changePlan(newPlanId);
        onSubscriptionChange?.(subscription);
      } catch (error) {
        console.error('Failed to change plan:', error);
      } finally {
        setIsChangingPlan(false);
      }
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription({ cancelAtPeriodEnd: true });
      setShowCancelDialog(false);
      onSubscriptionChange?.(subscription!);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'starter':
        return <Zap className="h-5 w-5" />;
      case 'professional':
        return <TrendingUp className="h-5 w-5" />;
      case 'enterprise':
        return <Shield className="h-5 w-5" />;
      default:
        return <Star className="h-5 w-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get usage recommendations
  const recommendations = usageBilling && currentPlan 
    ? getRecommendations(usageBilling.wordsProcessed * 30 / new Date().getDate()) // Estimate monthly usage
    : null;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Status */}
      {subscription && currentPlan && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {getPlanIcon(currentPlan.id)}
                  {currentPlan.name} Plan
                </CardTitle>
                <CardDescription>
                  {formatCurrency(currentPlan.pricePerWord)}/word • 
                  {currentPlan.monthlyWordLimit 
                    ? ` ${currentPlan.monthlyWordLimit.toLocaleString()} words/month`
                    : ' Unlimited words'
                  }
                </CardDescription>
              </div>
              <div className="text-right">
                {getStatusBadge(subscription.status)}
                {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                  <p className="text-sm text-gray-500 mt-1">
                    Trial ends {formatDate(subscription.trial_end)}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          
          {usageBilling && (
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Usage This Period</span>
                    <span className="text-sm text-gray-500">
                      {usageBilling.wordsProcessed.toLocaleString()} words
                    </span>
                  </div>
                  
                  {currentPlan.monthlyWordLimit && (
                    <>
                      <Progress 
                        value={(usageBilling.wordsProcessed / currentPlan.monthlyWordLimit) * 100} 
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>
                          {((usageBilling.wordsProcessed / currentPlan.monthlyWordLimit) * 100).toFixed(1)}% used
                        </span>
                        <span>
                          {usageBilling.remainingWords?.toLocaleString()} remaining
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Estimated Cost</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(usageBilling.estimatedCost)}
                  </span>
                </div>

                {subscription.current_period_end && (
                  <p className="text-sm text-gray-500">
                    Next billing: {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Usage Recommendations */}
      {recommendations && recommendations.recommendedPlan.id !== currentPlan?.id && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            <strong>Recommendation:</strong> {recommendations.reason}
            {recommendations.savings && (
              <span className="text-green-600 font-medium">
                {' '}Save {formatCurrency(recommendations.savings)}/month!
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-6 relative ${
                  plan.isPopular ? 'border-blue-500 border-2' : ''
                } ${
                  currentPlan?.id === plan.id ? 'bg-blue-50' : ''
                }`}
              >
                {plan.isPopular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    Popular
                  </Badge>
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  {getPlanIcon(plan.id)}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                </div>
                
                <p className="text-3xl font-bold mb-4">
                  {formatCurrency(plan.pricePerWord)}
                  <span className="text-base font-normal text-gray-500">/word</span>
                </p>
                
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.trialDays > 0 && !subscription && (
                  <p className="text-sm text-blue-600 mb-4">
                    {plan.trialDays}-day free trial
                  </p>
                )}
                
                <Button
                  className="w-full"
                  variant={currentPlan?.id === plan.id ? "outline" : "default"}
                  disabled={isLoading || isChangingPlan || currentPlan?.id === plan.id}
                  onClick={() => handlePlanChange(plan.id)}
                >
                  {isChangingPlan && selectedPlan === plan.id ? (
                    'Changing...'
                  ) : currentPlan?.id === plan.id ? (
                    'Current Plan'
                  ) : subscription ? (
                    'Switch Plan'
                  ) : (
                    'Start Trial'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Actions */}
      {subscription && subscription.status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>
              Manage your subscription settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Update Payment Method
              </Button>
              
              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    Cancel Subscription
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel your subscription? You'll continue to have access 
                      until the end of your current billing period.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                      Keep Subscription
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleCancelSubscription}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Canceling...' : 'Cancel Subscription'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 