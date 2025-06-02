import { supabase } from '../supabase'
import { sessionManager, SessionManager, SessionInfo, SessionConfig } from '../sessionManager'
import { AuditLogger } from './AuditLogger'
import { DeviceFingerprinting } from './DeviceFingerprinting'
import { getCachedClientInfo } from '../utils/clientInfo'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Enhanced session data with security metadata
 */
export interface EnhancedSessionInfo extends SessionInfo {
  deviceFingerprint?: string
  ipAddress?: string
  userAgent?: string
  concurrentSessions?: number
  securityScore?: number
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  lastValidation?: number
  sessionId?: string
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean
  session?: Session
  user?: User
  violations: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  actions: string[]
}

/**
 * Enhanced session configuration
 */
export interface EnhancedSessionConfig extends SessionConfig {
  // Advanced security settings
  maxConcurrentSessions: number
  sessionBindToIP: boolean
  sessionBindToDevice: boolean
  enableGeolocationTracking: boolean
  requirePeriodicReauth: boolean
  reauthInterval: number // seconds
  
  // Security thresholds
  suspiciousActivityThreshold: number
  enforceStrongDeviceBinding: boolean
  logAllSessionEvents: boolean
  
  // Token security
  tokenRotationInterval: number // seconds
  validateTokenOnActivity: boolean
  enableSessionFingerprinting: boolean
}

/**
 * Session security violation types
 */
export type SessionViolationType = 
  | 'CONCURRENT_SESSION_LIMIT'
  | 'IP_ADDRESS_CHANGE'
  | 'DEVICE_FINGERPRINT_CHANGE'
  | 'SUSPICIOUS_GEOLOCATION'
  | 'SESSION_EXPIRED'
  | 'TOKEN_INVALID'
  | 'DEVICE_NOT_RECOGNIZED'
  | 'UNUSUAL_ACTIVITY_PATTERN'
  | 'REAUTH_REQUIRED'
  | 'SESSION_HIJACK_SUSPECTED'

/**
 * Enhanced Session Manager with advanced security features
 */
export class EnhancedSessionManager extends SessionManager {
  private auditLogger: AuditLogger
  private deviceFingerprinting: DeviceFingerprinting
  private enhancedConfig: EnhancedSessionConfig
  private activeSessions = new Map<string, EnhancedSessionInfo>()
  private lastReauth = new Map<string, number>()
  private sessionValidationCache = new Map<string, { result: SessionValidationResult; timestamp: number }>()

  constructor(config?: Partial<EnhancedSessionConfig>) {
    super()
    
    this.enhancedConfig = {
      // Base session config
      warningThreshold: 300,
      idleTimeout: 1800,
      autoRefresh: true,
      rememberMe: false,
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      progressiveDelayBase: 1000,
      progressiveDelayMultiplier: 2,
      maxProgressiveDelay: 30 * 1000,
      captchaThreshold: 3,
      
      // Enhanced security config
      maxConcurrentSessions: 3,
      sessionBindToIP: true,
      sessionBindToDevice: true,
      enableGeolocationTracking: false, // Disabled by default for privacy
      requirePeriodicReauth: true,
      reauthInterval: 4 * 60 * 60, // 4 hours
      
      suspiciousActivityThreshold: 5,
      enforceStrongDeviceBinding: true,
      logAllSessionEvents: true,
      
      tokenRotationInterval: 30 * 60, // 30 minutes
      validateTokenOnActivity: true,
      enableSessionFingerprinting: true,
      
      ...config
    }

    this.auditLogger = new AuditLogger()
    this.deviceFingerprinting = new DeviceFingerprinting()
    
    // Configure base session manager
    this.configure(this.enhancedConfig)
  }

  /**
   * Enhanced session validation with security checks
   */
  public async validateSessionWithSecurity(userId?: string): Promise<SessionValidationResult> {
    const clientInfo = await getCachedClientInfo()
    const violations: string[] = []
    const actions: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        violations.push('NO_ACTIVE_SESSION')
        return {
          valid: false,
          violations,
          riskLevel: 'high',
          actions: ['REQUIRE_LOGIN']
        }
      }

      const user = session.user
      if (!user) {
        violations.push('INVALID_USER')
        return {
          valid: false,
          violations,
          riskLevel: 'high',
          actions: ['REQUIRE_LOGIN']
        }
      }

      const sessionUserId = userId || user.id

      // Check session expiration
      if (session.expires_at && session.expires_at < Date.now() / 1000) {
        violations.push('SESSION_EXPIRED')
        actions.push('REFRESH_TOKEN')
        riskLevel = 'medium'
      }

