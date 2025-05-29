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

-- QA Sessions indexes
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_id ON public.qa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_status ON public.qa_sessions(analysis_status);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_created_at ON public.qa_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_qa_errors_session_id ON public.qa_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_severity ON public.qa_errors(severity);
CREATE INDEX IF NOT EXISTS idx_file_uploads_session_id ON public.file_uploads(session_id);

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