import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PasswordStrengthProps, PasswordRequirement } from './types';

const PasswordStrengthIndicator: React.FC<PasswordStrengthProps> = ({
  password,
  requirements,
  showRequirements = true,
  className
}) => {
  // Default requirements if none provided
  const defaultRequirements: PasswordRequirement[] = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[a-z]/.test(password), text: "One lowercase letter" },
    { met: /\d/.test(password), text: "One number" },
    { met: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: "One special character" }
  ];

  const finalRequirements = requirements || defaultRequirements;
  const passwordScore = finalRequirements.filter(req => req.met).length;
  const passwordStrength = (passwordScore / finalRequirements.length) * 100;

  const getPasswordStrengthText = () => {
    if (passwordScore <= 2) return "Weak";
    if (passwordScore <= 3) return "Fair";
    if (passwordScore <= 4) return "Good";
    return "Strong";
  };

  const getPasswordStrengthTextColor = () => {
    if (passwordScore <= 2) return "text-red-600";
    if (passwordScore <= 3) return "text-yellow-600";
    if (passwordScore <= 4) return "text-blue-600";
    return "text-green-600";
  };

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">Password strength:</span>
        <span className={cn("font-medium", getPasswordStrengthTextColor())}>
          {getPasswordStrengthText()}
        </span>
      </div>
      
      <Progress value={passwordStrength} className="h-2" />
      
      {showRequirements && (
        <div className="space-y-1">
          {finalRequirements.map((req, index) => (
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
      )}
    </div>
  );
};

export default PasswordStrengthIndicator; 