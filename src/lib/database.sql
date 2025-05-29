-- AI-Powered Linguistic QA Platform Database Schema

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'reviewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qa_sessions_user_id ON public.qa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_status ON public.qa_sessions(analysis_status);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_created_at ON public.qa_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_qa_errors_session_id ON public.qa_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_errors_severity ON public.qa_errors(severity);
CREATE INDEX IF NOT EXISTS idx_file_uploads_session_id ON public.file_uploads(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 