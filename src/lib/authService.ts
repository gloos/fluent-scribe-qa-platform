import { supabase } from './supabase';

export interface LoginAttemptResult {
  success: boolean;
  locked?: boolean;
  lockout_duration?: number;
  attempts_remaining?: number;
  message: string;
}

export interface LoginSecurityInfo {
  isLocked: boolean;
  lockoutUntil?: string;
  failedAttempts: number;
  lastLoginAttempt?: string;
  lastSuccessfulLogin?: string;
}

/**
 * Enhanced authentication service with security features
 */
export class AuthService {
  /**
   * Get client information for security tracking
   */
  private getClientInfo() {
    return {
      userAgent: navigator.userAgent,
      // Note: Real IP detection requires server-side implementation
      // For now, we'll pass null and let the server handle it
      ipAddress: null
    };
  }

  /**
   * Check if an account is currently locked
   */
  async checkAccountLockStatus(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_account_locked', {
        user_email: email
      });

      if (error) {
        console.error('Error checking account lock status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Unexpected error checking account lock:', error);
      return false;
    }
  }

  /**
   * Get security information for a user account
   */
  async getAccountSecurityInfo(email: string): Promise<LoginSecurityInfo | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('failed_login_attempts, account_locked_until, last_login_attempt, last_successful_login')
        .eq('email', email)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        isLocked: data.account_locked_until ? new Date(data.account_locked_until) > new Date() : false,
        lockoutUntil: data.account_locked_until,
        failedAttempts: data.failed_login_attempts || 0,
        lastLoginAttempt: data.last_login_attempt,
        lastSuccessfulLogin: data.last_successful_login
      };
    } catch (error) {
      console.error('Error getting account security info:', error);
      return null;
    }
  }

  /**
   * Enhanced login with security features
   */
  async secureLogin(email: string, password: string): Promise<{
    success: boolean;
    data?: any;
    error?: any;
    securityInfo?: LoginAttemptResult;
  }> {
    const clientInfo = this.getClientInfo();

    try {
      // First check if account is locked
      const isLocked = await this.checkAccountLockStatus(email);
      if (isLocked) {
        return {
          success: false,
          error: { message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.' },
          securityInfo: {
            success: false,
            locked: true,
            message: 'Account locked'
          }
        };
      }

      // Attempt login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Handle failed login attempt
        const securityResult = await this.handleFailedLogin(email, clientInfo.userAgent);
        return {
          success: false,
          error,
          securityInfo: securityResult
        };
      }

      // Handle successful login
      const securityResult = await this.handleSuccessfulLogin(email, clientInfo.userAgent);
      return {
        success: true,
        data,
        securityInfo: securityResult
      };

    } catch (error) {
      console.error('Unexpected error during secure login:', error);
      return {
        success: false,
        error: { message: 'An unexpected error occurred. Please try again.' }
      };
    }
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(email: string, userAgent?: string): Promise<LoginAttemptResult> {
    try {
      const { data, error } = await supabase.rpc('handle_failed_login', {
        user_email: email,
        client_ip: null, // Would be set server-side in production
        user_agent_string: userAgent
      });

      if (error) {
        console.error('Error handling failed login:', error);
        return {
          success: false,
          message: 'Login failed'
        };
      }

      return data as LoginAttemptResult;
    } catch (error) {
      console.error('Unexpected error handling failed login:', error);
      return {
        success: false,
        message: 'Login failed'
      };
    }
  }

  /**
   * Handle successful login attempt
   */
  private async handleSuccessfulLogin(email: string, userAgent?: string): Promise<LoginAttemptResult> {
    try {
      const { data, error } = await supabase.rpc('handle_successful_login', {
        user_email: email,
        client_ip: null, // Would be set server-side in production
        user_agent_string: userAgent
      });

      if (error) {
        console.error('Error handling successful login:', error);
        return {
          success: true,
          message: 'Login successful'
        };
      }

      return data as LoginAttemptResult;
    } catch (error) {
      console.error('Unexpected error handling successful login:', error);
      return {
        success: true,
        message: 'Login successful'
      };
    }
  }

  /**
   * Get recent login attempts for security monitoring (admin only)
   */
  async getRecentLoginAttempts(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('login_attempts')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching login attempts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching login attempts:', error);
      return [];
    }
  }

  /**
   * Unlock an account (admin function)
   */
  async unlockAccount(email: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          failed_login_attempts: 0,
          account_locked_until: null
        })
        .eq('email', email);

      if (error) {
        console.error('Error unlocking account:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error unlocking account:', error);
      return false;
    }
  }

  /**
   * Check if an email exists in the system (without revealing if it's registered)
   */
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      // This should be implemented server-side to avoid revealing user existence
      // For now, we'll return true to avoid information disclosure
      return true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    requirements: Array<{ met: boolean; text: string }>;
  } {
    const requirements = [
      { met: password.length >= 8, text: "At least 8 characters" },
      { met: /[A-Z]/.test(password), text: "One uppercase letter" },
      { met: /[a-z]/.test(password), text: "One lowercase letter" },
      { met: /\d/.test(password), text: "One number" },
      { met: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: "One special character" }
    ];

    const score = requirements.filter(req => req.met).length;
    const isValid = score >= 4; // Require at least 4 out of 5 criteria

    return {
      isValid,
      score,
      requirements
    };
  }

  /**
   * Rate limiting for login attempts (client-side basic implementation)
   */
  private loginAttemptCounts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly MAX_ATTEMPTS_PER_MINUTE = 5;
  private readonly MINUTE_IN_MS = 60 * 1000;

  checkRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const attempts = this.loginAttemptCounts.get(email);

    if (!attempts) {
      this.loginAttemptCounts.set(email, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Reset count if more than a minute has passed
    if (now - attempts.lastAttempt > this.MINUTE_IN_MS) {
      this.loginAttemptCounts.set(email, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Check if under rate limit
    if (attempts.count < this.MAX_ATTEMPTS_PER_MINUTE) {
      attempts.count++;
      attempts.lastAttempt = now;
      return { allowed: true };
    }

    // Rate limited
    const retryAfter = Math.ceil((attempts.lastAttempt + this.MINUTE_IN_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
}

export const authService = new AuthService(); 