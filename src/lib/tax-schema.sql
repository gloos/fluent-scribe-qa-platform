-- Tax Calculation System Database Schema
-- This file contains the database tables needed for comprehensive tax calculation

-- Create tax_rates table for storing jurisdiction-specific tax rates
CREATE TABLE IF NOT EXISTS public.tax_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jurisdiction TEXT NOT NULL,
    jurisdiction_type TEXT NOT NULL CHECK (jurisdiction_type IN ('country', 'state', 'province', 'city', 'postal_code')),
    tax_type TEXT NOT NULL CHECK (tax_type IN ('sales_tax', 'vat', 'gst', 'hst', 'local_tax')),
    rate DECIMAL(8,6) NOT NULL, -- e.g., 0.08 for 8%, supports up to 99.999999%
    
    -- Date ranges for tax rate validity
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE, -- NULL means no expiry
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Geographic specificity
    country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2 country code
    state_code TEXT, -- State/province code for sub-national jurisdictions
    city TEXT, -- City name for city-specific rates
    postal_codes TEXT[], -- Array of postal codes for postal-code-specific rates
    
    -- Tax rules and conditions
    applies_to_digital_services BOOLEAN DEFAULT TRUE,
    minimum_threshold INTEGER, -- Minimum amount in cents for tax to apply
    
    -- Metadata
    description TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'avalara', 'taxjar', 'external_api')),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tax_rates_positive_rate CHECK (rate >= 0 AND rate <= 1),
    CONSTRAINT tax_rates_state_check CHECK (
        (jurisdiction_type = 'state' AND state_code IS NOT NULL) OR 
        (jurisdiction_type != 'state')
    ),
    CONSTRAINT tax_rates_city_check CHECK (
        (jurisdiction_type = 'city' AND city IS NOT NULL) OR 
        (jurisdiction_type != 'city')
    ),
    CONSTRAINT tax_rates_postal_check CHECK (
        (jurisdiction_type = 'postal_code' AND postal_codes IS NOT NULL AND array_length(postal_codes, 1) > 0) OR 
        (jurisdiction_type != 'postal_code')
    )
);

-- Create tax_exemptions table for managing customer tax exemptions
CREATE TABLE IF NOT EXISTS public.tax_exemptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    
    -- Exemption details
    exemption_type TEXT NOT NULL CHECK (exemption_type IN ('tax_exempt_organization', 'reseller', 'government', 'education', 'other')),
    jurisdiction TEXT NOT NULL, -- Where exemption applies (country code, 'US-CA' for state, or '*' for global)
    
    -- Certificate information
    exemption_certificate TEXT, -- File path or URL to certificate
    certificate_number TEXT,
    
    -- Validity period
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE, -- NULL means no expiry
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Supporting documents
    documents JSONB DEFAULT '[]', -- Array of {url, type, uploaded_at} objects
    
    -- Verification tracking
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES public.profiles(id),
    verification_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_tax_categories table for managing product-specific tax classifications
