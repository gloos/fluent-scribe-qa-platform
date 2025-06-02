import { SecurityEvent, RateLimitData } from './types';
import { AuditLogger } from './AuditLogger';

/**
 * Configuration for password reset rate limiting
 */
export interface PasswordResetRateLimitConfig {
  // Email-based limits
  maxResetRequestsPerEmail: number;
  emailCooldownPeriod: number; // milliseconds
  
  // IP-based limits
  maxResetRequestsPerIP: number;
  ipCooldownPeriod: number; // milliseconds
  
  // Global limits
  maxResetRequestsGlobal: number;
  globalCooldownPeriod: number; // milliseconds
  
  // Progressive delays
  enableProgressiveDelays: boolean;
  progressiveDelayBase: number; // milliseconds
  progressiveDelayMultiplier: number;
  maxProgressiveDelay: number; // milliseconds
  
  // Suspicious activity detection
  suspiciousRequestThreshold: number;
  suspiciousActivityCooldown: number; // milliseconds
  
  // CAPTCHA integration
  captchaThreshold: number;
  captchaCooldown: number; // milliseconds
}

/**
 * Default configuration for password reset rate limiting
 */
export const DEFAULT_PASSWORD_RESET_CONFIG: PasswordResetRateLimitConfig = {
  // Allow 3 reset requests per email per hour
  maxResetRequestsPerEmail: 3,
  emailCooldownPeriod: 60 * 60 * 1000, // 1 hour
  
  // Allow 10 reset requests per IP per hour
  maxResetRequestsPerIP: 10,
  ipCooldownPeriod: 60 * 60 * 1000, // 1 hour
  
  // Global protection: 100 requests per 15 minutes
  maxResetRequestsGlobal: 100,
  globalCooldownPeriod: 15 * 60 * 1000, // 15 minutes
  
  // Progressive delays enabled with exponential backoff
  enableProgressiveDelays: true,
  progressiveDelayBase: 5000, // 5 seconds base
  progressiveDelayMultiplier: 2,
  maxProgressiveDelay: 60000, // 1 minute max
  
  // Suspicious activity: 5 requests from same source triggers investigation
  suspiciousRequestThreshold: 5,
  suspiciousActivityCooldown: 30 * 60 * 1000, // 30 minutes
  
  // CAPTCHA after 2 failed attempts
  captchaThreshold: 2,
  captchaCooldown: 15 * 60 * 1000, // 15 minutes
};

/**
 * Password reset rate limit check result
 */
export interface PasswordResetRateLimitResult {
  allowed: boolean;
  reason?: 'email_rate_limit' | 'ip_rate_limit' | 'global_rate_limit' | 'suspicious_activity' | 'captcha_required';
  waitTime?: number; // milliseconds until next request allowed
  needsCaptcha?: boolean;
  progressiveDelay?: number; // additional delay to apply
  metadata?: {
    emailAttempts?: number;
    ipAttempts?: number;
    globalAttempts?: number;
    isSuspicious?: boolean;
  };
}

/**
 * Enhanced password reset rate limiting service
 * Provides comprehensive protection against abuse of password reset functionality
 */
