import { enhancedSessionManager, EnhancedSessionInfo } from './EnhancedSessionManager'
import { AuditLogger } from './AuditLogger'
import { getCachedClientInfo } from '../utils/clientInfo'
import type { Session } from '@supabase/supabase-js'

/**
 * Complexity metrics for session analysis
 */
export interface SessionComplexityMetrics {
  totalSessions: number
  averageSessionAge: number
  deviceVariability: number
  ipVariability: number
  timePatternVariability: number
  securityScoreDistribution: {
    low: number
    medium: number
    high: number
    critical: number
  }
  riskFactorWeights: {
    concurrentSessions: number
    deviceChanges: number
    locationChanges: number
    timePatterns: number
    sessionAge: number
  }
}

/**
 * Security interdependency analysis
 */
export interface SecurityInterdependencyAnalysis {
  dependencies: Array<{
    source: string
    target: string
    strength: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    description: string
  }>
  criticalPaths: Array<{
    path: string[]
    totalRisk: number
    description: string
  }>
  vulnerabilities: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
    affectedSessions: number
  }>
  recommendations: string[]
  complexityScore: number
}

/**
 * Session pattern analysis result
 */
export interface SessionPatternAnalysis {
  patterns: Array<{
    type: 'time_based' | 'location_based' | 'device_based' | 'behavior_based'
    pattern: string
    frequency: number
    risk: number
    description: string
  }>
  anomalies: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    sessionId?: string
    timestamp: number
  }>
  trends: {
    sessionGrowth: number
    riskTrend: 'improving' | 'stable' | 'declining'
    deviceDiversity: number
    temporalPatterns: string[]
  }
}

/**
 * Session Complexity Analyzer for identifying security interdependencies
 */
export class SessionComplexityAnalyzer {
  private auditLogger: AuditLogger
  private sessionHistory: Map<string, EnhancedSessionInfo[]> = new Map()
  private complexityCache: Map<string, { analysis: SecurityInterdependencyAnalysis; timestamp: number }> = new Map()
  private patternCache: Map<string, { patterns: SessionPatternAnalysis; timestamp: number }> = new Map()

  constructor() {
    this.auditLogger = new AuditLogger()
  }

  /**
   * Analyze session complexity and interdependencies
   */
  public async analyzeSessionComplexity(userId?: string): Promise<SecurityInterdependencyAnalysis> {
    const clientInfo = await getCachedClientInfo()
    
    try {
      // Check cache first
      const cacheKey = userId || 'global'
      const cached = this.complexityCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
        return cached.analysis
      }

      // Get current session info
      const sessionInfo = await enhancedSessionManager.getEnhancedSessionInfo(userId)
      const globalAnalysis = enhancedSessionManager.getSessionSecurityAnalysis()

      // Collect session history
      const sessionHistory = this.getSessionHistory(userId)
      
      // Analyze dependencies
      const dependencies = this.analyzeDependencies(sessionInfo, sessionHistory, globalAnalysis)
      
      // Identify critical paths
      const criticalPaths = this.identifyCriticalPaths(dependencies)
      
      // Detect vulnerabilities
      const vulnerabilities = this.detectVulnerabilities(sessionInfo, sessionHistory, dependencies)
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(vulnerabilities, criticalPaths)
      
      // Calculate overall complexity score
      const complexityScore = this.calculateComplexityScore(dependencies, vulnerabilities, globalAnalysis)

      const analysis: SecurityInterdependencyAnalysis = {
        dependencies,
        criticalPaths,
        vulnerabilities,
        recommendations,
        complexityScore
      }

      // Cache the analysis
      this.complexityCache.set(cacheKey, { analysis, timestamp: Date.now() })

      // Log the analysis event
      await this.auditLogger.logEvent({
        event_type: 'SUSPICIOUS_ACTIVITY',
        user_id: userId || 'system',
        actor_email: sessionInfo?.user?.email || 'system',
        result: 'SUCCESS',
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        reason: 'Session complexity analysis completed',
        metadata: {
          complexityScore,
          vulnerabilityCount: vulnerabilities.length,
          criticalPathCount: criticalPaths.length,
          analysisType: 'session_complexity'
        }
      })

      return analysis

    } catch (error) {
      console.error('Session complexity analysis error:', error)
      
      await this.auditLogger.logEvent({
        event_type: 'SUSPICIOUS_ACTIVITY',
        user_id: userId || 'system',
        actor_email: 'system',
        result: 'FAILURE',
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        reason: 'Session complexity analysis failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })

      // Return minimal analysis on error
      return {
        dependencies: [],
        criticalPaths: [],
        vulnerabilities: [{
          type: 'analysis_error',
          severity: 'high',
          description: 'Failed to complete session complexity analysis',
          recommendation: 'Review system logs and retry analysis',
          affectedSessions: 0
        }],
        recommendations: ['System error occurred - review logs and retry'],
        complexityScore: 0
      }
    }
  }

  /**
   * Analyze session patterns for anomaly detection
   */
  public async analyzeSessionPatterns(userId?: string): Promise<SessionPatternAnalysis> {
    const cacheKey = userId || 'global'
    const cached = this.patternCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minute cache
      return cached.patterns
    }

    const sessionHistory = this.getSessionHistory(userId)
    const currentSession = await enhancedSessionManager.getEnhancedSessionInfo(userId)

    // Analyze different pattern types
    const timePatterns = this.analyzeTimePatterns(sessionHistory)
    const locationPatterns = this.analyzeLocationPatterns(sessionHistory)
    const devicePatterns = this.analyzeDevicePatterns(sessionHistory)
    const behaviorPatterns = this.analyzeBehaviorPatterns(sessionHistory)

    // Detect anomalies
    const anomalies = this.detectAnomalies(currentSession, sessionHistory)

    // Analyze trends
    const trends = this.analyzeTrends(sessionHistory)

    const patterns: SessionPatternAnalysis = {
      patterns: [...timePatterns, ...locationPatterns, ...devicePatterns, ...behaviorPatterns],
      anomalies,
      trends
    }

    // Cache the patterns
    this.patternCache.set(cacheKey, { patterns, timestamp: Date.now() })

    return patterns
  }

