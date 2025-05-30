import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NameFieldsGroupProps {
  firstName: string;
  lastName: string;
  errors: {
    firstName?: string;
    lastName?: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: 'firstName' | 'lastName') => void;
  disabled?: boolean;
}

export const NameFieldsGroup: React.FC<NameFieldsGroupProps> = ({
  firstName,
  lastName,
  errors,
  onChange,
  onClearError,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (errors[e.target.name as keyof typeof errors]) {
      onClearError(e.target.name as 'firstName' | 'lastName');
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">First name</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="firstName"
            name="firstName"
            type="text"
            placeholder="John"
            value={firstName}
            onChange={handleChange}
            className={cn(
              "pl-10",
              errors.firstName && "border-red-500"
            )}
            disabled={disabled}
            required
          />
        </div>
        {errors.firstName && (
          <p className="text-sm text-red-600">{errors.firstName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Last name</Label>
        <Input
          id="lastName"
          name="lastName"
          type="text"
          placeholder="Doe"
          value={lastName}
          onChange={handleChange}
          className={cn(
            errors.lastName && "border-red-500"
          )}
          disabled={disabled}
          required
        />
        {errors.lastName && (
          <p className="text-sm text-red-600">{errors.lastName}</p>
        )}
      </div>
    </div>
  );
}; 