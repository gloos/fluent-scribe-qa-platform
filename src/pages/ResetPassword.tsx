import React from 'react';
import { ResetPasswordLayout } from '@/components/auth/password-reset/ResetPasswordLayout';
import { ResetStatusDisplay } from '@/components/auth/password-reset/ResetStatusDisplay';
import { PasswordResetForm } from '@/components/auth/password-reset/PasswordResetForm';
import { usePasswordResetToken } from '@/hooks/usePasswordResetToken';

const ResetPassword: React.FC = () => {
  const { status, setStatus } = usePasswordResetToken();

  const renderContent = () => {
    if (status === 'valid') {
      return <PasswordResetForm onStatusChange={setStatus} />;
    }
    
    return <ResetStatusDisplay status={status} />;
  };

  return (
    <ResetPasswordLayout>
      {renderContent()}
    </ResetPasswordLayout>
  );
};

export default ResetPassword; 