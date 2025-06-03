import { supabase } from '@/lib/supabase';

export interface DeletionRequest {
  id: string;
  userId: string;
  requestedAt: string;
  completionScheduled: string;
  status: 'grace_period' | 'processing' | 'completed' | 'cancelled';
  reason?: string;
  feedback?: string;
  dataExported: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  processedAt?: string;
  processedBy?: string;
  dataDeletionCompleted: boolean;
  authDeletionCompleted: boolean;
  deletionErrors: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeletionRequestData {
  userId: string;
  completionScheduled: string;
  reason?: string;
  feedback?: string;
  dataExported: boolean;
}

export interface DeletionAuditLog {
  id: string;
  deletionRequestId: string;
  action: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  details: any;
  errorMessage?: string;
  createdAt: string;
}

export interface DeleteUserDataResult {
  success: boolean;
  deleted: Record<string, boolean>;
  errors: Array<{ error: string; timestamp: string }>;
}

class AccountDeletionService {
  /**
   * Create a new account deletion request
   */
  async createDeletionRequest(data: CreateDeletionRequestData): Promise<{ 
    success: boolean; 
    data?: DeletionRequest; 
    error?: string 
  }> {
    try {
      const { data: result, error } = await supabase
        .from('deletion_requests')
        .insert({
          user_id: data.userId,
          completion_scheduled: data.completionScheduled,
          reason: data.reason,
          feedback: data.feedback,
          data_exported: data.dataExported,
          status: 'grace_period'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating deletion request:', error);
        return { success: false, error: error.message };
      }

      // Log the creation
      await this.logDeletionAction(
        result.id,
        'request_created',
        data.userId,
        null,
        null,
        { reason: data.reason, dataExported: data.dataExported }
      );

      return { 
        success: true, 
        data: this.transformDeletionRequest(result)
      };
    } catch (error) {
      console.error('Service error creating deletion request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get deletion request for a user
   */
  async getDeletionRequest(userId: string): Promise<{
    success: boolean;
    data?: DeletionRequest;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['grace_period', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching deletion request:', error);
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: data ? this.transformDeletionRequest(data) : undefined
      };
    } catch (error) {
      console.error('Service error fetching deletion request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Cancel a deletion request during grace period
   */
  async cancelDeletionRequest(
    requestId: string, 
    userId: string, 
    cancellationReason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('deletion_requests')
        .update({
          status: 'cancelled',
          cancellation_reason: cancellationReason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId
        })
        .eq('id', requestId)
        .eq('user_id', userId)
        .eq('status', 'grace_period')
        .select()
        .single();

      if (error) {
        console.error('Error cancelling deletion request:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Deletion request not found or cannot be cancelled' };
      }

      // Log the cancellation
      await this.logDeletionAction(
        requestId,
        'request_cancelled',
        userId,
        null,
        null,
        { cancellationReason }
      );

      return { success: true };
    } catch (error) {
      console.error('Service error cancelling deletion request:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get audit log for a deletion request
   */
  async getDeletionAuditLog(requestId: string): Promise<{
    success: boolean;
    data?: DeletionAuditLog[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('deletion_audit_log')
        .select('*')
        .eq('deletion_request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching audit log:', error);
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: data?.map(this.transformAuditLog) || []
      };
    } catch (error) {
      console.error('Service error fetching audit log:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Process pending deletions (typically called by scheduled job)
   */
  async processPendingDeletions(): Promise<{
    success: boolean;
    processed: number;
    errors: Array<{ requestId: string; error: string }>;
  }> {
    try {
      // Get pending deletions that are ready for processing
      const { data: pendingDeletions, error: fetchError } = await supabase
        .rpc('get_pending_deletions');

      if (fetchError) {
        console.error('Error fetching pending deletions:', fetchError);
        return { success: false, processed: 0, errors: [{ requestId: 'fetch', error: fetchError.message }] };
      }

      const errors: Array<{ requestId: string; error: string }> = [];
      let processed = 0;

      for (const deletion of pendingDeletions || []) {
        try {
          await this.processSingleDeletion(deletion);
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ requestId: deletion.id, error: errorMessage });
          console.error(`Failed to process deletion ${deletion.id}:`, error);
        }
      }

      return { success: true, processed, errors };
    } catch (error) {
      console.error('Service error processing pending deletions:', error);
      return { 
        success: false, 
        processed: 0, 
        errors: [{ requestId: 'service', error: error instanceof Error ? error.message : 'Unknown error' }]
      };
    }
  }

  /**
   * Process a single deletion request
   */
  private async processSingleDeletion(deletion: any): Promise<void> {
    const requestId = deletion.id;
    const userId = deletion.user_id;

    try {
      // Mark as processing
      await supabase
        .from('deletion_requests')
        .update({ 
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      await this.logDeletionAction(requestId, 'processing_started', null, null, null, {});

      // Delete user data
      await this.logDeletionAction(requestId, 'data_deletion_started', null, null, null, {});
      
      const { data: deletionResult, error: dataError } = await supabase
        .rpc('process_user_data_deletion', { p_user_id: userId });

      if (dataError || !deletionResult?.success) {
        throw new Error(`Data deletion failed: ${dataError?.message || 'Unknown error'}`);
      }

      // Update deletion request with data deletion completion
      await supabase
        .from('deletion_requests')
        .update({ data_deletion_completed: true })
        .eq('id', requestId);

      await this.logDeletionAction(
        requestId, 
        'data_deletion_completed', 
        null, 
        null, 
        null, 
        { deletionSummary: deletionResult.deleted }
      );

      // Delete from auth.users (this requires admin privileges)
      await this.logDeletionAction(requestId, 'auth_deletion_started', null, null, null, {});
      
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        // Log the error but don't fail the entire process
        await this.logDeletionAction(
          requestId, 
          'deletion_failed', 
          null, 
          null, 
          null, 
          {}, 
          `Auth deletion failed: ${authError.message}`
        );
        
        // Update with partial completion
        await supabase
          .from('deletion_requests')
          .update({ 
            deletion_errors: [{ type: 'auth_deletion', error: authError.message }]
          })
          .eq('id', requestId);
      } else {
        // Mark auth deletion as completed
        await supabase
          .from('deletion_requests')
          .update({ auth_deletion_completed: true })
          .eq('id', requestId);

        await this.logDeletionAction(requestId, 'auth_deletion_completed', null, null, null, {});
      }

      // Mark overall deletion as completed
      await supabase
        .from('deletion_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);

      await this.logDeletionAction(requestId, 'deletion_completed', null, null, null, {});

    } catch (error) {
      console.error(`Error processing deletion ${requestId}:`, error);
      
      // Update deletion request with error
      await supabase
        .from('deletion_requests')
        .update({ 
          status: 'grace_period', // Reset to grace period for manual intervention
          deletion_errors: [{ type: 'processing', error: error instanceof Error ? error.message : 'Unknown error' }]
        })
        .eq('id', requestId);

      await this.logDeletionAction(
        requestId, 
        'deletion_failed', 
        null, 
        null, 
        null, 
        {}, 
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  /**
   * Log deletion action for audit trail
   */
  private async logDeletionAction(
    deletionRequestId: string,
    action: string,
    performedBy: string | null,
    ipAddress: string | null,
    userAgent: string | null,
    details: any = {},
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_deletion_action', {
        p_deletion_request_id: deletionRequestId,
        p_action: action,
        p_performed_by: performedBy,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_details: details,
        p_error_message: errorMessage
      });
    } catch (error) {
      console.error('Failed to log deletion action:', error);
      // Don't throw here as logging failures shouldn't break the main flow
    }
  }

  /**
   * Transform database deletion request to service format
   */
  private transformDeletionRequest(dbData: any): DeletionRequest {
    return {
      id: dbData.id,
      userId: dbData.user_id,
      requestedAt: dbData.requested_at,
      completionScheduled: dbData.completion_scheduled,
      status: dbData.status,
      reason: dbData.reason,
      feedback: dbData.feedback,
      dataExported: dbData.data_exported,
      cancellationReason: dbData.cancellation_reason,
      cancelledAt: dbData.cancelled_at,
      cancelledBy: dbData.cancelled_by,
      processedAt: dbData.processed_at,
      processedBy: dbData.processed_by,
      dataDeletionCompleted: dbData.data_deletion_completed,
      authDeletionCompleted: dbData.auth_deletion_completed,
      deletionErrors: dbData.deletion_errors || [],
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at
    };
  }

  /**
   * Transform database audit log to service format
   */
  private transformAuditLog(dbData: any): DeletionAuditLog {
    return {
      id: dbData.id,
      deletionRequestId: dbData.deletion_request_id,
      action: dbData.action,
      performedBy: dbData.performed_by,
      ipAddress: dbData.ip_address,
      userAgent: dbData.user_agent,
      details: dbData.details || {},
      errorMessage: dbData.error_message,
      createdAt: dbData.created_at
    };
  }

  /**
   * Check if user has an active deletion request
   */
  async hasActiveDeletionRequest(userId: string): Promise<boolean> {
    try {
      const result = await this.getDeletionRequest(userId);
      return result.success && !!result.data;
    } catch (error) {
      console.error('Error checking active deletion request:', error);
      return false;
    }
  }

  /**
   * Get days remaining in grace period
   */
  calculateGracePeriodDaysRemaining(completionScheduled: string): number {
    const now = new Date();
    const scheduledDate = new Date(completionScheduled);
    const diffTime = scheduledDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

export const accountDeletionService = new AccountDeletionService(); 