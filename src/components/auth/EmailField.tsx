import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailFieldProps {
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: 'email') => void;
  disabled?: boolean;
  placeholder?: string;
}

export const EmailField: React.FC<EmailFieldProps> = ({
  value,
  error,
  onChange,
  onClearError,
  disabled = false,
  placeholder = "john.doe@example.com"
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (error) {
      onClearError('email');
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <div className="relative">
        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className={cn(
            "pl-10",
            error && "border-red-500"
          )}
          disabled={disabled}
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 