import React from 'react';
import { Shield } from 'lucide-react';
import { SecurityStatusProps } from './types';
import { securityService } from '@/lib/security';

const SecurityStatusDisplay: React.FC<SecurityStatusProps> = ({ 
  securityInfo, 
  rateLimitInfo, 
  email 
}) => {
  const rateLimitStatus = securityService.getRateLimitStatus(email);
  
  // Show rate limit warning if show warning is not active
  if (rateLimitStatus.attempts > 0 && !rateLimitInfo?.limited) {
    return (
      <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
        <div className="flex items-center">
          <Shield className="h-4 w-4 text-blue-500 mr-2" />
          <span className="text-sm text-blue-700">
            Security Status: {rateLimitStatus.remainingAttempts} login attempt(s) remaining
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default SecurityStatusDisplay; 