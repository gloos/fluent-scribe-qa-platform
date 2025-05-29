import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileText, Lock, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ResetStatus = 'validating' | 'valid' | 'invalid' | 'expired' | 'completed' | 'error';

const ResetPassword = () => {
  const { updatePassword, validatePasswordStrength } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<ResetStatus>('validating');
  const [passwords, setPasswords] = useState({
    password: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    isValid: false,
    requirements: []
  });

  // Get the reset token from URL (support both search params and hash fragments)
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');
  
  // Also check for the standard Supabase token in search params
  const token = searchParams.get('token');

  useEffect(() => {
    // Function to check if we already have a valid session (Supabase auto-detected)
    const checkExistingSession = async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          setStatus('valid');
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking session:', error);
        return false;
      }
    };
    
    // Function to handle session setup with tokens
    const setupSession = async (accessToken: string, refreshToken: string) => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Error setting recovery session:', error);
          setStatus('expired');
        } else {
          setStatus('valid');
        }
      } catch (error) {
        console.error('Unexpected error setting session:', error);
        setStatus('error');
      }
    };

    // Function to handle token-based reset (standard Supabase flow)
    const handleTokenReset = async (token: string) => {
      try {
        // For token-based reset, we verify the token and set up the session
        const { supabase } = await import('../lib/supabase');
        
        // Verify the token by attempting to use it
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });

        if (error) {
          console.error('Error verifying reset token:', error);
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setStatus('expired');
          } else {
            setStatus('invalid');
          }
        } else if (data?.session) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch (error) {
        console.error('Unexpected error verifying token:', error);
        setStatus('error');
      }
    };

    const processResetRequest = async () => {
      // First, check if Supabase already detected and set up the session
      const hasValidSession = await checkExistingSession();
      if (hasValidSession) {
        return;
      }
      
      // Check if we have a token in the URL hash (most common Supabase approach)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');
      const hashToken = hashParams.get('token');

      // Try different token approaches in order of preference
      if (hashAccessToken && hashRefreshToken && hashType === 'recovery') {
        setupSession(hashAccessToken, hashRefreshToken);
      } else if (accessToken && refreshToken && type === 'recovery') {
        setupSession(accessToken, refreshToken);
      } else if (hashToken && hashType === 'recovery') {
        handleTokenReset(hashToken);
      } else if (token && type === 'recovery') {
        handleTokenReset(token);
      } else {
        setStatus('invalid');
      }
    };

    // Add a small delay to allow Supabase's detectSessionInUrl to work first
    const timer = setTimeout(() => {
      processResetRequest();
    }, 100);

    return () => clearTimeout(timer);
  }, [accessToken, refreshToken, type, token]);

  // Update password strength when password changes
  useEffect(() => {
    if (passwords.password) {
      const strength = validatePasswordStrength(passwords.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, isValid: false, requirements: [] });
    }
  }, [passwords.password, validatePasswordStrength]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!passwords.password) {
      newErrors.password = "Password is required";
    } else if (!passwordStrength.isValid) {
      newErrors.password = "Password does not meet security requirements";
    }

    if (!passwords.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (passwords.password !== passwords.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));

    // Clear field-specific errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const { error } = await updatePassword(passwords.password);

      if (error) {
        console.error('Password reset error:', error);
        let errorMessage = "Failed to reset password. Please try again.";
        
        if (error.message.includes("session")) {
          errorMessage = "Reset link has expired. Please request a new password reset.";
          setStatus('expired');
        }

        setErrors({ general: errorMessage });
        toast({
          title: "Reset Failed",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        setStatus('completed');
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in with your new password.",
          variant: "default"
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successful. Please log in with your new password.' 
            }
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Unexpected error during password reset:', error);
      setErrors({ general: "An unexpected error occurred. Please try again." });
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 2) return "bg-red-500";
    if (passwordStrength.score <= 3) return "bg-yellow-500";
    if (passwordStrength.score <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 2) return "Weak";
    if (passwordStrength.score <= 3) return "Fair";
    if (passwordStrength.score <= 4) return "Good";
    return "Strong";
  };

  const renderStatusContent = () => {
    switch (status) {
      case 'validating':
        return (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Validating Reset Link</h3>
            <p className="text-gray-600">Please wait while we verify your password reset request...</p>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-red-700">Invalid Reset Link</h3>
            <p className="text-gray-600 mb-6">
              This password reset link is invalid or malformed. Please check your email for the correct link.
            </p>
            <Button asChild variant="outline">
              <Link to="/forgot-password">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Request New Reset Link
              </Link>
            </Button>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-orange-700">Reset Link Expired</h3>
            <p className="text-gray-600 mb-6">
              This password reset link has expired for security reasons. Please request a new one.
            </p>
            <Button asChild variant="outline">
              <Link to="/forgot-password">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Request New Reset Link
              </Link>
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-red-700">Error</h3>
            <p className="text-gray-600 mb-6">
              An error occurred while processing your reset request. Please try again.
            </p>
            <div className="space-y-2">
              <Button asChild variant="outline">
                <Link to="/forgot-password">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Request New Reset Link
                </Link>
              </Button>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-green-700">Password Reset Complete</h3>
            <p className="text-gray-600 mb-6">
              Your password has been successfully updated. You will be redirected to the login page shortly.
            </p>
            <Button asChild>
              <Link to="/login">
                Continue to Login
              </Link>
            </Button>
          </div>
        );

      case 'valid':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPasswords.password ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={passwords.password}
                  onChange={handleInputChange}
                  className={cn(
                    "pl-10 pr-10",
                    errors.password && "border-red-500 focus:border-red-500"
                  )}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, password: !prev.password }))}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  {showPasswords.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Password Strength Indicator */}
            {passwords.password && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Password Strength</Label>
                  <span className={cn(
                    "text-sm font-medium",
                    passwordStrength.score <= 2 && "text-red-600",
                    passwordStrength.score === 3 && "text-yellow-600",
                    passwordStrength.score === 4 && "text-blue-600",
                    passwordStrength.score === 5 && "text-green-600"
                  )}>
                    {getPasswordStrengthText()}
                  </span>
                </div>
                <Progress 
                  value={(passwordStrength.score / 5) * 100} 
                  className={cn(
                    "h-2",
                    "[&>div]:transition-all [&>div]:duration-300",
                    passwordStrength.score <= 2 && "[&>div]:bg-red-500",
                    passwordStrength.score === 3 && "[&>div]:bg-yellow-500", 
                    passwordStrength.score === 4 && "[&>div]:bg-blue-500",
                    passwordStrength.score === 5 && "[&>div]:bg-green-500"
                  )}
                />
                <div className="space-y-1">
                  {passwordStrength.requirements.map((req: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      {req.met ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={req.met ? "text-green-700" : "text-gray-600"}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={passwords.confirmPassword}
                  onChange={handleInputChange}
                  className={cn(
                    "pl-10 pr-10",
                    errors.confirmPassword && "border-red-500 focus:border-red-500"
                  )}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  disabled={isSubmitting}
                >
                  {showPasswords.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
              disabled={isSubmitting || !passwordStrength.isValid}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <FileText className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Reset Password
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Create a new secure password for your account
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Choose a strong password to secure your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStatusContent()}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">
          <p>
            Remember your password?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 