// Authentication form data
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Registration form data
export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

// Password requirement interface
export interface PasswordRequirement {
  met: boolean;
  text: string;
}

// Security information
export interface SecurityInfo {
  isLocked: boolean;
  failedAttempts: number;
  lockoutTime?: string;
  attemptsRemaining?: number;
}

// Rate limiting information
export interface RateLimitInfo {
  limited: boolean;
  retryAfter?: number;
}

// Form validation errors
export interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

// Registration form errors
export interface RegisterFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

// Login form props
export interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isSubmitting: boolean;
  errors: LoginFormErrors;
  securityInfo?: SecurityInfo;
  rateLimitInfo?: RateLimitInfo;
}

// Register form props
export interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void>;
  isSubmitting: boolean;
  errors: RegisterFormErrors;
}

// Security status display props
export interface SecurityStatusProps {
  securityInfo?: SecurityInfo;
  rateLimitInfo?: RateLimitInfo;
  email: string;
}

// Rate limit warning props
export interface RateLimitWarningProps {
  show: boolean;
  countdown: number;
  onCountdownEnd: () => void;
}

// Password strength props
export interface PasswordStrengthProps {
  password: string;
  requirements?: PasswordRequirement[];
  showRequirements?: boolean;
  className?: string;
} 