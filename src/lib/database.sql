-- AI-Powered Linguistic QA Platform Database Schema

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT, -- Optional display name different from full_name
    avatar_url TEXT,
    phone TEXT,
    bio TEXT,
    
    -- Role and permissions
    role TEXT DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'manager', 'qa_analyst', 'user', 'guest')),
    
    -- Organization and team structure
    organization_id UUID,
    department TEXT,
    job_title TEXT,
    manager_id UUID REFERENCES public.profiles(id),
    
    -- User status and activity
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending', 'deactivated')),
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    
    -- Security fields
    password_changed_at TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    backup_codes_generated_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- User preferences
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en-US',
    date_format TEXT DEFAULT 'yyyy-MM-dd',
    time_format TEXT DEFAULT '24h',
    
    -- Metadata
    user_agent TEXT, -- Last used user agent
    ip_address INET, -- Last known IP address
    signup_source TEXT, -- How they signed up (web, api, invite, etc.)
    referral_code TEXT, -- If they were referred
    marketing_consent BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Create audit_logs table for comprehensive role-based access logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Event identification
    event_type TEXT NOT NULL CHECK (event_type IN (
        'PERMISSION_CHECK', 
        'ROLE_ASSIGNED', 
        'ROLE_REMOVED', 
        'ACCESS_GRANTED', 
        'ACCESS_DENIED',
        'ROLE_UPDATED',
        'PERMISSION_GRANTED',
        'PERMISSION_DENIED',
        'RESOURCE_ACCESS',
        'SECURITY_VIOLATION',
        'PRIVILEGE_ESCALATION',
        'SUSPICIOUS_ACTIVITY'
    )),
    
    -- Core audit information
    user_id UUID REFERENCES public.profiles(id),
    affected_user_id UUID REFERENCES public.profiles(id), -- For role assignments affecting others
    actor_email TEXT, -- Email for identification even if user deleted
    affected_email TEXT,
    
    -- Permission and role context
    permission_checked TEXT, -- Permission being checked
    role_from TEXT, -- Previous role (for role changes)
    role_to TEXT, -- New role (for role changes)
    current_user_role TEXT, -- Actor's role at time of action
    
    -- Resource context
    resource_type TEXT, -- Type of resource accessed
    resource_id TEXT, -- ID of specific resource
    resource_name TEXT, -- Human-readable resource name
    organization_id UUID REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id),
    
    -- Request details
    request_path TEXT, -- API endpoint or page accessed
    request_method TEXT, -- HTTP method (GET, POST, etc.)
    request_body JSONB, -- Sanitized request data
    
    -- Result and metadata
    result TEXT NOT NULL CHECK (result IN ('granted', 'denied', 'error', 'warning')),
    reason TEXT, -- Explanation for the result
    
    -- Session and security context
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    
    -- Geographic and temporal context
    geo_location JSONB, -- City, country, timezone
    
    -- Detailed event metadata
    metadata JSONB DEFAULT '{}', -- Additional event-specific data
    
    -- Risk assessment
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score INTEGER DEFAULT 100 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For retention policy
    
    -- Compliance flags
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Data retention
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT, -- Email domain for auto-assignment
    description TEXT,
    website TEXT,
    logo_url TEXT,
    
    -- Organization settings
    max_users INTEGER DEFAULT 50,
    max_storage_gb INTEGER DEFAULT 10,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
    
    -- Contact information
    contact_email TEXT,
    contact_phone TEXT,
    billing_email TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'US',
    
    -- Settings
    timezone TEXT DEFAULT 'UTC',
    date_format TEXT DEFAULT 'yyyy-MM-dd',
    currency TEXT DEFAULT 'USD',
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'trial')),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Add foreign key constraint for organization_id in profiles
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_organization_id 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

-- Create projects table for grouping QA sessions
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Business context
    client_name TEXT,
    project_type TEXT DEFAULT 'translation' CHECK (project_type IN ('translation', 'review', 'post_editing', 'terminology', 'style_guide')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Timeline
    start_date DATE,
    end_date DATE,
    deadline DATE,
    
    -- Status and progress
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled', 'archived')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- QA Settings - default values for sessions in this project
    default_qa_settings JSONB DEFAULT '{"autoAnalyze": true, "severity": "major", "mqmThreshold": 25}',
    quality_threshold INTEGER DEFAULT 85, -- Minimum acceptable quality score
    
    -- Metadata
    tags TEXT[], -- Array of tags for categorization
    metadata JSONB DEFAULT '{}', -- Flexible metadata storage
    
    -- Relationships and permissions
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members table for user assignments and permissions
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Role in project
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'qa_lead', 'translator', 'reviewer', 'member')),
    
    -- Permissions
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false, "manage": false}',
    
    -- Assignment details
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    
    -- Unique constraint to prevent duplicate assignments
    UNIQUE(project_id, user_id)
);

