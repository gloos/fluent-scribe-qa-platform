import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

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
}

class SessionManager {
  private config: SessionConfig = {
    warningThreshold: 300, // 5 minutes
    idleTimeout: 1800, // 30 minutes
    autoRefresh: true,
    rememberMe: false
  };

  private idleTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private sessionWarningCallbacks: Array<(timeLeft: number) => void> = [];
  private sessionExpiredCallbacks: Array<() => void> = [];
  private activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

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
  }
}

// Create and export singleton instance
export const sessionManager = new SessionManager();

// Export the class for testing or custom instances
export { SessionManager }; 