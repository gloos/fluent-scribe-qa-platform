import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { STRIPE_CONFIG, validateStripeConfig } from '@/lib/config/stripe';

// Stripe context interface
interface StripeContextValue {
  stripe: Stripe | null;
  isLoading: boolean;
  error: string | null;
  isConfigValid: boolean;
}

// Create the context
const StripeContext = createContext<StripeContextValue | undefined>(undefined);

// Hook to use Stripe context
export function useStripe() {
  const context = useContext(StripeContext);
  if (context === undefined) {
    throw new Error('useStripe must be used within a StripeProvider');
  }
  return context;
}

// Stripe provider props
interface StripeProviderProps {
  children: React.ReactNode;
}

// Stripe provider component
export function StripeProvider({ children }: StripeProviderProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigValid, setIsConfigValid] = useState(false);

  useEffect(() => {
    // Validate configuration first
    const configValidation = validateStripeConfig();
    setIsConfigValid(configValidation.isValid);

    if (!configValidation.isValid) {
      setError(`Missing Stripe configuration: ${configValidation.missingKeys.join(', ')}`);
      setIsLoading(false);
      return;
    }

    // Load Stripe
    const initializeStripe = async () => {
      try {
        const stripePromise = await loadStripe(STRIPE_CONFIG.publishableKey);
        if (!stripePromise) {
          throw new Error('Failed to load Stripe');
        }
        setStripe(stripePromise);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize Stripe';
        setError(message);
        console.error('Stripe initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeStripe();
  }, []);

  const contextValue: StripeContextValue = {
    stripe,
    isLoading,
    error,
    isConfigValid,
  };

  return (
    <StripeContext.Provider value={contextValue}>
      {children}
    </StripeContext.Provider>
  );
}

// Enhanced Elements provider that includes our custom provider
interface StripeElementsProviderProps {
  children: React.ReactNode;
  clientSecret?: string;
  appearance?: any;
}

export function StripeElementsProvider({ 
  children, 
  clientSecret,
  appearance 
}: StripeElementsProviderProps) {
  const { stripe, isLoading, error, isConfigValid } = useStripe();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading payment system...</span>
      </div>
    );
  }

  // Show error state
  if (error || !isConfigValid) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Payment System Configuration Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'Stripe is not properly configured'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show Stripe Elements when everything is ready
  if (!stripe) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-700">Payment system is not available</p>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: appearance || {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '6px',
      },
    },
  };

  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
}

// Complete provider that wraps both providers
export function StripeRootProvider({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider>
      {children}
    </StripeProvider>
  );
} 