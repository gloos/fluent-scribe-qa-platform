import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmPasswordFieldProps {
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: 'confirmPassword') => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ConfirmPasswordField: React.FC<ConfirmPasswordFieldProps> = ({
  value,
  error,
  onChange,
  onClearError,
  disabled = false,
  placeholder = "Confirm your password"
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (error) {
      onClearError('confirmPassword');
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="confirmPassword">Confirm password</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          id="confirmPassword"
          name="confirmPassword"
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
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 