-- Create project_milestones table for tracking project phases
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Timeline
    due_date DATE,
    completed_date DATE,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
    
    -- Progress
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Order for display
    sort_order INTEGER DEFAULT 0,
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update qa_sessions table to reference projects
ALTER TABLE public.qa_sessions 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create assessment_criteria table for configurable quality standards
CREATE TABLE IF NOT EXISTS public.assessment_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    framework TEXT DEFAULT 'MQM' CHECK (framework IN ('MQM', 'DQF', 'CUSTOM', 'LISA_QA', 'SAE_J2450')),
    version TEXT DEFAULT '1.0',
    
    -- Ownership and scope
    organization_id UUID REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id), -- Criteria can be project-specific
    is_global BOOLEAN DEFAULT FALSE, -- Global criteria available to all
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Criteria definition
    criteria_config JSONB NOT NULL DEFAULT '{}', -- Detailed criteria configuration
    weight_distribution JSONB DEFAULT '{}', -- How different criteria are weighted
    
    -- Scoring configuration
    max_score DECIMAL(5,2) DEFAULT 100.00,
    passing_threshold DECIMAL(5,2) DEFAULT 85.00,
    
    -- Metadata
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assessment_templates table for reusable assessment configurations
CREATE TABLE IF NOT EXISTS public.assessment_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template configuration
    criteria_id UUID REFERENCES public.assessment_criteria(id) ON DELETE CASCADE,
    template_config JSONB NOT NULL DEFAULT '{}', -- Assessment workflow configuration
    
    -- Scope and usage
    organization_id UUID REFERENCES public.organizations(id),
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assessment_results table for normalized assessment data
CREATE TABLE IF NOT EXISTS public.assessment_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.qa_sessions(id) ON DELETE CASCADE,
    criteria_id UUID REFERENCES public.assessment_criteria(id),
    
    -- Assessment metadata
    assessment_type TEXT DEFAULT 'automatic' CHECK (assessment_type IN ('automatic', 'manual', 'hybrid', 'review')),
    assessor_id UUID REFERENCES public.profiles(id), -- Who performed the assessment
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'in_progress', 'completed', 'approved', 'rejected')),
    
    -- Overall scores
    overall_score DECIMAL(5,2),
    mqm_score DECIMAL(5,2),
    fluency_score DECIMAL(5,2),
    adequacy_score DECIMAL(5,2),
    
    -- Detailed metrics
    total_segments INTEGER DEFAULT 0,
    assessed_segments INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    suggestion_count INTEGER DEFAULT 0,
    
    -- Score breakdown
    score_breakdown JSONB DEFAULT '{}', -- Detailed score per criterion
    quality_metrics JSONB DEFAULT '{}', -- Additional quality metrics
    
    -- Assessment metadata
    assessment_duration INTEGER, -- Time spent in seconds
    confidence_level DECIMAL(3,2) DEFAULT 0.85, -- Confidence in assessment
    
    -- Workflow tracking
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.profiles(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assessment_segments table for segment-level assessment data
CREATE TABLE IF NOT EXISTS public.assessment_segments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_result_id UUID REFERENCES public.assessment_results(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.qa_sessions(id) ON DELETE CASCADE,
    
    -- Segment identification
    segment_id TEXT NOT NULL, -- XLIFF segment ID
    segment_index INTEGER, -- Position in file
    
    -- Content
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    context_text TEXT, -- Additional context
    
    -- Segment-level scores
    segment_score DECIMAL(5,2),
    fluency_score DECIMAL(5,2),
    adequacy_score DECIMAL(5,2),
    
    -- Metrics
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    
    -- Assessment details
    issues_found JSONB DEFAULT '[]', -- Array of issues found in this segment
    suggestions JSONB DEFAULT '[]', -- Improvement suggestions
    notes TEXT, -- Assessor notes
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assessed_by UUID REFERENCES public.profiles(id),
    
    -- Index for fast segment lookups
    UNIQUE(assessment_result_id, segment_id)
);

-- Enhance qa_errors table with better categorization and assessment links
ALTER TABLE public.qa_errors 
ADD COLUMN IF NOT EXISTS assessment_result_id UUID REFERENCES public.assessment_results(id),
ADD COLUMN IF NOT EXISTS assessment_segment_id UUID REFERENCES public.assessment_segments(id),
ADD COLUMN IF NOT EXISTS error_weight DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS mqm_category TEXT,
ADD COLUMN IF NOT EXISTS mqm_severity TEXT,
ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'accepted', 'disputed', 'wont_fix'));

-- Create assessment_comparisons table for comparative analysis
CREATE TABLE IF NOT EXISTS public.assessment_comparisons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Comparison configuration
    comparison_type TEXT DEFAULT 'before_after' CHECK (comparison_type IN ('before_after', 'ab_test', 'multi_version', 'assessor_agreement')),
    
    -- Related assessments
    baseline_result_id UUID REFERENCES public.assessment_results(id),
    target_result_id UUID REFERENCES public.assessment_results(id),
    
    -- Results
    comparison_results JSONB DEFAULT '{}',
    improvement_percentage DECIMAL(5,2),
    statistical_significance DECIMAL(3,2),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create qa_sessions table
