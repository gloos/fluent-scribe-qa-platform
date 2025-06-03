import { accountDeletionService } from '@/services/AccountDeletionService';

export interface JobResult {
  success: boolean;
  processed: number;
  errors: Array<{ requestId: string; error: string }>;
  timestamp: string;
}

/**
 * Account Deletion Job Handler
 * This class manages the scheduled processing of account deletion requests
 * that are past their grace period.
 */
export class AccountDeletionJob {
  private static isRunning = false;

  /**
   * Process all pending account deletions
   * This method should be called by a scheduled job (e.g., cron job, scheduled task)
   */
  static async processPendingDeletions(): Promise<JobResult> {
    const timestamp = new Date().toISOString();
    
    // Prevent multiple simultaneous executions
    if (this.isRunning) {
      console.log('Account deletion job already running, skipping this execution');
      return {
        success: false,
        processed: 0,
        errors: [{ requestId: 'system', error: 'Job already running' }],
        timestamp
      };
    }

    this.isRunning = true;
    
    try {
      console.log(`[${timestamp}] Starting account deletion job...`);
      
      const result = await accountDeletionService.processPendingDeletions();
      
      console.log(`[${timestamp}] Account deletion job completed:`, {
        processed: result.processed,
        errors: result.errors.length,
        success: result.success
      });

      // Log any errors for monitoring
      if (result.errors.length > 0) {
        console.error(`[${timestamp}] Account deletion job errors:`, result.errors);
      }

      return {
        ...result,
        timestamp
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${timestamp}] Account deletion job failed:`, error);
      
      return {
        success: false,
        processed: 0,
        errors: [{ requestId: 'job', error: errorMessage }],
        timestamp
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start scheduled execution using setInterval
   * This is a simple implementation - in production, use a proper job scheduler
   */
  static startScheduled(intervalMinutes: number = 60): NodeJS.Timeout {
    console.log(`Starting account deletion job scheduler (every ${intervalMinutes} minutes)`);
    
    return setInterval(async () => {
      await this.processPendingDeletions();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop scheduled execution
   */
  static stopScheduled(intervalId: NodeJS.Timeout): void {
    console.log('Stopping account deletion job scheduler');
    clearInterval(intervalId);
  }

  /**
   * Check if job is currently running
   */
  static isJobRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Utility function to create a simple cron-like scheduler
 * This runs the job at specified hours of the day (24-hour format)
 */
export function scheduleDeletionJobAtHours(hours: number[]): NodeJS.Timeout {
  console.log(`Scheduling account deletion job to run at hours: ${hours.join(', ')}`);
  
  const checkInterval = 60 * 1000; // Check every minute
  
  return setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Run at the top of each specified hour (minute 0)
    if (hours.includes(currentHour) && currentMinute === 0) {
      console.log(`Triggering scheduled account deletion job at ${currentHour}:00`);
      await AccountDeletionJob.processPendingDeletions();
    }
  }, checkInterval);
}

/**
 * Initialize the account deletion job scheduler
 * Call this from your application startup
 */
export function initializeAccountDeletionScheduler(): NodeJS.Timeout {
  // Run every day at 2 AM and 2 PM
  return scheduleDeletionJobAtHours([2, 14]);
}

// Export for easy importing
export default AccountDeletionJob; 