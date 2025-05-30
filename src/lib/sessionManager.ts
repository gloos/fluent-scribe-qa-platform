import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

// Re-export security types that will be used
export interface RateLimitData {
  attempts: number;
  lastAttempt: number;
  progressiveDelay: number;
  lockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  waitTime?: number;
  needsCaptcha?: boolean;
}

export interface RateLimitStatus {
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: number;
  nextAttemptAllowed?: number;
}

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress: string; // Required to match security types
  userAgent: string; // Required to match security types
  deviceFingerprint?: string;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export type SecurityEventType = 
  | 'LOGIN_ATTEMPT'
  | 'LOGIN_SUCCESS' 
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKED' 
  | 'SUSPICIOUS_ACTIVITY' 
  | 'RATE_LIMIT_EXCEEDED'
  | 'DEVICE_CHANGE' 
  | 'PASSWORD_RESET'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED';

export interface SessionInfo {
  session: Session | null;
  user: User | null;
  isExpired: boolean;
  timeUntilExpiry: number; // in seconds
  lastActivity: number; // timestamp
}

export interface SessionConfig {
  warningThreshold: number; // seconds before expiry to show warning
  idleTimeout: number; // seconds of inactivity before logout
  autoRefresh: boolean; // whether to auto-refresh sessions
  rememberMe: boolean; // whether session should persist across browser restarts
  // Security configuration
  maxLoginAttempts: number;
  lockoutDuration: number; // milliseconds
  progressiveDelayBase: number; // milliseconds
  progressiveDelayMultiplier: number;
  maxProgressiveDelay: number; // milliseconds
  captchaThreshold: number; // attempts before requiring captcha
}

class SessionManager {
  private config: SessionConfig = {
    warningThreshold: 300, // 5 minutes
    idleTimeout: 1800, // 30 minutes
    autoRefresh: true,
    rememberMe: false,
    // Security defaults
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    progressiveDelayBase: 1000, // 1 second
    progressiveDelayMultiplier: 2,
    maxProgressiveDelay: 30 * 1000, // 30 seconds
    captchaThreshold: 3
  };

  private idleTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private sessionWarningCallbacks: Array<(timeLeft: number) => void> = [];
  private sessionExpiredCallbacks: Array<() => void> = [];
  private activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  // Security state
  private rateLimitData = new Map<string, RateLimitData>();
  private securityEventCallbacks: Array<(event: SecurityEvent) => void> = [];

  constructor() {
    this.initializeActivityTracking();
  }

  /**
   * Initialize activity tracking to detect user activity
   */
  private initializeActivityTracking() {
    const resetIdleTimer = () => {
      this.lastActivity = Date.now();
      this.resetIdleTimer();
    };

    // Add event listeners for user activity
    this.activityEvents.forEach(event => {
      document.addEventListener(event, resetIdleTimer, true);
    });
  }

  /**
   * Configure session management settings
   */
  public configure(config: Partial<SessionConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current session information
   */
  public async getSessionInfo(): Promise<SessionInfo> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return {
        session: null,
        user: null,
        isExpired: true,
        timeUntilExpiry: 0,
        lastActivity: this.lastActivity
      };
    }

    const now = Date.now() / 1000; // Convert to seconds
    const expiresAt = session.expires_at || 0;
    const timeUntilExpiry = Math.max(0, expiresAt - now);
    const isExpired = timeUntilExpiry <= 0;

