// Billing System Types for Stripe Integration
export interface BillingCustomer {
  id: string;
  stripe_customer_id: string;
  user_id?: string;
  organization_id?: string;
  email: string;
  name?: string;
  description?: string;
  
  // Address information
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  
  // Customer status
  status: 'active' | 'inactive' | 'deleted';
  currency: string;
  
  // Metadata
  stripe_metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface BillingSubscription {
  id: string;
  stripe_subscription_id: string;
  billing_customer_id: string;
  
  // Subscription details
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 
          'past_due' | 'canceled' | 'unpaid' | 'paused';
  pricing_plan: 'starter' | 'professional' | 'enterprise';
  
  // Billing configuration
  collection_method: 'charge_automatically' | 'send_invoice';
  currency: string;
  
  // Period information
  current_period_start?: string;
  current_period_end?: string;
  billing_cycle_anchor?: string;
  
  // Trial information
  trial_start?: string;
  trial_end?: string;
  
  // Cancellation information
  cancel_at_period_end: boolean;
  canceled_at?: string;
  cancellation_reason?: string;
  
  // Metadata
  stripe_metadata: Record<string, any>;
  application_fee_percent?: number;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface BillingPaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  billing_customer_id: string;
  
  // Payment method details
  type: 'card' | 'bank_account' | 'sepa_debit' | 'ideal' | 'sofort';
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  
  // Card-specific information
  card_brand?: string;
  card_last4?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  card_funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
  
  // Address information
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_address_city?: string;
  billing_address_state?: string;
  billing_address_postal_code?: string;
  billing_address_country?: string;
  
  // Metadata
  stripe_metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface BillingInvoice {
  id: string;
  stripe_invoice_id: string;
  billing_customer_id: string;
  billing_subscription_id?: string;
  
  // Invoice details
  invoice_number?: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | 'deleted';
  collection_method?: 'charge_automatically' | 'send_invoice';
  
  // Financial information (in cents)
  currency: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  
  // Period information
  period_start?: string;
  period_end?: string;
  
  // Payment information
  payment_intent_id?: string;
  payment_method_id?: string;
  
  // Important dates
  created_at_stripe: string;
  due_date?: string;
  finalized_at?: string;
  paid_at?: string;
  voided_at?: string;
  
  // URLs and metadata
  hosted_invoice_url?: string;
  invoice_pdf_url?: string;
  description?: string;
  footer?: string;
  
  // Metadata
  stripe_metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface BillingUsageRecord {
  id: string;
  billing_subscription_id: string;
  qa_session_id?: string;
  
  // Usage details
  words_processed: number;
  processing_type: 'qa_analysis' | 'batch_processing' | 'api_call';
  
  // Billing period
  billing_period_start: string;
  billing_period_end: string;
  
  // Pricing information
  price_per_word: number;
  total_cost: number;
  
  // Stripe usage record tracking
  stripe_usage_record_id?: string;
  reported_to_stripe: boolean;
  reported_at?: string;
  
  // Invoice tracking
  invoiced: boolean;
  invoice_id?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  processed_at: string;
}

export interface BillingWebhook {
  id: string;
  stripe_event_id: string;
  event_type: string;
  api_version?: string;
  
  // Processing status
  processed: boolean;
  processing_attempts: number;
  last_processing_attempt?: string;
  processing_error?: string;
  
  // Event data
  event_data: Record<string, any>;
  
  // Audit fields
  received_at: string;
  processed_at?: string;
}

// Pricing plan configuration
export interface PricingPlan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  description: string;
  price_per_word: number; // in USD
  monthly_limit?: number; // words, undefined for unlimited
  features: string[];
  stripe_price_id: string;
  stripe_product_id: string;
}

// Stripe-related interfaces for frontend components
export interface StripeCustomerPortalSession {
  url: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

// Usage tracking interfaces
export interface UsageSummary {
  current_period_start: string;
  current_period_end: string;
  words_processed: number;
  words_limit?: number;
  estimated_cost: number;
  days_remaining: number;
}

export interface UsageByType {
  qa_analysis: number;
  batch_processing: number;
  api_call: number;
  total: number;
}

// Billing dashboard data
export interface BillingDashboardData {
  customer: BillingCustomer;
  subscription?: BillingSubscription;
  usage_summary: UsageSummary;
  usage_by_type: UsageByType;
  recent_invoices: BillingInvoice[];
  payment_methods: BillingPaymentMethod[];
  next_billing_date?: string;
  subscription_status: string;
}

// API request/response types
export interface CreateCustomerRequest {
  email: string;
  name?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  price_id: string;
  payment_method_id?: string;
  trial_period_days?: number;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionRequest {
  price_id?: string;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
}

export interface RecordUsageRequest {
  subscription_id: string;
  qa_session_id?: string;
  words_processed: number;
  processing_type: 'qa_analysis' | 'batch_processing' | 'api_call';
}

// Error types
export interface BillingError {
  code: string;
  message: string;
  type: 'api_error' | 'card_error' | 'invalid_request_error' | 'authentication_error';
  param?: string;
  decline_code?: string;
}

export interface BillingApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: BillingError;
}

// Webhook event types
export type StripeWebhookEventType = 
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.created'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'setup_intent.succeeded'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'; 