import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Chrome } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { AuthLogo } from './AuthLogo';
import { NameFieldsGroup } from './NameFieldsGroup';
import { EmailField } from './EmailField';
import { PasswordField } from './PasswordField';
import { ConfirmPasswordField } from './ConfirmPasswordField';
import { TermsCheckbox } from './TermsCheckbox';
import { useRegisterForm } from '@/hooks/useRegisterForm';

interface RegisterFormProps {
  onGoogleSignup?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onGoogleSignup }) => {
  const navigate = useNavigate();
  const { signUp, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    formData,
    validationErrors,
    passwordStrength,
    handleChange,
    validateForm,
    clearFieldError
  } = useRegisterForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors below and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        {
          full_name: `${formData.firstName} ${formData.lastName}`,
          first_name: formData.firstName,
          last_name: formData.lastName
        }
      );

      if (error) {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Account Created Successfully!",
        description: "Please check your email for a verification link before signing in.",
      });

      navigate("/login", { 
        state: { 
          message: "Registration successful! Please check your email for verification." 
        }
      });

    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (onGoogleSignup) {
      onGoogleSignup();
    } else {
      toast({
        title: "Coming Soon",
        description: "Google signup will be available in a future update.",
      });
    }
  };

  const isLoading = authLoading || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <AuthLogo />
        
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Start your linguistic quality assessment journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <NameFieldsGroup
                firstName={formData.firstName}
                lastName={formData.lastName}
                errors={{
                  firstName: validationErrors.firstName,
                  lastName: validationErrors.lastName
                }}
                onChange={handleChange}
                onClearError={clearFieldError}
                disabled={isLoading}
              />

              <EmailField
                value={formData.email}
                error={validationErrors.email}
                onChange={handleChange}
                onClearError={clearFieldError}
                disabled={isLoading}
              />

              <PasswordField
                value={formData.password}
                error={validationErrors.password}
                passwordStrength={passwordStrength}
                onChange={handleChange}
                onClearError={clearFieldError}
                disabled={isLoading}
              />

              <ConfirmPasswordField
                value={formData.confirmPassword}
                error={validationErrors.confirmPassword}
                onChange={handleChange}
                onClearError={clearFieldError}
                disabled={isLoading}
              />

              <TermsCheckbox
                checked={formData.termsAccepted}
                error={validationErrors.terms}
                onChange={handleChange}
                onClearError={clearFieldError}
                disabled={isLoading}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={handleGoogleSignup}
                disabled={isLoading}
              >
                <Chrome className="h-4 w-4 mr-2" />
                Google
              </Button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 