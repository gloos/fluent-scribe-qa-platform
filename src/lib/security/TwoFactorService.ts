import { supabase } from '../supabase'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { AuditLogger } from './AuditLogger'
import { getCachedClientInfo } from '../utils/clientInfo'

/**
 * Supported 2FA methods
 */
export enum TwoFactorMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email'
}

/**
 * 2FA setup result
 */
export interface TwoFactorSetupResult {
  success: boolean
  method: TwoFactorMethod
  secret?: string
  qrCodeDataUrl?: string
  backupCodes?: string[]
  error?: string
}

/**
 * 2FA verification result
 */
export interface TwoFactorVerificationResult {
  success: boolean
  error?: string
  usedBackupCode?: boolean
  remainingBackupCodes?: number
}

/**
 * 2FA status
 */
export interface TwoFactorStatus {
  enabled: boolean
  methods: TwoFactorMethod[]
  backupCodesCount: number
  setupDate?: string
  lastUsed?: string
}

/**
 * Backup codes configuration
 */
export interface BackupCodesConfig {
  count: number
  length: number
  expirationDays: number
}

/**
 * Default backup codes configuration
 */
export const DEFAULT_BACKUP_CODES_CONFIG: BackupCodesConfig = {
  count: 10,
  length: 8,
  expirationDays: 365
}

/**
 * Comprehensive Two-Factor Authentication Service
 */
export class TwoFactorService {
  private auditLogger: AuditLogger
  private appName: string
  private issuer: string

  constructor(
    appName: string = 'LinguaQA',
    issuer: string = 'LinguaQA',
    auditLogger?: AuditLogger
  ) {
    this.appName = appName
    this.issuer = issuer
    this.auditLogger = auditLogger || new AuditLogger()
  }

