import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, CheckCircle, XCircle, Mail, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type VerificationStatus = 'verifying' | 'success' | 'error' | 'expired' | 'already-verified';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      // Check if this is an email verification link
      if (type !== 'signup' && type !== 'email_change') {
        setStatus('error');
        setErrorMessage('Invalid verification link');
        return;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage('Missing verification token');
        return;
      }

      try {
        // The verification is automatically handled by Supabase when the user visits the link
        // We just need to check if the user is now verified
        
        // Wait a moment for the auth state to update
        setTimeout(() => {
          if (isAuthenticated && user?.email_confirmed_at) {
            setStatus('success');
            toast({
              title: "Email Verified!",
              description: "Your email has been successfully verified. You can now sign in.",
            });
          } else if (isAuthenticated) {
            setStatus('already-verified');
          } else {
            // Check for common error scenarios
            const error = searchParams.get('error');
            if (error) {
              if (error.includes('expired')) {
                setStatus('expired');
                setErrorMessage('The verification link has expired');
              } else {
                setStatus('error');
                setErrorMessage('Verification failed: ' + error);
              }
            } else {
              setStatus('success');
            }
          }
        }, 2000);

      } catch (error) {
        setStatus('error');
        setErrorMessage('An unexpected error occurred during verification');
      }
    };

    verifyEmail();
  }, [searchParams, isAuthenticated, user]);

  const handleContinue = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Verifying your email...
              </h2>
              <p className="text-gray-600">
                Please wait while we confirm your email address.
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Email verified successfully!
              </h2>
              <p className="text-gray-600">
                Your email has been confirmed. You can now access all features of LinguaQA.
              </p>
            </div>

            <div className="pt-4">
              <Button onClick={handleContinue} className="w-full">
                {isAuthenticated ? 'Continue to Dashboard' : 'Sign In'}
              </Button>
            </div>
          </div>
        );

      case 'already-verified':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Email already verified
              </h2>
              <p className="text-gray-600">
                Your email address has already been confirmed. You're all set!
              </p>
            </div>

            <div className="pt-4">
              <Button onClick={handleContinue} className="w-full">
                Continue to Dashboard
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-8 w-8 text-yellow-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Verification link expired
              </h2>
              <p className="text-gray-600">
                The verification link has expired. Please request a new one.
              </p>
            </div>

            <Alert className="text-left">
              <AlertDescription>
                Verification links expire after 24 hours for security reasons. 
                You can request a new verification email from the sign in page.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 pt-4">
              <Link to="/login">
                <Button className="w-full">
                  Go to Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" className="w-full">
                  Create New Account
                </Button>
              </Link>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Verification failed
              </h2>
              <p className="text-gray-600">
                {errorMessage || 'There was an error verifying your email address.'}
              </p>
            </div>

            <Alert variant="destructive" className="text-left">
              <AlertDescription>
                Please try clicking the verification link again, or contact support if the problem persists.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 pt-4">
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerification; 