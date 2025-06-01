import type { 
  BillingInvoice, 
  BillingSubscription, 
  BillingCustomer,
  BillingUsageRecord
} from '../types/billing';
import { StripeService } from '@/integrations/stripe/stripe-service';
import { usageTracker } from './usage-tracking-service';
import { supabase } from '../supabase';
import { 
  taxCalculationService, 
  TaxCalculationRequest, 
  TaxCalculationResult 
} from './tax-calculation-service';

export interface InvoiceGenerationOptions {
  includeTax?: boolean;
  currency?: string;
  template?: 'standard' | 'detailed' | 'minimal';
  dueInDays?: number;
  autoFinalize?: boolean;
  description?: string;
  footer?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  amount: number; // in cents
  type: 'subscription' | 'usage' | 'tax' | 'discount';
  metadata?: Record<string, any>;
}

export interface InvoiceSummary {
  subtotal: number; // in cents
  taxAmount: number; // in cents
  discountAmount: number; // in cents
  total: number; // in cents
  currency: string;
  lineItems: InvoiceLineItem[];
  usageRecordIds: string[];
  taxCalculationResult?: TaxCalculationResult;
}

export interface InvoiceGenerationResult {
  success: boolean;
  invoice?: BillingInvoice;
  stripeInvoiceId?: string;
  error?: string;
  validationErrors?: string[];
}

export class InvoiceGenerationService {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  /**
   * Generate an invoice for a subscription billing period
   */
  async generatePeriodInvoice(
    subscriptionId: string,
    periodStart: string,
    periodEnd: string,
    options: InvoiceGenerationOptions = {}
  ): Promise<InvoiceGenerationResult> {
    try {
      // Get subscription details
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        return {
          success: false,
          error: 'Subscription not found'
        };
      }

      // Get customer details
      const customer = await this.getCustomer(subscription.billing_customer_id);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }

      // Generate invoice summary from usage and subscription data
      const invoiceSummary = await this.generateInvoiceSummary(
        subscription,
        customer,
        periodStart,
        periodEnd,
        options
      );

