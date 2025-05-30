import React from 'react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TermsCheckboxProps {
  checked: boolean;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: 'terms') => void;
  disabled?: boolean;
}

export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({
  checked,
  error,
  onChange,
  onClearError,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (error) {
      onClearError('terms');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start space-x-2">
        <input 
          type="checkbox" 
          id="terms"
          name="termsAccepted"
          checked={checked}
          onChange={handleChange}
          className={cn(
            "mt-1 rounded border-gray-300",
            error && "border-red-500"
          )}
          disabled={disabled}
          required 
        />
        <Label htmlFor="terms" className="text-sm leading-5">
          I agree to the{" "}
          <Link to="/terms" className="text-blue-600 hover:text-blue-500">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-blue-600 hover:text-blue-500">
            Privacy Policy
          </Link>
        </Label>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 