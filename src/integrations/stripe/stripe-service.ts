import Stripe from 'stripe';
import { 
  BillingCustomer, 
  BillingSubscription, 
  CreateCustomerRequest, 
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  BillingApiResponse,
  BillingError,
  PricingPlan
} from '@/lib/types/billing';

// Initialize Stripe with environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
  typescript: true,
});

// Pricing plan configuration
export const PRICING_PLANS: Record<string, PricingPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    price_per_word: 0.0005, // $0.0005 per word
    monthly_limit: 50000,
    features: [
      'Up to 50,000 words/month',
      'Basic error detection',
      'Email support',
      'Standard processing speed'
    ],
    stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID!,
    stripe_product_id: process.env.STRIPE_STARTER_PRODUCT_ID!
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Most popular for growing businesses',
    price_per_word: 0.0004, // $0.0004 per word
    monthly_limit: 200000,
    features: [
      'Up to 200,000 words/month',
      'Advanced error categorization',
      'Priority support',
      'Fast processing speed',
      'Custom style guides'
    ],
    stripe_price_id: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    stripe_product_id: process.env.STRIPE_PROFESSIONAL_PRODUCT_ID!
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with high volume',
    price_per_word: 0.0003, // $0.0003 per word
    monthly_limit: undefined, // Unlimited
    features: [
      'Unlimited words',
      'Full MQM compliance',
      'Dedicated support',
      'Fastest processing',
      'API access',
      'Custom integrations'
    ],
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    stripe_product_id: process.env.STRIPE_ENTERPRISE_PRODUCT_ID!
  }
};