CREATE TABLE IF NOT EXISTS public.qa_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('xliff', 'xlf', 'mxliff')),
    file_size BIGINT NOT NULL,
    file_path TEXT, -- Storage path for uploaded file
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    mqm_score DECIMAL(5,2),
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    analysis_results JSONB, -- Store detailed analysis results
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create qa_errors table
CREATE TABLE IF NOT EXISTS public.qa_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.qa_sessions(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    error_description TEXT NOT NULL,
    suggestion TEXT,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create file_uploads table for storage tracking
CREATE TABLE IF NOT EXISTS public.file_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.qa_sessions(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_bucket TEXT DEFAULT 'qa-files',
    upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    preferred_language TEXT DEFAULT 'en',
    notification_settings JSONB DEFAULT '{"email": true, "browser": true}',
    analysis_settings JSONB DEFAULT '{"autoAnalyze": true, "severity": "major"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_feedback table for collecting feedback on error categorizations and system effectiveness
CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Feedback target - what is being reviewed
    target_type TEXT NOT NULL CHECK (target_type IN ('error_instance', 'categorization_result', 'assessment_result', 'taxonomy_category', 'system_suggestion')),
    target_id UUID NOT NULL, -- References error, assessment, or categorization ID
    
    -- User information
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_role TEXT, -- Role at time of feedback
    
    -- Feedback classification
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('quick_rating', 'detailed_form', 'category_correction', 'suggestion', 'effectiveness_rating')),
    feedback_source TEXT DEFAULT 'manual' CHECK (feedback_source IN ('manual', 'prompted', 'workflow', 'automated')),
    
    -- Content
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
    category_suggestion JSONB, -- Suggested MQM categorization changes
    comment TEXT, -- Free text feedback
    
    -- Context and workflow
    session_id UUID REFERENCES public.qa_sessions(id) ON DELETE SET NULL,
    assessment_result_id UUID REFERENCES public.assessment_results(id) ON DELETE SET NULL,
    original_categorization JSONB, -- Original error categorization
    suggested_categorization JSONB, -- User's suggested categorization
    
    -- Metadata
    confidence_level DECIMAL(3,2) DEFAULT 0.75 CHECK (confidence_level >= 0 AND confidence_level <= 1),
    interaction_context JSONB DEFAULT '{}', -- UI context, workflow step, etc.
    device_info JSONB DEFAULT '{}', -- Device/browser info for UX analysis
    response_time_ms INTEGER, -- Time taken to provide feedback
    
    -- Status and workflow
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'implemented', 'rejected', 'pending')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Effectiveness tracking
    was_helpful BOOLEAN, -- Did this feedback improve the system?
    implementation_date TIMESTAMP WITH TIME ZONE, -- When changes were applied
    impact_score DECIMAL(3,2), -- Measured improvement from this feedback
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback_metrics table for aggregated feedback analytics
CREATE TABLE IF NOT EXISTS public.feedback_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Metrics scope
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    
    -- Feedback volume metrics
    total_feedback_count INTEGER DEFAULT 0,
    quick_rating_count INTEGER DEFAULT 0,
    detailed_feedback_count INTEGER DEFAULT 0,
    category_correction_count INTEGER DEFAULT 0,
    
    -- Quality metrics
    average_rating DECIMAL(3,2),
    satisfaction_score DECIMAL(3,2), -- Overall user satisfaction
    response_rate DECIMAL(3,2), -- % of prompts that received feedback
    
    -- Category feedback breakdown
    category_feedback JSONB DEFAULT '{}', -- Feedback per MQM category
    severity_feedback JSONB DEFAULT '{}', -- Feedback per severity level
    
    -- System improvement metrics
    suggestions_implemented INTEGER DEFAULT 0,
    average_implementation_time_days DECIMAL(5,2),
    measured_improvements JSONB DEFAULT '{}', -- Tracked system improvements
    
    -- User engagement
    unique_contributors INTEGER DEFAULT 0,
    repeat_contributors INTEGER DEFAULT 0,
    average_response_time_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure no overlapping periods for same scope
    UNIQUE(organization_id, project_id, user_id, period_start, period_end, period_type)
);

