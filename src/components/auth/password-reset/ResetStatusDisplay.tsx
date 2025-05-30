import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export type ResetStatus = 'validating' | 'valid' | 'invalid' | 'expired' | 'completed' | 'error';

interface ResetStatusDisplayProps {
  status: Exclude<ResetStatus, 'valid'>;
}

interface StatusConfig {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  description: string;
  action: React.ReactNode | null;
}

export const ResetStatusDisplay: React.FC<ResetStatusDisplayProps> = ({ status }) => {
  const statusConfig: Record<Exclude<ResetStatus, 'valid'>, StatusConfig> = {
    validating: {
      icon: (
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      ),
      title: 'Validating Reset Link',
      description: 'Please wait while we verify your password reset request...',
      action: null
    },
    invalid: {
      icon: <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />,
      title: 'Invalid Reset Link',
      titleColor: 'text-red-700',
      description: 'This password reset link is invalid or malformed. Please check your email for the correct link.',
      action: (
        <Button asChild variant="outline">
          <Link to="/forgot-password">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Request New Reset Link
          </Link>
        </Button>
      )
    },
    expired: {
      icon: <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />,
      title: 'Reset Link Expired',
      titleColor: 'text-orange-700',
      description: 'This password reset link has expired for security reasons. Please request a new one.',
      action: (
        <Button asChild variant="outline">
          <Link to="/forgot-password">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Request New Reset Link
          </Link>
        </Button>
      )
    },
    error: {
      icon: <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />,
      title: 'Error',
      titleColor: 'text-red-700',
      description: 'An error occurred while processing your reset request. Please try again.',
      action: (
        <Button asChild variant="outline">
          <Link to="/forgot-password">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Request New Reset Link
          </Link>
        </Button>
      )
    },
    completed: {
      icon: <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />,
      title: 'Password Reset Complete',
      titleColor: 'text-green-700',
      description: 'Your password has been successfully updated. You will be redirected to the login page shortly.',
      action: (
        <Button asChild>
          <Link to="/login">
            Continue to Login
          </Link>
        </Button>
      )
    }
  };

  const config = statusConfig[status];

  return (
    <div className="text-center py-8">
      {config.icon}
      <h3 className={`text-lg font-semibold mb-2 ${config.titleColor || ''}`}>
        {config.title}
      </h3>
      <p className="text-gray-600 mb-6">
        {config.description}
      </p>
      {config.action && (
        <div className="space-y-2">
          {config.action}
        </div>
      )}
    </div>
  );
}; 