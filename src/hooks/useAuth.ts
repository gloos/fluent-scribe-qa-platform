import { useState, useEffect } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { authService, LoginAttemptResult, LoginSecurityInfo, securePasswordReset, PasswordResetResult } from '../lib/authService'
import { sessionManager } from '@/lib/sessionManager'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: AuthError | null
}

interface EnhancedLoginResult {
  success: boolean
  error?: AuthError | null
  securityInfo?: LoginAttemptResult
  rateLimit?: {
    limited: boolean
    retryAfter?: number
  }
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: error || null
      })

      // Start session monitoring if user is authenticated
      if (session?.user) {
        sessionManager.startSessionMonitoring()
      }
    })

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null
      })

      // Handle session monitoring based on auth state
      if (session?.user) {
        sessionManager.startSessionMonitoring()
      } else {
        sessionManager.stopSessionMonitoring()
      }

      // Handle specific auth events
      if (event === 'SIGNED_OUT') {
        sessionManager.stopSessionMonitoring()
      }
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Session token refreshed successfully')
      }
    })

    return () => {
      subscription.unsubscribe()
      sessionManager.stopSessionMonitoring()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false, error }))
      return { error }
    }

    // Start session monitoring on successful login
    if (data.session) {
      sessionManager.startSessionMonitoring()
    }

    return { data }
  }

  /**
   * Enhanced secure login with rate limiting and account lockout protection
   */
  const secureSignIn = async (email: string, password: string, rememberMe: boolean = false): Promise<EnhancedLoginResult> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Set remember me preference
      sessionManager.setRememberMe(rememberMe)

      // Check rate limiting first
      const rateCheck = authService.checkRateLimit(email)
      if (!rateCheck.allowed) {
        setAuthState(prev => ({ ...prev, loading: false }))
        return {
          success: false,
          error: { 
            message: `Too many login attempts. Please wait ${rateCheck.retryAfter} seconds before trying again.` 
          } as AuthError,
          rateLimit: {
            limited: true,
            retryAfter: rateCheck.retryAfter
          }
        }
      }

      // Perform secure login
      const result = await authService.secureLogin(email, password)
      
      if (result.success) {
        setAuthState(prev => ({ 
          ...prev, 
          loading: false,
          user: result.data?.user || null,
          session: result.data?.session || null
        }))

        // Start session monitoring on successful login
        if (result.data?.session) {
          sessionManager.startSessionMonitoring()
        }
      } else {
        setAuthState(prev => ({ 
          ...prev, 
          loading: false, 
          error: result.error 
        }))
      }

      return {
        success: result.success,
        error: result.error,
        securityInfo: result.securityInfo,
        rateLimit: {
          limited: false
        }
      }

    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error as AuthError 
      }))
      
      return {
        success: false,
        error: error as AuthError
      }
    }
  }

  /**
   * Check account security status
   */
  const getAccountSecurityInfo = async (email: string): Promise<LoginSecurityInfo | null> => {
    return await authService.getAccountSecurityInfo(email)
  }

  /**
   * Check if account is locked
   */
  const checkAccountLockStatus = async (email: string): Promise<boolean> => {
    return await authService.checkAccountLockStatus(email)
  }

  /**
   * Validate password strength
   */
  const validatePasswordStrength = (password: string) => {
    return authService.validatePasswordStrength(password)
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false, error }))
      return { error }
    }

    return { data }
  }

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    // Use secure logout from session manager
    const result = await sessionManager.secureLogout()

    if (!result.success) {
      setAuthState(prev => ({ ...prev, loading: false, error: result.error }))
      return { error: result.error }
    }

    setAuthState({
      user: null,
      session: null,
      loading: false,
      error: null
    })

    return {}
  }

  const resetPassword = async (email: string): Promise<PasswordResetResult> => {
    // Use the secure password reset with rate limiting
    return await securePasswordReset(email)
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ 
      password: newPassword 
    })

    return { error }
  }

  /**
   * Refresh the current session manually
   */
  const refreshSession = async () => {
    return await sessionManager.refreshSession()
  }

  /**
   * Get current session information and statistics
   */
  const getSessionInfo = async () => {
    return await sessionManager.getSessionInfo()
  }

  /**
   * Get detailed session statistics for debugging
   */
  const getSessionStats = async () => {
    return await sessionManager.getSessionStats()
  }

  /**
   * Unlock account (admin function)
   */
  const unlockAccount = async (email: string): Promise<boolean> => {
    return await authService.unlockAccount(email)
  }

  /**
   * Get recent login attempts (admin function)
   */
  const getRecentLoginAttempts = async (limit?: number) => {
    return await authService.getRecentLoginAttempts(limit)
  }

  return {
    ...authState,
    signIn,
    secureSignIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
    getSessionInfo,
    getSessionStats,
    getAccountSecurityInfo,
    checkAccountLockStatus,
    validatePasswordStrength,
    unlockAccount,
    getRecentLoginAttempts,
    isAuthenticated: !!authState.user
  }
} 