CREATE TABLE IF NOT EXISTS public.product_tax_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Tax classification codes
    tax_code TEXT, -- Standard tax codes (e.g., Avalara tax codes)
    harmonized_code TEXT, -- HS codes for international classification
    
    -- Jurisdiction-specific rates (overrides general rates)
    jurisdiction_rates JSONB DEFAULT '[]', -- Array of {jurisdiction, rate, effective_date} objects
    
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tax_calculation_log table for audit trail and debugging
CREATE TABLE IF NOT EXISTS public.tax_calculation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    calculation_id TEXT NOT NULL, -- Unique identifier for this calculation
    customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
    
    -- Request details
    customer_location JSONB NOT NULL, -- {country, state, city, postal_code}
    line_items JSONB NOT NULL, -- Array of line items that were calculated
    
    -- Result details
    total_tax_amount INTEGER NOT NULL, -- in cents
    effective_tax_rate DECIMAL(8,6) NOT NULL,
    calculation_method TEXT DEFAULT 'database' CHECK (calculation_method IN ('database', 'external_api', 'hybrid')),
    
    -- Tax breakdown
    tax_details JSONB NOT NULL, -- Detailed breakdown of taxes applied
    exemptions_applied JSONB DEFAULT '[]', -- Array of exemptions that were applied
    
    -- Performance metrics
    calculation_duration_ms INTEGER,
    
    -- Audit fields
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL -- Link to invoice if applied
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tax_rates_country_active ON public.tax_rates(country_code, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction_type ON public.tax_rates(jurisdiction_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_effective_date ON public.tax_rates(effective_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tax_rates_state ON public.tax_rates(country_code, state_code) WHERE state_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tax_exemptions_customer ON public.tax_exemptions(customer_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tax_exemptions_valid_period ON public.tax_exemptions(valid_from, valid_until) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_product_tax_categories_active ON public.product_tax_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_tax_categories_name ON public.product_tax_categories(category_name) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tax_calculation_log_customer ON public.tax_calculation_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculation_log_date ON public.tax_calculation_log(calculated_at);
CREATE INDEX IF NOT EXISTS idx_tax_calculation_log_invoice ON public.tax_calculation_log(invoice_id) WHERE invoice_id IS NOT NULL;

-- Create updated_at triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_rates_updated_at BEFORE UPDATE ON public.tax_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tax_exemptions_updated_at BEFORE UPDATE ON public.tax_exemptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER product_tax_categories_updated_at BEFORE UPDATE ON public.product_tax_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on tax tables
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_calculation_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tax_rates (read-only for authenticated users, admin-only write)
CREATE POLICY "Public read access to tax rates" ON public.tax_rates
    FOR SELECT USING (true);

CREATE POLICY "Admin full access to tax rates" ON public.tax_rates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role_name = 'admin'
        )
    );

-- Create RLS policies for tax_exemptions (customers can view their own, admins can manage all)
CREATE POLICY "Customers can view their own tax exemptions" ON public.tax_exemptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.billing_customers bc
            JOIN public.profiles p ON (bc.user_id = p.id OR bc.organization_id IN (
                SELECT organization_id FROM public.organization_members WHERE user_id = p.id
            ))
            WHERE bc.id = customer_id AND p.id = auth.uid()
        )
    );

CREATE POLICY "Admin full access to tax exemptions" ON public.tax_exemptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role_name = 'admin'
        )
    );

-- Create RLS policies for product_tax_categories (read-only for authenticated users, admin-only write)
CREATE POLICY "Public read access to product tax categories" ON public.product_tax_categories
    FOR SELECT USING (true);

CREATE POLICY "Admin full access to product tax categories" ON public.product_tax_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role_name = 'admin'
        )
    );

-- Create RLS policies for tax_calculation_log (customers can view their own, admins can view all)
CREATE POLICY "Customers can view their own tax calculations" ON public.tax_calculation_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.billing_customers bc
            JOIN public.profiles p ON (bc.user_id = p.id OR bc.organization_id IN (
                SELECT organization_id FROM public.organization_members WHERE user_id = p.id
            ))
            WHERE bc.id = customer_id AND p.id = auth.uid()
        )
    );

CREATE POLICY "Admin full access to tax calculation log" ON public.tax_calculation_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role_name = 'admin'
        )
    );

-- Insert initial tax rate data for common jurisdictions
INSERT INTO public.tax_rates (jurisdiction, jurisdiction_type, tax_type, rate, effective_date, country_code, applies_to_digital_services, description, source) VALUES
    -- United States
    ('United States', 'country', 'sales_tax', 0.00, '2024-01-01T00:00:00Z', 'US', true, 'US Federal - No federal sales tax', 'manual'),
    
    -- Major US states
    ('California', 'state', 'sales_tax', 0.0725, '2024-01-01T00:00:00Z', 'US', true, 'California State Sales Tax', 'manual'),
    ('Texas', 'state', 'sales_tax', 0.0625, '2024-01-01T00:00:00Z', 'US', true, 'Texas State Sales Tax', 'manual'),
    ('New York', 'state', 'sales_tax', 0.08, '2024-01-01T00:00:00Z', 'US', true, 'New York State Sales Tax', 'manual'),
    ('Florida', 'state', 'sales_tax', 0.06, '2024-01-01T00:00:00Z', 'US', true, 'Florida State Sales Tax', 'manual'),
    
    -- European Union - VAT
    ('Germany', 'country', 'vat', 0.19, '2024-01-01T00:00:00Z', 'DE', true, 'German VAT (Mehrwertsteuer)', 'manual'),
    ('United Kingdom', 'country', 'vat', 0.20, '2024-01-01T00:00:00Z', 'GB', true, 'UK VAT', 'manual'),
    ('France', 'country', 'vat', 0.20, '2024-01-01T00:00:00Z', 'FR', true, 'French VAT (TVA)', 'manual'),
    ('Netherlands', 'country', 'vat', 0.21, '2024-01-01T00:00:00Z', 'NL', true, 'Dutch VAT (BTW)', 'manual'),
    ('Italy', 'country', 'vat', 0.22, '2024-01-01T00:00:00Z', 'IT', true, 'Italian VAT (IVA)', 'manual'),
    ('Spain', 'country', 'vat', 0.21, '2024-01-01T00:00:00Z', 'ES', true, 'Spanish VAT (IVA)', 'manual'),
    
    -- Canada - GST/HST
    ('Canada', 'country', 'gst', 0.05, '2024-01-01T00:00:00Z', 'CA', true, 'Canadian GST', 'manual'),
    ('Ontario', 'state', 'hst', 0.13, '2024-01-01T00:00:00Z', 'CA', true, 'Ontario HST', 'manual'),
    ('Quebec', 'state', 'gst', 0.09975, '2024-01-01T00:00:00Z', 'CA', true, 'Quebec GST + QST combined', 'manual'),
    
    -- Australia
    ('Australia', 'country', 'gst', 0.10, '2024-01-01T00:00:00Z', 'AU', true, 'Australian GST', 'manual'),
    
    -- Other major markets
    ('Japan', 'country', 'vat', 0.10, '2024-01-01T00:00:00Z', 'JP', true, 'Japanese Consumption Tax', 'manual'),
    ('Singapore', 'country', 'gst', 0.09, '2024-01-01T00:00:00Z', 'SG', true, 'Singapore GST', 'manual')