  /**
   * Analyze dependencies between session components
   */
  private analyzeDependencies(
    currentSession: EnhancedSessionInfo | null,
    sessionHistory: EnhancedSessionInfo[],
    globalAnalysis: any
  ): Array<{
    source: string
    target: string
    strength: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    description: string
  }> {
    const dependencies = []

    // Device-to-session dependency
    if (currentSession?.deviceFingerprint) {
      const deviceRisk = sessionHistory.filter(s => s.deviceFingerprint === currentSession.deviceFingerprint).length > 1 ? 'low' : 'medium'
      dependencies.push({
        source: 'device_fingerprint',
        target: 'session_validation',
        strength: 0.8,
        riskLevel: deviceRisk,
        description: 'Session validation depends on device fingerprint consistency'
      })
    }

    // IP-to-session dependency
    if (currentSession?.ipAddress) {
      const ipChanges = new Set(sessionHistory.map(s => s.ipAddress)).size
      const ipRisk = ipChanges > 3 ? 'high' : ipChanges > 1 ? 'medium' : 'low'
      dependencies.push({
        source: 'ip_address',
        target: 'session_security',
        strength: 0.6,
        riskLevel: ipRisk,
        description: 'Session security depends on IP address stability'
      })
    }

    // Concurrent session dependency
    if (globalAnalysis.totalSessions > 1) {
      dependencies.push({
        source: 'concurrent_sessions',
        target: 'resource_allocation',
        strength: 0.7,
        riskLevel: globalAnalysis.totalSessions > 3 ? 'high' : 'medium',
        description: 'Resource allocation depends on number of concurrent sessions'
      })
    }

    // Security score dependency
    if (currentSession?.securityScore !== undefined) {
      const scoreRisk = currentSession.securityScore < 50 ? 'critical' : 
                      currentSession.securityScore < 70 ? 'high' : 
                      currentSession.securityScore < 85 ? 'medium' : 'low'
      dependencies.push({
        source: 'security_score',
        target: 'access_control',
        strength: 0.9,
        riskLevel: scoreRisk,
        description: 'Access control decisions depend on session security score'
      })
    }

    return dependencies
  }

  /**
   * Identify critical paths through dependencies
   */
  private identifyCriticalPaths(dependencies: Array<any>): Array<{
    path: string[]
    totalRisk: number
    description: string
  }> {
    const criticalPaths = []
    
    // Find high-risk dependency chains
    const highRiskDeps = dependencies.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical')
    
    if (highRiskDeps.length > 0) {
      // Build dependency chains
      const chainMap = new Map<string, string[]>()
      
      highRiskDeps.forEach(dep => {
        if (!chainMap.has(dep.source)) {
          chainMap.set(dep.source, [])
        }
        chainMap.get(dep.source)!.push(dep.target)
      })

      // Create critical paths
      chainMap.forEach((targets, source) => {
        const totalRisk = highRiskDeps
          .filter(d => d.source === source)
          .reduce((sum, d) => sum + d.strength, 0)
        
        criticalPaths.push({
          path: [source, ...targets],
          totalRisk,
          description: `Critical dependency path starting from ${source}`
        })
      })
    }

    return criticalPaths
  }

