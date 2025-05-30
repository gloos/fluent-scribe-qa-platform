import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPasswordStrengthText, getPasswordStrengthColor } from '@/lib/password-validation';

interface PasswordFieldProps {
  value: string;
  error?: string;
  passwordStrength: {
    score: number;
    isValid: boolean;
    requirements: Array<{ met: boolean; text: string }>;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: 'password') => void;
  disabled?: boolean;
  placeholder?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  error,
  passwordStrength,
  onChange,
  onClearError,
  disabled = false,
  placeholder = "Create a secure password"
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (error) {
      onClearError('password');
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className={cn(
            "pl-10 pr-10",
            error && "border-red-500"
          )}
          disabled={disabled}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-8 w-8 p-0"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-400" />
          ) : (
            <Eye className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>
      
      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Password strength:</span>
            <span className={cn(
              "font-medium",
              getPasswordStrengthColor(passwordStrength.score).replace('bg-', 'text-')
            )}>
              {getPasswordStrengthText(passwordStrength.score)}
            </span>
          </div>
          <Progress 
            value={(passwordStrength.score / 5) * 100} 
            className="h-2"
          />
          <div className="space-y-1">
            {passwordStrength.requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                {req.met ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-gray-400" />
                )}
                <span className={req.met ? "text-green-600" : "text-gray-600"}>
                  {req.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 