ON CONFLICT (jurisdiction, jurisdiction_type, tax_type, country_code, state_code) DO NOTHING;

-- Insert initial product tax categories
INSERT INTO public.product_tax_categories (category_name, description, tax_code) VALUES
    ('digital_services', 'Software as a Service and digital service offerings', 'SaaS'),
    ('qa_analysis', 'Quality assurance and document analysis services', 'QA'),
    ('api_usage', 'API consumption and programmatic access', 'API'),
    ('storage_services', 'Data storage and file management services', 'STORAGE'),
    ('consulting_services', 'Professional consulting and advisory services', 'CONSULT')
ON CONFLICT (category_name) DO NOTHING;

-- Create a view for easy tax calculation queries
CREATE OR REPLACE VIEW public.active_tax_rates AS
SELECT 
    tr.*,
    CASE 
        WHEN tr.jurisdiction_type = 'country' THEN 1
        WHEN tr.jurisdiction_type = 'state' THEN 2
        WHEN tr.jurisdiction_type = 'city' THEN 3
        WHEN tr.jurisdiction_type = 'postal_code' THEN 4
        ELSE 5
    END as priority_order
FROM public.tax_rates tr
WHERE tr.is_active = TRUE
    AND tr.effective_date <= NOW()
    AND (tr.expiry_date IS NULL OR tr.expiry_date > NOW())
ORDER BY priority_order DESC, tr.rate DESC;

-- Create a function to get effective tax rate for a location
CREATE OR REPLACE FUNCTION public.get_effective_tax_rate(
    p_country_code TEXT,
    p_state_code TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_postal_code TEXT DEFAULT NULL
) RETURNS DECIMAL(8,6) AS $$
DECLARE
    effective_rate DECIMAL(8,6) := 0;
BEGIN
    SELECT COALESCE(SUM(rate), 0) INTO effective_rate
    FROM public.active_tax_rates
    WHERE country_code = UPPER(p_country_code)
        AND applies_to_digital_services = TRUE
        AND (
            jurisdiction_type = 'country'
            OR (jurisdiction_type = 'state' AND state_code = UPPER(p_state_code))
            OR (jurisdiction_type = 'city' AND LOWER(city) = LOWER(p_city))
            OR (jurisdiction_type = 'postal_code' AND p_postal_code = ANY(postal_codes))
        );
    
    RETURN effective_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to log tax calculations
CREATE OR REPLACE FUNCTION public.log_tax_calculation(
    p_calculation_id TEXT,
    p_customer_id UUID,
    p_customer_location JSONB,
    p_line_items JSONB,
    p_total_tax_amount INTEGER,
    p_effective_tax_rate DECIMAL(8,6),
    p_tax_details JSONB,
    p_calculation_duration_ms INTEGER DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.tax_calculation_log (
        calculation_id,
        customer_id,
        customer_location,
        line_items,
        total_tax_amount,
        effective_tax_rate,
        tax_details,
        calculation_duration_ms,
        invoice_id
    ) VALUES (
        p_calculation_id,
        p_customer_id,
        p_customer_location,
        p_line_items,
        p_total_tax_amount,
        p_effective_tax_rate,
        p_tax_details,
        p_calculation_duration_ms,
        p_invoice_id
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 