      // Validate invoice data
      const validationErrors = this.validateInvoiceData(invoiceSummary, subscription, customer);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Invoice validation failed',
          validationErrors
        };
      }

      // Create invoice in Stripe
      const stripeResult = await this.createStripeInvoice(subscription, customer, invoiceSummary, options);
      if (!stripeResult.success || !stripeResult.stripeInvoice) {
        return {
          success: false,
          error: stripeResult.error || 'Failed to create Stripe invoice'
        };
      }

      // Store invoice in our database
      const invoice = await this.storeInvoice(stripeResult.stripeInvoice, subscription, customer, invoiceSummary);

      // Mark usage records as invoiced
      await this.markUsageRecordsAsInvoiced(invoiceSummary.usageRecordIds, invoice.id);

      return {
        success: true,
        invoice,
        stripeInvoiceId: stripeResult.stripeInvoice.id
      };

    } catch (error) {
      console.error('Error generating period invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate invoice for immediate usage (one-time)
   */
  async generateUsageInvoice(
    customerId: string,
    usageRecordIds: string[],
    options: InvoiceGenerationOptions = {}
  ): Promise<InvoiceGenerationResult> {
    try {
      // Get customer details
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }

      // Get usage records
      const usageRecords = await this.getUsageRecords(usageRecordIds);
      if (usageRecords.length === 0) {
        return {
          success: false,
          error: 'No usage records found'
        };
      }

      // Generate invoice summary from usage records
      const invoiceSummary = await this.generateUsageInvoiceSummary(usageRecords, customer, options);

      // Validate invoice data
      const validationErrors = this.validateInvoiceData(invoiceSummary, null, customer);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Invoice validation failed',
          validationErrors
        };
      }

      // Create one-time invoice in Stripe
      const stripeResult = await this.createStripeUsageInvoice(customer, invoiceSummary, options);
      if (!stripeResult.success || !stripeResult.stripeInvoice) {
        return {
          success: false,
          error: stripeResult.error || 'Failed to create Stripe invoice'
        };
      }

      // Store invoice in our database
      const invoice = await this.storeInvoice(stripeResult.stripeInvoice, null, customer, invoiceSummary);

      // Mark usage records as invoiced
      await this.markUsageRecordsAsInvoiced(usageRecordIds, invoice.id);

      return {
        success: true,
        invoice,
        stripeInvoiceId: stripeResult.stripeInvoice.id
      };

    } catch (error) {
      console.error('Error generating usage invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate invoice summary from subscription and usage data
   */
  private async generateInvoiceSummary(
    subscription: BillingSubscription,
    customer: BillingCustomer,
    periodStart: string,
    periodEnd: string,
    options: InvoiceGenerationOptions
  ): Promise<InvoiceSummary> {
    const lineItems: InvoiceLineItem[] = [];
    const currency = options.currency || subscription.currency || 'usd';

    // Add subscription fee line item
    const subscriptionAmount = await this.calculateSubscriptionAmount(subscription, periodStart, periodEnd);
    if (subscriptionAmount > 0) {
      lineItems.push({
        id: `subscription-${subscription.id}`,
        description: `${subscription.pricing_plan} plan (${periodStart} - ${periodEnd})`,
        quantity: 1,
        unitPrice: subscriptionAmount,
        amount: subscriptionAmount,
        type: 'subscription',
        metadata: {
          subscriptionId: subscription.id,
          pricingPlan: subscription.pricing_plan,
          periodStart,
          periodEnd,
          productTaxCategory: 'digital_services'
        }
      });
    }

    // Get usage records for this period
    const usageRecords = await this.getUsageRecordsForPeriod(subscription.id, periodStart, periodEnd);
    const usageRecordIds = usageRecords.map(record => record.id);

    // Calculate usage charges
    const usageTotal = usageRecords.reduce((sum, record) => sum + record.total_cost, 0);

    if (usageTotal > 0) {
      const totalWords = usageRecords.reduce((sum, record) => sum + record.words_processed, 0);
      
      lineItems.push({
        id: `usage-${subscription.id}-${periodStart}`,
        description: `Word processing usage (${totalWords.toLocaleString()} words)`,
        quantity: totalWords,
        unitPrice: Math.round((usageTotal / totalWords) * 100), // Convert to cents per word
        amount: Math.round(usageTotal * 100), // Convert to cents
        type: 'usage',
        metadata: {
          subscriptionId: subscription.id,
          totalWords,
          usageRecordCount: usageRecords.length,
          periodStart,
          periodEnd,
          productTaxCategory: 'qa_analysis'
        }
      });
    }

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate tax using the new tax service
    let taxAmount = 0;
    let taxCalculationResult: TaxCalculationResult | undefined;

    if (options.includeTax !== false && subtotal > 0) {
      try {
        const taxRequest: TaxCalculationRequest = {
          customer_id: customer.id,
          customer_country: customer.country || 'US',
          customer_state: customer.state,
          customer_city: customer.city,
          customer_postal_code: customer.postal_code,
          line_items: lineItems.map(item => ({
            id: item.id,
            description: item.description,
            amount: item.amount,
            quantity: item.quantity,
            product_tax_category: item.metadata?.productTaxCategory
          })),
          currency: currency,
          transaction_date: new Date().toISOString()
        };

        taxCalculationResult = await taxCalculationService.calculateTax(taxRequest);

        if (taxCalculationResult.success) {
          taxAmount = taxCalculationResult.total_tax_amount;

          // Add detailed tax line items
          if (taxCalculationResult.tax_details && taxCalculationResult.tax_details.length > 0) {
            taxCalculationResult.tax_details.forEach(taxDetail => {
              if (taxDetail.amount > 0) {
                lineItems.push({
                  id: `tax-${taxDetail.jurisdiction.replace(/\s+/g, '-').toLowerCase()}`,
                  description: taxDetail.description,
                  quantity: 1,
                  unitPrice: taxDetail.amount,
                  amount: taxDetail.amount,
                  type: 'tax',
                  metadata: {
                    jurisdiction: taxDetail.jurisdiction,
                    taxType: taxDetail.tax_type,
                    taxRate: taxDetail.rate,
                    calculationMethod: taxCalculationResult.calculation_method
                  }
                });
              }
            });
          } else if (taxAmount > 0) {
            // Fallback: single tax line item if no detailed breakdown
            lineItems.push({
              id: `tax-${customer.country || 'unknown'}`,
              description: `Tax (${Math.round(taxCalculationResult.tax_rate * 100)}%)`,
              quantity: 1,
              unitPrice: taxAmount,
              amount: taxAmount,
              type: 'tax',
              metadata: {
                taxRate: taxCalculationResult.tax_rate,
                calculationMethod: taxCalculationResult.calculation_method
              }
            });
          }

          // Log the tax calculation for audit purposes
          try {
            await this.logTaxCalculation(taxCalculationResult, customer.id);
          } catch (logError) {
            console.warn('Failed to log tax calculation:', logError);
            // Don't fail invoice generation due to logging error
          }
        } else {
          console.warn('Tax calculation failed:', taxCalculationResult.error);
          // Fallback to simple tax calculation if the service fails
          const fallbackRate = this.getFallbackTaxRate(customer.country || 'US');
          taxAmount = Math.round(subtotal * fallbackRate);
          
          if (taxAmount > 0) {
            lineItems.push({
              id: `tax-fallback-${customer.country || 'US'}`,
              description: `Tax (${Math.round(fallbackRate * 100)}%) - Estimated`,
              quantity: 1,
              unitPrice: taxAmount,
              amount: taxAmount,
              type: 'tax',
              metadata: {
                taxRate: fallbackRate,
                calculationMethod: 'fallback',
                originalError: taxCalculationResult.error
              }
            });
          }
        }
      } catch (error) {
        console.error('Tax calculation service error:', error);
        // Fallback to simple tax calculation
        const fallbackRate = this.getFallbackTaxRate(customer.country || 'US');
        taxAmount = Math.round(subtotal * fallbackRate);
        
        if (taxAmount > 0) {
          lineItems.push({
            id: `tax-fallback-${customer.country || 'US'}`,
            description: `Tax (${Math.round(fallbackRate * 100)}%) - Estimated`,
            quantity: 1,
            unitPrice: taxAmount,
            amount: taxAmount,
            type: 'tax',
            metadata: {
              taxRate: fallbackRate,
              calculationMethod: 'fallback',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }
    }

    // Calculate total
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount: 0, // TODO: Implement discounts
      total,
      currency,
      lineItems,
      usageRecordIds,
      taxCalculationResult
    };
  }

  /**
   * Generate invoice summary for usage-only invoice
   */
  private async generateUsageInvoiceSummary(
    usageRecords: BillingUsageRecord[],
    customer: BillingCustomer,
    options: InvoiceGenerationOptions
  ): Promise<InvoiceSummary> {
    const lineItems: InvoiceLineItem[] = [];
    const currency = options.currency || 'usd';

    // Group usage records by type
    const usageByType = usageRecords.reduce((acc, record) => {
      if (!acc[record.processing_type]) {
        acc[record.processing_type] = [];
      }
      acc[record.processing_type].push(record);
      return acc;
    }, {} as Record<string, BillingUsageRecord[]>);

    // Create line items for each usage type
    Object.entries(usageByType).forEach(([type, records]) => {
      const totalWords = records.reduce((sum, record) => sum + record.words_processed, 0);
      const totalCost = records.reduce((sum, record) => sum + record.total_cost, 0);

      lineItems.push({
        id: `usage-${type}-${Date.now()}`,
        description: `${type.replace('_', ' ')} (${totalWords.toLocaleString()} words)`,
        quantity: totalWords,
        unitPrice: Math.round((totalCost / totalWords) * 100), // Convert to cents per word
        amount: Math.round(totalCost * 100), // Convert to cents
        type: 'usage',
        metadata: {
          processingType: type,
          totalWords,
          recordCount: records.length,
          productTaxCategory: this.getProductTaxCategory(type)
        }
      });
    });

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate tax using the new tax service
    let taxAmount = 0;
    let taxCalculationResult: TaxCalculationResult | undefined;

    if (options.includeTax !== false && subtotal > 0) {
      try {
        const taxRequest: TaxCalculationRequest = {
          customer_id: customer.id,
          customer_country: customer.country || 'US',
          customer_state: customer.state,
          customer_city: customer.city,
          customer_postal_code: customer.postal_code,
          line_items: lineItems.map(item => ({
            id: item.id,
            description: item.description,
            amount: item.amount,
            quantity: item.quantity,
            product_tax_category: item.metadata?.productTaxCategory
          })),
          currency: currency,
          transaction_date: new Date().toISOString()
        };

        taxCalculationResult = await taxCalculationService.calculateTax(taxRequest);

        if (taxCalculationResult.success) {
          taxAmount = taxCalculationResult.total_tax_amount;

          // Add tax line items
          if (taxCalculationResult.tax_details && taxCalculationResult.tax_details.length > 0) {
            taxCalculationResult.tax_details.forEach(taxDetail => {
              if (taxDetail.amount > 0) {
                lineItems.push({
                  id: `tax-${taxDetail.jurisdiction.replace(/\s+/g, '-').toLowerCase()}`,
                  description: taxDetail.description,
                  quantity: 1,
                  unitPrice: taxDetail.amount,
                  amount: taxDetail.amount,
                  type: 'tax',
                  metadata: {
                    jurisdiction: taxDetail.jurisdiction,
                    taxType: taxDetail.tax_type,
                    taxRate: taxDetail.rate,
                    calculationMethod: taxCalculationResult.calculation_method
                  }
                });
              }
            });
          } else if (taxAmount > 0) {
            lineItems.push({
              id: `tax-${customer.country || 'unknown'}`,
              description: `Tax (${Math.round(taxCalculationResult.tax_rate * 100)}%)`,
              quantity: 1,
              unitPrice: taxAmount,
              amount: taxAmount,
              type: 'tax',
              metadata: {
                taxRate: taxCalculationResult.tax_rate,
                calculationMethod: taxCalculationResult.calculation_method
              }
            });
          }

          // Log the tax calculation
          try {
            await this.logTaxCalculation(taxCalculationResult, customer.id);
          } catch (logError) {
            console.warn('Failed to log tax calculation:', logError);
          }
        } else {
          // Fallback calculation
          const fallbackRate = this.getFallbackTaxRate(customer.country || 'US');
          taxAmount = Math.round(subtotal * fallbackRate);
          
          if (taxAmount > 0) {
            lineItems.push({
              id: `tax-fallback-${customer.country || 'US'}`,
              description: `Tax (${Math.round(fallbackRate * 100)}%) - Estimated`,
              quantity: 1,
              unitPrice: taxAmount,
              amount: taxAmount,
              type: 'tax',
              metadata: {
                taxRate: fallbackRate,
                calculationMethod: 'fallback'
              }
            });
          }
        }
      } catch (error) {
        console.error('Tax calculation service error:', error);
        // Fallback calculation
        const fallbackRate = this.getFallbackTaxRate(customer.country || 'US');
        taxAmount = Math.round(subtotal * fallbackRate);
        
        if (taxAmount > 0) {
          lineItems.push({
            id: `tax-fallback-${customer.country || 'US'}`,
            description: `Tax (${Math.round(fallbackRate * 100)}%) - Estimated`,
            quantity: 1,
            unitPrice: taxAmount,
            amount: taxAmount,
            type: 'tax',
            metadata: {
              taxRate: fallbackRate,
              calculationMethod: 'fallback'
            }
          });
        }
      }
    }

    // Calculate total
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount: 0,
      total,
      currency,
      lineItems,
      usageRecordIds: usageRecords.map(record => record.id),
      taxCalculationResult
    };
  }

  /**
   * Create invoice in Stripe
   */
  private async createStripeInvoice(
    subscription: BillingSubscription,
    customer: BillingCustomer,
    invoiceSummary: InvoiceSummary,
    options: InvoiceGenerationOptions
  ): Promise<{ success: boolean; stripeInvoice?: any; error?: string }> {
    try {
      // For now, simulate Stripe invoice creation
      // In a real implementation, this would use the Stripe API:
      /*
      const invoice = await stripe.invoices.create({
        customer: customer.stripe_customer_id,
        collection_method: 'charge_automatically',
        currency: invoiceSummary.currency,
        description: options.description || `Invoice for ${subscription.pricing_plan} plan`,
        footer: options.footer,
        due_date: options.dueInDays ? Math.floor((Date.now() + options.dueInDays * 24 * 60 * 60 * 1000) / 1000) : undefined,
        auto_advance: options.autoFinalize !== false,
        metadata: {
          subscriptionId: subscription.id,
          billingPeriodStart: subscription.current_period_start,
          billingPeriodEnd: subscription.current_period_end
        }
      });

      // Add line items
      for (const lineItem of invoiceSummary.lineItems) {
        await stripe.invoiceItems.create({
          customer: customer.stripe_customer_id,
          invoice: invoice.id,
          amount: lineItem.amount,
          currency: invoiceSummary.currency,
          description: lineItem.description,
          quantity: lineItem.quantity,
          metadata: lineItem.metadata
        });
      }

      if (options.autoFinalize !== false) {
        await stripe.invoices.finalizeInvoice(invoice.id);
      }
      */

      // Simulate Stripe invoice
      const stripeInvoice = {
        id: `in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customer: customer.stripe_customer_id,
        subscription: subscription.stripe_subscription_id,
        status: 'open',
        currency: invoiceSummary.currency,
        amount_due: invoiceSummary.total,
        amount_paid: 0,
        amount_remaining: invoiceSummary.total,
        subtotal: invoiceSummary.subtotal,
        tax: invoiceSummary.taxAmount,
        total: invoiceSummary.total,
        created: Math.floor(Date.now() / 1000),
        period_start: Math.floor(new Date(subscription.current_period_start!).getTime() / 1000),
        period_end: Math.floor(new Date(subscription.current_period_end!).getTime() / 1000),
        due_date: options.dueInDays ? Math.floor((Date.now() + options.dueInDays * 24 * 60 * 60 * 1000) / 1000) : null,
        description: options.description || `Invoice for ${subscription.pricing_plan} plan`,
        footer: options.footer,
        hosted_invoice_url: `https://invoice.stripe.com/i/acct_test_${Math.random().toString(36).substr(2, 9)}`,
        invoice_pdf: `https://pay.stripe.com/invoice/${Math.random().toString(36).substr(2, 9)}/pdf`,
        metadata: {
          subscriptionId: subscription.id,
          billingPeriodStart: subscription.current_period_start,
          billingPeriodEnd: subscription.current_period_end
        }
      };

      return {
        success: true,
        stripeInvoice
      };

    } catch (error) {
      console.error('Error creating Stripe invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Stripe invoice'
      };
    }
  }

  /**
   * Create usage-only invoice in Stripe
   */
  private async createStripeUsageInvoice(
    customer: BillingCustomer,
    invoiceSummary: InvoiceSummary,
    options: InvoiceGenerationOptions
  ): Promise<{ success: boolean; stripeInvoice?: any; error?: string }> {
    try {
      // Simulate Stripe one-time invoice
      const stripeInvoice = {
        id: `in_usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customer: customer.stripe_customer_id,
        subscription: null,
        status: 'open',
        currency: invoiceSummary.currency,
        amount_due: invoiceSummary.total,
        amount_paid: 0,
        amount_remaining: invoiceSummary.total,
        subtotal: invoiceSummary.subtotal,
        tax: invoiceSummary.taxAmount,
        total: invoiceSummary.total,
        created: Math.floor(Date.now() / 1000),
        period_start: null,
        period_end: null,
        due_date: options.dueInDays ? Math.floor((Date.now() + options.dueInDays * 24 * 60 * 60 * 1000) / 1000) : null,
        description: options.description || 'Usage-based invoice',
        footer: options.footer,
        hosted_invoice_url: `https://invoice.stripe.com/i/acct_test_${Math.random().toString(36).substr(2, 9)}`,
        invoice_pdf: `https://pay.stripe.com/invoice/${Math.random().toString(36).substr(2, 9)}/pdf`,
        metadata: {
          type: 'usage_only',
          usageRecordCount: invoiceSummary.usageRecordIds.length
        }
      };

      return {
        success: true,
        stripeInvoice
      };

    } catch (error) {
      console.error('Error creating Stripe usage invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Stripe invoice'
      };
    }
  }

  /**
   * Store invoice in database
   */
  private async storeInvoice(
    stripeInvoice: any,
    subscription: BillingSubscription | null,
    customer: BillingCustomer,
    invoiceSummary: InvoiceSummary
  ): Promise<BillingInvoice> {
    const invoice: Omit<BillingInvoice, 'id' | 'created_at' | 'updated_at'> = {
      stripe_invoice_id: stripeInvoice.id,
      billing_customer_id: customer.id,
      billing_subscription_id: subscription?.id,
      invoice_number: null, // Stripe will generate this
      status: stripeInvoice.status as any,
      collection_method: 'charge_automatically',
      currency: stripeInvoice.currency,
      amount_due: stripeInvoice.amount_due,
      amount_paid: stripeInvoice.amount_paid,
      amount_remaining: stripeInvoice.amount_remaining,
      subtotal: stripeInvoice.subtotal,
      tax_amount: stripeInvoice.tax || 0,
      total: stripeInvoice.total,
      period_start: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000).toISOString() : null,
      period_end: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000).toISOString() : null,
      payment_intent_id: null,
      payment_method_id: null,
      created_at_stripe: new Date(stripeInvoice.created * 1000).toISOString(),
      due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString() : null,
      finalized_at: null,
      paid_at: null,
      voided_at: null,
      hosted_invoice_url: stripeInvoice.hosted_invoice_url,
      invoice_pdf_url: stripeInvoice.invoice_pdf,
      description: stripeInvoice.description,
      footer: stripeInvoice.footer,
      stripe_metadata: stripeInvoice.metadata || {},
      synced_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('billing_invoices')
      .insert(invoice)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store invoice: ${error.message}`);
    }

    return data as BillingInvoice;
  }

  /**
   * Validate invoice data before generation
   */
  private validateInvoiceData(
    invoiceSummary: InvoiceSummary,
    subscription: BillingSubscription | null,
    customer: BillingCustomer
  ): string[] {
    const errors: string[] = [];

    // Validate customer
    if (!customer.stripe_customer_id) {
      errors.push('Customer must have a Stripe customer ID');
    }

    // Validate subscription (if provided)
    if (subscription && !subscription.stripe_subscription_id) {
      errors.push('Subscription must have a Stripe subscription ID');
    }

    // Validate amounts
    if (invoiceSummary.total <= 0) {
      errors.push('Invoice total must be greater than zero');
    }

    if (invoiceSummary.lineItems.length === 0) {
      errors.push('Invoice must have at least one line item');
    }

    // Validate currency
    const supportedCurrencies = ['usd', 'eur', 'gbp', 'cad'];
    if (!supportedCurrencies.includes(invoiceSummary.currency.toLowerCase())) {
      errors.push(`Currency ${invoiceSummary.currency} is not supported`);
    }

    return errors;
  }

  /**
   * Mark usage records as invoiced
   */
  private async markUsageRecordsAsInvoiced(usageRecordIds: string[], invoiceId: string): Promise<void> {
    if (usageRecordIds.length === 0) return;

    const { error } = await supabase
      .from('billing_usage_records')
      .update({ 
        invoiced: true,
        invoice_id: invoiceId,
        updated_at: new Date().toISOString()
      })
      .in('id', usageRecordIds);

    if (error) {
      console.error('Failed to mark usage records as invoiced:', error);
      throw new Error(`Failed to mark usage records as invoiced: ${error.message}`);
    }
  }

  /**
   * Helper methods for data retrieval
   */
  private async getSubscription(subscriptionId: string): Promise<BillingSubscription | null> {
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }

    return data as BillingSubscription;
  }

  private async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    const { data, error } = await supabase
      .from('billing_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data as BillingCustomer;
  }

  private async getUsageRecordsForPeriod(
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<BillingUsageRecord[]> {
    const { data, error } = await supabase
      .from('billing_usage_records')
      .select('*')
      .eq('billing_subscription_id', subscriptionId)
      .gte('billing_period_start', periodStart)
      .lte('billing_period_end', periodEnd)
      .eq('invoiced', false);

    if (error) {
      console.error('Error fetching usage records:', error);
      return [];
    }

    return data as BillingUsageRecord[];
  }

  private async getUsageRecords(usageRecordIds: string[]): Promise<BillingUsageRecord[]> {
    const { data, error } = await supabase
      .from('billing_usage_records')
      .select('*')
      .in('id', usageRecordIds);

    if (error) {
      console.error('Error fetching usage records:', error);
      return [];
    }

    return data as BillingUsageRecord[];
  }

  private async calculateSubscriptionAmount(
    subscription: BillingSubscription,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    // Calculate base subscription amount based on plan
    const planPrices = {
      starter: 2500, // $25.00 in cents
      professional: 5000, // $50.00 in cents
      enterprise: 10000 // $100.00 in cents
    };

    const baseAmount = planPrices[subscription.pricing_plan as keyof typeof planPrices] || 0;

    // TODO: Add prorating logic if needed
    // For now, return full amount
    return baseAmount;
  }

  /**
   * Get product tax category based on processing type
   */
  private getProductTaxCategory(processingType: string): string {
    const categoryMap: Record<string, string> = {
      'qa_analysis': 'qa_analysis',
      'batch_processing': 'qa_analysis',
      'api_call': 'api_usage'
    };
    return categoryMap[processingType] || 'digital_services';
  }

  /**
   * Fallback tax rates for when the tax service is unavailable
   */
  private getFallbackTaxRate(country: string): number {
    const fallbackRates: Record<string, number> = {
      'US': 0.08, // 8% average US sales tax
      'GB': 0.20, // 20% UK VAT
      'DE': 0.19, // 19% German VAT
      'FR': 0.20, // 20% French VAT
      'CA': 0.13, // 13% HST Canada
      'AU': 0.10, // 10% Australian GST
      'NL': 0.21, // 21% Dutch VAT
      'IT': 0.22, // 22% Italian VAT
      'ES': 0.21, // 21% Spanish VAT
      'JP': 0.10, // 10% Japanese consumption tax
      'SG': 0.09  // 9% Singapore GST
    };
    
    return fallbackRates[country.toUpperCase()] || 0;
  }

  /**
   * Log tax calculation for audit purposes
   */
  private async logTaxCalculation(
    taxResult: TaxCalculationResult,
    customerId: string,
    invoiceId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_tax_calculation', {
        p_calculation_id: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        p_customer_id: customerId,
        p_customer_location: JSON.stringify({
          nexus_jurisdictions: taxResult.nexus_jurisdictions
        }),
        p_line_items: JSON.stringify(taxResult.line_item_taxes),
        p_total_tax_amount: taxResult.total_tax_amount,
        p_effective_tax_rate: taxResult.tax_rate,
        p_tax_details: JSON.stringify(taxResult.tax_details),
        p_invoice_id: invoiceId || null
      });

      if (error) {
        console.error('Failed to log tax calculation:', error);
      }
    } catch (error) {
      console.error('Error logging tax calculation:', error);
    }
  }

  /**
   * @deprecated Use the new tax calculation service instead
   */
  private getTaxRate(country: string): number {
    console.warn('getTaxRate is deprecated. Use tax calculation service instead.');
    return this.getFallbackTaxRate(country);
  }

  /**
   * Get invoice generation statistics
   */
  async getInvoiceStats(): Promise<{
    totalInvoices: number;
    openInvoices: number;
    paidInvoices: number;
    totalRevenue: number;
    lastGeneratedAt?: string;
  }> {
    try {
      // Total invoices
      const { count: totalCount } = await supabase
        .from('billing_invoices')
        .select('id', { count: 'exact' });

      // Open invoices
      const { count: openCount } = await supabase
        .from('billing_invoices')
        .select('id', { count: 'exact' })
        .eq('status', 'open');

      // Paid invoices
      const { count: paidCount } = await supabase
        .from('billing_invoices')
        .select('id', { count: 'exact' })
        .eq('status', 'paid');

      // Total revenue from paid invoices
      const { data: revenueData } = await supabase
        .from('billing_invoices')
        .select('total')
        .eq('status', 'paid');

      const totalRevenue = revenueData?.reduce((sum, invoice) => sum + invoice.total, 0) || 0;

      // Last generated invoice
      const { data: lastInvoice } = await supabase
        .from('billing_invoices')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalInvoices: totalCount || 0,
        openInvoices: openCount || 0,
        paidInvoices: paidCount || 0,
        totalRevenue: totalRevenue / 100, // Convert from cents to dollars
        lastGeneratedAt: lastInvoice?.created_at
      };

    } catch (error) {
      console.error('Error getting invoice stats:', error);
      return {
        totalInvoices: 0,
        openInvoices: 0,
        paidInvoices: 0,
        totalRevenue: 0
      };
    }
  }
}

// Export singleton instance
export const invoiceGenerator = new InvoiceGenerationService(); 