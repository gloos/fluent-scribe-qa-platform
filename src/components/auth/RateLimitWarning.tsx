import React from 'react';
import { Shield } from 'lucide-react';
import { RateLimitWarningProps } from './types';

const RateLimitWarning: React.FC<RateLimitWarningProps> = ({ 
  show, 
  countdown, 
  onCountdownEnd 
}) => {
  if (!show) return null;

  return (
    <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
      <div className="flex">
        <div className="flex-shrink-0">
          <Shield className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Security Protection Active
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Multiple failed login attempts detected. 
              {countdown > 0 && (
                <span className="font-medium">
                  {` Please wait ${countdown} second(s) before trying again.`}
                </span>
              )}
            </p>
            {countdown > 60 && (
              <p className="mt-1 text-xs">
                For security, accounts are temporarily locked after repeated failed attempts.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitWarning; 