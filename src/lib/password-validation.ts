export interface PasswordRequirement {
  met: boolean;
  text: string;
}

export interface PasswordStrength {
  isValid: boolean;
  score: number;
  requirements: PasswordRequirement[];
}

export const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, text: "At least 8 characters" },
  { regex: /[A-Z]/, text: "One uppercase letter" },
  { regex: /[a-z]/, text: "One lowercase letter" },
  { regex: /\d/, text: "One number" },
  { regex: /[!@#$%^&*(),.?":{}|<>]/, text: "One special character" }
] as const;

export const validatePasswordStrength = (password: string): PasswordStrength => {
  const requirements = PASSWORD_REQUIREMENTS.map(req => ({
    met: req.regex.test(password),
    text: req.text
  }));

  const score = requirements.filter(req => req.met).length;
  const isValid = score >= 4; // Require at least 4 out of 5 criteria

  return {
    isValid,
    score,
    requirements
  };
};

export const getPasswordStrengthColor = (score: number): string => {
  if (score <= 2) return "bg-red-500";
  if (score <= 3) return "bg-yellow-500";
  if (score <= 4) return "bg-blue-500";
  return "bg-green-500";
};

export const getPasswordStrengthText = (score: number): string => {
  if (score <= 2) return "Weak";
  if (score <= 3) return "Fair";
  if (score <= 4) return "Good";
  return "Strong";
}; 