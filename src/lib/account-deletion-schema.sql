-- Account Deletion System Database Schema
-- This file contains the database tables and functions needed for secure account deletion

-- Create deletion_requests table for tracking account deletion workflows
CREATE TABLE IF NOT EXISTS public.deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Request details
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_scheduled TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'grace_period' CHECK (status IN ('grace_period', 'processing', 'completed', 'cancelled')),
    
    -- User provided information
    reason TEXT,
    feedback TEXT,
    data_exported BOOLEAN DEFAULT FALSE,
    
    -- Processing tracking
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id), -- For admin processing
    
    -- Deletion details
    data_deletion_completed BOOLEAN DEFAULT FALSE,
    auth_deletion_completed BOOLEAN DEFAULT FALSE,
    deletion_errors JSONB DEFAULT '[]',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON public.deletion_requests(completion_scheduled);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_created ON public.deletion_requests(created_at);

-- Create deletion_audit_log table for detailed audit trail
CREATE TABLE IF NOT EXISTS public.deletion_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deletion_request_id UUID NOT NULL REFERENCES public.deletion_requests(id) ON DELETE CASCADE,
    
    -- Action details
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'request_created', 'request_cancelled', 'grace_period_reminder', 
        'processing_started', 'data_deletion_started', 'data_deletion_completed',
        'auth_deletion_started', 'auth_deletion_completed', 'deletion_completed',
        'deletion_failed', 'cancellation_requested'
    )),
    
    -- Context
    performed_by UUID REFERENCES auth.users(id), -- NULL for system actions
    ip_address INET,
    user_agent TEXT,
    
    -- Details
    details JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_deletion_audit_deletion_id ON public.deletion_audit_log(deletion_request_id);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_action ON public.deletion_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_created ON public.deletion_audit_log(created_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_deletion_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating updated_at
DROP TRIGGER IF EXISTS trigger_update_deletion_request_updated_at ON public.deletion_requests;
CREATE TRIGGER trigger_update_deletion_request_updated_at
    BEFORE UPDATE ON public.deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_deletion_request_updated_at();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION log_deletion_action(
    p_deletion_request_id UUID,
    p_action VARCHAR(50),
    p_performed_by UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.deletion_audit_log (
        deletion_request_id,
        action,
        performed_by,
        ip_address,
        user_agent,
        details,
        error_message
    ) VALUES (
        p_deletion_request_id,
        p_action,
        p_performed_by,
        p_ip_address,
        p_user_agent,
        p_details,
        p_error_message
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending deletion requests that are ready for processing
CREATE OR REPLACE FUNCTION get_pending_deletions()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    completion_scheduled TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    feedback TEXT,
    data_exported BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.id,
        dr.user_id,
        dr.completion_scheduled,
        dr.reason,
        dr.feedback,
        dr.data_exported
    FROM public.deletion_requests dr
    WHERE dr.status = 'grace_period'
    AND dr.completion_scheduled <= NOW()
    ORDER BY dr.completion_scheduled ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely delete user data (anonymize what can't be deleted)
CREATE OR REPLACE FUNCTION process_user_data_deletion(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    deletion_summary JSONB := '{}';
    error_summary JSONB := '[]';
    current_error TEXT;
BEGIN
    -- Start transaction
    BEGIN
        -- Delete user preferences
        DELETE FROM public.user_preferences WHERE user_id = p_user_id;
        deletion_summary := jsonb_set(deletion_summary, '{user_preferences}', 'true');
        
        -- Delete QA sessions
        DELETE FROM public.qa_sessions WHERE user_id = p_user_id;
        deletion_summary := jsonb_set(deletion_summary, '{qa_sessions}', 'true');
        
        -- Delete user feedback
        DELETE FROM public.user_feedback WHERE user_id = p_user_id;
        deletion_summary := jsonb_set(deletion_summary, '{user_feedback}', 'true');
        
        -- Anonymize audit logs (keep for compliance but remove personal info)
        UPDATE public.audit_logs 
        SET user_id = NULL,
            user_email = 'deleted-user@anonymized.local',
            details = jsonb_set(COALESCE(details, '{}'), '{anonymized}', 'true')
        WHERE user_id = p_user_id;
        deletion_summary := jsonb_set(deletion_summary, '{audit_logs_anonymized}', 'true');
        
        -- Delete profile data
        DELETE FROM public.profiles WHERE id = p_user_id;
        deletion_summary := jsonb_set(deletion_summary, '{profiles}', 'true');
        
        -- Note: We don't delete from auth.users here as that requires special handling
        
    EXCEPTION WHEN OTHERS THEN
        current_error := SQLERRM;
        error_summary := error_summary || jsonb_build_object(
            'error', current_error,
            'timestamp', NOW()
        );
    END;
    
    RETURN jsonb_build_object(
        'success', jsonb_array_length(error_summary) = 0,
        'deleted', deletion_summary,
        'errors', error_summary
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security policies
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own deletion requests
CREATE POLICY "Users can view their own deletion requests" ON public.deletion_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to create their own deletion requests
CREATE POLICY "Users can create their own deletion requests" ON public.deletion_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own deletion requests (for cancellation)
CREATE POLICY "Users can update their own deletion requests" ON public.deletion_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for viewing audit logs of their own deletion requests
CREATE POLICY "Users can view audit logs of their deletion requests" ON public.deletion_audit_log
    FOR SELECT USING (
        deletion_request_id IN (
            SELECT id FROM public.deletion_requests WHERE user_id = auth.uid()
        )
    );

-- Admin policies (for system processing)
-- Note: These would typically be restricted to service role or admin users
CREATE POLICY "Service role can manage all deletion requests" ON public.deletion_requests
    FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role can manage all audit logs" ON public.deletion_audit_log
    FOR ALL USING (current_setting('role') = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.deletion_requests TO authenticated;
GRANT SELECT ON public.deletion_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_deletion_action TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_deletions TO service_role;
GRANT EXECUTE ON FUNCTION process_user_data_deletion TO service_role; 