      // Check for concurrent sessions
      const concurrentSessions = this.getConcurrentSessionCount(sessionUserId)
      if (concurrentSessions > this.enhancedConfig.maxConcurrentSessions) {
        violations.push('CONCURRENT_SESSION_LIMIT')
        actions.push('TERMINATE_OLDEST_SESSIONS')
        riskLevel = 'high'
      }

      // Device fingerprinting check
      if (this.enhancedConfig.sessionBindToDevice) {
        const deviceChange = this.deviceFingerprinting.checkDeviceChange(user.email || sessionUserId)
        if (deviceChange.isNewDevice) {
          violations.push('DEVICE_FINGERPRINT_CHANGE')
          actions.push('REQUIRE_DEVICE_VERIFICATION')
          riskLevel = Math.max(riskLevel === 'low' ? 1 : riskLevel === 'medium' ? 2 : riskLevel === 'high' ? 3 : 4, 2) === 2 ? 'medium' : riskLevel
        }
      }

      // Periodic re-authentication check
      if (this.enhancedConfig.requirePeriodicReauth) {
        const lastReauth = this.lastReauth.get(sessionUserId) || 0
        const reauthRequired = (Date.now() - lastReauth) > (this.enhancedConfig.reauthInterval * 1000)
        
        if (reauthRequired) {
          violations.push('REAUTH_REQUIRED')
          actions.push('REQUIRE_REAUTH')
          riskLevel = Math.max(riskLevel === 'low' ? 1 : riskLevel === 'medium' ? 2 : riskLevel === 'high' ? 3 : 4, 2) === 2 ? 'medium' : riskLevel
        }
      }

      // Log security event
      if (this.enhancedConfig.logAllSessionEvents || violations.length > 0) {
        await this.auditLogger.logEvent({
          event_type: violations.length > 0 ? 'SUSPICIOUS_ACTIVITY' : 'LOGIN_SUCCESS',
          user_id: sessionUserId,
          actor_email: user.email || 'unknown',
          result: violations.length === 0 ? 'SUCCESS' : 'FAILURE',
          ip_address: clientInfo.ipAddress,
          user_agent: clientInfo.userAgent,
          reason: violations.length > 0 ? violations.join(', ') : 'Session validation passed',
          metadata: {
            violations,
            riskLevel,
            actions,
            concurrentSessions,
            sessionAge: session.expires_at ? (session.expires_at - (Date.now() / 1000)) : 0
          }
        })
      }

      // Store session info
      const enhancedInfo: EnhancedSessionInfo = {
        session,
        user,
        isExpired: violations.includes('SESSION_EXPIRED'),
        timeUntilExpiry: session.expires_at ? Math.max(0, session.expires_at - (Date.now() / 1000)) : 0,
        lastActivity: Date.now(),
        deviceFingerprint: this.deviceFingerprinting.generateDeviceFingerprint().hash,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        concurrentSessions,
        securityScore: this.calculateSecurityScore(violations, riskLevel),
        riskLevel,
        lastValidation: Date.now(),
        sessionId: this.generateSessionId(session)
      }

      this.activeSessions.set(sessionUserId, enhancedInfo)

