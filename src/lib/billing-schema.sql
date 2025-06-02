-- Billing System Database Schema for Stripe Integration
-- This file contains the database tables needed for payment processing

-- Create billing_customers table to link Stripe customers with our users/organizations
CREATE TABLE IF NOT EXISTS public.billing_customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Customer metadata
    email TEXT NOT NULL,
    name TEXT,
    description TEXT,
    
    -- Address information (synced from Stripe)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    
    -- Customer status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
    currency TEXT DEFAULT 'USD',
    
    -- Metadata
    stripe_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    
    -- Ensure either user_id or organization_id is set
    CONSTRAINT billing_customers_owner_check CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR 
        (user_id IS NULL AND organization_id IS NOT NULL)
    )
);

-- Create billing_subscriptions table for managing subscription states
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    
    -- Subscription details
    status TEXT NOT NULL CHECK (status IN (
        'incomplete', 'incomplete_expired', 'trialing', 'active', 
        'past_due', 'canceled', 'unpaid', 'paused'
    )),
    pricing_plan TEXT NOT NULL CHECK (pricing_plan IN ('starter', 'professional', 'enterprise')),
    
    -- Billing configuration
    collection_method TEXT DEFAULT 'charge_automatically' CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
    currency TEXT DEFAULT 'USD',
    
    -- Period information
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE,
    
    -- Trial information
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation information
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Metadata
    stripe_metadata JSONB DEFAULT '{}',
    application_fee_percent DECIMAL(5,2),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Create billing_payment_methods table for storing payment method information
CREATE TABLE IF NOT EXISTS public.billing_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_payment_method_id TEXT UNIQUE NOT NULL,
    billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    
    -- Payment method details
    type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'sepa_debit', 'ideal', 'sofort')),
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    
    -- Card-specific information (if applicable)
    card_brand TEXT, -- visa, mastercard, amex, etc.
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_funding TEXT, -- credit, debit, prepaid, unknown
    
    -- Address information
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_address_city TEXT,
    billing_address_state TEXT,
    billing_address_postal_code TEXT,
    billing_address_country TEXT,
    
    -- Metadata
    stripe_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Create billing_invoices table for invoice management
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    billing_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
    
    -- Invoice details
    invoice_number TEXT,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'open', 'paid', 'uncollectible', 'void', 'deleted'
    )),
    collection_method TEXT CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
    
    -- Financial information
    currency TEXT DEFAULT 'USD',
    amount_due INTEGER NOT NULL, -- in cents
    amount_paid INTEGER DEFAULT 0, -- in cents
    amount_remaining INTEGER DEFAULT 0, -- in cents
    subtotal INTEGER NOT NULL, -- in cents
    tax_amount INTEGER DEFAULT 0, -- in cents
    total INTEGER NOT NULL, -- in cents
    
    -- Period information
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Payment information
    payment_intent_id TEXT,
    payment_method_id TEXT,
    
    -- Important dates
    created_at_stripe TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    
    -- URLs and metadata
    hosted_invoice_url TEXT,
    invoice_pdf_url TEXT,
    description TEXT,
    footer TEXT,
    
    -- Metadata
    stripe_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create billing_usage_records table for tracking word processing usage
CREATE TABLE IF NOT EXISTS public.billing_usage_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    billing_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
    qa_session_id UUID REFERENCES public.qa_sessions(id) ON DELETE CASCADE,
    
    -- Usage details
    words_processed INTEGER NOT NULL,
    processing_type TEXT NOT NULL CHECK (processing_type IN ('qa_analysis', 'batch_processing', 'api_call')),
    
    -- Billing period this usage belongs to
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pricing information at time of processing
    price_per_word DECIMAL(10,6) NOT NULL, -- allows for very precise pricing
    total_cost DECIMAL(10,2) NOT NULL,
    
    -- Stripe usage record tracking
    stripe_usage_record_id TEXT,
    reported_to_stripe BOOLEAN DEFAULT FALSE,
    reported_at TIMESTAMP WITH TIME ZONE,
    
    -- Invoice tracking
    invoiced BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create billing_webhooks table for webhook event tracking
CREATE TABLE IF NOT EXISTS public.billing_webhooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    api_version TEXT,
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processing_attempts INTEGER DEFAULT 0,
    last_processing_attempt TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    -- Event data
    event_data JSONB NOT NULL,
    
    -- Audit fields
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for billing_customers
CREATE INDEX IF NOT EXISTS idx_billing_customers_stripe_id ON public.billing_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON public.billing_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_organization_id ON public.billing_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_email ON public.billing_customers(email);
CREATE INDEX IF NOT EXISTS idx_billing_customers_status ON public.billing_customers(status);

-- Indexes for billing_subscriptions
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe_id ON public.billing_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer_id ON public.billing_subscriptions(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_plan ON public.billing_subscriptions(pricing_plan);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end ON public.billing_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_trial_end ON public.billing_subscriptions(trial_end);

-- Indexes for billing_payment_methods
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_stripe_id ON public.billing_payment_methods(stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_customer_id ON public.billing_payment_methods(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_type ON public.billing_payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_default ON public.billing_payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_status ON public.billing_payment_methods(status);

-- Indexes for billing_invoices
CREATE INDEX IF NOT EXISTS idx_billing_invoices_stripe_id ON public.billing_invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_customer_id ON public.billing_invoices(billing_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_subscription_id ON public.billing_invoices(billing_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date ON public.billing_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_period ON public.billing_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_stripe ON public.billing_invoices(created_at_stripe);

-- Indexes for billing_usage_records
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_subscription_id ON public.billing_usage_records(billing_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_session_id ON public.billing_usage_records(qa_session_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_period ON public.billing_usage_records(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_type ON public.billing_usage_records(processing_type);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_stripe_reported ON public.billing_usage_records(reported_to_stripe, reported_at);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_invoiced ON public.billing_usage_records(invoiced);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_invoice_id ON public.billing_usage_records(invoice_id);

-- Indexes for billing_webhooks
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_stripe_event_id ON public.billing_webhooks(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_event_type ON public.billing_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_processed ON public.billing_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_billing_webhooks_received_at ON public.billing_webhooks(received_at);

-- Composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_billing_customers_user_status ON public.billing_customers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer_status ON public.billing_subscriptions(billing_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_usage_records_subscription_period ON public.billing_usage_records(billing_subscription_id, billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_customer_status_due ON public.billing_invoices(billing_customer_id, status, due_date);

-- Triggers for updated_at fields
CREATE TRIGGER billing_customers_updated_at 
    BEFORE UPDATE ON public.billing_customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER billing_subscriptions_updated_at 
    BEFORE UPDATE ON public.billing_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER billing_payment_methods_updated_at 
    BEFORE UPDATE ON public.billing_payment_methods
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER billing_invoices_updated_at 
    BEFORE UPDATE ON public.billing_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); 