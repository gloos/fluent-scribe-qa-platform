import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { securityService } from '@/lib/security';
import { useLoginForm } from './hooks/useLoginForm';
import { useLoginSecurity } from './hooks/useLoginSecurity';
import LoginLayout from './LoginLayout';
import LoginFormFields from './LoginFormFields';
import RateLimitWarning from './RateLimitWarning';
import SecurityStatusDisplay from './SecurityStatusDisplay';

const LoginForm: React.FC = () => {
  const { secureSignIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the intended destination from location state
  const from = location.state?.from?.pathname || '/dashboard';
  const registrationSuccess = location.state?.registrationSuccess;

  // Use our custom hooks
  const {
    formData,
    errors,
    validateForm,
    handleInputChange,
    setGeneralError,
    clearErrors
  } = useLoginForm();

  const {
    securityInfo,
    rateLimitInfo,
    showRateLimitWarning,
    rateLimitCountdown,
    checkRateLimit,
    recordFailedAttempt,
    recordSuccessfulAttempt,
    startRateLimitWarning,
    updateSecurityInfo,
    updateRateLimitInfo,
    getSecurityBadgeVariant
  } = useLoginSecurity(formData.email);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setGeneralError("Please fill in all fields");
      return;
    }

    // Check rate limiting before attempting login
    const rateLimitCheck = checkRateLimit(formData.email);
    if (!rateLimitCheck.allowed) {
      const waitTimeMinutes = Math.ceil((rateLimitCheck.waitTime || 0) / 60);
      setGeneralError(
        rateLimitCheck.needsCaptcha 
          ? `Account temporarily locked. Please wait ${waitTimeMinutes} minute(s) before trying again.`
          : `Please wait ${rateLimitCheck.waitTime} second(s) before trying again.`
      );
      startRateLimitWarning(rateLimitCheck.waitTime || 0);
      return;
    }

    setIsSubmitting(true);
    clearErrors();

    try {
      const result = await secureSignIn(formData.email, formData.password, formData.rememberMe);
      
      if (result.error) {
        // Record failed attempt for rate limiting
        recordFailedAttempt(formData.email);
        
        // Log security event
        securityService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          email: formData.email,
          ipAddress: 'client-ip-placeholder',
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          success: false,
          metadata: { 
            errorMessage: result.error.message,
            rateLimitStatus: securityService.getRateLimitStatus(formData.email)
          }
        });

        // Handle different types of errors
        let errorMessage = "Login failed. Please check your credentials.";
        
        if (result.securityInfo?.locked) {
          errorMessage = "Account temporarily locked due to too many failed attempts. Please try again later.";
          updateSecurityInfo({
            isLocked: true,
            lockoutTime: new Date(Date.now() + (result.securityInfo?.lockout_duration || 15) * 60 * 1000).toISOString(),
            failedAttempts: securityInfo?.failedAttempts || 0
          });
        } else if (result.securityInfo?.attempts_remaining !== undefined) {
          updateSecurityInfo({
            attemptsRemaining: result.securityInfo?.attempts_remaining,
            failedAttempts: (securityInfo?.failedAttempts || 0) + 1,
            isLocked: false
          });
        }

        if (result.rateLimit?.limited) {
          updateRateLimitInfo(result.rateLimit);
          errorMessage = `Too many login attempts. Please wait ${result.rateLimit.retryAfter} seconds.`;
        }

        if (result.error?.message) {
          // Don't expose internal error details
          if (result.error.message.includes("Invalid login credentials")) {
            errorMessage = "Invalid email or password. Please try again.";
          } else if (result.error.message.includes("Email not confirmed")) {
            errorMessage = "Please check your email and click the verification link before logging in.";
          }
        }

        setGeneralError(errorMessage);
        
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        // Record successful attempt
        recordSuccessfulAttempt(formData.email);
        
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting to your dashboard...",
          variant: "default"
        });

        // Navigate to intended destination
        navigate(from, { replace: true });
      }
    } catch (err) {
      // Record failed attempt for unexpected errors
      recordFailedAttempt(formData.email);
      
      securityService.logSecurityEvent({
        type: 'LOGIN_FAILURE',
        email: formData.email,
        ipAddress: 'client-ip-placeholder',
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        success: false,
        metadata: { 
          errorType: 'unexpected_error',
          errorMessage: err instanceof Error ? err.message : 'Unknown error'
        }
      });

      setGeneralError("An unexpected error occurred. Please try again.");
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = rateLimitInfo?.limited || securityInfo?.isLocked;
  const showSecurityBadge = securityInfo && (securityInfo.isLocked || securityInfo.failedAttempts > 0);

  return (
    <LoginLayout
      registrationSuccess={registrationSuccess}
      securityBadgeVariant={getSecurityBadgeVariant()}
      showSecurityBadge={!!showSecurityBadge}
    >
      <RateLimitWarning 
        show={showRateLimitWarning}
        countdown={rateLimitCountdown}
        onCountdownEnd={() => {}}
      />
      
      <SecurityStatusDisplay 
        securityInfo={securityInfo}
        rateLimitInfo={rateLimitInfo}
        email={formData.email}
      />

      <LoginFormFields
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        onInputChange={handleInputChange}
        onSubmit={handleLogin}
        disabled={isFormDisabled}
      />
    </LoginLayout>
  );
};

export default LoginForm; 