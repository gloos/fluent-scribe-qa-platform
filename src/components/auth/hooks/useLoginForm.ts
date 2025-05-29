import { useState } from 'react';
import { LoginFormData, LoginFormErrors } from '../types';

export const useLoginForm = (initialData?: Partial<LoginFormData>) => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: initialData?.email || "",
    password: initialData?.password || "",
    rememberMe: initialData?.rememberMe || false
  });
  
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));

    // Clear field-specific errors when user starts typing
    if (errors[name as keyof LoginFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      rememberMe: false
    });
    setErrors({});
  };

  const setFieldError = (field: keyof LoginFormErrors, message: string) => {
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
    validateForm,
    handleInputChange,
    resetForm,
    setFieldError,
    setGeneralError,
    clearErrors,
    setFormData
  };
}; 