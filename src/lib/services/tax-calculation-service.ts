import { supabase } from '../supabase';

// Tax calculation interfaces
export interface TaxRateData {
  id: string;
  jurisdiction: string;
  jurisdiction_type: 'country' | 'state' | 'province' | 'city' | 'postal_code';
  tax_type: 'sales_tax' | 'vat' | 'gst' | 'hst' | 'local_tax';
  rate: number; // decimal (e.g., 0.08 for 8%)
  effective_date: string;
  expiry_date?: string;
  is_active: boolean;
  
  // Geographic specificity
  country_code: string;
  state_code?: string;
  city?: string;
  postal_codes?: string[]; // For postal code specific rates
  
  // Tax rules
  applies_to_digital_services: boolean;
  minimum_threshold?: number; // Minimum amount for tax to apply
  
  // Metadata
  description?: string;
  source?: string; // 'manual' | 'avalara' | 'taxjar' | 'external_api'
  created_at: string;
  updated_at: string;
}

export interface TaxExemption {
  id: string;
  customer_id: string;
  exemption_type: 'tax_exempt_organization' | 'reseller' | 'government' | 'education' | 'other';
  jurisdiction: string; // Where exemption applies
  exemption_certificate?: string;
  certificate_number?: string;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  
  // Supporting documents
  documents?: {
    url: string;
    type: string;
    uploaded_at: string;
  }[];
  
  created_at: string;
  updated_at: string;
  verified_at?: string;
  verified_by?: string;
}

export interface ProductTaxCategory {
  id: string;
  category_name: string;
  description?: string;
  
  // Tax classification codes
  tax_code?: string; // Standard tax codes (e.g., Avalara tax codes)
  harmonized_code?: string; // HS codes for international
  
  // Jurisdiction-specific rates (overrides general rates)
  jurisdiction_rates?: {
    jurisdiction: string;
    rate: number;
    effective_date: string;
  }[];
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxCalculationRequest {
  // Customer information
  customer_id: string;
  customer_country: string;
  customer_state?: string;
  customer_city?: string;
  customer_postal_code?: string;
  
  // Line items to calculate tax for
  line_items: {
    id: string;
    description: string;
    amount: number; // in cents
    quantity: number;
    product_tax_category?: string; // Reference to ProductTaxCategory
  }[];
  
  // Transaction details
  transaction_date?: string;
  currency: string;
  
  // Business logic
  is_business_customer?: boolean;
  exemption_certificate?: string;
}

export interface TaxCalculationResult {
  success: boolean;
  error?: string;
  
  // Tax breakdown
  total_tax_amount: number; // in cents
  tax_rate: number; // effective combined rate
  
  // Detailed breakdown
  tax_details: {
    jurisdiction: string;
    tax_type: string;
    rate: number;
    amount: number; // in cents
    description: string;
  }[];
  
  // Line item breakdown
  line_item_taxes: {
    line_item_id: string;
    tax_amount: number;
    tax_rate: number;
    exempt: boolean;
    exemption_reason?: string;
  }[];
  
  // Compliance information
  nexus_jurisdictions: string[];
  calculation_method: 'database' | 'external_api' | 'hybrid';
  calculated_at: string;
}

export class TaxCalculationService {
  private cache = new Map<string, TaxCalculationResult>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    // Initialize tax service
  }

  /**
   * Calculate tax for a given request
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached.calculated_at)) {
        return cached;
      }

      // Check for tax exemptions first
      const exemptions = await this.getCustomerExemptions(
        request.customer_id, 
        request.customer_country,
        request.customer_state
      );

      // Get applicable tax rates
      const applicableRates = await this.getApplicableTaxRates(
        request.customer_country,
        request.customer_state,
        request.customer_city,
        request.customer_postal_code
      );

      if (applicableRates.length === 0) {
        return {
          success: true,
          total_tax_amount: 0,
          tax_rate: 0,
          tax_details: [],
          line_item_taxes: request.line_items.map(item => ({
            line_item_id: item.id,
            tax_amount: 0,
            tax_rate: 0,
            exempt: false
          })),
          nexus_jurisdictions: [],
          calculation_method: 'database',
          calculated_at: new Date().toISOString()
        };
      }

      // Calculate tax for each line item
      const lineItemTaxes = await Promise.all(
        request.line_items.map(item => 
          this.calculateLineItemTax(item, applicableRates, exemptions)
        )
      );

      // Aggregate tax details
      const taxDetailsMap = new Map<string, any>();
      let totalTaxAmount = 0;

      lineItemTaxes.forEach(lineItemTax => {
        totalTaxAmount += lineItemTax.tax_amount;
        
        lineItemTax.tax_breakdown?.forEach(breakdown => {
          const key = `${breakdown.jurisdiction}-${breakdown.tax_type}`;
          if (taxDetailsMap.has(key)) {
            taxDetailsMap.get(key).amount += breakdown.amount;
          } else {
            taxDetailsMap.set(key, { ...breakdown });
          }
        });
      });

      const taxDetails = Array.from(taxDetailsMap.values());
      const subtotal = request.line_items.reduce((sum, item) => sum + item.amount, 0);
      const effectiveRate = subtotal > 0 ? totalTaxAmount / subtotal : 0;

      const result: TaxCalculationResult = {
        success: true,
        total_tax_amount: totalTaxAmount,
        tax_rate: effectiveRate,
        tax_details: taxDetails,
        line_item_taxes: lineItemTaxes.map(item => ({
          line_item_id: item.line_item_id,
          tax_amount: item.tax_amount,
          tax_rate: item.tax_rate,
          exempt: item.exempt,
          exemption_reason: item.exemption_reason
        })),
        nexus_jurisdictions: applicableRates.map(rate => rate.jurisdiction),
        calculation_method: 'database',
        calculated_at: new Date().toISOString()
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;

    } catch (error) {
      console.error('Tax calculation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown tax calculation error',
        total_tax_amount: 0,
        tax_rate: 0,
        tax_details: [],
        line_item_taxes: [],
        nexus_jurisdictions: [],
        calculation_method: 'database',
        calculated_at: new Date().toISOString()
      };
    }
  }

  /**
   * Get applicable tax rates for a jurisdiction
   */
  private async getApplicableTaxRates(
    country: string,
    state?: string,
    city?: string,
    postalCode?: string
  ): Promise<TaxRateData[]> {
    const { data, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('country_code', country.toUpperCase())
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString())
      .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString())
      .order('jurisdiction_type', { ascending: false }); // More specific jurisdictions first

