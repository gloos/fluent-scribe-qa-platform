import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Lock, Eye, EyeOff, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthText } from '@/lib/password-validation';
import { cn } from '@/lib/utils';

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordChangeFormProps {
  userId: string;
}

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ userId }) => {
  const { updatePassword } = useAuth();
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(validatePasswordStrength(''));

  // Update password strength when new password changes
  useEffect(() => {
    setPasswordStrength(validatePasswordStrength(formData.newPassword));
  }, [formData.newPassword]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (!passwordStrength.isValid) {
      newErrors.newPassword = "Password does not meet security requirements";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

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

    try {
      const { error } = await updatePassword(formData.newPassword);
      
      if (error) throw error;

      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
        variant: "default"
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change password.";
      toast({
        title: "Password Change Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                value={formData.currentPassword}
                onChange={handleInputChange}
                className={cn(errors.currentPassword && "border-red-500")}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-red-600">{errors.currentPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={formData.newPassword}
                onChange={handleInputChange}
                className={cn(errors.newPassword && "border-red-500")}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-red-600">{errors.newPassword}</p>
            )}
          </div>

          {/* Password Strength Indicator */}
          {formData.newPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Password Strength</Label>
                <span className="text-sm font-medium">
                  {passwordStrength.score}/5 - {getPasswordStrengthText(passwordStrength.score)}
                </span>
              </div>
              <Progress 
                value={(passwordStrength.score / 5) * 100} 
                className="h-2"
              />
              <div className="space-y-1">
                {passwordStrength.requirements.map((req, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <span className={req.met ? "text-green-600" : "text-red-600"}>
                      {req.met ? '✓' : '✗'}
                    </span>
                    <span className={req.met ? "text-green-700" : "text-gray-600"}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={cn(errors.confirmPassword && "border-red-500")}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSubmitting}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting || !passwordStrength.isValid} className="w-full">
            {isSubmitting ? (
              <>Changing Password...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Change Password
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}; 