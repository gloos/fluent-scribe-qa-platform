-- Two-Factor Authentication Migration
-- Add required fields for 2FA support to the profiles table

-- Add 2FA fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_method TEXT CHECK (two_factor_method IN ('totp', 'sms', 'email')),
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB;

-- Create index for 2FA queries
CREATE INDEX IF NOT EXISTS idx_profiles_two_factor_enabled ON public.profiles(two_factor_enabled);
CREATE INDEX IF NOT EXISTS idx_profiles_two_factor_method ON public.profiles(two_factor_method);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.two_factor_secret IS 'Encrypted TOTP secret for 2FA authentication';
COMMENT ON COLUMN public.profiles.two_factor_method IS 'Primary 2FA method: totp, sms, or email';
COMMENT ON COLUMN public.profiles.two_factor_backup_codes IS 'JSON array of backup codes with metadata';

-- Update the audit_logs table to include 2FA specific event types if needed
-- (The existing event_type enum already includes security events) 