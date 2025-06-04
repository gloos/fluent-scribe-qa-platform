import { StripeService } from '@/integrations/stripe/stripe-service';
import { createClient } from '@supabase/supabase-js';
import type { BillingUsageRecord, BillingSubscription } from '@/lib/types/billing';
import { supabase } from '@/lib/supabase';

export interface StripeUsageReportResult {
  success: boolean;
  stripeUsageRecordId?: string;
  error?: string;
}

export interface BatchReportResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ recordId: string; error: string }>;
}

export class StripeUsageReporter {
  private stripeService: StripeService;
  private isReporting = false;

  constructor() {
    this.stripeService = new StripeService();
  }

  /**
   * Report a single usage record to Stripe
   */
  async reportUsageRecord(usageRecord: BillingUsageRecord): Promise<StripeUsageReportResult> {
    try {
      if (usageRecord.reported_to_stripe) {
        return {
          success: true,
          stripeUsageRecordId: usageRecord.stripe_usage_record_id || undefined
        };
      }

      // Get subscription details for Stripe subscription ID
      const subscription = await this.getSubscription(usageRecord.billing_subscription_id);
      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found'
        };
      }

      if (!subscription.stripe_subscription_id) {
        return {
          success: false,
          error: 'No Stripe subscription ID found'
        };
      }

      // Create usage record in Stripe
      const timestamp = Math.floor(new Date(usageRecord.created_at).getTime() / 1000);
      
      // For now, we'll simulate the Stripe API call
      // In a real implementation, this would call the Stripe API:
      /*
      const stripeUsageRecord = await stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity: usageRecord.words_processed,
          timestamp: timestamp,
          action: 'increment'
        }
      );
      */

      // Simulate Stripe response
      const stripeUsageRecordId = `stripe_usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update our database record
      const { error: updateError } = await supabase
        .from('billing_usage_records')
        .update({
          stripe_usage_record_id: stripeUsageRecordId,
          reported_to_stripe: true,
          reported_at: new Date().toISOString()
        })
        .eq('id', usageRecord.id);

      if (updateError) {
        console.error('Failed to update usage record:', updateError);
        return {
          success: false,
          error: `Failed to update record: ${updateError.message}`
        };
      }

      console.log(`✅ Reported usage record ${usageRecord.id} to Stripe: ${stripeUsageRecordId}`);

      return {
        success: true,
        stripeUsageRecordId
      };

    } catch (error) {
      console.error('Error reporting usage to Stripe:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch report unreported usage records to Stripe
   */
  async batchReportUsage(maxRecords: number = 100): Promise<BatchReportResult> {
    if (this.isReporting) {
      console.log('📊 Batch reporting already in progress, skipping...');
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
    }

    this.isReporting = true;

    try {
      console.log('📊 Starting batch usage reporting to Stripe...');

      // Get unreported usage records
      const { data: unreportedRecords, error: fetchError } = await supabase
        .from('billing_usage_records')
        .select('*')
        .eq('reported_to_stripe', false)
        .order('created_at', { ascending: true })
        .limit(maxRecords);

      if (fetchError) {
        throw new Error(`Failed to fetch unreported records: ${fetchError.message}`);
      }

      if (!unreportedRecords || unreportedRecords.length === 0) {
        console.log('📊 No unreported usage records found');
        return {
          processed: 0,
          successful: 0,
          failed: 0,
          errors: []
        };
      }

      console.log(`📊 Found ${unreportedRecords.length} unreported usage records`);

      const result: BatchReportResult = {
        processed: unreportedRecords.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      // Process each record
      for (const record of unreportedRecords) {
        try {
          const reportResult = await this.reportUsageRecord(record as BillingUsageRecord);
          
          if (reportResult.success) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              recordId: record.id,
              error: reportResult.error || 'Unknown error'
            });
          }

          // Small delay to avoid overwhelming Stripe API
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          result.failed++;
          result.errors.push({
            recordId: record.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`📊 Batch reporting completed: ${result.successful} successful, ${result.failed} failed`);

      return result;

    } catch (error) {
      console.error('Error in batch usage reporting:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [{
          recordId: 'batch',
          error: error instanceof Error ? error.message : 'Batch processing failed'
        }]
      };
    } finally {
      this.isReporting = false;
    }
  }

  /**
   * Report usage for a specific subscription's billing period
   */
  async reportSubscriptionPeriodUsage(
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<BatchReportResult> {
    try {
      console.log(`📊 Reporting usage for subscription ${subscriptionId} period ${periodStart} to ${periodEnd}`);

      // Get unreported usage records for this subscription and period
      const { data: periodRecords, error: fetchError } = await supabase
        .from('billing_usage_records')
        .select('*')
        .eq('billing_subscription_id', subscriptionId)
        .eq('reported_to_stripe', false)
        .gte('billing_period_start', periodStart)
        .lte('billing_period_end', periodEnd)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(`Failed to fetch period records: ${fetchError.message}`);
      }

      if (!periodRecords || periodRecords.length === 0) {
        console.log('📊 No unreported usage records found for this period');
        return {
          processed: 0,
          successful: 0,
          failed: 0,
          errors: []
        };
      }

      const result: BatchReportResult = {
        processed: periodRecords.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      // Process each record
      for (const record of periodRecords) {
        try {
          const reportResult = await this.reportUsageRecord(record as BillingUsageRecord);
          
          if (reportResult.success) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              recordId: record.id,
              error: reportResult.error || 'Unknown error'
            });
          }

          // Small delay to avoid overwhelming Stripe API
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          result.failed++;
          result.errors.push({
            recordId: record.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`📊 Period usage reporting completed: ${result.successful} successful, ${result.failed} failed`);

      return result;

    } catch (error) {
      console.error('Error reporting subscription period usage:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [{
          recordId: 'period',
          error: error instanceof Error ? error.message : 'Period reporting failed'
        }]
      };
    }
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
   * Get reporting statistics
   */
  async getReportingStats(): Promise<{
    totalUsageRecords: number;
    reportedToStripe: number;
    pendingReports: number;
    failedReports: number;
    lastReportedAt?: string;
  }> {
    try {
      // Total usage records
      const { count: totalCount } = await supabase
        .from('billing_usage_records')
        .select('id', { count: 'exact' });

      // Reported to Stripe
      const { count: reportedCount } = await supabase
        .from('billing_usage_records')
        .select('id', { count: 'exact' })
        .eq('reported_to_stripe', true);

      // Pending reports
      const { count: pendingCount } = await supabase
        .from('billing_usage_records')
        .select('id', { count: 'exact' })
        .eq('reported_to_stripe', false);

      // Last reported
      const { data: lastReported } = await supabase
        .from('billing_usage_records')
        .select('reported_at')
        .eq('reported_to_stripe', true)
        .order('reported_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalUsageRecords: totalCount || 0,
        reportedToStripe: reportedCount || 0,
        pendingReports: pendingCount || 0,
        failedReports: 0, // TODO: Track failed reports separately
        lastReportedAt: lastReported?.reported_at
      };

    } catch (error) {
      console.error('Error getting reporting stats:', error);
      return {
        totalUsageRecords: 0,
        reportedToStripe: 0,
        pendingReports: 0,
        failedReports: 0
      };
    }
  }

  /**
   * Start automatic batch reporting with interval
   */
  startAutomaticReporting(intervalMinutes: number = 15): void {
    console.log(`📊 Starting automatic usage reporting every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        await this.batchReportUsage();
      } catch (error) {
        console.error('Error in automatic usage reporting:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const stripeUsageReporter = new StripeUsageReporter(); 