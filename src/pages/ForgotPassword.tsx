import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Mail, ArrowLeft, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    limited: boolean;
    retryAfter?: number;
    captchaRequired?: boolean;
    suspiciousActivity?: boolean;
  } | null>(null);

  // Email validation
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) {
      setValidationError("Email is required");
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("Please enter a valid email address");
      return false;
    }
    
    setValidationError("");
    return true;
  };

  // Format wait time in a user-friendly way
  const formatWaitTime = (waitTimeMs?: number): string => {
    if (!waitTimeMs) return '';
    
    const minutes = Math.ceil(waitTimeMs / (1000 * 60));
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);
    setRateLimitInfo(null);

    try {
      const result = await resetPassword(email);

      if (!result.success) {
        if (result.rateLimited) {
          const waitTime = formatWaitTime(result.retryAfter);
          setRateLimitInfo({
            limited: true,
            retryAfter: result.retryAfter,
            captchaRequired: result.captchaRequired,
            suspiciousActivity: result.suspiciousActivity
          });

          toast({
            title: "Rate Limit Exceeded",
            description: `Please wait ${waitTime} before requesting another password reset.`,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Reset Failed",
          description: result.error?.message || "Failed to send reset email",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitted(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions.",
      });

    } catch (error) {
      toast({
        title: "Reset Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    
    // Clear validation error and rate limit info when user starts typing
    if (validationError) {
      setValidationError("");
    }
    if (rateLimitInfo) {
      setRateLimitInfo(null);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center space-x-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">LinguaQA</span>
            </Link>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Check your email
                  </h2>
                  <p className="text-gray-600">
                    We've sent password reset instructions to:
                  </p>
                  <p className="font-medium text-gray-900">{email}</p>
                </div>

                <Alert>
                  <AlertDescription>
                    If you don't see the email in your inbox, please check your spam folder. 
                    The reset link will expire in 24 hours.
                  </AlertDescription>
                </Alert>

                <div className="pt-4">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to sign in
                    </Button>
                  </Link>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Didn't receive an email?{" "}
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setEmail("");
                      }}
                      className="text-blue-600 hover:text-blue-500 font-medium"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">LinguaQA</span>
          </Link>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Rate limit warning */}
            {rateLimitInfo?.limited && (
              <Alert className="mb-4" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p>Too many password reset requests.</p>
                    {rateLimitInfo.retryAfter && (
                      <p className="text-sm">
                        Please wait {formatWaitTime(rateLimitInfo.retryAfter)} before trying again.
                      </p>
                    )}
                    {rateLimitInfo.captchaRequired && (
                      <p className="text-sm">Additional verification may be required for your next attempt.</p>
                    )}
                    {rateLimitInfo.suspiciousActivity && (
                      <p className="text-sm">Suspicious activity detected. Please contact support if you need assistance.</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={handleEmailChange}
                    className={cn(
                      "pl-10",
                      validationError && "border-red-500"
                    )}
                    required
                  />
                </div>
                {validationError && (
                  <p className="text-sm text-red-600">{validationError}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || rateLimitInfo?.limited}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Sending reset email...
                  </>
                ) : rateLimitInfo?.limited ? (
                  "Please wait before trying again"
                ) : (
                  "Send reset email"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
                <ArrowLeft className="inline h-4 w-4 mr-1" />
                Back to sign in
              </Link>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword; 