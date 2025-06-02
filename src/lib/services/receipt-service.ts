import { createClient } from '@supabase/supabase-js';
import type { 
  BillingInvoice, 
  BillingCustomer,
  BillingPaymentMethod 
} from '@/lib/types/billing';
import type {
  PaymentReceipt,
  ReceiptDeliveryChannel,
  ReceiptTemplate,
  ReceiptGenerationOptions,
  ReceiptDeliveryOptions,
  ReceiptGenerationResult,
  ReceiptDeliveryResult,
  ReceiptData,
  ReceiptListItem,
  ReceiptAuditLog
} from '@/lib/types/receipt';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export class ReceiptService {
  private static instance: ReceiptService;
  
  // Company information - in production this would come from configuration
  private readonly companyInfo = {
    name: 'Fluent Scribe QA Platform',
    address: {
      line1: '123 Business Ave',
      line2: 'Suite 100',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94105',
      country: 'US'
    },
    email: 'billing@fluentscribe.com',
    phone: '+1 (555) 123-4567',
    website: 'https://fluentscribe.com',
    tax_id: 'US-123456789'
  };

  private constructor() {}

  public static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService();
    }
    return ReceiptService.instance;
  }

  /**
   * Generate a payment receipt for an invoice
   */
  async generateReceipt(
    invoiceId: string,
    options: ReceiptGenerationOptions = {}
  ): Promise<ReceiptGenerationResult> {
    try {
      // Get invoice and validate it's paid
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: {
            code: 'invoice_not_found',
            message: 'Invoice not found',
            type: 'data_error'
          }
        };
      }

      if (invoice.status !== 'paid' || invoice.amount_remaining > 0) {
        return {
          success: false,
          error: {
            code: 'invoice_not_paid',
            message: 'Invoice has not been fully paid',
            type: 'data_error'
          }
        };
      }

      // Check if receipt already exists
      const existingReceipt = await this.getReceiptByInvoiceIdPrivate(invoiceId);
      if (existingReceipt && !options.immediate_delivery) {
        return {
          success: true,
          receipt: existingReceipt,
          pdf_url: existingReceipt.pdf_url
        };
      }

      // Get customer and payment method data
      const customer = await this.getCustomer(invoice.billing_customer_id);
      if (!customer) {
        return {
          success: false,
          error: {
            code: 'customer_not_found',
            message: 'Customer not found',
            type: 'data_error'
          }
        };
      }

      const paymentMethod = invoice.payment_method_id 
        ? await this.getPaymentMethod(invoice.payment_method_id)
        : undefined;

      // Generate receipt number
      const receiptNumber = await this.generateReceiptNumber();

      // Create receipt record
      const receipt: Omit<PaymentReceipt, 'id' | 'created_at' | 'updated_at'> = {
        receipt_number: receiptNumber,
        invoice_id: invoiceId,
        billing_customer_id: invoice.billing_customer_id,
        status: 'pending',
        template_type: options.template_type || 'basic',
        currency: invoice.currency,
        amount_paid: invoice.amount_paid,
        tax_amount: invoice.tax_amount,
        subtotal: invoice.subtotal,
        total: invoice.total,
        payment_method_type: paymentMethod?.type || 'unknown',
        payment_method_last4: paymentMethod?.card_last4,
        payment_date: invoice.paid_at || new Date().toISOString(),
        payment_intent_id: invoice.payment_intent_id,
        delivery_channels: [],
        delivery_attempts: 0,
        metadata: options.custom_variables || {}
      };

      // Store receipt in database
      const storedReceipt = await this.storeReceipt(receipt);
      if (!storedReceipt) {
        return {
          success: false,
          error: {
            code: 'storage_failed',
            message: 'Failed to store receipt',
            type: 'generation_error'
          }
        };
      }

      // Generate PDF
      const pdfResult = await this.generateReceiptPDF(storedReceipt, customer, invoice, paymentMethod);
      if (!pdfResult.success) {
        return {
          success: false,
          error: pdfResult.error
        };
      }

      // Update receipt with PDF URL and mark as generated
      const updatedReceipt = await this.updateReceiptStatus(storedReceipt.id, 'generated', {
        pdf_url: pdfResult.pdf_url,
        pdf_size_bytes: pdfResult.pdf_size_bytes,
        generated_at: new Date().toISOString()
      });

      // Log audit event
      await this.logReceiptAction(storedReceipt.id, 'generated', 'system');

      // Set up delivery channels if specified
      if (options.delivery_channels && options.delivery_channels.length > 0) {
        await this.setupDeliveryChannels(updatedReceipt.id, options.delivery_channels, customer);
        
        if (options.immediate_delivery) {
          await this.deliverReceipt(updatedReceipt.id, {});
        }
      }

      return {
        success: true,
        receipt: updatedReceipt,
        pdf_url: pdfResult.pdf_url
      };

    } catch (error) {
      console.error('Error generating receipt:', error);
      return {
        success: false,
        error: {
          code: 'generation_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'generation_error'
        }
      };
    }
  }

  /**
   * Deliver a receipt via configured channels
   */
  async deliverReceipt(
    receiptId: string,
    options: ReceiptDeliveryOptions = {}
  ): Promise<ReceiptDeliveryResult> {
    try {
      const receipt = await this.getReceipt(receiptId);
      if (!receipt) {
        return {
          success: false,
          error: {
            code: 'receipt_not_found',
            message: 'Receipt not found',
            type: 'validation_error',
            channel: 'unknown'
          }
        };
      }

      if (receipt.status !== 'generated') {
        return {
          success: false,
          error: {
            code: 'receipt_not_ready',
            message: 'Receipt has not been generated yet',
            type: 'validation_error',
            channel: 'unknown'
          }
        };
      }

      // Get delivery channels
      const deliveryChannels = await this.getDeliveryChannels(receiptId);
      if (deliveryChannels.length === 0) {
        return {
          success: false,
          error: {
            code: 'no_delivery_channels',
            message: 'No delivery channels configured',
            type: 'validation_error',
            channel: 'unknown'
          }
        };
      }

      let allSuccessful = true;
      let lastError: any = null;

      // Attempt delivery on each channel
      for (const channel of deliveryChannels) {
        const result = await this.deliverViaChannel(receipt, channel, options);
        if (!result.success) {
          allSuccessful = false;
          lastError = result.error;
        }
      }

      // Update receipt status based on delivery results
      if (allSuccessful) {
        await this.updateReceiptStatus(receiptId, 'delivered');
        await this.logReceiptAction(receiptId, 'delivered', 'system');
      } else {
        await this.updateReceiptStatus(receiptId, 'failed', {
          delivery_error: lastError?.message || 'Delivery failed'
        });
        await this.logReceiptAction(receiptId, 'failed', 'system', lastError?.message);
      }

      return {
        success: allSuccessful,
        delivered_at: allSuccessful ? new Date().toISOString() : undefined,
        error: allSuccessful ? undefined : lastError
      };

    } catch (error) {
      console.error('Error delivering receipt:', error);
      return {
        success: false,
        error: {
          code: 'delivery_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'network_error',
          channel: 'unknown'
        }
      };
    }
  }

  /**
   * Get receipts for a customer
   */
  async getCustomerReceipts(
    customerId: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<ReceiptListItem[]> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .select(`
          id,
          receipt_number,
          payment_date,
          amount_paid,
          currency,
          status,
          pdf_url,
          billing_invoices(invoice_number)
        `)
        .eq('billing_customer_id', customerId)
        .eq('status', options.status || 'delivered')
        .order('payment_date', { ascending: false })
        .range(options.offset || 0, (options.offset || 0) + (options.limit || 20) - 1);

      if (error) throw error;

      return (data || []).map(receipt => ({
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        invoice_number: (receipt.billing_invoices as any)?.[0]?.invoice_number,
        payment_date: receipt.payment_date,
        amount_paid: receipt.amount_paid,
        currency: receipt.currency,
        status: receipt.status as PaymentReceipt['status'],
        pdf_url: receipt.pdf_url,
        can_download: !!receipt.pdf_url && receipt.status === 'delivered'
      }));

    } catch (error) {
      console.error('Error getting customer receipts:', error);
      return [];
    }
  }

  /**
   * Get receipt by invoice ID - Public method for API use
   */
  async getReceiptByInvoiceId(invoiceId: string): Promise<PaymentReceipt | null> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      // Receipt not found is expected in many cases
      return null;
    }
  }

  /**
   * Resend a receipt
   */
  async resendReceipt(receiptId: string, userId?: string): Promise<ReceiptDeliveryResult> {
    await this.logReceiptAction(receiptId, 'resent', userId || 'system');
    return this.deliverReceipt(receiptId, {});
  }

  /**
   * Private helper methods
   */
  private async getInvoice(invoiceId: string): Promise<BillingInvoice | null> {
    try {
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting invoice:', error);
      return null;
    }
  }

  private async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    try {
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting customer:', error);
      return null;
    }
  }

  private async getPaymentMethod(paymentMethodId: string): Promise<BillingPaymentMethod | null> {
    try {
      const { data, error } = await supabase
        .from('billing_payment_methods')
        .select('*')
        .eq('stripe_payment_method_id', paymentMethodId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting payment method:', error);
      return null;
    }
  }

  private async getReceipt(receiptId: string): Promise<PaymentReceipt | null> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting receipt:', error);
      return null;
    }
  }

  private async generateReceiptNumber(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('generate_receipt_number');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to timestamp-based number
      return `RCP-${new Date().getFullYear()}-${Date.now()}`;
    }
  }

  private async storeReceipt(receipt: Omit<PaymentReceipt, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentReceipt | null> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .insert(receipt)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error storing receipt:', error);
      return null;
    }
  }

  private async updateReceiptStatus(
    receiptId: string, 
    status: PaymentReceipt['status'],
    additionalData: Partial<PaymentReceipt> = {}
  ): Promise<PaymentReceipt> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .update({ status, ...additionalData })
        .eq('id', receiptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating receipt status:', error);
      throw error;
    }
  }

  private async generateReceiptPDF(
    receipt: PaymentReceipt,
    customer: BillingCustomer,
    invoice: BillingInvoice,
    paymentMethod?: BillingPaymentMethod
  ): Promise<{ success: boolean; pdf_url?: string; pdf_size_bytes?: number; error?: any }> {
    try {
      // Get receipt template
      const template = await this.getReceiptTemplate(receipt.template_type);
      if (!template) {
        return {
          success: false,
          error: {
            code: 'template_not_found',
            message: 'Receipt template not found',
            type: 'template_error'
          }
        };
      }

      // Prepare template data
      const receiptData = await this.prepareReceiptData(receipt, customer, invoice, paymentMethod);
      
      // Render HTML
      const renderedHtml = this.renderTemplate(template.html_template, receiptData);
      
      // For now, simulate PDF generation
      // In production, this would use a service like Puppeteer or a PDF API
      const simulatedPdfUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/receipts/${receipt.id}.pdf`;
      const simulatedSize = renderedHtml.length * 2; // Rough estimate

      console.log('PDF generation simulated for receipt:', receipt.receipt_number);
      console.log('PDF URL would be:', simulatedPdfUrl);

      return {
        success: true,
        pdf_url: simulatedPdfUrl,
        pdf_size_bytes: simulatedSize
      };

    } catch (error) {
      console.error('Error generating PDF:', error);
      return {
        success: false,
        error: {
          code: 'pdf_generation_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'generation_error'
        }
      };
    }
  }

  private async getReceiptTemplate(templateType: string): Promise<ReceiptTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('receipt_templates')
        .select('*')
        .eq('type', templateType)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting receipt template:', error);
      return null;
    }
  }

  private async prepareReceiptData(
    receipt: PaymentReceipt,
    customer: BillingCustomer,
    invoice: BillingInvoice,
    paymentMethod?: BillingPaymentMethod
  ): Promise<Record<string, any>> {
    const formatCurrency = (amount: number, currency: string) => {
      return (amount / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
      });
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    return {
      receipt_number: receipt.receipt_number,
      payment_date: formatDate(receipt.payment_date),
      customer_name: customer.name || customer.email,
      customer_email: customer.email,
      amount_paid: formatCurrency(receipt.amount_paid, receipt.currency),
      tax_amount: formatCurrency(receipt.tax_amount, receipt.currency),
      subtotal: formatCurrency(receipt.subtotal, receipt.currency),
      total: formatCurrency(receipt.total, receipt.currency),
      payment_method: this.formatPaymentMethod(paymentMethod),
      invoice_number: invoice.invoice_number || invoice.stripe_invoice_id,
      payment_intent_id: receipt.payment_intent_id,
      company_name: this.companyInfo.name,
      company_email: this.companyInfo.email,
      company_address_line1: this.companyInfo.address.line1,
      company_address_line2: this.companyInfo.address.line2,
      company_city: this.companyInfo.address.city,
      company_state: this.companyInfo.address.state,
      company_postal_code: this.companyInfo.address.postal_code,
      company_country: this.companyInfo.address.country,
      company_phone: this.companyInfo.phone,
      company_website: this.companyInfo.website,
      company_tax_id: this.companyInfo.tax_id
    };
  }

  private formatPaymentMethod(paymentMethod?: BillingPaymentMethod): string {
    if (!paymentMethod) return 'Unknown';
    
    if (paymentMethod.type === 'card') {
      const brand = paymentMethod.card_brand?.toUpperCase() || 'CARD';
      const last4 = paymentMethod.card_last4 || '****';
      return `${brand} ending in ${last4}`;
    }
    
    return paymentMethod.type.toUpperCase();
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    // Simple template variable replacement
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value || ''));
    }
    
    return rendered;
  }

  private async setupDeliveryChannels(
    receiptId: string,
    channels: ('email' | 'portal' | 'api')[],
    customer: BillingCustomer
  ): Promise<void> {
    const deliveryChannels = channels.map(channelType => ({
      receipt_id: receiptId,
      channel_type: channelType,
      recipient: channelType === 'email' ? customer.email : undefined,
      status: 'pending' as const,
      delivery_attempts: 0,
      metadata: {}
    }));

    try {
      const { error } = await supabase
        .from('receipt_delivery_channels')
        .insert(deliveryChannels);

      if (error) throw error;
    } catch (error) {
      console.error('Error setting up delivery channels:', error);
      throw error;
    }
  }

  private async getDeliveryChannels(receiptId: string): Promise<ReceiptDeliveryChannel[]> {
    try {
      const { data, error } = await supabase
        .from('receipt_delivery_channels')
        .select('*')
        .eq('receipt_id', receiptId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting delivery channels:', error);
      return [];
    }
  }

  private async deliverViaChannel(
    receipt: PaymentReceipt,
    channel: ReceiptDeliveryChannel,
    options: ReceiptDeliveryOptions
  ): Promise<{ success: boolean; error?: any }> {
    try {
      // Update delivery attempt
      await this.updateDeliveryChannel(channel.id, {
        delivery_attempts: channel.delivery_attempts + 1,
        last_attempt_at: new Date().toISOString()
      });

      switch (channel.channel_type) {
        case 'email':
          return await this.deliverViaEmail(receipt, channel, options);
        case 'portal':
          return await this.deliverViaPortal(receipt, channel);
        case 'api':
          return await this.deliverViaAPI(receipt, channel);
        default:
          return {
            success: false,
            error: {
              code: 'unsupported_channel',
              message: `Unsupported delivery channel: ${channel.channel_type}`,
              type: 'validation_error',
              channel: channel.channel_type
            }
          };
      }
    } catch (error) {
      console.error(`Error delivering via ${channel.channel_type}:`, error);
      return {
        success: false,
        error: {
          code: 'delivery_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'network_error',
          channel: channel.channel_type
        }
      };
    }
  }

  private async deliverViaEmail(
    receipt: PaymentReceipt,
    channel: ReceiptDeliveryChannel,
    options: ReceiptDeliveryOptions
  ): Promise<{ success: boolean; error?: any }> {
    try {
      // For now, simulate email delivery
      // In production, this would integrate with an email service like SendGrid, AWS SES, etc.
      console.log(`Simulating email delivery to ${channel.recipient}`);
      console.log(`Subject: Payment Receipt - ${receipt.receipt_number}`);
      console.log(`PDF URL: ${receipt.pdf_url}`);

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update delivery channel as successful
      await this.updateDeliveryChannel(channel.id, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        response_code: 200,
        response_message: 'Email sent successfully'
      });

      return { success: true };

    } catch (error) {
      await this.updateDeliveryChannel(channel.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: {
          code: 'email_failed',
          message: error instanceof Error ? error.message : 'Email delivery failed',
          type: 'email_error',
          channel: 'email',
          recipient: channel.recipient
        }
      };
    }
  }

  private async deliverViaPortal(
    receipt: PaymentReceipt,
    channel: ReceiptDeliveryChannel
  ): Promise<{ success: boolean; error?: any }> {
    try {
      // Portal delivery is automatic - receipt is available when generated
      await this.updateDeliveryChannel(channel.id, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        response_message: 'Available in customer portal'
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'portal_failed',
          message: error instanceof Error ? error.message : 'Portal delivery failed',
          type: 'network_error',
          channel: 'portal'
        }
      };
    }
  }

  private async deliverViaAPI(
    receipt: PaymentReceipt,
    channel: ReceiptDeliveryChannel
  ): Promise<{ success: boolean; error?: any }> {
    try {
      // API delivery - receipt is accessible via API endpoints
      await this.updateDeliveryChannel(channel.id, {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        response_message: 'Available via API'
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'api_failed',
          message: error instanceof Error ? error.message : 'API delivery failed',
          type: 'network_error',
          channel: 'api'
        }
      };
    }
  }

  private async updateDeliveryChannel(
    channelId: string,
    updates: Partial<ReceiptDeliveryChannel>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('receipt_delivery_channels')
        .update(updates)
        .eq('id', channelId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating delivery channel:', error);
      throw error;
    }
  }

  private async logReceiptAction(
    receiptId: string,
    action: ReceiptAuditLog['action'],
    performedBy?: string,
    details?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('receipt_audit_logs')
        .insert({
          receipt_id: receiptId,
          action,
          performed_by: performedBy,
          details,
          metadata: {}
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging receipt action:', error);
      // Don't throw - audit logging failure shouldn't break the main flow
    }
  }

  private async getReceiptByInvoiceIdPrivate(invoiceId: string): Promise<PaymentReceipt | null> {
    try {
      const { data, error } = await supabase
        .from('billing_receipts')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      // Receipt not found is expected in many cases
      return null;
    }
  }
} 