    return {
      session,
      user: session.user,
      isExpired,
      timeUntilExpiry,
      lastActivity: this.lastActivity
    };
  }

  /**
   * Check if session is approaching expiration
   */
  public async isSessionExpiringSoon(): Promise<boolean> {
    const sessionInfo = await this.getSessionInfo();
    return !sessionInfo.isExpired && sessionInfo.timeUntilExpiry <= this.config.warningThreshold;
  }

  /**
   * Check if user has been idle too long
   */
  public isUserIdle(): boolean {
    const idleTime = (Date.now() - this.lastActivity) / 1000;
    return idleTime >= this.config.idleTimeout;
  }

  /**
   * Refresh the current session
   */
  public async refreshSession(): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error during session refresh:', error);
      return { success: false, error };
    }
  }

  /**
   * Secure logout with session invalidation
   */
  public async secureLogout(): Promise<{ success: boolean; error?: any }> {
    try {
      // Clear all timers
      this.clearTimers();

      // Sign out from Supabase (this invalidates the session)
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        return { success: false, error };
      }

      // Clear any local storage items related to session
      this.clearLocalSessionData();

      return { success: true };
    } catch (error) {
      console.error('Unexpected error during logout:', error);
      return { success: false, error };
    }
  }

  // =========================
  // SECURITY METHODS
  // =========================

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
        needsCaptcha: data.attempts >= this.config.captchaThreshold
      };
    }

    // Reset if enough time has passed
    if (now - data.lastAttempt > this.config.lockoutDuration) {
      this.rateLimitData.set(identifier, {
        attempts: 1,
        lastAttempt: now,
        progressiveDelay: 0
      });
      return { allowed: true };
    }

    // Check if we're within limits
    if (data.attempts >= this.config.maxLoginAttempts) {
      // Lock the account
      this.rateLimitData.set(identifier, {
        ...data,
        lockedUntil: now + this.config.lockoutDuration
      });

      return { 
        allowed: false, 
        waitTime: Math.ceil(this.config.lockoutDuration / 1000),
        needsCaptcha: true
      };
    }

    return { 
      allowed: true,
      needsCaptcha: data.attempts >= this.config.captchaThreshold
    };
  }

  /**
   * Record a failed login attempt
   */
  public recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const data = this.rateLimitData.get(identifier) || {
      attempts: 0,
      lastAttempt: now,
      progressiveDelay: 0
    };

    const newAttempts = data.attempts + 1;
    const progressiveDelay = Math.min(
      this.config.progressiveDelayBase * 
      Math.pow(this.config.progressiveDelayMultiplier, newAttempts - 1),
      this.config.maxProgressiveDelay
    );

    this.rateLimitData.set(identifier, {
      attempts: newAttempts,
      lastAttempt: now,
      progressiveDelay
    });

    // Log security event
    this.logSecurityEvent({
      type: 'LOGIN_FAILURE',
      email: identifier,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      timestamp: now,
      success: false,
      metadata: { 
        attempts: newAttempts,
        progressiveDelay,
        willLockAfter: this.config.maxLoginAttempts
      }
    });

    // Check if we need to lock the account and log that event
    if (newAttempts >= this.config.maxLoginAttempts) {
      this.rateLimitData.set(identifier, {
        attempts: newAttempts,
        lastAttempt: now,
        progressiveDelay,
        lockedUntil: now + this.config.lockoutDuration
      });

      this.logSecurityEvent({
        type: 'ACCOUNT_LOCKED',
        email: identifier,
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
        timestamp: now,
        success: false,
        metadata: { attempts: newAttempts }
      });
    }

    // Show user feedback
    if (newAttempts >= this.config.maxLoginAttempts - 1) {
      toast({
        title: "Account Security Warning",
        description: `Account will be temporarily locked after ${this.config.maxLoginAttempts - newAttempts + 1} more failed attempt(s).`,
        variant: "destructive"
      });
    }
  }

  /**
   * Record a successful login attempt
   */
  public recordSuccessfulAttempt(identifier: string, userId?: string): void {
    const now = Date.now();
    
    // Clear rate limiting data on successful login
    this.rateLimitData.delete(identifier);

    // Log security event
    this.logSecurityEvent({
      type: 'LOGIN_SUCCESS',
      userId,
      email: identifier,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      timestamp: now,
      success: true,
      metadata: { 
        rateLimitCleared: true
      }
    });
  }

  /**
   * Get rate limit status for display
   */
  public getRateLimitStatus(identifier: string): RateLimitStatus {
    const data = this.rateLimitData.get(identifier);
    
    if (!data) {
      return {
        attempts: 0,
        remainingAttempts: this.config.maxLoginAttempts
      };
    }

    const remainingAttempts = Math.max(0, this.config.maxLoginAttempts - data.attempts);
    
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
   * Log a security event
   */
  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEventCallbacks.forEach(callback => callback(event));
  }

  /**
   * Register callback for security events
   */
  public onSecurityEvent(callback: (event: SecurityEvent) => void) {
    this.securityEventCallbacks.push(callback);
    return () => {
      const index = this.securityEventCallbacks.indexOf(callback);
      if (index > -1) {
        this.securityEventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get client IP address (best effort)
   */
  private getClientIP(): string {
    // In production, this would come from headers set by a reverse proxy
    // For now, we'll use a placeholder
    return 'client-ip-placeholder';
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
  }

  // =========================
  // SESSION LIFECYCLE METHODS
  // =========================

  /**
   * Start session monitoring (expiration and idle detection)
   */
  public startSessionMonitoring() {
    this.resetIdleTimer();
    this.startExpirationWarning();
  }

  /**
   * Stop session monitoring
   */
  public stopSessionMonitoring() {
    this.clearTimers();
  }

  /**
   * Reset the idle timer
   */
  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.config.idleTimeout * 1000);
  }

  /**
   * Start monitoring for session expiration warnings
   */
  private async startExpirationWarning() {
    const sessionInfo = await this.getSessionInfo();
    
    if (sessionInfo.isExpired || !sessionInfo.session) {
      return;
    }

    const warningTime = Math.max(0, sessionInfo.timeUntilExpiry - this.config.warningThreshold);
    
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }

    this.warningTimer = setTimeout(() => {
      this.handleSessionWarning();
    }, warningTime * 1000);
  }

  /**
   * Handle idle timeout
   */
  private handleIdleTimeout() {
    console.log('User idle timeout - logging out');
    this.sessionExpiredCallbacks.forEach(callback => callback());
    this.secureLogout();
  }

  /**
   * Handle session expiration warning
   */
  private async handleSessionWarning() {
    const sessionInfo = await this.getSessionInfo();
    
    if (!sessionInfo.isExpired && sessionInfo.session) {
      this.sessionWarningCallbacks.forEach(callback => 
        callback(sessionInfo.timeUntilExpiry)
      );
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Clear local session data
   */
  private clearLocalSessionData() {
    // Clear any session-related localStorage items
    const sessionKeys = [
      'supabase.auth.token',
      // Construct the storage key pattern used by Supabase
      'sb-auth-token'
    ];

    sessionKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn('Error clearing storage item:', key, error);
      }
    });

    // Clear any keys that start with 'sb-' (Supabase convention)
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Error clearing Supabase storage items:', error);
    }
  }

  /**
   * Register callback for session warning
   */
  public onSessionWarning(callback: (timeLeft: number) => void) {
    this.sessionWarningCallbacks.push(callback);
    return () => {
      const index = this.sessionWarningCallbacks.indexOf(callback);
      if (index > -1) {
        this.sessionWarningCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for session expiration
   */
  public onSessionExpired(callback: () => void) {
    this.sessionExpiredCallbacks.push(callback);
    return () => {
      const index = this.sessionExpiredCallbacks.indexOf(callback);
      if (index > -1) {
        this.sessionExpiredCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Set remember me preference
   */
  public setRememberMe(remember: boolean) {
    this.config.rememberMe = remember;
    
    // Note: Supabase handles persistent vs session storage automatically
    // based on the persistSession configuration in the client
    // The remember me preference can be used by the application
    // to determine session behavior
  }

  /**
   * Get session statistics for debugging/monitoring
   */
  public async getSessionStats() {
    const sessionInfo = await this.getSessionInfo();
    const idleTime = (Date.now() - this.lastActivity) / 1000;

    return {
      ...sessionInfo,
      idleTime,
      isIdle: this.isUserIdle(),
      isExpiringSoon: await this.isSessionExpiringSoon(),
      config: this.config
    };
  }

  /**
   * Cleanup - remove event listeners and clear timers
   */
  public destroy() {
    // Remove activity event listeners
    const resetIdleTimer = () => {
      this.lastActivity = Date.now();
      this.resetIdleTimer();
    };

    this.activityEvents.forEach(event => {
      document.removeEventListener(event, resetIdleTimer, true);
    });

    this.clearTimers();
    this.sessionWarningCallbacks = [];
    this.sessionExpiredCallbacks = [];
    this.securityEventCallbacks = [];
  }
}

// Create and export singleton instance
export const sessionManager = new SessionManager();

// Export the class for testing or custom instances
export { SessionManager }; 