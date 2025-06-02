import { createClient } from '@supabase/supabase-js';
import { PaymentProcessingService, PaymentResult } from './payment-processing-service';
import type { BillingInvoice, BillingSubscription, BillingCustomer } from '@/lib/types/billing';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface PaymentWorkflowJob {
  id: string;
  type: 'automatic_payment' | 'retry_payment' | 'payment_reminder' | 'dunning_email';
  invoice_id: string;
  customer_id: string;
  subscription_id?: string;
  scheduled_for: string;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  last_attempt?: string;
  last_error?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentWorkflowConfiguration {
  automatic_payment_enabled: boolean;
  retry_attempts: number;
  retry_intervals: number[]; // Days between retries
  reminder_schedule: number[]; // Days before due date to send reminders
  dunning_schedule: number[]; // Days after failure to send dunning emails
  grace_period_days: number;
  auto_cancel_after_days: number;
}

export interface PaymentWorkflowStats {
  total_scheduled: number;
  pending_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  average_processing_time: number;
  next_batch_size: number;
  next_batch_eta?: string;
}

export class PaymentWorkflowScheduler {
  private paymentProcessor: PaymentProcessingService;
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  
  private defaultConfig: PaymentWorkflowConfiguration = {
    automatic_payment_enabled: true,
    retry_attempts: 3,
    retry_intervals: [1, 3, 7], // 1 day, 3 days, 7 days
    reminder_schedule: [7, 3, 1], // 7, 3, 1 days before due date
    dunning_schedule: [1, 7, 14], // 1, 7, 14 days after failure
    grace_period_days: 3,
    auto_cancel_after_days: 30
  };

  constructor() {
    this.paymentProcessor = new PaymentProcessingService();
  }

  /**
   * Start the payment workflow scheduler
   */
  async start(intervalMs: number = 60000): Promise<void> {
    if (this.isRunning) {
      console.warn('Payment workflow scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting payment workflow scheduler...');

    // Process immediately on start
    await this.processScheduledJobs();

    // Set up recurring processing
    this.processingInterval = setInterval(async () => {
      try {
        await this.processScheduledJobs();
      } catch (error) {
        console.error('Error in scheduled job processing:', error);
      }
    }, intervalMs);

    console.log(`Payment workflow scheduler started with ${intervalMs}ms interval`);
  }

  /**
   * Stop the payment workflow scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Payment workflow scheduler is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    console.log('Payment workflow scheduler stopped');
  }

  /**
   * Schedule automatic payment for an invoice
   */
  async scheduleAutomaticPayment(
    invoiceId: string,
    scheduledFor?: string,
    retryCount: number = 0
  ): Promise<string> {
    try {
      // Get invoice details
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Calculate scheduled time (default to now if not specified)
      const scheduledTime = scheduledFor || new Date().toISOString();

      const job: Omit<PaymentWorkflowJob, 'id' | 'created_at' | 'updated_at'> = {
        type: 'automatic_payment',
        invoice_id: invoiceId,
        customer_id: invoice.billing_customer_id,
        subscription_id: invoice.billing_subscription_id,
        scheduled_for: scheduledTime,
        retry_count: retryCount,
        max_retries: this.defaultConfig.retry_attempts,
        status: 'pending',
        metadata: {
          invoice_amount: invoice.total,
          currency: invoice.currency,
          due_date: invoice.due_date
        }
      };

      const jobId = await this.storeWorkflowJob(job);
      console.log(`Scheduled automatic payment job ${jobId} for invoice ${invoiceId}`);
      
      return jobId;

    } catch (error) {
      console.error('Error scheduling automatic payment:', error);
      throw error;
    }
  }

  /**
   * Schedule payment retry after failure
   */
  async schedulePaymentRetry(
    invoiceId: string,
    retryCount: number,
    lastError?: string
  ): Promise<string> {
    try {
      if (retryCount >= this.defaultConfig.retry_attempts) {
        console.log(`Maximum retry attempts reached for invoice ${invoiceId}`);
        await this.schedulePaymentDunning(invoiceId, 0);
        return '';
      }

      // Calculate retry delay
      const retryDelay = this.defaultConfig.retry_intervals[Math.min(retryCount, this.defaultConfig.retry_intervals.length - 1)];
      const scheduledTime = new Date(Date.now() + (retryDelay * 24 * 60 * 60 * 1000));

      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const job: Omit<PaymentWorkflowJob, 'id' | 'created_at' | 'updated_at'> = {
        type: 'retry_payment',
        invoice_id: invoiceId,
        customer_id: invoice.billing_customer_id,
        subscription_id: invoice.billing_subscription_id,
        scheduled_for: scheduledTime.toISOString(),
        retry_count: retryCount,
        max_retries: this.defaultConfig.retry_attempts,
        status: 'pending',
        last_error: lastError,
        metadata: {
          original_failure_date: new Date().toISOString(),
          retry_delay_days: retryDelay
        }
      };

      const jobId = await this.storeWorkflowJob(job);
      console.log(`Scheduled payment retry ${retryCount + 1} for invoice ${invoiceId} at ${scheduledTime.toISOString()}`);
      
      return jobId;

    } catch (error) {
      console.error('Error scheduling payment retry:', error);
      throw error;
    }
  }

  /**
   * Schedule payment reminders
   */
  async schedulePaymentReminders(invoiceId: string): Promise<string[]> {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice || !invoice.due_date) {
        throw new Error(`Invoice ${invoiceId} not found or has no due date`);
      }

      const dueDate = new Date(invoice.due_date);
      const jobIds: string[] = [];

      for (const daysBefore of this.defaultConfig.reminder_schedule) {
        const reminderDate = new Date(dueDate.getTime() - (daysBefore * 24 * 60 * 60 * 1000));
        
        // Only schedule if reminder date is in the future
        if (reminderDate > new Date()) {
          const job: Omit<PaymentWorkflowJob, 'id' | 'created_at' | 'updated_at'> = {
            type: 'payment_reminder',
            invoice_id: invoiceId,
            customer_id: invoice.billing_customer_id,
            subscription_id: invoice.billing_subscription_id,
            scheduled_for: reminderDate.toISOString(),
            retry_count: 0,
            max_retries: 0,
            status: 'pending',
            metadata: {
              days_before_due: daysBefore,
              due_date: invoice.due_date
            }
          };

          const jobId = await this.storeWorkflowJob(job);
          jobIds.push(jobId);
        }
      }

      console.log(`Scheduled ${jobIds.length} payment reminders for invoice ${invoiceId}`);
      return jobIds;

    } catch (error) {
      console.error('Error scheduling payment reminders:', error);
      throw error;
    }
  }

  /**
   * Schedule dunning emails after payment failures
   */
  async schedulePaymentDunning(invoiceId: string, currentStep: number): Promise<string> {
    try {
      if (currentStep >= this.defaultConfig.dunning_schedule.length) {
        console.log(`Maximum dunning attempts reached for invoice ${invoiceId}, considering cancellation`);
        await this.handleMaxDunningReached(invoiceId);
        return '';
      }

      const daysDelay = this.defaultConfig.dunning_schedule[currentStep];
      const scheduledTime = new Date(Date.now() + (daysDelay * 24 * 60 * 60 * 1000));

      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const job: Omit<PaymentWorkflowJob, 'id' | 'created_at' | 'updated_at'> = {
        type: 'dunning_email',
        invoice_id: invoiceId,
        customer_id: invoice.billing_customer_id,
        subscription_id: invoice.billing_subscription_id,
        scheduled_for: scheduledTime.toISOString(),
        retry_count: currentStep,
        max_retries: this.defaultConfig.dunning_schedule.length - 1,
        status: 'pending',
        metadata: {
          dunning_step: currentStep + 1,
          total_dunning_steps: this.defaultConfig.dunning_schedule.length,
          escalation_level: this.getDunningEscalationLevel(currentStep)
        }
      };

      const jobId = await this.storeWorkflowJob(job);
      console.log(`Scheduled dunning email step ${currentStep + 1} for invoice ${invoiceId}`);
      
      return jobId;

    } catch (error) {
      console.error('Error scheduling payment dunning:', error);
      throw error;
    }
  }

  /**
   * Process all scheduled jobs that are due
   */
  async processScheduledJobs(): Promise<void> {
    try {
      // Get jobs that are due for processing
      const dueJobs = await this.getDueJobs();
      
      if (dueJobs.length === 0) {
        return;
      }

      console.log(`Processing ${dueJobs.length} scheduled payment jobs`);

      for (const job of dueJobs) {
        try {
          await this.markJobAsRunning(job.id);
          await this.processJob(job);
          await this.markJobAsCompleted(job.id);
        } catch (error) {
          console.error(`Error processing job ${job.id}:`, error);
          await this.markJobAsFailed(job.id, error instanceof Error ? error.message : 'Unknown error');
        }
      }

    } catch (error) {
      console.error('Error processing scheduled jobs:', error);
      throw error;
    }
  }

  /**
   * Process a single workflow job
   */
  private async processJob(job: PaymentWorkflowJob): Promise<void> {
    console.log(`Processing ${job.type} job ${job.id} for invoice ${job.invoice_id}`);

    switch (job.type) {
      case 'automatic_payment':
        await this.processAutomaticPaymentJob(job);
        break;

      case 'retry_payment':
        await this.processRetryPaymentJob(job);
        break;

      case 'payment_reminder':
        await this.processPaymentReminderJob(job);
        break;

      case 'dunning_email':
        await this.processDunningEmailJob(job);
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async processAutomaticPaymentJob(job: PaymentWorkflowJob): Promise<void> {
    try {
      const result = await this.paymentProcessor.processAutomaticPayment(job.invoice_id);
      
      if (!result.success) {
        // Payment failed, schedule retry
        await this.schedulePaymentRetry(
          job.invoice_id,
          job.retry_count + 1,
          result.error?.message
        );
      } else {
        console.log(`Automatic payment successful for invoice ${job.invoice_id}`);
      }

    } catch (error) {
      console.error(`Automatic payment job failed for invoice ${job.invoice_id}:`, error);
      await this.schedulePaymentRetry(
        job.invoice_id,
        job.retry_count + 1,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async processRetryPaymentJob(job: PaymentWorkflowJob): Promise<void> {
    try {
      const result = await this.paymentProcessor.processAutomaticPayment(job.invoice_id, job.retry_count);
      
      if (!result.success) {
        // Payment failed again, schedule next retry or dunning
        if (job.retry_count + 1 < job.max_retries) {
          await this.schedulePaymentRetry(
            job.invoice_id,
            job.retry_count + 1,
            result.error?.message
          );
        } else {
          // Max retries reached, start dunning process
          await this.schedulePaymentDunning(job.invoice_id, 0);
        }
      } else {
        console.log(`Payment retry successful for invoice ${job.invoice_id}`);
      }

    } catch (error) {
      console.error(`Payment retry job failed for invoice ${job.invoice_id}:`, error);
      
      if (job.retry_count + 1 < job.max_retries) {
        await this.schedulePaymentRetry(
          job.invoice_id,
          job.retry_count + 1,
          error instanceof Error ? error.message : 'Unknown error'
        );
      } else {
        await this.schedulePaymentDunning(job.invoice_id, 0);
      }
    }
  }

  private async processPaymentReminderJob(job: PaymentWorkflowJob): Promise<void> {
    try {
      console.log(`Sending payment reminder for invoice ${job.invoice_id}`);
      
      // Get invoice and customer details
      const invoice = await this.getInvoice(job.invoice_id);
      const customer = await this.getCustomer(job.customer_id);
      
      if (!invoice || !customer) {
        throw new Error('Invoice or customer not found');
      }

      // TODO: Send actual reminder email
      console.log(`Payment reminder sent to ${customer.email} for invoice ${invoice.stripe_invoice_id}`);

    } catch (error) {
      console.error(`Payment reminder job failed for invoice ${job.invoice_id}:`, error);
      throw error;
    }
  }

  private async processDunningEmailJob(job: PaymentWorkflowJob): Promise<void> {
    try {
      console.log(`Sending dunning email step ${job.retry_count + 1} for invoice ${job.invoice_id}`);
      
      // Get invoice and customer details
      const invoice = await this.getInvoice(job.invoice_id);
      const customer = await this.getCustomer(job.customer_id);
      
      if (!invoice || !customer) {
        throw new Error('Invoice or customer not found');
      }

      const escalationLevel = this.getDunningEscalationLevel(job.retry_count);
      
      // TODO: Send actual dunning email with appropriate tone
      console.log(`Dunning email (${escalationLevel}) sent to ${customer.email} for invoice ${invoice.stripe_invoice_id}`);

      // Schedule next dunning email if not at max
      if (job.retry_count + 1 < job.max_retries) {
        await this.schedulePaymentDunning(job.invoice_id, job.retry_count + 1);
      } else {
        await this.handleMaxDunningReached(job.invoice_id);
      }

    } catch (error) {
      console.error(`Dunning email job failed for invoice ${job.invoice_id}:`, error);
      throw error;
    }
  }

  private getDunningEscalationLevel(step: number): 'friendly' | 'firm' | 'final' {
    if (step === 0) return 'friendly';
    if (step === 1) return 'firm';
    return 'final';
  }

  private async handleMaxDunningReached(invoiceId: string): Promise<void> {
    try {
      console.log(`Maximum dunning attempts reached for invoice ${invoiceId}`);
      
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice || !invoice.billing_subscription_id) {
        return;
      }

      // Check if subscription should be canceled after grace period
      const gracePeriodEnd = new Date(Date.now() + (this.defaultConfig.grace_period_days * 24 * 60 * 60 * 1000));
      
      // TODO: Implement subscription cancellation logic
      console.log(`Subscription ${invoice.billing_subscription_id} marked for cancellation after grace period (${gracePeriodEnd.toISOString()})`);

    } catch (error) {
      console.error('Error handling max dunning reached:', error);
    }
  }

  /**
   * Database operations
   */
  private async getDueJobs(): Promise<PaymentWorkflowJob[]> {
    // For now, return empty array since we don't have the payment_workflow_jobs table yet
    // In a real implementation:
    /*
    const { data, error } = await supabase
      .from('payment_workflow_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch due jobs: ${error.message}`);
    }

    return data || [];
    */
    return [];
  }

  private async storeWorkflowJob(job: Omit<PaymentWorkflowJob, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    // For now, return a mock ID
    // In a real implementation:
    /*
    const { data, error } = await supabase
      .from('payment_workflow_jobs')
      .insert({
        ...job,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store workflow job: ${error.message}`);
    }

    return data.id;
    */
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async markJobAsRunning(jobId: string): Promise<void> {
    // In a real implementation:
    /*
    const { error } = await supabase
      .from('payment_workflow_jobs')
      .update({
        status: 'running',
        last_attempt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to mark job as running: ${error.message}`);
    }
    */
    console.log(`Job ${jobId} marked as running`);
  }

  private async markJobAsCompleted(jobId: string): Promise<void> {
    // In a real implementation:
    /*
    const { error } = await supabase
      .from('payment_workflow_jobs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to mark job as completed: ${error.message}`);
    }
    */
    console.log(`Job ${jobId} marked as completed`);
  }

  private async markJobAsFailed(jobId: string, error: string): Promise<void> {
    // In a real implementation:
    /*
    const { error: updateError } = await supabase
      .from('payment_workflow_jobs')
      .update({
        status: 'failed',
        last_error: error,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error(`Failed to mark job as failed: ${updateError.message}`);
    }
    */
    console.log(`Job ${jobId} marked as failed: ${error}`);
  }

  private async getInvoice(invoiceId: string): Promise<BillingInvoice | null> {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }

    return data as BillingInvoice;
  }

  private async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    const { data, error } = await supabase
      .from('billing_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data as BillingCustomer;
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<PaymentWorkflowStats> {
    try {
      // For now, return mock stats
      // In a real implementation, query the payment_workflow_jobs table
      return {
        total_scheduled: 0,
        pending_jobs: 0,
        running_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        success_rate: 0,
        average_processing_time: 0,
        next_batch_size: 0
      };

    } catch (error) {
      console.error('Error getting workflow stats:', error);
      return {
        total_scheduled: 0,
        pending_jobs: 0,
        running_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        success_rate: 0,
        average_processing_time: 0,
        next_batch_size: 0
      };
    }
  }

  /**
   * Update workflow configuration
   */
  updateConfiguration(config: Partial<PaymentWorkflowConfiguration>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    console.log('Payment workflow configuration updated:', this.defaultConfig);
  }

  /**
   * Get current workflow configuration
   */
  getConfiguration(): PaymentWorkflowConfiguration {
    return { ...this.defaultConfig };
  }
}

// Export singleton instance
export const paymentWorkflowScheduler = new PaymentWorkflowScheduler(); 