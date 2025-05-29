import { 
  SECURITY_CONFIG, 
  SecurityEvent, 
  SecurityEventType,
  SecurityStats 
} from './types';

export class SecurityLogger {
  private securityEvents: SecurityEvent[] = [];

  /**
   * Log security events for auditing
   */
  public logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // In production, this would send to a logging service
    console.log('🔐 Security Event:', {
      type: event.type,
      timestamp: new Date(event.timestamp).toISOString(),
      success: event.success,
      userId: event.userId,
      email: event.email,
      ipAddress: event.ipAddress,
      deviceFingerprint: event.deviceFingerprint,
      metadata: event.metadata
    });

    // Keep only last 1000 events in memory (prevent memory leaks)
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Trigger alerts for critical events
    this.checkForSecurityAlerts(event);
  }

  /**
   * Get security events for auditing
   */
  public getSecurityEvents(userId?: string, eventType?: SecurityEventType): SecurityEvent[] {
    let events = [...this.securityEvents];

    if (userId) {
      events = events.filter(event => event.userId === userId);
    }

    if (eventType) {
      events = events.filter(event => event.type === eventType);
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): SecurityStats {
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentEvents = this.securityEvents.filter(e => e.timestamp > last24Hours);

    return {
      totalEvents: this.securityEvents.length,
      failedLogins: recentEvents.filter(e => e.type === 'LOGIN_FAILURE').length,
      successfulLogins: recentEvents.filter(e => e.type === 'LOGIN_SUCCESS').length,
      suspiciousActivity: recentEvents.filter(e => e.type === 'SUSPICIOUS_ACTIVITY').length,
      accountLockouts: recentEvents.filter(e => e.type === 'ACCOUNT_LOCKED').length,
      recentEvents: recentEvents.slice(0, 10) // Last 10 events
    };
  }

  /**
   * Clear security events (for testing or admin)
   */
  public clearSecurityEvents(): void {
    this.securityEvents = [];
  }

  /**
   * Export security events for analysis
   */
  public exportSecurityEvents(startDate?: Date, endDate?: Date): SecurityEvent[] {
    let events = [...this.securityEvents];

    if (startDate) {
      events = events.filter(e => e.timestamp >= startDate.getTime());
    }

    if (endDate) {
      events = events.filter(e => e.timestamp <= endDate.getTime());
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Check for security alerts and suspicious patterns
   */
  private checkForSecurityAlerts(event: SecurityEvent): void {
    const recentEvents = this.securityEvents.filter(
      e => e.timestamp > Date.now() - (60 * 60 * 1000) && e.email === event.email
    );

    // Multiple failed logins from different IPs
    if (event.type === 'LOGIN_FAILURE') {
      const uniqueIPs = new Set(recentEvents.map(e => e.ipAddress));
      if (uniqueIPs.size >= 3) {
        this.logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          email: event.email,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: Date.now(),
          success: false,
          metadata: { 
            reason: 'Multiple IPs attempting login',
            uniqueIPs: Array.from(uniqueIPs),
            timeframe: '1 hour'
          }
        });
      }
    }

    // Rapid-fire login attempts
    const recentAttempts = recentEvents.filter(
      e => e.type === 'LOGIN_FAILURE' && e.timestamp > Date.now() - (5 * 60 * 1000)
    );

    if (recentAttempts.length >= 5) {
      this.logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        email: event.email,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: Date.now(),
        success: false,
        metadata: { 
          attempts: recentAttempts.length,
          timeframe: '5 minutes'
        }
      });
    }

    // Check for suspicious user agent changes
    if (event.type === 'LOGIN_SUCCESS') {
      const recentSuccessfulLogins = recentEvents.filter(
        e => e.type === 'LOGIN_SUCCESS' && e.email === event.email
      );

      if (recentSuccessfulLogins.length >= 2) {
        const userAgents = new Set(recentSuccessfulLogins.map(e => e.userAgent));
        if (userAgents.size >= 3) {
          this.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            email: event.email,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            timestamp: Date.now(),
            success: false,
            metadata: { 
              reason: 'Multiple user agents for successful logins',
              userAgents: Array.from(userAgents),
              timeframe: '1 hour'
            }
          });
        }
      }
    }

    // Check for unusual time patterns (e.g., logins at 3 AM)
    if (event.type === 'LOGIN_SUCCESS') {
      const loginHour = new Date(event.timestamp).getHours();
      if (loginHour >= 2 && loginHour <= 5) { // 2 AM to 5 AM
        const recentUnusualLogins = recentEvents.filter(
          e => e.type === 'LOGIN_SUCCESS' && 
          e.email === event.email &&
          new Date(e.timestamp).getHours() >= 2 && 
          new Date(e.timestamp).getHours() <= 5
        );

        if (recentUnusualLogins.length >= 2) {
          this.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            email: event.email,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            timestamp: Date.now(),
            success: false,
            metadata: { 
              reason: 'Unusual login time pattern',
              loginHour,
              timeframe: '1 hour'
            }
          });
        }
      }
    }
  }

  /**
   * Get events by severity level
   */
  public getEventsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): SecurityEvent[] {
    const severityMapping = {
      low: ['LOGIN_SUCCESS', 'MFA_ENABLED'],
      medium: ['LOGIN_FAILURE', 'DEVICE_CHANGE'],
      high: ['RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY'],
      critical: ['ACCOUNT_LOCKED', 'PASSWORD_RESET']
    };

    const eventTypes = severityMapping[severity];
    return this.securityEvents.filter(event => eventTypes.includes(event.type));
  }

  /**
   * Generate security alert summary
   */
  public generateAlertSummary(timeframe: number = 24 * 60 * 60 * 1000): {
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    totalEvents: number;
    timeframe: string;
  } {
    const cutoff = Date.now() - timeframe;
    const recentEvents = this.securityEvents.filter(e => e.timestamp > cutoff);

    const criticalAlerts = this.getEventsBySeverity('critical').filter(e => e.timestamp > cutoff).length;
    const highAlerts = this.getEventsBySeverity('high').filter(e => e.timestamp > cutoff).length;
    const mediumAlerts = this.getEventsBySeverity('medium').filter(e => e.timestamp > cutoff).length;

    return {
      criticalAlerts,
      highAlerts,
      mediumAlerts,
      totalEvents: recentEvents.length,
      timeframe: `${timeframe / (60 * 60 * 1000)} hours`
    };
  }
} 