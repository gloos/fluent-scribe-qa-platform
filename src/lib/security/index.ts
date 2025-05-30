// Export all security modules
export * from './types';
export * from './DeviceFingerprinting';
export * from './SecurityLogger';
export * from './PasswordSecurityService';
export * from './SecurityHeaders';

// Import modules for unified service
import { sessionManager, SessionManager } from '../sessionManager'; // Use consolidated session manager
import { DeviceFingerprinting } from './DeviceFingerprinting';
import { SecurityLogger } from './SecurityLogger';
import { PasswordSecurityService } from './PasswordSecurityService';
import { SecurityHeaders } from './SecurityHeaders';
import type { SecurityEvent as SecurityEventType } from './types';

/**
 * Unified Security Service that combines all security modules
 * This provides backward compatibility and a single entry point
 */
export class SecurityService {
  private sessionManager: SessionManager;
  private deviceFingerprinting: DeviceFingerprinting;
  private securityLogger: SecurityLogger;

  constructor() {
    this.sessionManager = sessionManager; // Use the singleton from consolidated session manager
    this.deviceFingerprinting = new DeviceFingerprinting();
    this.securityLogger = new SecurityLogger();
    
    // Connect session manager security events to security logger
    this.sessionManager.onSecurityEvent((event) => {
      // Convert the session manager event to security logger event format
      const securityEvent: SecurityEventType = {
        ...event,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent
      };
      this.securityLogger.logSecurityEvent(securityEvent);
    });
  }

  // Session Management Methods
  public checkRateLimit(identifier: string) {
    return this.sessionManager.checkRateLimit(identifier);
  }

  public recordFailedAttempt(identifier: string) {
    return this.sessionManager.recordFailedAttempt(identifier);
  }

  public recordSuccessfulAttempt(identifier: string, userId?: string) {
    // Check for device changes
    const { isNewDevice, fingerprint } = this.deviceFingerprinting.checkDeviceChange(
      identifier,
      userId,
      (event) => this.securityLogger.logSecurityEvent(event)
    );

    // Record successful login with additional device information
    this.sessionManager.recordSuccessfulAttempt(identifier, userId);
    
    // Log additional device information if it's a new device
    if (isNewDevice) {
      this.securityLogger.logSecurityEvent({
        type: 'DEVICE_CHANGE',
        userId,
        email: identifier,
        ipAddress: 'client-ip-placeholder',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        timestamp: Date.now(),
        success: true,
        metadata: {
          deviceFingerprint: fingerprint.hash,
          isNewDevice,
          deviceCount: this.deviceFingerprinting.getDeviceStats().totalDevices
        }
      });
    }
  }

  public getRateLimitStatus(identifier: string) {
    return this.sessionManager.getRateLimitStatus(identifier);
  }

  public clearRateLimit(identifier: string) {
    return this.sessionManager.clearRateLimit(identifier);
  }

  // Device Fingerprinting Methods
  public generateDeviceFingerprint() {
    return this.deviceFingerprinting.generateDeviceFingerprint();
  }

  public getDeviceFingerprints(identifier: string) {
    return this.deviceFingerprinting.getDeviceFingerprints(identifier);
  }

  public removeDeviceFingerprint(identifier: string, fingerprintHash: string) {
    return this.deviceFingerprinting.removeDeviceFingerprint(identifier, fingerprintHash);
  }

  public clearUserDeviceFingerprints(identifier: string) {
    return this.deviceFingerprinting.clearUserDeviceFingerprints(identifier);
  }

  // Security Logging Methods
  public logSecurityEvent(event: SecurityEventType) {
    return this.securityLogger.logSecurityEvent(event);
  }

  public getSecurityEvents(userId?: string, eventType?: import('./types').SecurityEventType) {
    return this.securityLogger.getSecurityEvents(userId, eventType);
  }

  public getSecurityStats() {
    return this.securityLogger.getSecurityStats();
  }

  public clearSecurityEvents() {
    return this.securityLogger.clearSecurityEvents();
  }

  public exportSecurityEvents(startDate?: Date, endDate?: Date) {
    return this.securityLogger.exportSecurityEvents(startDate, endDate);
  }

  public getEventsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical') {
    return this.securityLogger.getEventsBySeverity(severity);
  }

  public generateAlertSummary(timeframe?: number) {
    return this.securityLogger.generateAlertSummary(timeframe);
  }

  // Static Security Header Methods
  public static setSecurityHeaders() {
    return SecurityHeaders.setSecurityHeaders();
  }

  public static getRecommendedHeaders() {
    return SecurityHeaders.getRecommendedHeaders();
  }

  public static validateCurrentHeaders() {
    return SecurityHeaders.validateCurrentHeaders();
  }

  public static generateCustomCSP(options: Parameters<typeof SecurityHeaders.generateCustomCSP>[0]) {
    return SecurityHeaders.generateCustomCSP(options);
  }

  // Static Password Security Methods
  public static checkPasswordBreach(password: string) {
    return PasswordSecurityService.checkPasswordBreach(password);
  }

  public static calculatePasswordEntropy(password: string) {
    return PasswordSecurityService.calculatePasswordEntropy(password);
  }

  public static validatePasswordComplexity(password: string) {
    return PasswordSecurityService.validatePasswordComplexity(password);
  }

  public static generateSecurePassword(length?: number) {
    return PasswordSecurityService.generateSecurePassword(length);
  }

  public static checkCommonPatterns(password: string) {
    return PasswordSecurityService.checkCommonPatterns(password);
  }

  public static assessPasswordStrength(password: string) {
    return PasswordSecurityService.assessPasswordStrength(password);
  }
}

// Export singleton instance for backward compatibility
export const securityService = new SecurityService();

// Initialize security headers when module loads
if (typeof window !== 'undefined') {
  SecurityService.setSecurityHeaders();
}

// Export individual services for direct use - use consolidated session manager
export { sessionManager } from '../sessionManager';
export const deviceFingerprinting = new DeviceFingerprinting();
export const securityLogger = new SecurityLogger();

// Re-export the static classes
export { PasswordSecurityService, SecurityHeaders }; 