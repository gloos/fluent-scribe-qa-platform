import { useState } from 'react';
import { validatePasswordStrength } from '@/lib/password-validation';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export const useRegisterForm = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const passwordStrength = validatePasswordStrength(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name as keyof ValidationErrors]) {
      clearFieldError(name as keyof ValidationErrors);
    }
  };

  const clearFieldError = (fieldName: keyof ValidationErrors) => {
    setValidationErrors(prev => ({
      ...prev,
      [fieldName]: undefined
    }));
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (!passwordStrength.isValid) {
      errors.password = "Password must meet all strength requirements";
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (!formData.termsAccepted) {
      errors.terms = "You must accept the Terms of Service and Privacy Policy";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return {
    formData,
    validationErrors,
    passwordStrength,
    handleChange,
    clearFieldError,
    validateForm
  };
}; 