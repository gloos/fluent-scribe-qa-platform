import { toast } from "@/hooks/use-toast";
import { 
  SECURITY_CONFIG, 
  RateLimitData, 
  RateLimitResult, 
  RateLimitStatus,
  SecurityEvent,
  SecurityEventType 
} from './types';

export class SessionManager {
  private rateLimitData = new Map<string, RateLimitData>();

  /**
   * Check if login attempt should be rate limited
   */
  public checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const data = this.rateLimitData.get(identifier);

    if (!data) {
      // First attempt
      this.rateLimitData.set(identifier, {
        attempts: 1,
        lastAttempt: now,
        progressiveDelay: 0
      });
      return { allowed: true };
    }

    // Check if account is locked
    if (data.lockedUntil && now < data.lockedUntil) {
      const waitTime = data.lockedUntil - now;
      return { 
        allowed: false, 
        waitTime: Math.ceil(waitTime / 1000),
        needsCaptcha: true
      };
    }

    // Check if we need to apply progressive delay
    if (data.progressiveDelay > 0 && now < data.lastAttempt + data.progressiveDelay) {
      const waitTime = (data.lastAttempt + data.progressiveDelay) - now;
      return { 
        allowed: false, 
        waitTime: Math.ceil(waitTime / 1000),
        needsCaptcha: data.attempts >= SECURITY_CONFIG.CAPTCHA.THRESHOLD_ATTEMPTS
      };
    }

    // Reset if enough time has passed
    if (now - data.lastAttempt > SECURITY_CONFIG.RATE_LIMITING.LOCKOUT_DURATION) {
      this.rateLimitData.set(identifier, {
        attempts: 1,
        lastAttempt: now,
        progressiveDelay: 0
      });
      return { allowed: true };
    }

    // Check if we're within limits
    if (data.attempts >= SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS) {
      // Lock the account
      this.rateLimitData.set(identifier, {
        ...data,
        lockedUntil: now + SECURITY_CONFIG.RATE_LIMITING.LOCKOUT_DURATION
      });

      return { 
        allowed: false, 
        waitTime: Math.ceil(SECURITY_CONFIG.RATE_LIMITING.LOCKOUT_DURATION / 1000),
        needsCaptcha: true
      };
    }

    return { 
      allowed: true,
      needsCaptcha: data.attempts >= SECURITY_CONFIG.CAPTCHA.THRESHOLD_ATTEMPTS
    };
  }

  /**
   * Record a failed login attempt
   */
  public recordFailedAttempt(identifier: string, onLogEvent?: (event: SecurityEvent) => void): void {
    const now = Date.now();
    const data = this.rateLimitData.get(identifier) || {
      attempts: 0,
      lastAttempt: now,
      progressiveDelay: 0
    };

    const newAttempts = data.attempts + 1;
    const progressiveDelay = Math.min(
      SECURITY_CONFIG.RATE_LIMITING.PROGRESSIVE_DELAY_BASE * 
      Math.pow(SECURITY_CONFIG.RATE_LIMITING.PROGRESSIVE_DELAY_MULTIPLIER, newAttempts - 1),
      SECURITY_CONFIG.RATE_LIMITING.MAX_PROGRESSIVE_DELAY
    );

    this.rateLimitData.set(identifier, {
      attempts: newAttempts,
      lastAttempt: now,
      progressiveDelay
    });

    // Log security event if callback provided
    if (onLogEvent) {
      onLogEvent({
        type: 'LOGIN_FAILURE',
        email: identifier,
        ipAddress: this.getClientIP(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        timestamp: now,
        success: false,
        metadata: { 
          attempts: newAttempts,
          progressiveDelay,
          willLockAfter: SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS
        }
      });

      // Check if we need to lock the account and log that event
      if (newAttempts >= SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS) {
        this.rateLimitData.set(identifier, {
          attempts: newAttempts,
          lastAttempt: now,
          progressiveDelay,
          lockedUntil: now + SECURITY_CONFIG.RATE_LIMITING.LOCKOUT_DURATION
        });

        onLogEvent({
          type: 'ACCOUNT_LOCKED',
          email: identifier,
          ipAddress: this.getClientIP(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
          timestamp: now,
          success: false,
          metadata: { attempts: newAttempts }
        });
      }
    }

    // Show user feedback
    if (newAttempts >= SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS - 1) {
      toast({
        title: "Account Security Warning",
        description: `Account will be temporarily locked after ${SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS - newAttempts + 1} more failed attempt(s).`,
        variant: "destructive"
      });
    }
  }

  /**
   * Record a successful login attempt
   */
  public recordSuccessfulAttempt(identifier: string, userId?: string, onLogEvent?: (event: SecurityEvent) => void): void {
    const now = Date.now();
    
    // Clear rate limiting data on successful login
    this.rateLimitData.delete(identifier);

    // Log security event if callback provided
    if (onLogEvent) {
      onLogEvent({
        type: 'LOGIN_SUCCESS',
        userId,
        email: identifier,
        ipAddress: this.getClientIP(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        timestamp: now,
        success: true,
        metadata: { 
          rateLimitCleared: true
        }
      });
    }
  }

  /**
   * Get rate limit status for display
   */
  public getRateLimitStatus(identifier: string): RateLimitStatus {
    const data = this.rateLimitData.get(identifier);
    
    if (!data) {
      return {
        attempts: 0,
        remainingAttempts: SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS
      };
    }

    const remainingAttempts = Math.max(0, SECURITY_CONFIG.RATE_LIMITING.LOGIN_ATTEMPTS - data.attempts);
    
    return {
      attempts: data.attempts,
      remainingAttempts,
      lockedUntil: data.lockedUntil,
      nextAttemptAllowed: data.progressiveDelay > 0 ? data.lastAttempt + data.progressiveDelay : undefined
    };
  }

  /**
   * Clear rate limiting data (for testing or admin override)
   */
  public clearRateLimit(identifier: string): void {
    this.rateLimitData.delete(identifier);
  }

  /**
   * Get client IP address (best effort)
   */
  private getClientIP(): string {
    // In production, this would come from headers set by a reverse proxy
    // For now, we'll use a placeholder
    return 'client-ip-placeholder';
  }
} 