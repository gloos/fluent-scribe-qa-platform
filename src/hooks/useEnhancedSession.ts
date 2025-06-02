import { useState, useEffect, useCallback } from 'react'
import { 
  enhancedSessionManager, 
  EnhancedSessionInfo, 
  SessionValidationResult,
  EnhancedSessionConfig 
} from '../lib/security/EnhancedSessionManager'
import { 
  sessionComplexityAnalyzer, 
  SecurityInterdependencyAnalysis,
  SessionPatternAnalysis 
} from '../lib/security/SessionComplexityAnalyzer'
import { useAuth } from './useAuth'
import { toast } from './use-toast'

export interface UseEnhancedSessionReturn {
  // Session state
  sessionInfo: EnhancedSessionInfo | null
  validationResult: SessionValidationResult | null
  isValidating: boolean
  
  // Security analysis
  complexityAnalysis: SecurityInterdependencyAnalysis | null
  patternAnalysis: SessionPatternAnalysis | null
  isAnalyzing: boolean
  
  // Methods
  validateSession: () => Promise<SessionValidationResult>
  analyzeComplexity: () => Promise<SecurityInterdependencyAnalysis>
  analyzePatterns: () => Promise<SessionPatternAnalysis>
  secureLogout: (reason?: string) => Promise<{ success: boolean; error?: any }>
  configureSession: (config: Partial<EnhancedSessionConfig>) => void
  
  // Security actions
  markReauthRequired: () => void
  markReauthCompleted: () => void
  
  // Monitoring
  getSecurityAnalysis: () => any
  cleanupSessions: () => void
}