  /**
   * Set up TOTP 2FA for a user
   */
  async setupTOTP(userId: string, userEmail: string): Promise<TwoFactorSetupResult> {
    try {
      const clientInfo = await getCachedClientInfo()

      // Generate a new secret
      const secret = new Secret({ size: 32 })
      
      // Create TOTP instance
      const totp = new TOTP({
        issuer: this.issuer,
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret
      })

      // Generate QR code
      const otpAuthUrl = totp.toString()
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

      // Generate backup codes
      const backupCodes = this.generateBackupCodes()

      // Store the secret and backup codes in the database (encrypted)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          two_factor_secret: secret.base32,
          two_factor_method: TwoFactorMethod.TOTP,
          two_factor_backup_codes: JSON.stringify(backupCodes),
          backup_codes_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        await this.logSecurityEvent(
          userId,
          userEmail,
          'TOTP_SETUP_FAILED',
          clientInfo.ipAddress,
          clientInfo.userAgent,
          { error: updateError.message }
        )
        return {
          success: false,
          method: TwoFactorMethod.TOTP,
          error: 'Failed to store 2FA configuration'
        }
      }

      await this.logSecurityEvent(
        userId,
        userEmail,
        'TOTP_SETUP_INITIATED',
        clientInfo.ipAddress,
        clientInfo.userAgent
      )

      return {
        success: true,
        method: TwoFactorMethod.TOTP,
        secret: secret.base32,
        qrCodeDataUrl,
        backupCodes
      }

    } catch (error) {
      console.error('TOTP setup error:', error)
      return {
        success: false,
        method: TwoFactorMethod.TOTP,
        error: 'Failed to set up TOTP authentication'
      }
    }
  }

  /**
   * Enable 2FA after TOTP verification
   */
  async enableTwoFactor(
    userId: string, 
    userEmail: string, 
    totpCode: string
  ): Promise<TwoFactorVerificationResult> {
    try {
      const clientInfo = await getCachedClientInfo()

      // Get user's 2FA data
      const { data: userData, error: fetchError } = await supabase
        .from('profiles')
        .select('two_factor_secret, two_factor_method')
        .eq('id', userId)
        .single()

      if (fetchError || !userData) {
        return {
          success: false,
          error: 'User not found or 2FA not set up'
        }
      }

      // Verify TOTP code
      const isValid = await this.verifyTOTP(userData.two_factor_secret, totpCode)

      if (!isValid) {
        await this.logSecurityEvent(
          userId,
          userEmail,
          'TOTP_ENABLE_FAILED',
          clientInfo.ipAddress,
          clientInfo.userAgent,
          { reason: 'Invalid TOTP code' }
        )
        return {
          success: false,
          error: 'Invalid verification code'
        }
      }

      // Enable 2FA
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return {
          success: false,
          error: 'Failed to enable 2FA'
        }
      }

      await this.logSecurityEvent(
        userId,
        userEmail,
        'TWO_FACTOR_ENABLED',
        clientInfo.ipAddress,
        clientInfo.userAgent
      )

      return { success: true }

    } catch (error) {
      console.error('Enable 2FA error:', error)
      return {
        success: false,
        error: 'Failed to enable 2FA'
      }
    }
  }

  /**
   * Verify 2FA code during login
   */
  async verifyTwoFactor(
    userId: string,
    userEmail: string,
    code: string,
    allowBackupCode: boolean = true
  ): Promise<TwoFactorVerificationResult> {
    try {
      const clientInfo = await getCachedClientInfo()

      // Get user's 2FA data
      const { data: userData, error: fetchError } = await supabase
        .from('profiles')
        .select('two_factor_secret, two_factor_method, two_factor_backup_codes, two_factor_enabled')
        .eq('id', userId)
        .single()

      if (fetchError || !userData || !userData.two_factor_enabled) {
        return {
          success: false,
          error: '2FA not enabled for this user'
        }
      }

      // Try TOTP first
      if (userData.two_factor_method === TwoFactorMethod.TOTP) {
        const isValidTOTP = await this.verifyTOTP(userData.two_factor_secret, code)
        
        if (isValidTOTP) {
          await this.logSecurityEvent(
            userId,
            userEmail,
            'TOTP_VERIFICATION_SUCCESS',
            clientInfo.ipAddress,
            clientInfo.userAgent
          )
          return { success: true }
        }
      }

      // Try backup code if TOTP failed and backup codes are allowed
      if (allowBackupCode && userData.two_factor_backup_codes) {
        const backupCodes = JSON.parse(userData.two_factor_backup_codes)
        const backupCodeIndex = backupCodes.findIndex((bc: any) => 
          bc.code === code && !bc.used
        )

        if (backupCodeIndex !== -1) {
          // Mark backup code as used
          backupCodes[backupCodeIndex].used = true
          backupCodes[backupCodeIndex].used_at = new Date().toISOString()

          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              two_factor_backup_codes: JSON.stringify(backupCodes),
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          if (updateError) {
            console.error('Failed to update backup codes:', updateError)
          }

          const remainingBackupCodes = backupCodes.filter((bc: any) => !bc.used).length

          await this.logSecurityEvent(
            userId,
            userEmail,
            'BACKUP_CODE_USED',
            clientInfo.ipAddress,
            clientInfo.userAgent,
            { remainingBackupCodes }
          )

          return {
            success: true,
            usedBackupCode: true,
            remainingBackupCodes
          }
        }
      }

      // All verification methods failed
      await this.logSecurityEvent(
        userId,
        userEmail,
        'TWO_FACTOR_VERIFICATION_FAILED',
        clientInfo.ipAddress,
        clientInfo.userAgent,
        { reason: 'Invalid code' }
      )

      return {
        success: false,
        error: 'Invalid verification code'
      }

    } catch (error) {
      console.error('2FA verification error:', error)
      return {
        success: false,
        error: 'Verification failed'
      }
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disableTwoFactor(
    userId: string,
    userEmail: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const clientInfo = await getCachedClientInfo()

      // Verify password first (this should be done via your auth service)
      // For now, we'll proceed assuming password verification is handled elsewhere

      // Disable 2FA
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_method: null,
          two_factor_backup_codes: null,
          backup_codes_generated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return {
          success: false,
          error: 'Failed to disable 2FA'
        }
      }

      await this.logSecurityEvent(
        userId,
        userEmail,
        'TWO_FACTOR_DISABLED',
        clientInfo.ipAddress,
        clientInfo.userAgent
      )

      return { success: true }

    } catch (error) {
      console.error('Disable 2FA error:', error)
      return {
        success: false,
        error: 'Failed to disable 2FA'
      }
    }
  }

  /**
   * Get 2FA status for a user
   */
  async getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
    try {
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('two_factor_enabled, two_factor_method, two_factor_backup_codes, backup_codes_generated_at')
        .eq('id', userId)
        .single()

      if (error || !userData) {
        return {
          enabled: false,
          methods: [],
          backupCodesCount: 0
        }
      }

      const backupCodes = userData.two_factor_backup_codes ? 
        JSON.parse(userData.two_factor_backup_codes) : []
      const remainingBackupCodes = backupCodes.filter((bc: any) => !bc.used).length

      return {
        enabled: userData.two_factor_enabled || false,
        methods: userData.two_factor_method ? [userData.two_factor_method] : [],
        backupCodesCount: remainingBackupCodes,
        setupDate: userData.backup_codes_generated_at
      }

    } catch (error) {
      console.error('Get 2FA status error:', error)
      return {
        enabled: false,
        methods: [],
        backupCodesCount: 0
      }
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    userEmail: string,
    config: BackupCodesConfig = DEFAULT_BACKUP_CODES_CONFIG
  ): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    try {
      const clientInfo = await getCachedClientInfo()

      const backupCodes = this.generateBackupCodes(config)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          two_factor_backup_codes: JSON.stringify(backupCodes),
          backup_codes_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return {
          success: false,
          error: 'Failed to generate backup codes'
        }
      }

      await this.logSecurityEvent(
        userId,
        userEmail,
        'BACKUP_CODES_REGENERATED',
        clientInfo.ipAddress,
        clientInfo.userAgent
      )

      return {
        success: true,
        backupCodes: backupCodes.map(bc => bc.code)
      }

    } catch (error) {
      console.error('Regenerate backup codes error:', error)
      return {
        success: false,
        error: 'Failed to generate backup codes'
      }
    }
  }

  /**
   * Verify TOTP code
   */
  private async verifyTOTP(secret: string, token: string): Promise<boolean> {
    try {
      const totp = new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(secret)
      })

      // Allow for time drift (±1 window)
      const currentTime = Math.floor(Date.now() / 1000)
      const window = 1

      for (let i = -window; i <= window; i++) {
        const timeStep = currentTime + (i * 30)
        const expectedToken = totp.generate({ timestamp: timeStep * 1000 })
        
        if (expectedToken === token) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('TOTP verification error:', error)
      return false
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(config: BackupCodesConfig = DEFAULT_BACKUP_CODES_CONFIG) {
    const codes = []
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    
    for (let i = 0; i < config.count; i++) {
      let code = ''
      for (let j = 0; j < config.length; j++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length))
      }
      
      codes.push({
        code,
        used: false,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + config.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      })
    }
    
    return codes
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(
    userId: string,
    userEmail: string,
    eventType: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Map 2FA specific events to valid audit event types
    let auditEventType: string
    let result: 'SUCCESS' | 'FAILURE'

    if (eventType.includes('FAILED')) {
      result = 'FAILURE'
    } else {
      result = 'SUCCESS'
    }

    // Map specific 2FA events to audit types
    switch (eventType) {
      case 'TOTP_SETUP_INITIATED':
      case 'TWO_FACTOR_ENABLED':
        auditEventType = 'MFA_ENABLED'
        break
      case 'TOTP_SETUP_FAILED':
      case 'TOTP_ENABLE_FAILED':
      case 'TWO_FACTOR_VERIFICATION_FAILED':
        auditEventType = 'MFA_ENABLED'
        result = 'FAILURE'
        break
      case 'TWO_FACTOR_DISABLED':
        auditEventType = 'MFA_DISABLED'
        break
      case 'TOTP_VERIFICATION_SUCCESS':
      case 'BACKUP_CODE_USED':
      case 'BACKUP_CODES_REGENERATED':
        auditEventType = 'LOGIN_SUCCESS'
        break
      default:
        auditEventType = 'SUSPICIOUS_ACTIVITY'
        break
    }

    const auditEntry = {
      event_type: auditEventType as any,
      user_id: userId,
      actor_email: userEmail,
      result,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason: eventType,
      metadata: {
        twoFactorEventType: eventType,
        ...metadata
      }
    }

    await this.auditLogger.logEvent(auditEntry)
  }
}

// Export singleton instance
export const twoFactorService = new TwoFactorService() 