-- Create feedback_learning table to track how feedback improves the system
CREATE TABLE IF NOT EXISTS public.feedback_learning (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Learning source
    feedback_id UUID REFERENCES public.user_feedback(id) ON DELETE CASCADE,
    learning_type TEXT NOT NULL CHECK (learning_type IN ('pattern_recognition', 'categorization_rule', 'threshold_adjustment', 'ui_improvement', 'workflow_optimization')),
    
    -- What was learned
    pattern_identified TEXT,
    rule_changes JSONB DEFAULT '{}', -- Changes made to categorization rules
    threshold_adjustments JSONB DEFAULT '{}', -- Confidence/severity threshold changes
    ui_changes JSONB DEFAULT '{}', -- Interface improvements
    
    -- Implementation
    implementation_status TEXT DEFAULT 'planned' CHECK (implementation_status IN ('planned', 'in_progress', 'implemented', 'tested', 'rolled_back')),
    implemented_by UUID REFERENCES public.profiles(id),
    implemented_at TIMESTAMP WITH TIME ZONE,
    
    -- Impact measurement
    baseline_metrics JSONB DEFAULT '{}', -- Metrics before change
    post_implementation_metrics JSONB DEFAULT '{}', -- Metrics after change
    improvement_percentage DECIMAL(5,2),
    
    -- Metadata
    affected_components TEXT[], -- System components affected
    confidence_score DECIMAL(3,2) DEFAULT 0.75, -- Confidence in this learning
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles(last_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity_at ON public.profiles(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- Organizations table indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON public.organizations(domain);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON public.organizations(subscription_tier);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON public.projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON public.projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON public.projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);

-- Project members table indexes
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON public.project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_status ON public.project_members(status);

-- Project milestones table indexes
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON public.project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_due_date ON public.project_milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_project_milestones_sort_order ON public.project_milestones(sort_order);

-- Assessment criteria table indexes
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_organization_id ON public.assessment_criteria(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_project_id ON public.assessment_criteria(project_id);
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_framework ON public.assessment_criteria(framework);
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_is_global ON public.assessment_criteria(is_global);
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_is_active ON public.assessment_criteria(is_active);
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_created_by ON public.assessment_criteria(created_by);

-- Assessment templates table indexes
CREATE INDEX IF NOT EXISTS idx_assessment_templates_criteria_id ON public.assessment_templates(criteria_id);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_organization_id ON public.assessment_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_is_public ON public.assessment_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_created_by ON public.assessment_templates(created_by);

-- Assessment results table indexes
CREATE INDEX IF NOT EXISTS idx_assessment_results_session_id ON public.assessment_results(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_criteria_id ON public.assessment_results(criteria_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessor_id ON public.assessment_results(assessor_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment_type ON public.assessment_results(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessment_results_review_status ON public.assessment_results(review_status);
CREATE INDEX IF NOT EXISTS idx_assessment_results_overall_score ON public.assessment_results(overall_score);
CREATE INDEX IF NOT EXISTS idx_assessment_results_mqm_score ON public.assessment_results(mqm_score);
CREATE INDEX IF NOT EXISTS idx_assessment_results_created_at ON public.assessment_results(created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_results_submitted_at ON public.assessment_results(submitted_at);
CREATE INDEX IF NOT EXISTS idx_assessment_results_approved_by ON public.assessment_results(approved_by);

-- Assessment segments table indexes  
CREATE INDEX IF NOT EXISTS idx_assessment_segments_assessment_result_id ON public.assessment_segments(assessment_result_id);
CREATE INDEX IF NOT EXISTS idx_assessment_segments_session_id ON public.assessment_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_segments_segment_index ON public.assessment_segments(segment_index);
CREATE INDEX IF NOT EXISTS idx_assessment_segments_assessed_by ON public.assessment_segments(assessed_by);
CREATE INDEX IF NOT EXISTS idx_assessment_segments_segment_score ON public.assessment_segments(segment_score);

-- Enhanced qa_errors table indexes
CREATE INDEX IF NOT EXISTS idx_qa_errors_assessment_result_id ON public.qa_errors(assessment_result_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_assessment_segment_id ON public.qa_errors(assessment_segment_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_mqm_category ON public.qa_errors(mqm_category);
CREATE INDEX IF NOT EXISTS idx_qa_errors_mqm_severity ON public.qa_errors(mqm_severity);
CREATE INDEX IF NOT EXISTS idx_qa_errors_is_critical ON public.qa_errors(is_critical);
CREATE INDEX IF NOT EXISTS idx_qa_errors_status ON public.qa_errors(status);
CREATE INDEX IF NOT EXISTS idx_qa_errors_reviewer_id ON public.qa_errors(reviewer_id);

-- Assessment comparisons table indexes
CREATE INDEX IF NOT EXISTS idx_assessment_comparisons_baseline_result_id ON public.assessment_comparisons(baseline_result_id);
CREATE INDEX IF NOT EXISTS idx_assessment_comparisons_target_result_id ON public.assessment_comparisons(target_result_id);
CREATE INDEX IF NOT EXISTS idx_assessment_comparisons_comparison_type ON public.assessment_comparisons(comparison_type);
CREATE INDEX IF NOT EXISTS idx_assessment_comparisons_created_by ON public.assessment_comparisons(created_by);

-- QA Sessions indexes
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_id ON public.qa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_project_id ON public.qa_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_status ON public.qa_sessions(analysis_status);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_created_at ON public.qa_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_qa_errors_session_id ON public.qa_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_severity ON public.qa_errors(severity);
CREATE INDEX IF NOT EXISTS idx_file_uploads_session_id ON public.file_uploads(session_id);

-- User feedback table indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_target_type ON public.user_feedback(target_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_target_id ON public.user_feedback(target_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback_type ON public.user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_session_id ON public.user_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_assessment_result_id ON public.user_feedback(assessment_result_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_reviewed_by ON public.user_feedback(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON public.user_feedback(rating);

-- Feedback metrics table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_organization_id ON public.feedback_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_project_id ON public.feedback_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_user_id ON public.feedback_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_period_type ON public.feedback_metrics(period_type);
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_period_start ON public.feedback_metrics(period_start);
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_period_end ON public.feedback_metrics(period_end);

-- Feedback learning table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_learning_feedback_id ON public.feedback_learning(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_learning_learning_type ON public.feedback_learning(learning_type);
CREATE INDEX IF NOT EXISTS idx_feedback_learning_implementation_status ON public.feedback_learning(implementation_status);
CREATE INDEX IF NOT EXISTS idx_feedback_learning_implemented_by ON public.feedback_learning(implemented_by);
CREATE INDEX IF NOT EXISTS idx_feedback_learning_implemented_at ON public.feedback_learning(implemented_at);

-- High-Priority Composite Indexes for Performance Optimization

-- Project dashboard queries (organization + status + priority)
CREATE INDEX IF NOT EXISTS idx_projects_org_status_priority 
ON public.projects(organization_id, status, priority);

-- QA session filtering (user + project + status)
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_project_status 
ON public.qa_sessions(user_id, project_id, analysis_status);

-- Assessment workflow queries (session + status + type)
CREATE INDEX IF NOT EXISTS idx_assessment_results_session_status_type 
ON public.assessment_results(session_id, review_status, assessment_type);

-- Error analysis queries (session + severity + status)
CREATE INDEX IF NOT EXISTS idx_qa_errors_session_severity_status 
ON public.qa_errors(session_id, severity, status);

-- Time-based project queries (org + deadline for dashboard)
CREATE INDEX IF NOT EXISTS idx_projects_org_deadline 
ON public.projects(organization_id, deadline) WHERE deadline IS NOT NULL;

-- Active user sessions (user + status + created_at for recent activity)
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_status_created 
ON public.qa_sessions(user_id, analysis_status, created_at);

-- JSONB Indexing for Flexible Queries

-- Project tags for categorization and filtering
CREATE INDEX IF NOT EXISTS idx_projects_tags_gin 
ON public.projects USING gin(tags);

-- Assessment criteria configuration searches
CREATE INDEX IF NOT EXISTS idx_assessment_criteria_config_gin 
ON public.assessment_criteria USING gin(criteria_config);

-- QA session analysis results searches
CREATE INDEX IF NOT EXISTS idx_qa_sessions_analysis_results_gin 
ON public.qa_sessions USING gin(analysis_results);

-- Partial Indexes for High-Frequency Conditional Queries

-- Active sessions only (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_qa_sessions_active_created 
ON public.qa_sessions(created_at, user_id) 
WHERE analysis_status IN ('pending', 'processing', 'completed');

-- Critical errors requiring immediate attention
CREATE INDEX IF NOT EXISTS idx_qa_errors_critical 
ON public.qa_errors(session_id, created_at) 
WHERE severity = 'critical' AND status = 'open';

-- Pending assessments for workflow management
CREATE INDEX IF NOT EXISTS idx_assessment_results_pending 
ON public.assessment_results(assessor_id, submitted_at) 
WHERE review_status = 'pending';

-- User feedback composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_feedback_target_user_status 
ON public.user_feedback(target_type, target_id, user_id, status);

-- Feedback for specific sessions and users
CREATE INDEX IF NOT EXISTS idx_user_feedback_session_user_type 
ON public.user_feedback(session_id, user_id, feedback_type);

-- Feedback analytics queries (organization + time period)
CREATE INDEX IF NOT EXISTS idx_feedback_metrics_org_period 
ON public.feedback_metrics(organization_id, period_type, period_start);

-- Recent feedback requiring review
CREATE INDEX IF NOT EXISTS idx_user_feedback_pending_review 
ON public.user_feedback(reviewed_by, created_at) 
WHERE status = 'submitted';

-- High-value feedback (detailed with ratings)
CREATE INDEX IF NOT EXISTS idx_user_feedback_detailed_rating 
ON public.user_feedback(target_type, rating, created_at) 
WHERE feedback_type = 'detailed_form' AND rating IS NOT NULL;

-- JSONB indexes for feedback content searches
CREATE INDEX IF NOT EXISTS idx_user_feedback_category_suggestion_gin 
ON public.user_feedback USING gin(category_suggestion);

CREATE INDEX IF NOT EXISTS idx_user_feedback_interaction_context_gin 
ON public.user_feedback USING gin(interaction_context);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can only see and edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations: Users can view their own organization, admins can view all
CREATE POLICY "Users can view own organization" ON public.organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "Admins can insert organizations" ON public.organizations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "Admins can update organizations" ON public.organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

-- QA Sessions: Users can only access their own sessions
CREATE POLICY "Users can view own qa_sessions" ON public.qa_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own qa_sessions" ON public.qa_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own qa_sessions" ON public.qa_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own qa_sessions" ON public.qa_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- QA Errors: Users can only access errors from their own sessions
CREATE POLICY "Users can view qa_errors from own sessions" ON public.qa_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.qa_sessions 
            WHERE qa_sessions.id = qa_errors.session_id 
            AND qa_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert qa_errors to own sessions" ON public.qa_errors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.qa_sessions 
            WHERE qa_sessions.id = qa_errors.session_id 
            AND qa_sessions.user_id = auth.uid()
        )
    );

-- File Uploads: Users can only access files from their own sessions
CREATE POLICY "Users can view file_uploads from own sessions" ON public.file_uploads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.qa_sessions 
            WHERE qa_sessions.id = file_uploads.session_id 
            AND qa_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert file_uploads to own sessions" ON public.file_uploads
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.qa_sessions 
            WHERE qa_sessions.id = file_uploads.session_id 
            AND qa_sessions.user_id = auth.uid()
        )
    );

-- User Preferences: Users can only access their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable RLS on new assessment tables
ALTER TABLE public.assessment_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_comparisons ENABLE ROW LEVEL SECURITY;

-- Assessment Criteria: Users can view global/org criteria, create within their org
CREATE POLICY "Users can view assessment criteria" ON public.assessment_criteria
    FOR SELECT USING (
        is_global = TRUE 
        OR organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create assessment criteria" ON public.assessment_criteria
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND (
            organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE profiles.id = auth.uid()
            )
            OR is_global = FALSE
        )
    );

CREATE POLICY "Users can update own assessment criteria" ON public.assessment_criteria
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
            AND profiles.organization_id = assessment_criteria.organization_id
        )
    );

-- Assessment Templates: Users can view public/org templates, create own
CREATE POLICY "Users can view assessment templates" ON public.assessment_templates
    FOR SELECT USING (
        is_public = TRUE
        OR organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create assessment templates" ON public.assessment_templates
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own assessment templates" ON public.assessment_templates
    FOR UPDATE USING (created_by = auth.uid());

-- Assessment Results: Users can access results from their sessions or org projects
CREATE POLICY "Users can view assessment results" ON public.assessment_results
    FOR SELECT USING (
        assessor_id = auth.uid()
        OR session_id IN (
            SELECT id FROM public.qa_sessions 
            WHERE qa_sessions.user_id = auth.uid()
        )
        OR session_id IN (
            SELECT qa_sessions.id FROM public.qa_sessions
            JOIN public.projects ON qa_sessions.project_id = projects.id
            JOIN public.project_members ON projects.id = project_members.project_id
            WHERE project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create assessment results" ON public.assessment_results
    FOR INSERT WITH CHECK (
        assessor_id = auth.uid()
        OR session_id IN (
            SELECT id FROM public.qa_sessions 
            WHERE qa_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update assessment results" ON public.assessment_results
    FOR UPDATE USING (
        assessor_id = auth.uid()
        OR approved_by = auth.uid()
    );

-- Assessment Segments: Users can access segments from their assessment results
CREATE POLICY "Users can view assessment segments" ON public.assessment_segments
    FOR SELECT USING (
        assessed_by = auth.uid()
        OR assessment_result_id IN (
            SELECT id FROM public.assessment_results
            WHERE assessor_id = auth.uid()
        )
        OR session_id IN (
            SELECT id FROM public.qa_sessions 
            WHERE qa_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create assessment segments" ON public.assessment_segments
    FOR INSERT WITH CHECK (
        assessed_by = auth.uid()
        OR assessment_result_id IN (
            SELECT id FROM public.assessment_results
            WHERE assessor_id = auth.uid()
        )
    );

-- Assessment Comparisons: Users can view comparisons they created or for their assessments
CREATE POLICY "Users can view assessment comparisons" ON public.assessment_comparisons
    FOR SELECT USING (
        created_by = auth.uid()
        OR baseline_result_id IN (
            SELECT id FROM public.assessment_results
            WHERE assessor_id = auth.uid()
        )
        OR target_result_id IN (
            SELECT id FROM public.assessment_results
            WHERE assessor_id = auth.uid()
        )
    );

CREATE POLICY "Users can create assessment comparisons" ON public.assessment_comparisons
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Enable RLS on feedback tables
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_learning ENABLE ROW LEVEL SECURITY;

-- Enable RLS on audit logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User Feedback: Users can view and create their own feedback, admins can view all
CREATE POLICY "Users can view own feedback" ON public.user_feedback
    FOR SELECT USING (
        user_id = auth.uid()
        OR reviewed_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can create feedback" ON public.user_feedback
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feedback" ON public.user_feedback
    FOR UPDATE USING (
        user_id = auth.uid()
        OR reviewed_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Feedback Metrics: Users can view metrics for their org/projects, admins can view all
CREATE POLICY "Users can view feedback metrics" ON public.feedback_metrics
    FOR SELECT USING (
        user_id = auth.uid()
        OR organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
        OR project_id IN (
            SELECT projects.id FROM public.projects
            JOIN public.project_members ON projects.id = project_members.project_id
            WHERE project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can create feedback metrics" ON public.feedback_metrics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Feedback Learning: Admins and managers can access learning data
CREATE POLICY "Admins can view feedback learning" ON public.feedback_learning
    FOR SELECT USING (
        implemented_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can create feedback learning" ON public.feedback_learning
    FOR INSERT WITH CHECK (
        implemented_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can update feedback learning" ON public.feedback_learning
    FOR UPDATE USING (
        implemented_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER profiles_updated_at 
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER qa_sessions_updated_at 
    BEFORE UPDATE ON public.qa_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_preferences_updated_at 
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Project-related triggers
CREATE TRIGGER projects_updated_at 
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER project_milestones_updated_at 
    BEFORE UPDATE ON public.project_milestones
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Assessment-related triggers
CREATE TRIGGER assessment_criteria_updated_at 
    BEFORE UPDATE ON public.assessment_criteria
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER assessment_templates_updated_at 
    BEFORE UPDATE ON public.assessment_templates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER assessment_results_updated_at 
    BEFORE UPDATE ON public.assessment_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Feedback-related triggers
CREATE TRIGGER user_feedback_updated_at 
    BEFORE UPDATE ON public.user_feedback
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER feedback_metrics_updated_at 
    BEFORE UPDATE ON public.feedback_metrics
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER feedback_learning_updated_at 
    BEFORE UPDATE ON public.feedback_learning
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
    name_parts TEXT[];
BEGIN
    -- Extract name information from metadata
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    
    -- Split full name into first and last name if available
    IF user_full_name IS NOT NULL THEN
        name_parts := string_to_array(trim(user_full_name), ' ');
        user_first_name := name_parts[1];
        IF array_length(name_parts, 1) > 1 THEN
            user_last_name := array_to_string(name_parts[2:], ' ');
        END IF;
    END IF;
    
    -- Insert user profile with enhanced fields
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name,
        first_name,
        last_name,
        display_name,
        avatar_url,
        status,
        is_verified,
        email_verified_at,
        signup_source,
        user_agent,
        created_at
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        user_full_name,
        user_first_name,
        user_last_name,
        COALESCE(user_first_name, split_part(NEW.email, '@', 1)), -- Use first name or email prefix as display name
        NEW.raw_user_meta_data->>'avatar_url',
        'pending', -- New users start as pending until verified
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE ELSE FALSE END,
        NEW.email_confirmed_at,
        'web', -- Default signup source
        NEW.raw_user_meta_data->>'user_agent',
        NEW.created_at
    );
    
    -- Insert default user preferences
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit logs indexes for security monitoring and compliance
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_affected_user_id ON public.audit_logs(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON public.audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON public.audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON public.audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_requires_review ON public.audit_logs(requires_review);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archived ON public.audit_logs(archived);
CREATE INDEX IF NOT EXISTS idx_audit_logs_expires_at ON public.audit_logs(expires_at);

-- Composite indexes for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event_time 
    ON public.audit_logs(user_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_event_time 
    ON public.audit_logs(organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_review 
    ON public.audit_logs(risk_level, requires_review, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_permission_result 
    ON public.audit_logs(permission_checked, result, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_access 
    ON public.audit_logs(resource_type, resource_id, result, created_at DESC);

-- GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin 
    ON public.audit_logs USING gin (metadata);

-- Partial indexes for performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_failed_attempts 
    ON public.audit_logs(user_id, created_at DESC) 
    WHERE result = 'denied';

CREATE INDEX IF NOT EXISTS idx_audit_logs_suspicious_activity 
    ON public.audit_logs(ip_address, user_agent, created_at DESC) 
    WHERE event_type = 'SUSPICIOUS_ACTIVITY';

CREATE INDEX IF NOT EXISTS idx_audit_logs_role_changes 
    ON public.audit_logs(affected_user_id, role_from, role_to, created_at DESC) 
    WHERE event_type IN ('ROLE_ASSIGNED', 'ROLE_REMOVED', 'ROLE_UPDATED');

CREATE INDEX IF NOT EXISTS idx_audit_logs_active_records 
    ON public.audit_logs(created_at DESC) 
    WHERE archived = FALSE;

-- ====================================================================================
-- VULNERABILITY SCANNING SYSTEM SCHEMA
-- ====================================================================================

-- Vulnerability Scans table - tracks scan executions
CREATE TABLE IF NOT EXISTS public.vulnerability_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) UNIQUE NOT NULL,
    scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('manual', 'scheduled', 'triggered')),
    
    -- Configuration
    configuration JSONB NOT NULL DEFAULT '{}',
    
    -- Status and timing
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    scan_duration_ms INTEGER,
    
    -- Results summary
    total_vulnerabilities INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    scan_coverage DECIMAL(5,2) DEFAULT 0.0,
    
    -- Metadata
    scanner_version VARCHAR(50),
    target_environment VARCHAR(50) CHECK (target_environment IN ('development', 'staging', 'production')),
    scanned_components JSONB DEFAULT '[]',
    
    -- User tracking
    triggered_by UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vulnerability Results table - individual vulnerabilities found
CREATE TABLE IF NOT EXISTS public.vulnerability_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES public.vulnerability_scans(id) ON DELETE CASCADE,
    
    -- Vulnerability identification
    vulnerability_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('dependency', 'security_header', 'api_endpoint', 'configuration', 'code_pattern')),
    
    -- Severity and impact
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Location and context
    location TEXT,
    file_path TEXT,
    line_number INTEGER,
    
    -- Security details
    cve VARCHAR(50),
    cvss_score DECIMAL(3,1),
    cwe VARCHAR(50),
    
    -- Remediation
    recommendations JSONB DEFAULT '[]',
    remediation_effort VARCHAR(20) CHECK (remediation_effort IN ('low', 'medium', 'high')),
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'fixed', 'false_positive', 'risk_accepted')),
    
    -- Assignment and tracking
    assigned_to UUID REFERENCES auth.users(id),
    priority VARCHAR(20) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vulnerability Definitions table - known vulnerability patterns and rules
CREATE TABLE IF NOT EXISTS public.vulnerability_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    vulnerability_type VARCHAR(50) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Detection pattern
    pattern TEXT,
    pattern_type VARCHAR(50) CHECK (pattern_type IN ('regex', 'semantic', 'static_analysis', 'dependency_check')),
    
    -- Classification
    default_severity VARCHAR(20) NOT NULL CHECK (default_severity IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Security framework mappings
    owasp_category VARCHAR(100),
    cwe_id VARCHAR(50),
    
    -- Description and guidance
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact_description TEXT,
    remediation_guidance TEXT,
    
    -- References
    references JSONB DEFAULT '[]',
    
    -- Rule configuration
    is_active BOOLEAN DEFAULT true,
    confidence_level VARCHAR(20) CHECK (confidence_level IN ('high', 'medium', 'low')),
    false_positive_rate DECIMAL(3,2),
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES public.organizations(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scan Schedules table - automated scanning configuration
CREATE TABLE IF NOT EXISTS public.scan_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Schedule identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Schedule configuration
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Scan configuration
    scan_configuration JSONB NOT NULL DEFAULT '{}',
    
    -- Targeting
    organization_id UUID REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_scan_id UUID REFERENCES public.vulnerability_scans(id),
    
    -- Error tracking
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    
    -- Notification settings
    notification_config JSONB DEFAULT '{}',
    notify_on_critical BOOLEAN DEFAULT true,
    notify_on_new_vulnerabilities BOOLEAN DEFAULT true,
    
    -- User tracking
    created_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vulnerability Remediation Tracking
CREATE TABLE IF NOT EXISTS public.vulnerability_remediations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vulnerability_id UUID NOT NULL REFERENCES public.vulnerability_results(id) ON DELETE CASCADE,
    
    -- Remediation details
    remediation_type VARCHAR(50) CHECK (remediation_type IN ('patch', 'configuration_change', 'code_fix', 'dependency_update', 'mitigation')),
    description TEXT NOT NULL,
    
    -- Implementation tracking
    status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'testing', 'deployed', 'verified', 'failed')),
    
    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    
    -- Timeline
    planned_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Impact and effort
    estimated_effort_hours DECIMAL(5,1),
    actual_effort_hours DECIMAL(5,1),
    business_impact VARCHAR(20) CHECK (business_impact IN ('high', 'medium', 'low', 'none')),
    
    -- Change tracking
    change_request_id VARCHAR(255),
    deployment_id VARCHAR(255),
    rollback_plan TEXT,
    
    -- Notes and documentation
    implementation_notes TEXT,
    testing_notes TEXT,
    verification_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vulnerability Reports table - formatted reports and summaries
CREATE TABLE IF NOT EXISTS public.vulnerability_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Report identification
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) CHECK (report_type IN ('scan_summary', 'trending_analysis', 'compliance_report', 'executive_summary')),
    
    -- Report scope
    scan_ids JSONB DEFAULT '[]',
    organization_id UUID REFERENCES public.organizations(id),
    project_id UUID REFERENCES public.projects(id),
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Report content
    summary JSONB NOT NULL DEFAULT '{}',
    detailed_findings JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    
    -- Report metadata
    report_format VARCHAR(50) CHECK (report_format IN ('json', 'pdf', 'html', 'csv')),
    report_data JSONB,
    file_path TEXT,
    
    -- Access control
    visibility VARCHAR(20) DEFAULT 'organization' CHECK (visibility IN ('private', 'organization', 'project', 'public')),
    
    -- User tracking
    generated_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- VULNERABILITY SCANNING INDEXES
-- ====================================================================================

-- Vulnerability Scans indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_scan_id ON public.vulnerability_scans(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_status ON public.vulnerability_scans(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_scan_type ON public.vulnerability_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_triggered_by ON public.vulnerability_scans(triggered_by);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_organization_id ON public.vulnerability_scans(organization_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_project_id ON public.vulnerability_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_started_at ON public.vulnerability_scans(started_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_completed_at ON public.vulnerability_scans(completed_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_target_environment ON public.vulnerability_scans(target_environment);

-- Vulnerability Results indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_scan_id ON public.vulnerability_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_vulnerability_id ON public.vulnerability_results(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_type ON public.vulnerability_results(type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_severity ON public.vulnerability_results(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_status ON public.vulnerability_results(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_assigned_to ON public.vulnerability_results(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_priority ON public.vulnerability_results(priority);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_cve ON public.vulnerability_results(cve);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_detected_at ON public.vulnerability_results(detected_at);
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_resolved_at ON public.vulnerability_results(resolved_at);

-- Vulnerability Definitions indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_rule_id ON public.vulnerability_definitions(rule_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_vulnerability_type ON public.vulnerability_definitions(vulnerability_type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_default_severity ON public.vulnerability_definitions(default_severity);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_category ON public.vulnerability_definitions(category);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_is_active ON public.vulnerability_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_organization_id ON public.vulnerability_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_cwe_id ON public.vulnerability_definitions(cwe_id);

-- Scan Schedules indexes
CREATE INDEX IF NOT EXISTS idx_scan_schedules_organization_id ON public.scan_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_project_id ON public.scan_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_is_active ON public.scan_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_next_run_at ON public.scan_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_last_run_at ON public.scan_schedules(last_run_at);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_created_by ON public.scan_schedules(created_by);

-- Vulnerability Remediations indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_vulnerability_id ON public.vulnerability_remediations(vulnerability_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_status ON public.vulnerability_remediations(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_remediation_type ON public.vulnerability_remediations(remediation_type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_assigned_to ON public.vulnerability_remediations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_planned_date ON public.vulnerability_remediations(planned_date);
CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_completed_at ON public.vulnerability_remediations(completed_at);

-- Vulnerability Reports indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_report_type ON public.vulnerability_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_organization_id ON public.vulnerability_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_project_id ON public.vulnerability_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_generated_by ON public.vulnerability_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_period_start ON public.vulnerability_reports(period_start);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_period_end ON public.vulnerability_reports(period_end);
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_visibility ON public.vulnerability_reports(visibility);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_org_status_date 
    ON public.vulnerability_scans(organization_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_vulnerability_results_scan_severity_status 
    ON public.vulnerability_results(scan_id, severity, status);

CREATE INDEX IF NOT EXISTS idx_vulnerability_results_type_severity_detected 
    ON public.vulnerability_results(type, severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_vuln_status_assigned 
    ON public.vulnerability_remediations(vulnerability_id, status, assigned_to);

-- GIN indexes for JSON data
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_configuration_gin 
    ON public.vulnerability_scans USING gin (configuration);

CREATE INDEX IF NOT EXISTS idx_vulnerability_results_metadata_gin 
    ON public.vulnerability_results USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_vulnerability_definitions_references_gin 
    ON public.vulnerability_definitions USING gin (references);

CREATE INDEX IF NOT EXISTS idx_scan_schedules_notification_config_gin 
    ON public.scan_schedules USING gin (notification_config);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_vulnerability_results_open_critical 
    ON public.vulnerability_results(detected_at DESC) 
    WHERE status = 'open' AND severity = 'critical';

CREATE INDEX IF NOT EXISTS idx_vulnerability_results_open_high 
    ON public.vulnerability_results(detected_at DESC) 
    WHERE status = 'open' AND severity = 'high';

CREATE INDEX IF NOT EXISTS idx_scan_schedules_active_next_run 
    ON public.scan_schedules(next_run_at ASC) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vulnerability_remediations_pending 
    ON public.vulnerability_remediations(planned_date ASC) 
    WHERE status IN ('planned', 'in_progress');

-- ====================================================================================
-- VULNERABILITY SCANNING RLS POLICIES
-- ====================================================================================

-- Enable RLS
ALTER TABLE public.vulnerability_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_reports ENABLE ROW LEVEL SECURITY;

-- Vulnerability Scans policies
CREATE POLICY "Users can view their organization's vulnerability scans" ON public.vulnerability_scans
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage vulnerability scans" ON public.vulnerability_scans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND organization_id = vulnerability_scans.organization_id
        )
    );

-- Vulnerability Results policies
CREATE POLICY "Users can view their organization's vulnerability results" ON public.vulnerability_results
    FOR SELECT USING (
        scan_id IN (
            SELECT id FROM public.vulnerability_scans
            WHERE organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Assigned users can update vulnerability results" ON public.vulnerability_results
    FOR UPDATE USING (
        assigned_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Vulnerability Definitions policies
CREATE POLICY "Users can view vulnerability definitions" ON public.vulnerability_definitions
    FOR SELECT USING (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage vulnerability definitions" ON public.vulnerability_definitions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Scan Schedules policies
CREATE POLICY "Users can view their organization's scan schedules" ON public.scan_schedules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage scan schedules" ON public.scan_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND organization_id = scan_schedules.organization_id
        )
    );

-- Vulnerability Remediations policies
CREATE POLICY "Users can view vulnerability remediations" ON public.vulnerability_remediations
    FOR SELECT USING (
        vulnerability_id IN (
            SELECT vr.id FROM public.vulnerability_results vr
            JOIN public.vulnerability_scans vs ON vr.scan_id = vs.id
            WHERE vs.organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Assigned users can update vulnerability remediations" ON public.vulnerability_remediations
    FOR UPDATE USING (
        assigned_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Vulnerability Reports policies
CREATE POLICY "Users can view their organization's vulnerability reports" ON public.vulnerability_reports
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid()
        )
        OR visibility = 'public'
    );

CREATE POLICY "Admins can manage vulnerability reports" ON public.vulnerability_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND organization_id = vulnerability_reports.organization_id
        )
    );

-- ====================================================================================
-- VULNERABILITY SCANNING TRIGGERS
-- ====================================================================================

-- Add triggers for automatic timestamp updates
CREATE TRIGGER vulnerability_scans_updated_at 
    BEFORE UPDATE ON public.vulnerability_scans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER vulnerability_results_updated_at 
    BEFORE UPDATE ON public.vulnerability_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER vulnerability_definitions_updated_at 
    BEFORE UPDATE ON public.vulnerability_definitions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER scan_schedules_updated_at 
    BEFORE UPDATE ON public.scan_schedules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER vulnerability_remediations_updated_at 
    BEFORE UPDATE ON public.vulnerability_remediations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER vulnerability_reports_updated_at 
    BEFORE UPDATE ON public.vulnerability_reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); 