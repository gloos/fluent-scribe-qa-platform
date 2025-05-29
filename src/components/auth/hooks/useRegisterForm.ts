import { useState } from 'react';
import { RegisterFormData, RegisterFormErrors, PasswordRequirement } from '../types';

export const useRegisterForm = (initialData?: Partial<RegisterFormData>) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    email: initialData?.email || "",
    password: initialData?.password || "",
    confirmPassword: initialData?.confirmPassword || "",
    termsAccepted: initialData?.termsAccepted || false
  });
  
  const [errors, setErrors] = useState<RegisterFormErrors>({});

  // Password strength validation
  const getPasswordRequirements = (password: string): PasswordRequirement[] => {
    return [
      { met: password.length >= 8, text: "At least 8 characters" },
      { met: /[A-Z]/.test(password), text: "One uppercase letter" },
      { met: /[a-z]/.test(password), text: "One lowercase letter" },
      { met: /\d/.test(password), text: "One number" },
      { met: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: "One special character" }
    ];
  };

  const passwordRequirements = getPasswordRequirements(formData.password);
  const passwordScore = passwordRequirements.filter(req => req.met).length;
  const passwordStrength = (passwordScore / passwordRequirements.length) * 100;

  const getPasswordStrengthColor = () => {
    if (passwordScore <= 2) return "bg-red-500";
    if (passwordScore <= 3) return "bg-yellow-500";
    if (passwordScore <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordScore <= 2) return "Weak";
    if (passwordScore <= 3) return "Fair";
    if (passwordScore <= 4) return "Good";
    return "Strong";
  };

  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (passwordScore < 4) {
      newErrors.password = "Password must meet all strength requirements";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.termsAccepted) {
      newErrors.terms = "You must accept the Terms of Service and Privacy Policy";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear validation error when user starts typing
    if (errors[name as keyof RegisterFormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false
    });
    setErrors({});
  };

  const setFieldError = (field: keyof RegisterFormErrors, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  };

  const setGeneralError = (message: string) => {
    setErrors(prev => ({ ...prev, general: message }));
  };

  const clearErrors = () => {
    setErrors({});
  };

  return {
    formData,
    errors,
    passwordRequirements,
    passwordScore,
    passwordStrength,
    getPasswordStrengthColor,
    getPasswordStrengthText,
    validateForm,
    handleInputChange,
    resetForm,
    setFieldError,
    setGeneralError,
    clearErrors,
    setFormData
  };
}; 