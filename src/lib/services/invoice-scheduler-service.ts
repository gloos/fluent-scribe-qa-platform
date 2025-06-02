import { createClient } from '@supabase/supabase-js';
import type { BillingSubscription, BillingUsageRecord } from '@/lib/types/billing';
import { invoiceGenerator, type InvoiceGenerationOptions } from './invoice-generation-service';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface ScheduledInvoiceJob {
  id: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  scheduledFor: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastAttempt?: string;
  error?: string;
  options?: InvoiceGenerationOptions;
}

export interface InvoiceSchedulingResult {
  success: boolean;
  jobsScheduled: number;
  jobsSkipped: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

export interface InvoiceGenerationBatchResult {
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    subscriptionId: string;
    success: boolean;
    invoiceId?: string;
    error?: string;
  }>;
}

export class InvoiceSchedulerService {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  /**
   * Schedule invoice generation for all subscriptions ending their billing period today
   */
  async scheduleEndOfPeriodInvoices(): Promise<InvoiceSchedulingResult> {
    try {
      console.log('🔄 Scheduling end-of-period invoices...');

      // Get subscriptions with billing periods ending today
      const subscriptions = await this.getSubscriptionsEndingToday();
      
      if (subscriptions.length === 0) {
        console.log('📊 No subscriptions ending today');
        return {
          success: true,
          jobsScheduled: 0,
          jobsSkipped: 0,
          errors: []
        };
      }

      console.log(`📊 Found ${subscriptions.length} subscriptions ending today`);

      const result: InvoiceSchedulingResult = {
        success: true,
        jobsScheduled: 0,
        jobsSkipped: 0,
        errors: []
      };

      // Process each subscription
      for (const subscription of subscriptions) {
        try {
          // Check if we already have an invoice for this period
          const existingInvoice = await this.hasInvoiceForPeriod(
            subscription.id,
            subscription.current_period_start!,
            subscription.current_period_end!
          );

          if (existingInvoice) {
            console.log(`⏭️ Skipping subscription ${subscription.id} - invoice already exists`);
            result.jobsSkipped++;
            continue;
          }

          // Generate invoice immediately (in production, this might be scheduled)
          const invoiceResult = await invoiceGenerator.generatePeriodInvoice(
            subscription.id,
            subscription.current_period_start!,
            subscription.current_period_end!,
            {
              includeTax: true,
              currency: subscription.currency,
              dueInDays: 30,
              autoFinalize: true,
              description: `${subscription.pricing_plan} plan invoice for ${subscription.current_period_start} to ${subscription.current_period_end}`
            }
          );

          if (invoiceResult.success) {
            console.log(`✅ Generated invoice for subscription ${subscription.id}: ${invoiceResult.stripeInvoiceId}`);
            result.jobsScheduled++;
          } else {
            console.error(`❌ Failed to generate invoice for subscription ${subscription.id}:`, invoiceResult.error);
            result.errors.push({
              subscriptionId: subscription.id,
              error: invoiceResult.error || 'Unknown error'
            });
          }

        } catch (error) {
          console.error(`❌ Error processing subscription ${subscription.id}:`, error);
          result.errors.push({
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`✅ Invoice scheduling completed: ${result.jobsScheduled} scheduled, ${result.jobsSkipped} skipped, ${result.errors.length} errors`);

      return result;

    } catch (error) {
      console.error('❌ Error scheduling end-of-period invoices:', error);
      return {
        success: false,
        jobsScheduled: 0,
        jobsSkipped: 0,
        errors: [{
          subscriptionId: 'batch',
          error: error instanceof Error ? error.message : 'Batch scheduling failed'
        }]
      };
    }
  }

  /**
   * Generate invoices for overdue usage (usage without subscription)
   */
  async generateOverdueUsageInvoices(): Promise<InvoiceGenerationBatchResult> {
    try {
      console.log('🔄 Generating overdue usage invoices...');

      // Get usage records that haven't been invoiced and are older than 7 days
      const overdueThreshold = new Date();
      overdueThreshold.setDate(overdueThreshold.getDate() - 7);

      const { data: overdueUsage, error } = await supabase
        .from('billing_usage_records')
        .select('*')
        .eq('invoiced', false)
        .is('billing_subscription_id', null) // Usage without subscription
        .lt('created_at', overdueThreshold.toISOString());

      if (error) {
        throw new Error(`Failed to fetch overdue usage: ${error.message}`);
      }

      if (!overdueUsage || overdueUsage.length === 0) {
        console.log('📊 No overdue usage records found');
        return {
          processed: 0,
          successful: 0,
          failed: 0,
          results: []
        };
      }

      console.log(`📊 Found ${overdueUsage.length} overdue usage records`);

      // Group usage by customer
      const usageByCustomer = overdueUsage.reduce((acc, record) => {
        // For now, we'll use the qa_session to determine customer
        // In a real implementation, you'd have a proper customer relationship
        const customerId = record.qa_session_id || 'unknown';
        
        if (!acc[customerId]) {
          acc[customerId] = [];
        }
        acc[customerId].push(record);
        return acc;
      }, {} as Record<string, BillingUsageRecord[]>);

      const result: InvoiceGenerationBatchResult = {
        processed: 0,
        successful: 0,
        failed: 0,
        results: []
      };

      // Generate invoices for each customer
      for (const [customerId, records] of Object.entries(usageByCustomer) as [string, BillingUsageRecord[]][]) {
        try {
          result.processed++;

          if (customerId === 'unknown') {
            // Skip records without proper customer association
            result.failed++;
            result.results.push({
              subscriptionId: customerId,
              success: false,
              error: 'Cannot generate invoice for unknown customer'
            });
            continue;
          }

          // Generate usage invoice
          const usageRecordIds = records.map(record => record.id);
          const invoiceResult = await invoiceGenerator.generateUsageInvoice(
            customerId,
            usageRecordIds,
            {
              includeTax: true,
              dueInDays: 15,
              autoFinalize: true,
              description: 'Usage-based invoice for word processing services'
            }
          );

          if (invoiceResult.success) {
            console.log(`✅ Generated usage invoice for customer ${customerId}: ${invoiceResult.stripeInvoiceId}`);
            result.successful++;
            result.results.push({
              subscriptionId: customerId,
              success: true,
              invoiceId: invoiceResult.stripeInvoiceId
            });
          } else {
            console.error(`❌ Failed to generate usage invoice for customer ${customerId}:`, invoiceResult.error);
            result.failed++;
            result.results.push({
              subscriptionId: customerId,
              success: false,
              error: invoiceResult.error || 'Unknown error'
            });
          }

        } catch (error) {
          console.error(`❌ Error generating usage invoice for customer ${customerId}:`, error);
          result.failed++;
          result.results.push({
            subscriptionId: customerId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`✅ Overdue usage invoice generation completed: ${result.successful} successful, ${result.failed} failed`);

      return result;

    } catch (error) {
      console.error('❌ Error generating overdue usage invoices:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        results: [{
          subscriptionId: 'batch',
          success: false,
          error: error instanceof Error ? error.message : 'Batch processing failed'
        }]
      };
    }
  }

  /**
   * Start automatic invoice generation on a schedule
   */
  startAutomaticGeneration(intervalHours: number = 24): void {
    if (this.isRunning) {
      console.log('⚠️ Invoice scheduler is already running');
      return;
    }

    console.log(`🚀 Starting automatic invoice generation every ${intervalHours} hours`);
    this.isRunning = true;

    // Run immediately
    this.runScheduledGeneration();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.runScheduledGeneration();
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Stop automatic invoice generation
   */
  stopAutomaticGeneration(): void {
    if (!this.isRunning) {
      console.log('⚠️ Invoice scheduler is not running');
      return;
    }

    console.log('🛑 Stopping automatic invoice generation');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Run a complete scheduled generation cycle
   */
  private async runScheduledGeneration(): Promise<void> {
    try {
      console.log('🕐 Running scheduled invoice generation...');

      // Generate end-of-period invoices
      const periodResult = await this.scheduleEndOfPeriodInvoices();
      
      // Generate overdue usage invoices
      const usageResult = await this.generateOverdueUsageInvoices();

      console.log(`✅ Scheduled generation completed: Period invoices: ${periodResult.jobsScheduled}, Usage invoices: ${usageResult.successful}`);

    } catch (error) {
      console.error('❌ Error in scheduled invoice generation:', error);
    }
  }

  /**
   * Get subscriptions with billing periods ending today
   */
  private async getSubscriptionsEndingToday(): Promise<BillingSubscription[]> {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('status', 'active')
      .gte('current_period_end', todayStart.toISOString())
      .lt('current_period_end', todayEnd.toISOString());

    if (error) {
      console.error('Error fetching subscriptions ending today:', error);
      return [];
    }

    return data as BillingSubscription[];
  }

  /**
   * Check if an invoice already exists for a billing period
   */
  private async hasInvoiceForPeriod(
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('id')
      .eq('billing_subscription_id', subscriptionId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .limit(1);

    if (error) {
      console.error('Error checking for existing invoice:', error);
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Get invoice generation statistics
   */
  async getSchedulerStats(): Promise<{
    isRunning: boolean;
    subscriptionsEndingToday: number;
    overdueUsageRecords: number;
    lastRunTime?: string;
  }> {
    try {
      const subscriptionsEndingToday = await this.getSubscriptionsEndingToday();

      // Get overdue usage count
      const overdueThreshold = new Date();
      overdueThreshold.setDate(overdueThreshold.getDate() - 7);

      const { count: overdueCount } = await supabase
        .from('billing_usage_records')
        .select('id', { count: 'exact' })
        .eq('invoiced', false)
        .is('billing_subscription_id', null)
        .lt('created_at', overdueThreshold.toISOString());

      return {
        isRunning: this.isRunning,
        subscriptionsEndingToday: subscriptionsEndingToday.length,
        overdueUsageRecords: overdueCount || 0,
        lastRunTime: undefined // TODO: Store last run time
      };

    } catch (error) {
      console.error('Error getting scheduler stats:', error);
      return {
        isRunning: this.isRunning,
        subscriptionsEndingToday: 0,
        overdueUsageRecords: 0
      };
    }
  }
}

// Export singleton instance
export const invoiceScheduler = new InvoiceSchedulerService(); 