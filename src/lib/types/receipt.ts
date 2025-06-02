// Receipt System Types for Payment Receipt Handling
import type { BillingCustomer, BillingInvoice, BillingPaymentMethod } from './billing';

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  invoice_id: string;
  billing_customer_id: string;
  
  // Receipt details
  status: 'pending' | 'generated' | 'delivered' | 'failed';
  template_type: 'basic' | 'detailed' | 'tax_compliant' | 'enterprise';
  
  // Financial information (from invoice)
  currency: string;
  amount_paid: number; // in cents
  tax_amount: number; // in cents
  subtotal: number; // in cents
  total: number; // in cents
  
  // Payment details
  payment_method_type?: string;
  payment_method_last4?: string;
  payment_date: string;
  payment_intent_id?: string;
  
  // Generation tracking
  generated_at?: string;
  generated_by?: string;
  pdf_url?: string;
  pdf_size_bytes?: number;
  
  // Delivery tracking
  delivery_channels: ReceiptDeliveryChannel[];
  delivery_attempts: number;
  last_delivery_attempt?: string;
  delivery_error?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

export interface ReceiptDeliveryChannel {
  id: string;
  receipt_id: string;
  channel_type: 'email' | 'portal' | 'api' | 'webhook';
  
  // Channel configuration
  recipient?: string; // email address for email channel
  endpoint_url?: string; // for webhook channel
  
  // Delivery status
  status: 'pending' | 'delivered' | 'failed' | 'bounced';
  delivered_at?: string;
  delivery_attempts: number;
  last_attempt_at?: string;
  error_message?: string;
  
  // Response tracking
  response_code?: number;
  response_message?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  type: 'basic' | 'detailed' | 'tax_compliant' | 'enterprise';
  version: string;
  
  // Template content
  html_template: string;
  pdf_template?: string;
  email_subject_template: string;
  email_body_template: string;
  
  // Template variables
  required_variables: string[];
  optional_variables: string[];
  
  // Configuration
  is_active: boolean;
  is_default: boolean;
  
  // Branding
  logo_url?: string;
  brand_colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ReceiptGenerationOptions {
  template_type?: 'basic' | 'detailed' | 'tax_compliant' | 'enterprise';
  delivery_channels?: ('email' | 'portal' | 'api')[];
  include_usage_details?: boolean;
  include_tax_breakdown?: boolean;
  custom_variables?: Record<string, any>;
  immediate_delivery?: boolean;
}

export interface ReceiptDeliveryOptions {
  email_recipient?: string;
  email_subject_override?: string;
  webhook_url?: string;
  retry_attempts?: number;
  retry_delay_minutes?: number;
}

// Receipt generation result
export interface ReceiptGenerationResult {
  success: boolean;
  receipt?: PaymentReceipt;
  pdf_url?: string;
  pdf_data?: Buffer;
  error?: {
    code: string;
    message: string;
    type: 'generation_error' | 'template_error' | 'data_error';
  };
}

// Receipt delivery result
export interface ReceiptDeliveryResult {
  success: boolean;
  delivery_id?: string;
  delivered_at?: string;
  error?: {
    code: string;
    message: string;
    type: 'email_error' | 'network_error' | 'validation_error';
    channel: string;
    recipient?: string;
  };
}

// Receipt data for template rendering
export interface ReceiptData {
  receipt: PaymentReceipt;
  customer: BillingCustomer;
  invoice: BillingInvoice;
  payment_method?: BillingPaymentMethod;
  
  // Company/sender information
  company: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
    email: string;
    phone?: string;
    website?: string;
    tax_id?: string;
  };
  
  // Payment breakdown
  line_items: ReceiptLineItem[];
  tax_details?: ReceiptTaxDetail[];
  
  // Usage details (if applicable)
  usage_summary?: {
    period_start: string;
    period_end: string;
    words_processed: number;
    processing_type: string;
    unit_price: number;
  };
}

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unit_price: number; // in cents
  total_price: number; // in cents
  tax_rate?: number; // percentage
  tax_amount?: number; // in cents
}

export interface ReceiptTaxDetail {
  tax_type: string; // e.g., 'VAT', 'Sales Tax', 'GST'
  rate: number; // percentage
  taxable_amount: number; // in cents
  tax_amount: number; // in cents
  jurisdiction?: string;
}

// Customer portal receipt list item
export interface ReceiptListItem {
  id: string;
  receipt_number: string;
  invoice_number?: string;
  payment_date: string;
  amount_paid: number;
  currency: string;
  status: PaymentReceipt['status'];
  pdf_url?: string;
  can_download: boolean;
}

// API request/response types
export interface GenerateReceiptRequest {
  invoice_id: string;
  options?: ReceiptGenerationOptions;
}

export interface DeliverReceiptRequest {
  receipt_id: string;
  delivery_options: ReceiptDeliveryOptions;
}

export interface GetReceiptsRequest {
  customer_id?: string;
  invoice_id?: string;
  status?: PaymentReceipt['status'];
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ReceiptApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type: string;
  };
}

// Webhook payload for receipt events
export interface ReceiptWebhookPayload {
  event_type: 'receipt.generated' | 'receipt.delivered' | 'receipt.failed';
  receipt_id: string;
  customer_id: string;
  invoice_id: string;
  timestamp: string;
  data: {
    receipt: PaymentReceipt;
    delivery_channel?: ReceiptDeliveryChannel;
    error?: string;
  };
}

// Receipt audit log entry
export interface ReceiptAuditLog {
  id: string;
  receipt_id: string;
  action: 'generated' | 'delivered' | 'failed' | 'downloaded' | 'resent';
  performed_by?: string; // user ID or 'system'
  details?: string;
  metadata: Record<string, any>;
  created_at: string;
} 