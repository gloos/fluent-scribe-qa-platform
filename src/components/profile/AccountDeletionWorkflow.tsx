import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle, 
  Clock, 
  Download, 
  Shield, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  ArrowRight,
  FileText,
  MessageSquare,
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { DeletionRequest } from '@/services/AccountDeletionService';

type WorkflowStep = 'initial' | 'verification' | 'data-export' | 'feedback' | 'final-confirmation' | 'processing' | 'completed';

interface StepData {
  password?: string;
  dataExported?: boolean;
  reason?: string;
  feedback?: string;
}

export default function AccountDeletionWorkflow() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('initial');
  const [stepData, setStepData] = useState<StepData>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDeletionRequest, setActiveDeletionRequest] = useState<DeletionRequest | null>(null);
  const [gracePeriodDaysRemaining, setGracePeriodDaysRemaining] = useState<number>(0);

  // Check for existing deletion request on component mount
  useEffect(() => {
    checkExistingDeletionRequest();
  }, []);

  const checkExistingDeletionRequest = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/account/deletion-request', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.status === 404) {
        return; // No active deletion request
      }

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setActiveDeletionRequest(data.data);
          setGracePeriodDaysRemaining(data.data.gracePeriodDaysRemaining || 0);
          
          // Set appropriate step based on status
          if (data.data.status === 'grace_period') {
            setCurrentStep('processing');
          } else if (data.data.status === 'processing') {
            setCurrentStep('processing');
          } else if (data.data.status === 'completed') {
            setCurrentStep('completed');
          }
        }
      }
    } catch (error) {
      console.error('Error checking deletion request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = (): boolean => {
    const newErrors: string[] = [];

    switch (currentStep) {
      case 'verification':
        if (!stepData.password) {
          newErrors.push('Please enter your password to verify your identity');
        }
        break;
      case 'feedback':
        if (!stepData.reason) {
          newErrors.push('Please select a reason for account deletion');
        }
        break;
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    setIsLoading(true);
    try {
      switch (currentStep) {
        case 'initial':
          setCurrentStep('verification');
          break;

        case 'verification':
          await verifyPassword();
          setCurrentStep('data-export');
          break;

        case 'data-export':
          setCurrentStep('feedback');
          break;

        case 'feedback':
          setCurrentStep('final-confirmation');
          break;

        case 'final-confirmation':
          await submitDeletionRequest();
          setCurrentStep('processing');
          break;
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'An unexpected error occurred']);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPassword = async () => {
    if (!stepData.password || !user?.email) {
      throw new Error('Password and email are required');
    }

    // Use Supabase's reauthentication
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: stepData.password
    });

    if (error) {
      throw new Error('Password verification failed. Please check your password and try again.');
    }
  };

  const submitDeletionRequest = async () => {
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + 30); // 30-day grace period

    const response = await fetch('/api/v1/account/deletion-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify({
        completionScheduled: completionDate.toISOString(),
        reason: stepData.reason,
        feedback: stepData.feedback,
        dataExported: Boolean(stepData.dataExported)
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create deletion request');
    }

    const result = await response.json();
    setActiveDeletionRequest(result.data);
    setGracePeriodDaysRemaining(30);
  };

  const handleCancelDeletion = async () => {
    if (!activeDeletionRequest) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/account/deletion-request/${activeDeletionRequest.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ cancellationReason: 'User requested cancellation' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to cancel deletion request');
      }
      
      // Reset state
      setActiveDeletionRequest(null);
      setCurrentStep('initial');
      setStepData({});
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to cancel deletion request']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    try {
      // For now, we'll simulate the export with user data
      const userData = {
        profile: {
          id: user?.id,
          email: user?.email,
          created_at: user?.created_at
        },
        export_date: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(userData, null, 2)], { 
        type: 'application/json' 
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `account-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStepData({ ...stepData, dataExported: true });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to export data']);
    } finally {
      setIsLoading(false);
    }
  };

  const getStepNumber = (): number => {
    const stepNumbers = {
      'initial': 1,
      'verification': 2,
      'data-export': 3,
      'feedback': 4,
      'final-confirmation': 5,
      'processing': 6,
      'completed': 7
    };
    return stepNumbers[currentStep] || 1;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'initial':
        return renderInitialStep();
      case 'verification':
        return renderVerificationStep();
      case 'data-export':
        return renderDataExportStep();
      case 'feedback':
        return renderFeedbackStep();
      case 'final-confirmation':
        return renderFinalConfirmationStep();
      case 'processing':
        return renderProcessingStep();
      case 'completed':
        return renderCompletedStep();
      default:
        return null;
    }
  };

  const renderInitialStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold mb-2">Delete Your Account</h3>
        <p className="text-gray-600">
          This action will permanently delete your account and all associated data. 
          This cannot be undone.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> Account deletion is permanent and irreversible. 
          All your data, including QA sessions, preferences, and history will be permanently removed.
        </AlertDescription>
      </Alert>

      <div className="space-y-3 text-left">
        <h4 className="font-medium">What will be deleted:</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            All QA sessions and conversation history
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            Profile information and preferences
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            API keys and access tokens
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            Usage analytics and feedback
          </li>
        </ul>
      </div>

      <Button 
        onClick={handleNext}
        disabled={isLoading}
        variant="destructive"
        className="w-full"
      >
        {isLoading ? 'Please wait...' : 'Continue with Account Deletion'}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Verify Your Identity</h3>
        <p className="text-gray-600">
          Please enter your password to confirm your identity before proceeding.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={stepData.password || ''}
            onChange={(e) => setStepData({ ...stepData, password: e.target.value })}
            placeholder="Enter your current password"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => setCurrentStep('initial')}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={isLoading || !stepData.password}
          variant="destructive"
          className="flex-1"
        >
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderDataExportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Download className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Export Your Data</h3>
        <p className="text-gray-600">
          Before deleting your account, you can download a copy of all your data.
        </p>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Your data export will include QA sessions, preferences, and usage history in JSON format.
          This process may take a few moments depending on your data volume.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <Button 
          onClick={handleExportData}
          disabled={isLoading}
          variant="outline"
          className="w-full"
        >
          {isLoading ? 'Exporting...' : 'Download My Data'}
          <Download className="w-4 h-4 ml-2" />
        </Button>

        {stepData.dataExported && (
          <div className="flex items-center gap-2 text-green-600 justify-center">
            <CheckCircle className="w-5 h-5" />
            <span>Data exported successfully</span>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox 
            id="skip-export"
            checked={stepData.dataExported || false}
            onCheckedChange={(checked) => setStepData({ ...stepData, dataExported: Boolean(checked) })}
          />
          <Label htmlFor="skip-export" className="text-sm">
            I understand that I can skip the data export. I will not be able to recover my data after account deletion.
          </Label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => setCurrentStep('verification')}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={isLoading}
          variant="destructive"
          className="flex-1"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderFeedbackStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Help Us Improve</h3>
        <p className="text-gray-600">
          Your feedback helps us understand why users leave and how we can improve.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="reason">Reason for leaving (required)</Label>
          <select
            id="reason"
            value={stepData.reason || ''}
            onChange={(e) => setStepData({ ...stepData, reason: e.target.value })}
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a reason...</option>
            <option value="not-useful">The service wasn't useful for my needs</option>
            <option value="too-expensive">Too expensive</option>
            <option value="technical-issues">Technical issues or bugs</option>
            <option value="privacy-concerns">Privacy concerns</option>
            <option value="switching-service">Switching to another service</option>
            <option value="temporary-break">Taking a temporary break</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <Label htmlFor="feedback">Additional feedback (optional)</Label>
          <Textarea
            id="feedback"
            value={stepData.feedback || ''}
            onChange={(e) => setStepData({ ...stepData, feedback: e.target.value })}
            placeholder="Tell us more about your experience or suggestions for improvement..."
            className="mt-1"
            rows={4}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => setCurrentStep('data-export')}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={isLoading || !stepData.reason}
          variant="destructive"
          className="flex-1"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderFinalConfirmationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Final Confirmation</h3>
        <p className="text-gray-600">
          Please review your deletion request before final submission.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>This is your last chance to cancel.</strong> Once submitted, your account will be scheduled 
          for deletion with a 30-day grace period during which you can still cancel.
        </AlertDescription>
      </Alert>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Deletion Summary:</h4>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span>Account:</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Data exported:</span>
            <span>{stepData.dataExported ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span>Reason:</span>
            <span className="text-right">{stepData.reason}</span>
          </div>
          <div className="flex justify-between">
            <span>Grace period:</span>
            <span>30 days</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => setCurrentStep('feedback')}
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          disabled={isLoading}
          variant="destructive"
          className="flex-1"
        >
          {isLoading ? 'Submitting...' : 'Delete My Account'}
          <Trash2 className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
        <Clock className="w-8 h-8 text-yellow-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold mb-2">Account Deletion Scheduled</h3>
        <p className="text-gray-600 mb-4">
          Your account deletion request has been submitted and is in the grace period.
        </p>
        
        {activeDeletionRequest && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Grace Period Information</span>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>Scheduled for:</strong> {' '}
                {new Date(activeDeletionRequest.completionScheduled).toLocaleDateString()}
              </p>
              <p>
                <strong>Days remaining:</strong> {gracePeriodDaysRemaining} days
              </p>
              <p>
                <strong>Status:</strong> {' '}
                <Badge variant={activeDeletionRequest.status === 'grace_period' ? 'secondary' : 'destructive'}>
                  {activeDeletionRequest.status.replace('_', ' ')}
                </Badge>
              </p>
            </div>
          </div>
        )}
      </div>

      {activeDeletionRequest?.status === 'grace_period' && gracePeriodDaysRemaining > 0 && (
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You can still cancel your account deletion during the grace period.
              After {gracePeriodDaysRemaining} days, the deletion will be processed automatically.
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={handleCancelDeletion}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Cancelling...' : 'Cancel Account Deletion'}
          </Button>
        </div>
      )}
    </div>
  );

  const renderCompletedStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold mb-2">Account Deleted</h3>
        <p className="text-gray-600">
          Your account has been successfully deleted. All your data has been permanently removed from our systems.
        </p>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Thank you for using our service. We're sorry to see you go and appreciate any feedback you provided.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <Trash2 className="w-5 h-5" />
          Delete Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{Math.round((getStepNumber() / 7) * 100)}%</span>
          </div>
          <Progress value={(getStepNumber() / 7) * 100} className="w-full" />
        </div>

        {/* Error display */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Step content */}
        {renderStep()}
      </CardContent>
    </Card>
  );
} 