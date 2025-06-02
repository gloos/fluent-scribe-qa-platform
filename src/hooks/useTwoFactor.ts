import { useState, useCallback } from 'react'
import { 
  twoFactorService, 
  TwoFactorSetupResult, 
  TwoFactorVerificationResult, 
  TwoFactorStatus 
} from '../lib/security/TwoFactorService'
import { useAuth } from './useAuth'
import { toast } from './use-toast'

export interface UseTwoFactorReturn {
  // State
  isLoading: boolean
  twoFactorStatus: TwoFactorStatus | null
  
  // Setup methods
  setupTOTP: () => Promise<TwoFactorSetupResult>
  enableTwoFactor: (totpCode: string) => Promise<TwoFactorVerificationResult>
  
  // Verification methods
  verifyTwoFactor: (code: string) => Promise<TwoFactorVerificationResult>
  
  // Management methods
  disableTwoFactor: (password: string) => Promise<{ success: boolean; error?: string }>
  regenerateBackupCodes: () => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>
  
  // Status methods
  refreshStatus: () => Promise<void>
}

export const useTwoFactor = (): UseTwoFactorReturn => {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)

  /**
   * Setup TOTP 2FA
   */
  const setupTOTP = useCallback(async (): Promise<TwoFactorSetupResult> => {
    if (!user?.id || !user?.email) {
      return {
        success: false,
        method: 'totp' as any,
        error: 'User not authenticated'
      }
    }

    setIsLoading(true)
    try {
      const result = await twoFactorService.setupTOTP(user.id, user.email)
      
      if (result.success) {
        toast({
          title: "2FA Setup Started",
          description: "Scan the QR code with your authenticator app",
        })
      } else {
        toast({
          title: "Setup Failed",
          description: result.error || "Failed to set up 2FA",
          variant: "destructive",
        })
      }

      return result
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Enable 2FA after verification
   */
  const enableTwoFactor = useCallback(async (totpCode: string): Promise<TwoFactorVerificationResult> => {
    if (!user?.id || !user?.email) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    setIsLoading(true)
    try {
      const result = await twoFactorService.enableTwoFactor(user.id, user.email, totpCode)
      
      if (result.success) {
        toast({
          title: "2FA Enabled",
          description: "Two-factor authentication has been successfully enabled",
        })
        await refreshStatus()
      } else {
        toast({
          title: "Verification Failed",
          description: result.error || "Invalid verification code",
          variant: "destructive",
        })
      }

      return result
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Verify 2FA code
   */
  const verifyTwoFactor = useCallback(async (code: string): Promise<TwoFactorVerificationResult> => {
    if (!user?.id || !user?.email) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    setIsLoading(true)
    try {
      const result = await twoFactorService.verifyTwoFactor(user.id, user.email, code)
      
      if (result.success) {
        if (result.usedBackupCode) {
          toast({
            title: "Backup Code Used",
            description: `Backup code accepted. ${result.remainingBackupCodes} codes remaining.`,
            variant: "default",
          })
        }
      }

      return result
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Disable 2FA
   */
  const disableTwoFactor = useCallback(async (password: string) => {
    if (!user?.id || !user?.email) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    setIsLoading(true)
    try {
      const result = await twoFactorService.disableTwoFactor(user.id, user.email, password)
      
      if (result.success) {
        toast({
          title: "2FA Disabled",
          description: "Two-factor authentication has been disabled",
        })
        await refreshStatus()
      } else {
        toast({
          title: "Disable Failed",
          description: result.error || "Failed to disable 2FA",
          variant: "destructive",
        })
      }

      return result
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Generate new backup codes
   */
  const regenerateBackupCodes = useCallback(async () => {
    if (!user?.id || !user?.email) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    setIsLoading(true)
    try {
      const result = await twoFactorService.regenerateBackupCodes(user.id, user.email)
      
      if (result.success) {
        toast({
          title: "Backup Codes Regenerated",
          description: "New backup codes have been generated. Store them safely.",
        })
        await refreshStatus()
      } else {
        toast({
          title: "Generation Failed",
          description: result.error || "Failed to generate backup codes",
          variant: "destructive",
        })
      }

      return result
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Refresh 2FA status
   */
  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setTwoFactorStatus(null)
      return
    }

    try {
      const status = await twoFactorService.getTwoFactorStatus(user.id)
      setTwoFactorStatus(status)
    } catch (error) {
      console.error('Failed to get 2FA status:', error)
      setTwoFactorStatus(null)
    }
  }, [user])

  // Auto-refresh status when user changes
  useState(() => {
    if (user?.id) {
      refreshStatus()
    }
  })

  return {
    isLoading,
    twoFactorStatus,
    setupTOTP,
    enableTwoFactor,
    verifyTwoFactor,
    disableTwoFactor,
    regenerateBackupCodes,
    refreshStatus
  }
} 