      return {
        valid: violations.length === 0 || !violations.includes('SESSION_EXPIRED'),
        session,
        user,
        violations,
        riskLevel,
        actions
      }

    } catch (error) {
      console.error('Session validation error:', error)
      violations.push('VALIDATION_ERROR')
      
      await this.auditLogger.logEvent({
        event_type: 'SUSPICIOUS_ACTIVITY',
        user_id: userId || 'unknown',
        actor_email: 'unknown',
        result: 'FAILURE',
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        reason: 'Session validation error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })

      return {
        valid: false,
        violations,
        riskLevel: 'critical',
        actions: ['REQUIRE_LOGIN']
      }
    }
  }

  /**
   * Enhanced secure logout with session cleanup
   */
  public async enhancedSecureLogout(userId?: string, reason = 'USER_LOGOUT'): Promise<{ success: boolean; error?: any }> {
    const clientInfo = await getCachedClientInfo()
    
    try {
      // Get current session info before logout
      const sessionInfo = await this.getSessionInfo()
      const actualUserId = userId || sessionInfo.user?.id

      // Perform base logout
      const result = await this.secureLogout()

      if (result.success) {
        // Clean up enhanced session data
        if (actualUserId) {
          this.activeSessions.delete(actualUserId)
          this.lastReauth.delete(actualUserId)
        }

        // Clear validation cache
        this.sessionValidationCache.clear()

        // Log logout event
        await this.auditLogger.logEvent({
          event_type: 'LOGOUT',
          user_id: actualUserId || 'unknown',
          actor_email: sessionInfo.user?.email || 'unknown',
          result: 'SUCCESS',
          ip_address: clientInfo.ipAddress,
          user_agent: clientInfo.userAgent,
          reason,
          metadata: {
            sessionDuration: sessionInfo.lastActivity ? Date.now() - sessionInfo.lastActivity : 0,
            logoutReason: reason
          }
        })
      }

      return result
    } catch (error) {
      console.error('Enhanced logout error:', error)
      return { success: false, error }
    }
  }

  /**
   * Get concurrent session count for a user
   */
  private getConcurrentSessionCount(userId: string): number {
    // In a real implementation, this would check active sessions across all devices/browsers
    // For now, we'll simulate this with local tracking
    return this.activeSessions.has(userId) ? 1 : 0
  }

  /**
   * Calculate security score based on violations and risk level
   */
  private calculateSecurityScore(violations: string[], riskLevel: string): number {
    let score = 100 // Start with perfect score

    // Deduct points for violations
    score -= violations.length * 10

    // Adjust based on risk level
    switch (riskLevel) {
      case 'critical':
        score -= 50
        break
      case 'high':
        score -= 30
        break
      case 'medium':
        score -= 15
        break
      case 'low':
        score -= 5
        break
    }

    return Math.max(0, score)
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(session: Session): string {
    return `${session.user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get enhanced session information
   */
  public async getEnhancedSessionInfo(userId?: string): Promise<EnhancedSessionInfo | null> {
    const validation = await this.validateSessionWithSecurity(userId)
    
    if (!validation.valid || !validation.session) {
      return null
    }

    const storedInfo = this.activeSessions.get(userId || validation.user!.id)
    return storedInfo || null
  }

  /**
   * Force re-authentication for a user
   */
  public markReauthRequired(userId: string): void {
    this.lastReauth.delete(userId)
  }

  /**
   * Mark successful re-authentication
   */
  public markReauthCompleted(userId: string): void {
    this.lastReauth.set(userId, Date.now())
  }

  /**
   * Get security analysis of current sessions
   */
  public getSessionSecurityAnalysis(): {
    totalSessions: number
    riskDistribution: Record<string, number>
    commonViolations: Array<{ violation: string; count: number }>
    averageSecurityScore: number
    recommendations: string[]
  } {
    const sessions = Array.from(this.activeSessions.values())
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 }
    const violationCounts = new Map<string, number>()
    
    let totalSecurityScore = 0

    sessions.forEach(session => {
      if (session.riskLevel) {
        riskDistribution[session.riskLevel]++
      }
      if (session.securityScore) {
        totalSecurityScore += session.securityScore
      }
    })

    const averageSecurityScore = sessions.length > 0 ? totalSecurityScore / sessions.length : 100

    // Generate recommendations based on analysis
    const recommendations: string[] = []
    
    if (riskDistribution.critical > 0) {
      recommendations.push('Immediately review critical risk sessions and consider forced logout')
    }
    if (riskDistribution.high > sessions.length * 0.3) {
      recommendations.push('High number of high-risk sessions detected - review security policies')
    }
    if (averageSecurityScore < 70) {
      recommendations.push('Average security score is low - consider implementing stricter session controls')
    }

    return {
      totalSessions: sessions.length,
      riskDistribution,
      commonViolations: Array.from(violationCounts.entries())
        .map(([violation, count]) => ({ violation, count }))
        .sort((a, b) => b.count - a.count),
      averageSecurityScore,
      recommendations
    }
  }

  /**
   * Configure enhanced session settings
   */
  public configureEnhanced(config: Partial<EnhancedSessionConfig>): void {
    this.enhancedConfig = { ...this.enhancedConfig, ...config }
    this.configure(this.enhancedConfig)
  }

  /**
   * Clean up expired sessions and validation cache
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now()
    const expiredSessions: string[] = []

    // Clean up active sessions
    this.activeSessions.forEach((sessionInfo, userId) => {
      if (sessionInfo.isExpired || (sessionInfo.lastValidation && now - sessionInfo.lastValidation > 5 * 60 * 1000)) {
        expiredSessions.push(userId)
      }
    })

    expiredSessions.forEach(userId => {
      this.activeSessions.delete(userId)
      this.lastReauth.delete(userId)
    })

    // Clean up validation cache
    this.sessionValidationCache.forEach((cached, key) => {
      if (now - cached.timestamp > 60 * 1000) { // 1 minute cache
        this.sessionValidationCache.delete(key)
      }
    })
  }
}

// Export singleton instance
export const enhancedSessionManager = new EnhancedSessionManager() 