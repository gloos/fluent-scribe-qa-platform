// Security configuration constants
export const SECURITY_CONFIG = {
  RATE_LIMITING: {
    LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
    PROGRESSIVE_DELAY_BASE: 1000, // 1 second base delay
    PROGRESSIVE_DELAY_MULTIPLIER: 2,
    MAX_PROGRESSIVE_DELAY: 30000, // 30 seconds max delay
  },
  CAPTCHA: {
    THRESHOLD_ATTEMPTS: 3,
    COOLDOWN_PERIOD: 5 * 60 * 1000, // 5 minutes
  },
  DEVICE_FINGERPRINTING: {
    ENABLED: true,
    TRACK_USER_AGENT: true,
    TRACK_SCREEN_RESOLUTION: true,
    TRACK_TIMEZONE: true,
    TRACK_LANGUAGE: true,
  },
  SESSION_SECURITY: {
    SUSPICIOUS_LOGIN_THRESHOLD: 3,
    GEO_LOCATION_CHECK: true,
    DEVICE_CHANGE_ALERT: true,
  }
} as const;

// Rate limiting storage interface
export interface RateLimitData {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
  progressiveDelay: number;
}

// Device fingerprint interface
export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  colorDepth: number;
  touchSupport: boolean;
  hash: string;
}

// Security event types
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

// Security event interface
export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
}

// Rate limit check result interface
export interface RateLimitResult {
  allowed: boolean;
  waitTime?: number;
  needsCaptcha?: boolean;
}

// Rate limit status interface
export interface RateLimitStatus {
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: number;
  nextAttemptAllowed?: number;
}

// Security statistics interface
export interface SecurityStats {
  totalEvents: number;
  failedLogins: number;
  successfulLogins: number;
  suspiciousActivity: number;
  accountLockouts: number;
  recentEvents: SecurityEvent[];
}

// Password breach check result interface
export interface PasswordBreachResult {
  isCompromised: boolean;
  occurrences?: number;
  error?: string;
}

// Password entropy result interface
export interface PasswordEntropyResult {
  entropy: number;
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  estimatedCrackTime: string;
} 