/**
 * Service class for handling Stripe payment operations
 */
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = stripe;
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(request: CreateCustomerRequest): Promise<BillingApiResponse<Stripe.Customer>> {
    try {
      const customer = await this.stripe.customers.create({
        email: request.email,
        name: request.name,
        description: request.description,
        metadata: request.metadata || {},
      });

      return {
        success: true,
        data: customer
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a Stripe customer by ID
   */
  async getCustomer(customerId: string): Promise<BillingApiResponse<Stripe.Customer>> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        return {
          success: false,
          error: {
            code: 'customer_deleted',
            message: 'Customer has been deleted',
            type: 'invalid_request_error'
          }
        };
      }

      return {
        success: true,
        data: customer as Stripe.Customer
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Update a Stripe customer
   */
  async updateCustomer(customerId: string, updates: Partial<CreateCustomerRequest>): Promise<BillingApiResponse<Stripe.Customer>> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: updates.email,
        name: updates.name,
        description: updates.description,
        metadata: updates.metadata,
      });

      return {
        success: true,
        data: customer
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<BillingApiResponse<Stripe.Subscription>> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: request.customer_id,
        items: [{ price: request.price_id }],
        metadata: request.metadata || {},
        expand: ['latest_invoice.payment_intent'],
        payment_behavior: 'default_incomplete',
      };

      // Add trial period if specified
      if (request.trial_period_days) {
        subscriptionData.trial_period_days = request.trial_period_days;
      }

      // Add payment method if provided
      if (request.payment_method_id) {
        subscriptionData.default_payment_method = request.payment_method_id;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<BillingApiResponse<Stripe.Subscription>> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer', 'default_payment_method']
      });

      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(subscriptionId: string, updates: UpdateSubscriptionRequest): Promise<BillingApiResponse<Stripe.Subscription>> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {
        metadata: updates.metadata,
        cancel_at_period_end: updates.cancel_at_period_end,
      };

      // If changing price, update the subscription item
      if (updates.price_id) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        const subscriptionItem = subscription.items.data[0];
        
        updateData.items = [{
          id: subscriptionItem.id,
          price: updates.price_id,
        }];
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateData);

      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, immediately = false): Promise<BillingApiResponse<Stripe.Subscription>> {
    try {
      const subscription = immediately 
        ? await this.stripe.subscriptions.cancel(subscriptionId)
        : await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Create a setup intent for payment method collection
   */
  async createSetupIntent(customerId: string): Promise<BillingApiResponse<Stripe.SetupIntent>> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });

      return {
        success: true,
        data: setupIntent
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string, type: 'card' = 'card'): Promise<BillingApiResponse<Stripe.PaymentMethod[]>> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type,
      });

      return {
        success: true,
        data: paymentMethods.data
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<BillingApiResponse<Stripe.Customer>> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      return {
        success: true,
        data: customer
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<BillingApiResponse<Stripe.PaymentMethod>> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      return {
        success: true,
        data: paymentMethod
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Record usage for metered billing
   * TODO: Implement once we verify the correct Stripe SDK method
   */
  async recordUsage(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<BillingApiResponse<any>> {
    try {
      // TODO: Fix this method call once we verify the correct Stripe SDK API
      // const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
      //   subscriptionItemId,
      //   {
      //     quantity,
      //     timestamp: timestamp || Math.floor(Date.now() / 1000),
      //     action: 'increment',
      //   }
      // );

      return {
        success: false,
        error: {
          code: 'not_implemented',
          message: 'Usage recording not yet implemented',
          type: 'api_error'
        }
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Get upcoming invoice for a customer
   * TODO: Implement once we verify the correct Stripe SDK method
   */
  async getUpcomingInvoice(customerId: string, subscriptionId?: string): Promise<BillingApiResponse<Stripe.Invoice>> {
    try {
      // TODO: Fix this method call once we verify the correct Stripe SDK API
      // const params: any = {
      //   customer: customerId,
      // };

      // if (subscriptionId) {
      //   params.subscription = subscriptionId;
      // }

      // const invoice = await this.stripe.invoices.retrieveUpcoming(params);

      return {
        success: false,
        error: {
          code: 'not_implemented',
          message: 'Get upcoming invoice not yet implemented',
          type: 'api_error'
        }
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(customerId: string, limit = 10): Promise<BillingApiResponse<Stripe.Invoice[]>> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
        status: 'paid',
      });

      return {
        success: true,
        data: invoices.data
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Create a customer portal session
   */
  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<BillingApiResponse<Stripe.BillingPortal.Session>> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return {
        success: true,
        data: session
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Create a checkout session for new subscriptions
   */
  async createCheckoutSession(
    priceId: string, 
    customerId?: string, 
    customerEmail?: string,
    trialPeriodDays?: number,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<BillingApiResponse<Stripe.Checkout.Session>> {
    try {
      const sessionData: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl || `${process.env.FRONTEND_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/billing`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        automatic_tax: { enabled: true },
      };

      if (customerId) {
        sessionData.customer = customerId;
      } else if (customerEmail) {
        sessionData.customer_email = customerEmail;
      }

      if (trialPeriodDays) {
        sessionData.subscription_data = {
          trial_period_days: trialPeriodDays,
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionData);

      return {
        success: true,
        data: session
      };
    } catch (error) {
      return this.handleStripeError(error);
    }
  }

  /**
   * Handle and format Stripe errors
   */
  private handleStripeError(error: any): BillingApiResponse {
    console.error('Stripe error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      const billingError: BillingError = {
        code: error.code || 'unknown_error',
        message: error.message,
        type: error.type as any,
        param: error.param,
        decline_code: (error as any).decline_code,
      };

      return {
        success: false,
        error: billingError
      };
    }

    // Handle unexpected errors
    return {
      success: false,
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
        type: 'api_error'
      }
    };
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, endpointSecret: string): Stripe.Event | null {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      console.error('Webhook signature validation failed:', error);
      return null;
    }
  }

  /**
   * Get pricing plans
   */
  getPricingPlans(): PricingPlan[] {
    return Object.values(PRICING_PLANS);
  }

  /**
   * Get pricing plan by ID
   */
  getPricingPlan(planId: string): PricingPlan | undefined {
    return PRICING_PLANS[planId];
  }
}

// Export a singleton instance
export const stripeService = new StripeService(); 