export class PasswordResetRateLimiter {
  private emailAttempts = new Map<string, RateLimitData>();
  private ipAttempts = new Map<string, RateLimitData>();
  private globalAttempts: RateLimitData = { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
  private suspiciousEmails = new Set<string>();
  private suspiciousIPs = new Set<string>();
  private auditLogger: AuditLogger;
  
  constructor(
    private config: PasswordResetRateLimitConfig = DEFAULT_PASSWORD_RESET_CONFIG,
    auditLogger?: AuditLogger
  ) {
    this.auditLogger = auditLogger || new AuditLogger();
    
    // Cleanup expired entries every 10 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 10 * 60 * 1000);
  }

  /**
   * Check if a password reset request is allowed
   */
  async checkResetRequest(
    email: string,
    ipAddress: string,
    userAgent: string = 'unknown'
  ): Promise<PasswordResetRateLimitResult> {
    const now = Date.now();
    
    // Log the attempt
    await this.logResetAttempt(email, ipAddress, userAgent, 'REQUEST_INITIATED');
    
    // Check email-based rate limiting
    const emailCheck = this.checkEmailRateLimit(email, now);
    if (!emailCheck.allowed) {
      await this.logResetAttempt(email, ipAddress, userAgent, 'EMAIL_RATE_LIMITED');
      return emailCheck;
    }
    
    // Check IP-based rate limiting
    const ipCheck = this.checkIPRateLimit(ipAddress, now);
    if (!ipCheck.allowed) {
      await this.logResetAttempt(email, ipAddress, userAgent, 'IP_RATE_LIMITED');
      return ipCheck;
    }
    
    // Check global rate limiting
    const globalCheck = this.checkGlobalRateLimit(now);
    if (!globalCheck.allowed) {
      await this.logResetAttempt(email, ipAddress, userAgent, 'GLOBAL_RATE_LIMITED');
      return globalCheck;
    }
    
    // Check for suspicious activity
    const suspiciousCheck = this.checkSuspiciousActivity(email, ipAddress, now);
    if (!suspiciousCheck.allowed) {
      await this.logResetAttempt(email, ipAddress, userAgent, 'SUSPICIOUS_ACTIVITY_DETECTED');
      return suspiciousCheck;
    }
    
    // Check if CAPTCHA is required
    const captchaCheck = this.checkCaptchaRequired(email, ipAddress);
    if (captchaCheck.needsCaptcha) {
      await this.logResetAttempt(email, ipAddress, userAgent, 'CAPTCHA_REQUIRED');
      return captchaCheck;
    }
    
    // All checks passed
    await this.logResetAttempt(email, ipAddress, userAgent, 'REQUEST_ALLOWED');
    return { allowed: true };
  }

  /**
   * Record a successful password reset request
   */
  async recordResetRequest(
    email: string,
    ipAddress: string,
    userAgent: string = 'unknown'
  ): Promise<void> {
    const now = Date.now();
    
    // Record email attempt
    this.recordEmailAttempt(email, now);
    
    // Record IP attempt
    this.recordIPAttempt(ipAddress, now);
    
    // Record global attempt
    this.recordGlobalAttempt(now);
    
    // Log successful request
    await this.logResetAttempt(email, ipAddress, userAgent, 'REQUEST_RECORDED');
  }

  /**
   * Record a failed password reset (e.g., invalid email)
   */
  async recordFailedReset(
    email: string,
    ipAddress: string,
    userAgent: string = 'unknown',
    reason: string = 'unknown'
  ): Promise<void> {
    // Increase penalties for failed attempts
    const emailData = this.emailAttempts.get(email) || { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
    emailData.attempts += 0.5; // Partial penalty for failed attempts
    this.emailAttempts.set(email, emailData);
    
    // Log failed attempt
    await this.logResetAttempt(email, ipAddress, userAgent, 'REQUEST_FAILED', { reason });
    
    // Check if this triggers suspicious activity detection
    this.checkAndMarkSuspicious(email, ipAddress);
  }

  /**
   * Check email-based rate limiting
   */
  private checkEmailRateLimit(email: string, now: number): PasswordResetRateLimitResult {
    const emailData = this.emailAttempts.get(email);
    
    if (!emailData) {
      return { allowed: true };
    }
    
    // Check if cooldown period has expired
    if (now - emailData.lastAttempt > this.config.emailCooldownPeriod) {
      this.emailAttempts.delete(email);
      return { allowed: true };
    }
    
    // Check if within rate limit
    if (emailData.attempts < this.config.maxResetRequestsPerEmail) {
      const progressiveDelay = this.calculateProgressiveDelay(emailData.attempts);
      return { 
        allowed: true,
        progressiveDelay,
        metadata: { emailAttempts: emailData.attempts }
      };
    }
    
    // Rate limited
    const waitTime = (emailData.lastAttempt + this.config.emailCooldownPeriod) - now;
    return {
      allowed: false,
      reason: 'email_rate_limit',
      waitTime: Math.max(0, waitTime),
      metadata: { emailAttempts: emailData.attempts }
    };
  }

  /**
   * Check IP-based rate limiting
   */
  private checkIPRateLimit(ipAddress: string, now: number): PasswordResetRateLimitResult {
    const ipData = this.ipAttempts.get(ipAddress);
    
    if (!ipData) {
      return { allowed: true };
    }
    
    // Check if cooldown period has expired
    if (now - ipData.lastAttempt > this.config.ipCooldownPeriod) {
      this.ipAttempts.delete(ipAddress);
      return { allowed: true };
    }
    
    // Check if within rate limit
    if (ipData.attempts < this.config.maxResetRequestsPerIP) {
      return { 
        allowed: true,
        metadata: { ipAttempts: ipData.attempts }
      };
    }
    
    // Rate limited
    const waitTime = (ipData.lastAttempt + this.config.ipCooldownPeriod) - now;
    return {
      allowed: false,
      reason: 'ip_rate_limit',
      waitTime: Math.max(0, waitTime),
      metadata: { ipAttempts: ipData.attempts }
    };
  }

  /**
   * Check global rate limiting
   */
  private checkGlobalRateLimit(now: number): PasswordResetRateLimitResult {
    // Check if cooldown period has expired
    if (now - this.globalAttempts.lastAttempt > this.config.globalCooldownPeriod) {
      this.globalAttempts = { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
      return { allowed: true };
    }
    
    // Check if within rate limit
    if (this.globalAttempts.attempts < this.config.maxResetRequestsGlobal) {
      return { 
        allowed: true,
        metadata: { globalAttempts: this.globalAttempts.attempts }
      };
    }
    
    // Rate limited
    const waitTime = (this.globalAttempts.lastAttempt + this.config.globalCooldownPeriod) - now;
    return {
      allowed: false,
      reason: 'global_rate_limit',
      waitTime: Math.max(0, waitTime),
      metadata: { globalAttempts: this.globalAttempts.attempts }
    };
  }

  /**
   * Check for suspicious activity
   */
  private checkSuspiciousActivity(email: string, ipAddress: string, now: number): PasswordResetRateLimitResult {
    const isSuspiciousEmail = this.suspiciousEmails.has(email);
    const isSuspiciousIP = this.suspiciousIPs.has(ipAddress);
    
    if (isSuspiciousEmail || isSuspiciousIP) {
      return {
        allowed: false,
        reason: 'suspicious_activity',
        waitTime: this.config.suspiciousActivityCooldown,
        metadata: { 
          isSuspicious: true,
          emailAttempts: this.emailAttempts.get(email)?.attempts || 0,
          ipAttempts: this.ipAttempts.get(ipAddress)?.attempts || 0
        }
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check if CAPTCHA is required
   */
  private checkCaptchaRequired(email: string, ipAddress: string): PasswordResetRateLimitResult {
    const emailData = this.emailAttempts.get(email);
    const ipData = this.ipAttempts.get(ipAddress);
    
    const emailAttempts = emailData?.attempts || 0;
    const ipAttempts = ipData?.attempts || 0;
    
    if (emailAttempts >= this.config.captchaThreshold || ipAttempts >= this.config.captchaThreshold) {
      return {
        allowed: true,
        needsCaptcha: true,
        metadata: { emailAttempts, ipAttempts }
      };
    }
    
    return { allowed: true, needsCaptcha: false };
  }

  /**
   * Record email attempt
   */
  private recordEmailAttempt(email: string, now: number): void {
    const emailData = this.emailAttempts.get(email) || { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
    emailData.attempts += 1;
    emailData.lastAttempt = now;
    emailData.progressiveDelay = this.calculateProgressiveDelay(emailData.attempts);
    this.emailAttempts.set(email, emailData);
  }

  /**
   * Record IP attempt
   */
  private recordIPAttempt(ipAddress: string, now: number): void {
    const ipData = this.ipAttempts.get(ipAddress) || { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
    ipData.attempts += 1;
    ipData.lastAttempt = now;
    this.ipAttempts.set(ipAddress, ipData);
  }

  /**
   * Record global attempt
   */
  private recordGlobalAttempt(now: number): void {
    this.globalAttempts.attempts += 1;
    this.globalAttempts.lastAttempt = now;
  }

  /**
   * Calculate progressive delay
   */
  private calculateProgressiveDelay(attempts: number): number {
    if (!this.config.enableProgressiveDelays) {
      return 0;
    }
    
    const delay = this.config.progressiveDelayBase * 
                  Math.pow(this.config.progressiveDelayMultiplier, attempts - 1);
    
    return Math.min(delay, this.config.maxProgressiveDelay);
  }

  /**
   * Check and mark suspicious activity
   */
  private checkAndMarkSuspicious(email: string, ipAddress: string): void {
    const emailData = this.emailAttempts.get(email);
    const ipData = this.ipAttempts.get(ipAddress);
    
    if (emailData && emailData.attempts >= this.config.suspiciousRequestThreshold) {
      this.suspiciousEmails.add(email);
      // Auto-remove after cooldown period
      setTimeout(() => {
        this.suspiciousEmails.delete(email);
      }, this.config.suspiciousActivityCooldown);
    }
    
    if (ipData && ipData.attempts >= this.config.suspiciousRequestThreshold) {
      this.suspiciousIPs.add(ipAddress);
      // Auto-remove after cooldown period
      setTimeout(() => {
        this.suspiciousIPs.delete(ipAddress);
      }, this.config.suspiciousActivityCooldown);
    }
  }

  /**
   * Log password reset attempt
   */
  private async logResetAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    eventType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const auditEntry = {
      event_type: 'PASSWORD_RESET' as const,
      actor_email: email,
      result: (eventType.includes('ALLOWED') || eventType.includes('RECORDED')) ? 'SUCCESS' as const : 'FAILURE' as const,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason: eventType,
      metadata: {
        resetEventType: eventType,
        ...metadata
      }
    };
    
    await this.auditLogger.logEvent(auditEntry);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean up email attempts
    for (const [email, data] of this.emailAttempts.entries()) {
      if (now - data.lastAttempt > this.config.emailCooldownPeriod) {
        this.emailAttempts.delete(email);
      }
    }
    
    // Clean up IP attempts
    for (const [ip, data] of this.ipAttempts.entries()) {
      if (now - data.lastAttempt > this.config.ipCooldownPeriod) {
        this.ipAttempts.delete(ip);
      }
    }
    
    // Clean up global attempts
    if (now - this.globalAttempts.lastAttempt > this.config.globalCooldownPeriod) {
      this.globalAttempts = { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
    }
  }

  /**
   * Get current rate limit status for an email
   */
  getEmailStatus(email: string): { attempts: number; waitTime: number; isSuspicious: boolean } {
    const emailData = this.emailAttempts.get(email);
    const now = Date.now();
    
    if (!emailData) {
      return { attempts: 0, waitTime: 0, isSuspicious: false };
    }
    
    const waitTime = Math.max(0, (emailData.lastAttempt + this.config.emailCooldownPeriod) - now);
    const isSuspicious = this.suspiciousEmails.has(email);
    
    return {
      attempts: emailData.attempts,
      waitTime,
      isSuspicious
    };
  }

  /**
   * Get current rate limit status for an IP
   */
  getIPStatus(ipAddress: string): { attempts: number; waitTime: number; isSuspicious: boolean } {
    const ipData = this.ipAttempts.get(ipAddress);
    const now = Date.now();
    
    if (!ipData) {
      return { attempts: 0, waitTime: 0, isSuspicious: false };
    }
    
    const waitTime = Math.max(0, (ipData.lastAttempt + this.config.ipCooldownPeriod) - now);
    const isSuspicious = this.suspiciousIPs.has(ipAddress);
    
    return {
      attempts: ipData.attempts,
      waitTime,
      isSuspicious
    };
  }

  /**
   * Reset rate limits for testing or administrative purposes
   */
  reset(): void {
    this.emailAttempts.clear();
    this.ipAttempts.clear();
    this.globalAttempts = { attempts: 0, lastAttempt: 0, progressiveDelay: 0 };
    this.suspiciousEmails.clear();
    this.suspiciousIPs.clear();
  }
}

// Export a singleton instance
export const passwordResetRateLimiter = new PasswordResetRateLimiter(); 