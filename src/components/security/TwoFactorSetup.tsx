import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { 
  Shield, 
  Smartphone, 
  Key, 
  CheckCircle, 
  AlertTriangle, 
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Copy
} from 'lucide-react'
import { useTwoFactor } from '@/hooks/useTwoFactor'
import { TwoFactorSetupResult } from '@/lib/security/TwoFactorService'
import { toast } from '@/hooks/use-toast'

interface TwoFactorSetupProps {
  onComplete?: () => void
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete }) => {
  const { 
    isLoading, 
    twoFactorStatus, 
    setupTOTP, 
    enableTwoFactor, 
    disableTwoFactor,
    regenerateBackupCodes,
    refreshStatus 
  } = useTwoFactor()

  const [setupResult, setSetupResult] = useState<TwoFactorSetupResult | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'complete'>('status')
  const [disablePassword, setDisablePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Load status on mount
  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // Handle TOTP setup
  const handleSetupTOTP = async () => {
    const result = await setupTOTP()
    if (result.success) {
      setSetupResult(result)
      setBackupCodes(result.backupCodes || [])
      setStep('setup')
    }
  }

  // Handle verification and enabling
  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive"
      })
      return
    }

    const result = await enableTwoFactor(verificationCode)
    if (result.success) {
      setStep('complete')
      onComplete?.()
    }
  }

  // Handle disable 2FA
  const handleDisable = async () => {
    if (!disablePassword) {
      toast({
        title: "Password Required",
        description: "Please enter your password to disable 2FA",
        variant: "destructive"
      })
      return
    }

    const result = await disableTwoFactor(disablePassword)
    if (result.success) {
      setDisablePassword('')
      setStep('status')
    }
  }

  // Handle backup codes regeneration
  const handleRegenerateBackupCodes = async () => {
    const result = await regenerateBackupCodes()
    if (result.success && result.backupCodes) {
      setBackupCodes(result.backupCodes)
      setShowBackupCodes(true)
    }
  }

  // Copy backup codes to clipboard
  const copyBackupCodes = () => {
    const text = backupCodes.join('\n')
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Backup codes copied to clipboard"
    })
  }

  // Download backup codes
  const downloadBackupCodes = () => {
    const text = `LinguaQA Two-Factor Authentication Backup Codes\n\nGenerated: ${new Date().toLocaleDateString()}\n\n${backupCodes.join('\n')}\n\nStore these codes safely. Each code can only be used once.`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'linguaqa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!twoFactorStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              {twoFactorStatus.enabled ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Disabled
                </Badge>
              )}
            </div>
            
            {!twoFactorStatus.enabled ? (
              <Button onClick={handleSetupTOTP} disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4 mr-2" />
                )}
                Enable 2FA
              </Button>
            ) : (
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateBackupCodes}
                  disabled={isLoading}
                >
                  <Key className="h-4 w-4 mr-2" />
                  New Backup Codes
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Disable 2FA
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                      <DialogDescription>
                        This will remove 2FA protection from your account. Enter your password to confirm.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="disable-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="disable-password"
                            type={showPassword ? "text" : "password"}
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                            placeholder="Enter your password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button 
                        onClick={handleDisable} 
                        disabled={isLoading || !disablePassword}
                        variant="destructive"
                        className="w-full"
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Disable 2FA
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {twoFactorStatus.enabled && (
            <div className="space-y-2 text-sm text-gray-600">
              <div>Method: <span className="font-medium">Authenticator App (TOTP)</span></div>
              <div>Backup Codes: <span className="font-medium">{twoFactorStatus.backupCodesCount} remaining</span></div>
              {twoFactorStatus.setupDate && (
                <div>Enabled: <span className="font-medium">{new Date(twoFactorStatus.setupDate).toLocaleDateString()}</span></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      {step === 'setup' && setupResult && (
        <Card>
          <CardHeader>
            <CardTitle>Set Up Your Authenticator App</CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app and enter the verification code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <img 
                  src={setupResult.qrCodeDataUrl} 
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            {/* Manual Entry */}
            <Alert>
              <AlertDescription>
                <strong>Can't scan the QR code?</strong> Manually enter this secret: 
                <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                  {setupResult.secret}
                </code>
              </AlertDescription>
            </Alert>

            {/* Verification */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <Button 
                onClick={handleVerifyAndEnable}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Verify and Enable 2FA
              </Button>
            </div>

            {/* Backup Codes Preview */}
            {backupCodes.length > 0 && (
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Save your backup codes after enabling 2FA. 
                  You'll need them if you lose access to your authenticator app.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backup Codes Display */}
      {showBackupCodes && backupCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Backup Codes
            </CardTitle>
            <CardDescription>
              Store these codes safely. Each code can only be used once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center p-2 bg-white rounded border">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Codes
              </Button>
              <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Store these backup codes in a secure location. 
                If you lose access to your authenticator app, these codes are the only way to access your account.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 