    if (error) {
      console.error('Error fetching tax rates:', error);
      throw new Error(`Failed to fetch tax rates: ${error.message}`);
    }

    // Handle case where data is null (no rates found)
    if (!data) {
      return [];
    }

    // Filter by geographic specificity
    const filteredRates = (data as TaxRateData[]).filter(rate => {
      // Country level always applies
      if (rate.jurisdiction_type === 'country') return true;
      
      // State/province level
      if (rate.jurisdiction_type === 'state' && rate.state_code === state?.toUpperCase()) {
        return true;
      }
      
      // City level
      if (rate.jurisdiction_type === 'city' && rate.city?.toLowerCase() === city?.toLowerCase()) {
        return true;
      }
      
      // Postal code level
      if (rate.jurisdiction_type === 'postal_code' && postalCode && 
          rate.postal_codes?.includes(postalCode)) {
        return true;
      }
      
      return false;
    });

    return filteredRates;
  }

  /**
   * Get customer tax exemptions
   */
  private async getCustomerExemptions(
    customerId: string,
    country: string,
    state?: string
  ): Promise<TaxExemption[]> {
    const { data, error } = await supabase
      .from('tax_exemptions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .lte('valid_from', new Date().toISOString())
      .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString());

    if (error) {
      console.error('Error fetching tax exemptions:', error);
      throw new Error(`Failed to fetch tax exemptions: ${error.message}`);
    }

    // Handle case where data is null (no exemptions found)
    if (!data) {
      return [];
    }

    // Filter exemptions applicable to jurisdiction
    return (data as TaxExemption[]).filter(exemption => {
      return exemption.jurisdiction === country || 
             exemption.jurisdiction === `${country}-${state}` ||
             exemption.jurisdiction === '*'; // Global exemption
    });
  }

  /**
   * Calculate tax for a single line item
   */
  private async calculateLineItemTax(
    lineItem: TaxCalculationRequest['line_items'][0],
    applicableRates: TaxRateData[],
    exemptions: TaxExemption[]
  ): Promise<{
    line_item_id: string;
    tax_amount: number;
    tax_rate: number;
    exempt: boolean;
    exemption_reason?: string;
    tax_breakdown?: Array<{
      jurisdiction: string;
      tax_type: string;
      rate: number;
      amount: number;
      description: string;
    }>;
  }> {
    // Check if line item is exempt
    const exemption = exemptions.find(ex => 
      ex.exemption_type === 'tax_exempt_organization' || 
      ex.exemption_type === 'reseller'
    );

    if (exemption) {
      return {
        line_item_id: lineItem.id,
        tax_amount: 0,
        tax_rate: 0,
        exempt: true,
        exemption_reason: `${exemption.exemption_type}: ${exemption.certificate_number || 'N/A'}`
      };
    }

    // Get product tax category if specified
    let productCategory: ProductTaxCategory | null = null;
    if (lineItem.product_tax_category) {
      const { data } = await supabase
        .from('product_tax_categories')
        .select('*')
        .eq('category_name', lineItem.product_tax_category)
        .eq('is_active', true)
        .single();
      
      productCategory = data as ProductTaxCategory;
    }

    // Calculate tax based on applicable rates
    const taxBreakdown: Array<{
      jurisdiction: string;
      tax_type: string;
      rate: number;
      amount: number;
      description: string;
    }> = [];

    let totalTaxAmount = 0;
    let combinedRate = 0;

    for (const rate of applicableRates) {
      // Check if rate applies to digital services (our main product type)
      if (!rate.applies_to_digital_services) continue;

      // Check minimum threshold
      if (rate.minimum_threshold && lineItem.amount < rate.minimum_threshold) continue;

      // Use product category specific rate if available
      let applicableRate = rate.rate;
      if (productCategory?.jurisdiction_rates) {
        const categoryRate = productCategory.jurisdiction_rates.find(
          jr => jr.jurisdiction === rate.jurisdiction
        );
        if (categoryRate) {
          applicableRate = categoryRate.rate;
        }
      }

      const taxAmount = Math.round(lineItem.amount * applicableRate);
      totalTaxAmount += taxAmount;
      combinedRate += applicableRate;

      taxBreakdown.push({
        jurisdiction: rate.jurisdiction,
        tax_type: rate.tax_type,
        rate: applicableRate,
        amount: taxAmount,
        description: `${rate.tax_type.toUpperCase()} - ${rate.jurisdiction}`
      });
    }

    return {
      line_item_id: lineItem.id,
      tax_amount: totalTaxAmount,
      tax_rate: combinedRate,
      exempt: false,
      tax_breakdown: taxBreakdown
    };
  }

  /**
   * Manage tax rates
   */
  async createTaxRate(taxRate: Omit<TaxRateData, 'id' | 'created_at' | 'updated_at'>): Promise<TaxRateData> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('tax_rates')
      .insert({
        ...taxRate,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tax rate: ${error.message}`);
    }

    // Clear cache after rate changes
    this.cache.clear();

    return data as TaxRateData;
  }

  async updateTaxRate(id: string, updates: Partial<TaxRateData>): Promise<TaxRateData> {
    const { data, error } = await supabase
      .from('tax_rates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update tax rate: ${error.message}`);
    }

    // Clear cache after rate changes
    this.cache.clear();

    return data as TaxRateData;
  }

  /**
   * Manage tax exemptions
   */
  async createTaxExemption(exemption: Omit<TaxExemption, 'id' | 'created_at' | 'updated_at'>): Promise<TaxExemption> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('tax_exemptions')
      .insert({
        ...exemption,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tax exemption: ${error.message}`);
    }

    return data as TaxExemption;
  }

  /**
   * Seed initial tax rates with common jurisdictions
   */
  async seedInitialTaxRates(): Promise<void> {
    const initialRates: Omit<TaxRateData, 'id' | 'created_at' | 'updated_at'>[] = [
      // United States - State Sales Tax
      {
        jurisdiction: 'United States - California',
        jurisdiction_type: 'state',
        tax_type: 'sales_tax',
        rate: 0.0725, // 7.25% base rate
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'US',
        state_code: 'CA',
        applies_to_digital_services: true,
        description: 'California State Sales Tax',
        source: 'manual'
      },
      // European Union - VAT
      {
        jurisdiction: 'Germany',
        jurisdiction_type: 'country',
        tax_type: 'vat',
        rate: 0.19, // 19% VAT
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'DE',
        applies_to_digital_services: true,
        description: 'German VAT (Mehrwertsteuer)',
        source: 'manual'
      },
      {
        jurisdiction: 'United Kingdom',
        jurisdiction_type: 'country',
        tax_type: 'vat',
        rate: 0.20, // 20% VAT
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'GB',
        applies_to_digital_services: true,
        description: 'UK VAT',
        source: 'manual'
      },
      {
        jurisdiction: 'France',
        jurisdiction_type: 'country',
        tax_type: 'vat',
        rate: 0.20, // 20% VAT
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'FR',
        applies_to_digital_services: true,
        description: 'French VAT (TVA)',
        source: 'manual'
      },
      // Canada - HST/GST
      {
        jurisdiction: 'Canada - Ontario',
        jurisdiction_type: 'state',
        tax_type: 'hst',
        rate: 0.13, // 13% HST
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'CA',
        state_code: 'ON',
        applies_to_digital_services: true,
        description: 'Ontario HST',
        source: 'manual'
      }
    ];

    for (const rate of initialRates) {
      try {
        await this.createTaxRate(rate);
      } catch (error) {
        console.log(`Tax rate already exists or error: ${error}`);
        // Continue with other rates
      }
    }
  }

  /**
   * Utility methods
   */
  private generateCacheKey(request: TaxCalculationRequest): string {
    const keyData = {
      customer: `${request.customer_country}-${request.customer_state}-${request.customer_postal_code}`,
      items: request.line_items.map(item => `${item.amount}-${item.product_tax_category}`).join(','),
      date: request.transaction_date || new Date().toISOString().split('T')[0]
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private isCacheValid(calculatedAt: string): boolean {
    return Date.now() - new Date(calculatedAt).getTime() < this.cacheExpiry;
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const taxCalculationService = new TaxCalculationService(); 