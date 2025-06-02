-- Receipt System Database Schema
-- This file contains the database tables needed for receipt handling and delivery

-- Create billing_receipts table for tracking payment receipts
CREATE TABLE IF NOT EXISTS public.billing_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
    billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    
    -- Receipt details
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'delivered', 'failed')),
    template_type TEXT DEFAULT 'basic' CHECK (template_type IN ('basic', 'detailed', 'tax_compliant', 'enterprise')),
    
    -- Financial information (from invoice, in cents)
    currency TEXT DEFAULT 'USD',
    amount_paid INTEGER NOT NULL,
    tax_amount INTEGER DEFAULT 0,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    
    -- Payment details
    payment_method_type TEXT,
    payment_method_last4 TEXT,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_intent_id TEXT,
    
    -- Generation tracking
    generated_at TIMESTAMP WITH TIME ZONE,
    generated_by UUID REFERENCES public.profiles(id),
    pdf_url TEXT,
    pdf_size_bytes INTEGER,
    
    -- Delivery tracking
    delivery_attempts INTEGER DEFAULT 0,
    last_delivery_attempt TIMESTAMP WITH TIME ZONE,
    delivery_error TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receipt_delivery_channels table for tracking delivery methods
CREATE TABLE IF NOT EXISTS public.receipt_delivery_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.billing_receipts(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'portal', 'api', 'webhook')),
    
    -- Channel configuration
    recipient TEXT, -- email address for email channel
    endpoint_url TEXT, -- for webhook channel
    
    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'bounced')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Response tracking
    response_code INTEGER,
    response_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receipt_templates table for managing receipt templates
CREATE TABLE IF NOT EXISTS public.receipt_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('basic', 'detailed', 'tax_compliant', 'enterprise')),
    version TEXT NOT NULL,
    
    -- Template content
    html_template TEXT NOT NULL,
    pdf_template TEXT,
    email_subject_template TEXT NOT NULL,
    email_body_template TEXT NOT NULL,
    
    -- Template variables
    required_variables JSONB DEFAULT '[]',
    optional_variables JSONB DEFAULT '[]',
    
    -- Configuration
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Branding
    logo_url TEXT,
    brand_colors JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    
    -- Ensure only one default template per type
    UNIQUE(type, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- Create receipt_audit_logs table for tracking receipt operations
CREATE TABLE IF NOT EXISTS public.receipt_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.billing_receipts(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('generated', 'delivered', 'failed', 'downloaded', 'resent')),
    performed_by UUID REFERENCES public.profiles(id), -- NULL for system actions
    details TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for billing_receipts
CREATE INDEX IF NOT EXISTS idx_billing_receipts_receipt_number ON public.billing_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_invoice_id ON public.billing_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_customer_id ON public.billing_receipts(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_status ON public.billing_receipts(status);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_payment_date ON public.billing_receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_generated_at ON public.billing_receipts(generated_at);
CREATE INDEX IF NOT EXISTS idx_billing_receipts_payment_intent ON public.billing_receipts(payment_intent_id);

-- Indexes for receipt_delivery_channels
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_receipt_id ON public.receipt_delivery_channels(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_type ON public.receipt_delivery_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_status ON public.receipt_delivery_channels(status);
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_delivered_at ON public.receipt_delivery_channels(delivered_at);
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_recipient ON public.receipt_delivery_channels(recipient);

-- Indexes for receipt_templates
CREATE INDEX IF NOT EXISTS idx_receipt_templates_type ON public.receipt_templates(type);
CREATE INDEX IF NOT EXISTS idx_receipt_templates_active ON public.receipt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_receipt_templates_default ON public.receipt_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_receipt_templates_name ON public.receipt_templates(name);

-- Indexes for receipt_audit_logs
CREATE INDEX IF NOT EXISTS idx_receipt_audit_logs_receipt_id ON public.receipt_audit_logs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_audit_logs_action ON public.receipt_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_receipt_audit_logs_performed_by ON public.receipt_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_receipt_audit_logs_created_at ON public.receipt_audit_logs(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_billing_receipts_customer_status_date ON public.billing_receipts(billing_customer_id, status, payment_date);
CREATE INDEX IF NOT EXISTS idx_receipt_delivery_channels_receipt_type_status ON public.receipt_delivery_channels(receipt_id, channel_type, status);
CREATE INDEX IF NOT EXISTS idx_receipt_templates_type_active_default ON public.receipt_templates(type, is_active, is_default);

-- Triggers for updated_at timestamps
CREATE TRIGGER billing_receipts_updated_at 
    BEFORE UPDATE ON public.billing_receipts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER receipt_delivery_channels_updated_at 
    BEFORE UPDATE ON public.receipt_delivery_channels
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER receipt_templates_updated_at 
    BEFORE UPDATE ON public.receipt_templates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    year_part TEXT;
    sequence_num INTEGER;
    receipt_number TEXT;
BEGIN
    -- Get current year
    year_part := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN receipt_number ~ ('^RCP-' || year_part || '-[0-9]+$')
            THEN CAST(SPLIT_PART(receipt_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO sequence_num
    FROM public.billing_receipts;
    
    -- Format: RCP-YYYY-NNNNNN (6 digits, zero-padded)
    receipt_number := 'RCP-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
    
    RETURN receipt_number;
END;
$$;

-- Function to ensure only one default template per type
CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If setting this template as default, unset all other defaults for this type
    IF NEW.is_default = TRUE THEN
        UPDATE public.receipt_templates 
        SET is_default = FALSE 
        WHERE type = NEW.type 
        AND id != NEW.id 
        AND is_default = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to maintain single default template per type
CREATE TRIGGER ensure_single_default_template_trigger
    BEFORE INSERT OR UPDATE ON public.receipt_templates
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_template();

-- Insert default basic template
INSERT INTO public.receipt_templates (
    name,
    type,
    version,
    html_template,
    email_subject_template,
    email_body_template,
    required_variables,
    optional_variables,
    is_active,
    is_default
) VALUES (
    'Basic Receipt Template',
    'basic',
    '1.0.0',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Receipt</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .details { margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #28a745; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Payment Receipt</h1>
        <p>Receipt #{{receipt_number}}</p>
    </div>
    <div class="details">
        <p><strong>Date:</strong> {{payment_date}}</p>
        <p><strong>Customer:</strong> {{customer_name}}</p>
        <p><strong>Email:</strong> {{customer_email}}</p>
        <p><strong>Amount Paid:</strong> <span class="amount">${{amount_paid}}</span></p>
        <p><strong>Payment Method:</strong> {{payment_method}}</p>
        <p><strong>Invoice:</strong> {{invoice_number}}</p>
    </div>
    <div class="footer">
        <p>Thank you for your payment!</p>
        <p>{{company_name}} - {{company_email}}</p>
    </div>
</body>
</html>',
    'Payment Receipt - {{receipt_number}}',
    'Dear {{customer_name}},

Thank you for your payment of ${{amount_paid}}. Your payment has been successfully processed.

Receipt Number: {{receipt_number}}
Payment Date: {{payment_date}}
Invoice: {{invoice_number}}

You can download your receipt from the link below or find it in your customer portal.

Best regards,
{{company_name}}',
    '["receipt_number", "payment_date", "customer_name", "customer_email", "amount_paid", "payment_method", "invoice_number", "company_name", "company_email"]'::jsonb,
    '["tax_amount", "subtotal", "payment_intent_id"]'::jsonb,
    TRUE,
    TRUE
) ON CONFLICT DO NOTHING; 