  /**
   * Detect security vulnerabilities based on analysis
   */
  private detectVulnerabilities(
    currentSession: EnhancedSessionInfo | null,
    sessionHistory: EnhancedSessionInfo[],
    dependencies: Array<any>
  ): Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    recommendation: string
    affectedSessions: number
  }> {
    const vulnerabilities = []

    // Session hijacking vulnerability
    const deviceChanges = new Set(sessionHistory.map(s => s.deviceFingerprint)).size
    if (deviceChanges > 2) {
      vulnerabilities.push({
        type: 'session_hijacking',
        severity: 'high',
        description: 'Multiple device fingerprints detected for user sessions',
        recommendation: 'Implement stronger device binding and require re-authentication',
        affectedSessions: sessionHistory.length
      })
    }

    // Concurrent session vulnerability
    if (currentSession?.concurrentSessions && currentSession.concurrentSessions > 3) {
      vulnerabilities.push({
        type: 'concurrent_session_abuse',
        severity: 'medium',
        description: 'Excessive concurrent sessions detected',
        recommendation: 'Reduce maximum concurrent session limit and monitor usage patterns',
        affectedSessions: currentSession.concurrentSessions
      })
    }

    // Weak security score vulnerability
    if (currentSession?.securityScore && currentSession.securityScore < 50) {
      vulnerabilities.push({
        type: 'weak_security_posture',
        severity: 'critical',
        description: 'Session security score is critically low',
        recommendation: 'Force re-authentication and review security policies',
        affectedSessions: 1
      })
    }

    // Critical dependency vulnerability
    const criticalDeps = dependencies.filter(d => d.riskLevel === 'critical')
    if (criticalDeps.length > 0) {
      vulnerabilities.push({
        type: 'critical_dependency',
        severity: 'high',
        description: 'Critical security dependencies detected',
        recommendation: 'Review and strengthen critical dependency chains',
        affectedSessions: sessionHistory.length
      })
    }

    return vulnerabilities
  }

  /**
   * Generate security recommendations based on analysis
   */
  private generateRecommendations(vulnerabilities: Array<any>, criticalPaths: Array<any>): string[] {
    const recommendations = []

    if (vulnerabilities.some(v => v.severity === 'critical')) {
      recommendations.push('Immediate action required: Force user re-authentication for critical vulnerabilities')
    }

    if (criticalPaths.length > 0) {
      recommendations.push('Review and strengthen security dependency chains')
    }

    if (vulnerabilities.some(v => v.type === 'session_hijacking')) {
      recommendations.push('Implement enhanced device fingerprinting and session binding')
    }

    if (vulnerabilities.some(v => v.type === 'concurrent_session_abuse')) {
      recommendations.push('Review and adjust concurrent session limits')
    }

    if (vulnerabilities.length === 0) {
      recommendations.push('Session security posture is good - maintain current policies')
    }

    return recommendations
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexityScore(dependencies: Array<any>, vulnerabilities: Array<any>, globalAnalysis: any): number {
    let score = 0

    // Dependency complexity
    score += dependencies.length * 10
    score += dependencies.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').length * 20

    // Vulnerability complexity
    score += vulnerabilities.length * 15
    score += vulnerabilities.filter(v => v.severity === 'critical').length * 30

    // Global session complexity
    score += globalAnalysis.totalSessions * 5
    score += (100 - globalAnalysis.averageSecurityScore) * 0.5

    return Math.min(100, score) // Cap at 100
  }

  /**
   * Helper methods for pattern analysis
   */
  private getSessionHistory(userId?: string): EnhancedSessionInfo[] {
    // In a real implementation, this would fetch from database
    // For now, return empty array as placeholder
    return []
  }

  private analyzeTimePatterns(sessions: EnhancedSessionInfo[]): Array<any> {
    // Placeholder for time pattern analysis
    return []
  }

  private analyzeLocationPatterns(sessions: EnhancedSessionInfo[]): Array<any> {
    // Placeholder for location pattern analysis
    return []
  }

  private analyzeDevicePatterns(sessions: EnhancedSessionInfo[]): Array<any> {
    // Placeholder for device pattern analysis
    return []
  }

  private analyzeBehaviorPatterns(sessions: EnhancedSessionInfo[]): Array<any> {
    // Placeholder for behavior pattern analysis
    return []
  }

  private detectAnomalies(currentSession: EnhancedSessionInfo | null, history: EnhancedSessionInfo[]): Array<any> {
    // Placeholder for anomaly detection
    return []
  }

  private analyzeTrends(sessions: EnhancedSessionInfo[]): any {
    // Placeholder for trend analysis
    return {
      sessionGrowth: 0,
      riskTrend: 'stable' as const,
      deviceDiversity: 0,
      temporalPatterns: []
    }
  }

  /**
   * Get complexity metrics for monitoring
   */
  public getComplexityMetrics(): SessionComplexityMetrics {
    // Placeholder implementation
    return {
      totalSessions: 0,
      averageSessionAge: 0,
      deviceVariability: 0,
      ipVariability: 0,
      timePatternVariability: 0,
      securityScoreDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      riskFactorWeights: {
        concurrentSessions: 0.2,
        deviceChanges: 0.3,
        locationChanges: 0.2,
        timePatterns: 0.1,
        sessionAge: 0.2
      }
    }
  }

  /**
   * Clear analysis caches
   */
  public clearCaches(): void {
    this.complexityCache.clear()
    this.patternCache.clear()
  }
}

// Export singleton instance
export const sessionComplexityAnalyzer = new SessionComplexityAnalyzer() 