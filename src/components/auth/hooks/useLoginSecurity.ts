import { useState, useEffect } from 'react';
import { securityService } from '@/lib/security';
import { SecurityInfo, RateLimitInfo } from '../types';
import { useAuth } from '@/hooks/useAuth';

export const useLoginSecurity = (email: string) => {
  const { getAccountSecurityInfo } = useAuth();
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Check account security status when email changes
  useEffect(() => {
    const checkSecurity = async () => {
      if (email && email.includes('@')) {
        try {
          const securityStatus = await getAccountSecurityInfo(email);
          if (securityStatus) {
            setSecurityInfo({
              isLocked: securityStatus.isLocked,
              failedAttempts: securityStatus.failedAttempts,
              lockoutTime: securityStatus.lockoutUntil
            });
          }
        } catch (error) {
          console.warn('Failed to get security info:', error);
        }
      }
    };

    const timeoutId = setTimeout(checkSecurity, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [email, getAccountSecurityInfo]);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimitInfo?.limited && rateLimitInfo.retryAfter) {
      const interval = setInterval(() => {
        setRateLimitInfo(prev => {
          if (!prev || !prev.retryAfter) return null;
          const newRetryAfter = prev.retryAfter - 1;
          if (newRetryAfter <= 0) {
            return null;
          }
          return { ...prev, retryAfter: newRetryAfter };
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [rateLimitInfo]);

  const checkRateLimit = (email: string): { allowed: boolean; waitTime?: number; needsCaptcha?: boolean } => {
    return securityService.checkRateLimit(email);
  };

  const recordFailedAttempt = (email: string) => {
    securityService.recordFailedAttempt(email);
  };

  const recordSuccessfulAttempt = (email: string, userId?: string) => {
    securityService.recordSuccessfulAttempt(email, userId);
  };

  const getRateLimitStatus = (email: string) => {
    return securityService.getRateLimitStatus(email);
  };

  const startRateLimitWarning = (waitTime: number) => {
    setShowRateLimitWarning(true);
    setRateLimitCountdown(waitTime);
    
    // Start countdown timer
    const timer = setInterval(() => {
      setRateLimitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowRateLimitWarning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const updateSecurityInfo = (info: Partial<SecurityInfo>) => {
    setSecurityInfo(prev => prev ? { ...prev, ...info } : null);
  };

  const updateRateLimitInfo = (info: RateLimitInfo | null) => {
    setRateLimitInfo(info);
  };

  const clearRateLimitWarning = () => {
    setShowRateLimitWarning(false);
    setRateLimitCountdown(0);
  };

  const getSecurityBadgeVariant = (): "destructive" | "secondary" | "outline" => {
    if (securityInfo?.isLocked) return "destructive";
    if (securityInfo?.failedAttempts && securityInfo.failedAttempts > 2) return "secondary";
    return "outline";
  };

  const formatLockoutTime = (lockoutTime?: string): string => {
    if (!lockoutTime) return "soon";
    
    const lockoutDate = new Date(lockoutTime);
    const now = new Date();
    const diffMinutes = Math.ceil((lockoutDate.getTime() - now.getTime()) / (1000 * 60));
    return diffMinutes > 0 ? `${diffMinutes} minute(s)` : "soon";
  };

  return {
    securityInfo,
    rateLimitInfo,
    showRateLimitWarning,
    rateLimitCountdown,
    checkRateLimit,
    recordFailedAttempt,
    recordSuccessfulAttempt,
    getRateLimitStatus,
    startRateLimitWarning,
    updateSecurityInfo,
    updateRateLimitInfo,
    clearRateLimitWarning,
    getSecurityBadgeVariant,
    formatLockoutTime
  };
}; 