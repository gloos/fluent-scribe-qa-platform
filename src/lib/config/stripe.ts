// Stripe Configuration
export const STRIPE_CONFIG = {
  // Public key for client-side operations (safe to expose)
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  
  // API version
  apiVersion: '2025-05-28.basil' as const,
  
  // Webhook endpoint secret
  webhookSecret: import.meta.env.STRIPE_WEBHOOK_SECRET,
  
  // Product and Price IDs from Stripe Dashboard
  products: {
    starter: {
      productId: import.meta.env.STRIPE_STARTER_PRODUCT_ID,
      priceId: import.meta.env.STRIPE_STARTER_PRICE_ID,
    },
    professional: {
      productId: import.meta.env.STRIPE_PROFESSIONAL_PRODUCT_ID,
      priceId: import.meta.env.STRIPE_PROFESSIONAL_PRICE_ID,
    },
    enterprise: {
      productId: import.meta.env.STRIPE_ENTERPRISE_PRODUCT_ID,
      priceId: import.meta.env.STRIPE_ENTERPRISE_PRICE_ID,
    },
  },
  
  // Application URLs
  urls: {
    frontend: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
    success: '/billing?session_id={CHECKOUT_SESSION_ID}',
    cancel: '/billing',
  },
  
  // Features configuration
  features: {
    enableTax: true,
    enablePromotionCodes: true,
    requireBillingAddress: true,
    enableCustomerPortal: true,
  },
  
  // Trial periods (in days)
  trialPeriods: {
    starter: 14,
    professional: 14,
    enterprise: 30,
  },
} as const;

// Validation function to check if Stripe is properly configured
export function validateStripeConfig(): { isValid: boolean; missingKeys: string[] } {
  const requiredKeys = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_PROFESSIONAL_PRICE_ID',
    'STRIPE_ENTERPRISE_PRICE_ID',
  ];
  
  const missingKeys: string[] = [];
  
  requiredKeys.forEach(key => {
    const value = import.meta.env[key];
    if (!value || value === 'undefined') {
      missingKeys.push(key);
    }
  });
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
}

// Helper function to get price ID by plan
export function getPriceIdByPlan(plan: 'starter' | 'professional' | 'enterprise'): string {
  return STRIPE_CONFIG.products[plan].priceId;
}

// Helper function to get product ID by plan
export function getProductIdByPlan(plan: 'starter' | 'professional' | 'enterprise'): string {
  return STRIPE_CONFIG.products[plan].productId;
} 