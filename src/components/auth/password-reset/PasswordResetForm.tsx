import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthText } from '@/lib/password-validation';
import { cn } from '@/lib/utils';
import type { ResetStatus } from './ResetStatusDisplay';

interface PasswordResetFormProps {
  onStatusChange: (status: ResetStatus) => void;
}

interface PasswordFormData {
  password: string;
  confirmPassword: string;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onStatusChange }) => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  
  const [passwords, setPasswords] = useState<PasswordFormData>({
    password: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(validatePasswordStrength(''));

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(validatePasswordStrength(passwords.password));
  }, [passwords.password]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwords.password) {
      newErrors.password = "Password is required";
    } else if (!passwordStrength.isValid) {
      newErrors.password = "Password does not meet security requirements";
    }

    if (!passwords.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (passwords.password !== passwords.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));

    // Clear field-specific errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const { error } = await updatePassword(passwords.password);

      if (error) {
        console.error('Password reset error:', error);
        let errorMessage = "Failed to reset password. Please try again.";
        
        if (error.message.includes("session")) {
          errorMessage = "Reset link has expired. Please request a new password reset.";
          onStatusChange('expired');
        }

        setErrors({ general: errorMessage });
        toast({
          title: "Reset Failed",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        onStatusChange('completed');
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in with your new password.",
          variant: "default"
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successful. Please log in with your new password.' 
            }
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Unexpected error during password reset:', error);
      setErrors({ general: "An unexpected error occurred. Please try again." });
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          New Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            name="password"
            type={showPasswords.password ? "text" : "password"}
            placeholder="Enter your new password"
            value={passwords.password}
            onChange={handleInputChange}
            className={cn(
              "pl-10 pr-10",
              errors.password && "border-red-500 focus:border-red-500"
            )}
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('password')}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            {showPasswords.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password}</p>
        )}
      </div>

      {/* Password Strength Indicator */}
      {passwords.password && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Password Strength</Label>
            <span className="text-sm font-medium" style={{ color: getPasswordStrengthColor(passwordStrength.score) }}>
              {passwordStrength.score}/5 - {getPasswordStrengthText(passwordStrength.score)}
            </span>
          </div>
          <Progress 
            value={(passwordStrength.score / 5) * 100} 
            className="h-2"
            style={{ 
              backgroundColor: '#e5e7eb',
            }}
          />
          <div className="space-y-1">
            {passwordStrength.requirements.map((req, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                {req.met ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-gray-400" />
                )}
                <span className={req.met ? "text-green-700" : "text-gray-600"}>
                  {req.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm New Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPasswords.confirmPassword ? "text" : "password"}
            placeholder="Confirm your new password"
            value={passwords.confirmPassword}
            onChange={handleInputChange}
            className={cn(
              "pl-10 pr-10",
              errors.confirmPassword && "border-red-500 focus:border-red-500"
            )}
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('confirmPassword')}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            {showPasswords.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-red-600">{errors.confirmPassword}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
        disabled={isSubmitting || !passwordStrength.isValid}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Updating Password...
          </>
        ) : (
          "Update Password"
        )}
      </Button>
    </form>
  );
}; 