export const useEnhancedSession = () => {
  const { user, session } = useAuth()
  const [sessionInfo, setSessionInfo] = useState<EnhancedSessionInfo | null>(null)
  const [validationResult, setValidationResult] = useState<SessionValidationResult | null>(null)
  const [complexityAnalysis, setComplexityAnalysis] = useState<SecurityInterdependencyAnalysis | null>(null)
  const [patternAnalysis, setPatternAnalysis] = useState<SessionPatternAnalysis | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  /**
   * Validate current session with enhanced security checks
   */
  const validateSession = useCallback(async (): Promise<SessionValidationResult> => {
    if (!user?.id) {
      const result: SessionValidationResult = {
        valid: false,
        violations: ['NO_USER'],
        riskLevel: 'high',
        actions: ['REQUIRE_LOGIN']
      }
      setValidationResult(result)
      return result
    }

    setIsValidating(true)
    try {
      const result = await enhancedSessionManager.validateSessionWithSecurity(user.id)
      setValidationResult(result)

      // Handle validation results
      if (!result.valid) {
        if (result.violations.includes('SESSION_EXPIRED')) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          })
        } else if (result.violations.includes('DEVICE_FINGERPRINT_CHANGE')) {
          toast({
            title: "New Device Detected",
            description: "Login from a new device detected. Additional verification may be required.",
            variant: "default"
          })
        } else if (result.violations.includes('REAUTH_REQUIRED')) {
          toast({
            title: "Re-authentication Required",
            description: "Please verify your identity to continue.",
            variant: "default"
          })
        } else if (result.riskLevel === 'critical' || result.riskLevel === 'high') {
          toast({
            title: "Security Alert",
            description: "Unusual activity detected. Please review your account security.",
            variant: "destructive"
          })
        }
      }

      return result
    } finally {
      setIsValidating(false)
    }
  }, [user])

  /**
   * Analyze session complexity and security interdependencies
   */
  const analyzeComplexity = useCallback(async (): Promise<SecurityInterdependencyAnalysis> => {
    setIsAnalyzing(true)
    try {
      const analysis = await sessionComplexityAnalyzer.analyzeSessionComplexity(user?.id)
      setComplexityAnalysis(analysis)

      // Show warnings for high complexity or vulnerabilities
      if (analysis.complexityScore > 70) {
        toast({
          title: "High Session Complexity",
          description: "Complex security dependencies detected. Review recommended.",
          variant: "default"
        })
      }

      if (analysis.vulnerabilities.some(v => v.severity === 'critical')) {
        toast({
          title: "Critical Security Issues",
          description: "Critical vulnerabilities detected in session security.",
          variant: "destructive"
        })
      }

      return analysis
    } finally {
      setIsAnalyzing(false)
    }
  }, [user])

  /**
   * Analyze session patterns for anomaly detection
   */
  const analyzePatterns = useCallback(async (): Promise<SessionPatternAnalysis> => {
    const patterns = await sessionComplexityAnalyzer.analyzeSessionPatterns(user?.id)
    setPatternAnalysis(patterns)

    // Alert on anomalies
    const criticalAnomalies = patterns.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high')
    if (criticalAnomalies.length > 0) {
      toast({
        title: "Session Anomalies Detected",
        description: `${criticalAnomalies.length} suspicious patterns detected in your session activity.`,
        variant: "destructive"
      })
    }

    return patterns
  }, [user])

  /**
   * Enhanced secure logout
   */
  const secureLogout = useCallback(async (reason = 'USER_LOGOUT') => {
    const result = await enhancedSessionManager.enhancedSecureLogout(user?.id, reason)
    
    if (result.success) {
      // Clear local state
      setSessionInfo(null)
      setValidationResult(null)
      setComplexityAnalysis(null)
      setPatternAnalysis(null)
      
      toast({
        title: "Logged Out",
        description: "You have been securely logged out.",
        variant: "default"
      })
    } else {
      toast({
        title: "Logout Error",
        description: "There was an issue logging out. Please try again.",
        variant: "destructive"
      })
    }

    return result
  }, [user])

  /**
   * Configure enhanced session settings
   */
  const configureSession = useCallback((config: Partial<EnhancedSessionConfig>) => {
    enhancedSessionManager.configureEnhanced(config)
    
    toast({
      title: "Session Configuration Updated",
      description: "Session security settings have been updated.",
      variant: "default"
    })
  }, [])

  /**
   * Mark re-authentication as required
   */
  const markReauthRequired = useCallback(() => {
    if (user?.id) {
      enhancedSessionManager.markReauthRequired(user.id)
      toast({
        title: "Re-authentication Required",
        description: "You will need to verify your identity for continued access.",
        variant: "default"
      })
    }
  }, [user])

  /**
   * Mark re-authentication as completed
   */
  const markReauthCompleted = useCallback(() => {
    if (user?.id) {
      enhancedSessionManager.markReauthCompleted(user.id)
      toast({
        title: "Re-authentication Complete",
        description: "Your identity has been verified successfully.",
        variant: "default"
      })
    }
  }, [user])

  /**
   * Get session security analysis
   */
  const getSecurityAnalysis = useCallback(() => {
    return enhancedSessionManager.getSessionSecurityAnalysis()
  }, [])

  /**
   * Clean up expired sessions
   */
  const cleanupSessions = useCallback(() => {
    enhancedSessionManager.cleanupExpiredSessions()
    sessionComplexityAnalyzer.clearCaches()
  }, [])

  // Auto-load session info when user changes
  useEffect(() => {
    const loadSessionInfo = async () => {
      if (user?.id && session) {
        try {
          const info = await enhancedSessionManager.getEnhancedSessionInfo(user.id)
          setSessionInfo(info)
        } catch (error) {
          console.error('Failed to load enhanced session info:', error)
        }
      } else {
        setSessionInfo(null)
      }
    }

    loadSessionInfo()
  }, [user, session])

  // Auto-validate session periodically
  useEffect(() => {
    if (!user?.id || !session) return

    // Initial validation
    validateSession()

    // Set up periodic validation (every 5 minutes)
    const interval = setInterval(() => {
      validateSession()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user, session, validateSession])

  // Auto-cleanup expired sessions periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupSessions()
    }, 10 * 60 * 1000) // Every 10 minutes

    return () => clearInterval(cleanupInterval)
  }, [cleanupSessions])

  return {
    sessionInfo,
    validationResult,
    isValidating,
    complexityAnalysis,
    patternAnalysis,
    isAnalyzing,
    validateSession,
    analyzeComplexity,
    analyzePatterns,
    secureLogout,
    configureSession,
    markReauthRequired,
    markReauthCompleted,
    getSecurityAnalysis,
    cleanupSessions
  }
} 