-- API Keys Management Schema
-- This schema supports the API integration capabilities for external system access

-- API Keys table for managing external API access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of the API key
    name VARCHAR(100) NOT NULL, -- Human-readable name for the key
    description TEXT, -- Optional description
    permissions JSONB NOT NULL DEFAULT '[]', -- Array of permissions/scopes
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT api_keys_name_user_unique UNIQUE(user_id, name),
    CONSTRAINT api_keys_rate_limits_positive CHECK (
        rate_limit_per_minute > 0 AND 
        rate_limit_per_hour > 0 AND 
        rate_limit_per_day > 0
    )
);

-- API Key Usage Tracking for rate limiting and analytics
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    processing_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Indexes for efficient rate limiting queries
    INDEX idx_api_key_usage_key_timestamp ON api_key_usage(api_key_id, timestamp),
    INDEX idx_api_key_usage_timestamp ON api_key_usage(timestamp)
);

-- API Key Rate Limit Tracking (for sliding window rate limiting)
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_type VARCHAR(10) NOT NULL CHECK (window_type IN ('minute', 'hour', 'day')),
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (api_key_id, window_start, window_type),
    INDEX idx_rate_limits_window ON api_key_rate_limits(window_start, window_type)
);

-- Row Level Security Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own API keys
CREATE POLICY "Users can manage their own API keys" ON api_keys
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Users can only see usage for their own API keys
CREATE POLICY "Users can view their own API key usage" ON api_key_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM api_keys 
            WHERE api_keys.id = api_key_usage.api_key_id 
            AND api_keys.user_id = auth.uid()
        )
    );

-- Policy: System can insert usage records for any key (for API middleware)
CREATE POLICY "System can insert usage records" ON api_key_usage
    FOR INSERT WITH CHECK (true);

-- Policy: Users can view rate limit data for their keys
CREATE POLICY "Users can view their API key rate limits" ON api_key_rate_limits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM api_keys 
            WHERE api_keys.id = api_key_rate_limits.api_key_id 
            AND api_keys.user_id = auth.uid()
        )
    );

-- Policy: System can manage rate limit data
CREATE POLICY "System can manage rate limit data" ON api_key_rate_limits
    FOR ALL WITH CHECK (true);

-- Functions for API key management
-- Function to generate a secure API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    -- Generate a 32-character random string with prefix
    RETURN 'sk-' || encode(gen_random_bytes(24), 'base64')::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash API key for storage
CREATE OR REPLACE FUNCTION hash_api_key(key_value TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(key_value, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key and return key info
CREATE OR REPLACE FUNCTION validate_api_key(key_value TEXT)
RETURNS TABLE (
    key_id UUID,
    user_id UUID,
    permissions JSONB,
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,
    rate_limit_per_day INTEGER,
    is_valid BOOLEAN
) AS $$
DECLARE
    key_hash TEXT;
BEGIN
    key_hash := hash_api_key(key_value);
    
    RETURN QUERY
    SELECT 
        ak.id,
        ak.user_id,
        ak.permissions,
        ak.rate_limit_per_minute,
        ak.rate_limit_per_hour,
        ak.rate_limit_per_day,
        (ak.is_active AND (ak.expires_at IS NULL OR ak.expires_at > NOW())) AS is_valid
    FROM api_keys ak
    WHERE ak.key_hash = validate_api_key.key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits for an API key
CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
    key_id UUID,
    current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    minute_allowed BOOLEAN,
    hour_allowed BOOLEAN,
    day_allowed BOOLEAN,
    minute_remaining INTEGER,
    hour_remaining INTEGER,
    day_remaining INTEGER
) AS $$
DECLARE
    key_limits RECORD;
    minute_count INTEGER;
    hour_count INTEGER;
    day_count INTEGER;
    minute_window TIMESTAMP WITH TIME ZONE;
    hour_window TIMESTAMP WITH TIME ZONE;
    day_window TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the API key limits
    SELECT rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day
    INTO key_limits
    FROM api_keys
    WHERE id = key_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, false, 0, 0, 0;
        RETURN;
    END IF;
    
    -- Calculate window start times
    minute_window := date_trunc('minute', current_time);
    hour_window := date_trunc('hour', current_time);
    day_window := date_trunc('day', current_time);
    
    -- Get current usage counts
    SELECT COALESCE(request_count, 0) INTO minute_count
    FROM api_key_rate_limits
    WHERE api_key_id = key_id 
    AND window_start = minute_window 
    AND window_type = 'minute';
    
    SELECT COALESCE(request_count, 0) INTO hour_count
    FROM api_key_rate_limits
    WHERE api_key_id = key_id 
    AND window_start = hour_window 
    AND window_type = 'hour';
    
    SELECT COALESCE(request_count, 0) INTO day_count
    FROM api_key_rate_limits
    WHERE api_key_id = key_id 
    AND window_start = day_window 
    AND window_type = 'day';
    
    -- Return rate limit status
    RETURN QUERY SELECT
        (minute_count < key_limits.rate_limit_per_minute) AS minute_allowed,
        (hour_count < key_limits.rate_limit_per_hour) AS hour_allowed,
        (day_count < key_limits.rate_limit_per_day) AS day_allowed,
        (key_limits.rate_limit_per_minute - minute_count) AS minute_remaining,
        (key_limits.rate_limit_per_hour - hour_count) AS hour_remaining,
        (key_limits.rate_limit_per_day - day_count) AS day_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment rate limit counters
CREATE OR REPLACE FUNCTION increment_api_key_usage(
    key_id UUID,
    current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID AS $$
DECLARE
    minute_window TIMESTAMP WITH TIME ZONE;
    hour_window TIMESTAMP WITH TIME ZONE;
    day_window TIMESTAMP WITH TIME ZONE;
BEGIN
    minute_window := date_trunc('minute', current_time);
    hour_window := date_trunc('hour', current_time);
    day_window := date_trunc('day', current_time);
    
    -- Update minute counter
    INSERT INTO api_key_rate_limits (api_key_id, window_start, window_type, request_count)
    VALUES (key_id, minute_window, 'minute', 1)
    ON CONFLICT (api_key_id, window_start, window_type)
    DO UPDATE SET 
        request_count = api_key_rate_limits.request_count + 1,
        updated_at = NOW();
    
    -- Update hour counter
    INSERT INTO api_key_rate_limits (api_key_id, window_start, window_type, request_count)
    VALUES (key_id, hour_window, 'hour', 1)
    ON CONFLICT (api_key_id, window_start, window_type)
    DO UPDATE SET 
        request_count = api_key_rate_limits.request_count + 1,
        updated_at = NOW();
    
    -- Update day counter
    INSERT INTO api_key_rate_limits (api_key_id, window_start, window_type, request_count)
    VALUES (key_id, day_window, 'day', 1)
    ON CONFLICT (api_key_id, window_start, window_type)
    DO UPDATE SET 
        request_count = api_key_rate_limits.request_count + 1,
        updated_at = NOW();
        
    -- Update last_used_at on the API key
    UPDATE api_keys SET last_used_at = current_time WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete records older than 7 days
    DELETE FROM api_key_rate_limits 
    WHERE window_start < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to relevant tables
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_key_rate_limits_updated_at 
    BEFORE UPDATE ON api_key_rate_limits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 