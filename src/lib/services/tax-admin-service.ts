import { supabase } from '../supabase';
import { 
  TaxRateData, 
  TaxExemption, 
  ProductTaxCategory,
  taxCalculationService 
} from './tax-calculation-service';

export interface TaxRateCreateRequest {
  jurisdiction: string;
  jurisdiction_type: 'country' | 'state' | 'province' | 'city' | 'postal_code';
  tax_type: 'sales_tax' | 'vat' | 'gst' | 'hst' | 'local_tax';
  rate: number;
  effective_date: string;
  expiry_date?: string;
  country_code: string;
  state_code?: string;
  city?: string;
  postal_codes?: string[];
  applies_to_digital_services?: boolean;
  minimum_threshold?: number;
  description?: string;
}

export interface TaxExemptionCreateRequest {
  customer_id: string;
  exemption_type: 'tax_exempt_organization' | 'reseller' | 'government' | 'education' | 'other';
  jurisdiction: string;
  exemption_certificate?: string;
  certificate_number?: string;
  valid_from: string;
  valid_until?: string;
  documents?: Array<{
    url: string;
    type: string;
    uploaded_at: string;
  }>;
}

export interface ProductTaxCategoryCreateRequest {
  category_name: string;
  description?: string;
  tax_code?: string;
  harmonized_code?: string;
  jurisdiction_rates?: Array<{
    jurisdiction: string;
    rate: number;
    effective_date: string;
  }>;
}

export interface TaxAdminStats {
  total_tax_rates: number;
  active_tax_rates: number;
  jurisdictions_covered: number;
  total_exemptions: number;
  active_exemptions: number;
  total_calculations_today: number;
  total_tax_collected_today: number; // in cents
}

export class TaxAdminService {
  /**
   * Tax Rate Management
   */
  async getTaxRates(
    filters: {
      country_code?: string;
      jurisdiction_type?: string;
      is_active?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: TaxRateData[]; count: number }> {
    let query = supabase
      .from('tax_rates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.country_code) {
      query = query.eq('country_code', filters.country_code.toUpperCase());
    }

    if (filters.jurisdiction_type) {
      query = query.eq('jurisdiction_type', filters.jurisdiction_type);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch tax rates: ${error.message}`);
    }

    return {
      data: (data as TaxRateData[]) || [],
      count: count || 0
    };
  }

  async createTaxRate(request: TaxRateCreateRequest): Promise<TaxRateData> {
    // Validate rate
    if (request.rate < 0 || request.rate > 1) {
      throw new Error('Tax rate must be between 0 and 1 (0% to 100%)');
    }

    // Validate jurisdiction type specific fields
    if (request.jurisdiction_type === 'state' && !request.state_code) {
      throw new Error('State code is required for state-level tax rates');
    }

    if (request.jurisdiction_type === 'city' && !request.city) {
      throw new Error('City name is required for city-level tax rates');
    }

    if (request.jurisdiction_type === 'postal_code' && (!request.postal_codes || request.postal_codes.length === 0)) {
      throw new Error('Postal codes are required for postal-code-level tax rates');
    }

    return await taxCalculationService.createTaxRate({
      ...request,
      is_active: true,
      applies_to_digital_services: request.applies_to_digital_services ?? true,
      source: 'manual'
    });
  }

  async updateTaxRate(id: string, updates: Partial<TaxRateCreateRequest>): Promise<TaxRateData> {
    // Validate rate if provided
    if (updates.rate !== undefined && (updates.rate < 0 || updates.rate > 1)) {
      throw new Error('Tax rate must be between 0 and 1 (0% to 100%)');
    }

    return await taxCalculationService.updateTaxRate(id, updates);
  }

  async deactivateTaxRate(id: string): Promise<TaxRateData> {
    return await taxCalculationService.updateTaxRate(id, { 
      is_active: false,
      expiry_date: new Date().toISOString()
    });
  }

  async deleteTaxRate(id: string): Promise<void> {
    const { error } = await supabase
      .from('tax_rates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete tax rate: ${error.message}`);
    }

    // Clear tax calculation cache
    taxCalculationService.clearCache();
  }

  /**
   * Tax Exemption Management
   */
  async getTaxExemptions(
    filters: {
      customer_id?: string;
      exemption_type?: string;
      jurisdiction?: string;
      is_active?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: TaxExemption[]; count: number }> {
    let query = supabase
      .from('tax_exemptions')
      .select(`
        *,
        billing_customers!customer_id (
          id,
          email,
          name,
          country
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    if (filters.exemption_type) {
      query = query.eq('exemption_type', filters.exemption_type);
    }

    if (filters.jurisdiction) {
      query = query.eq('jurisdiction', filters.jurisdiction);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch tax exemptions: ${error.message}`);
    }

    return {
      data: (data as TaxExemption[]) || [],
      count: count || 0
    };
  }

  async createTaxExemption(request: TaxExemptionCreateRequest): Promise<TaxExemption> {
    // Validate customer exists
    const { data: customer } = await supabase
      .from('billing_customers')
      .select('id')
      .eq('id', request.customer_id)
      .single();

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Validate valid_from is not in the future
    if (new Date(request.valid_from) > new Date()) {
      throw new Error('Valid from date cannot be in the future');
    }

    // Validate valid_until is after valid_from if provided
    if (request.valid_until && new Date(request.valid_until) <= new Date(request.valid_from)) {
      throw new Error('Valid until date must be after valid from date');
    }

    return await taxCalculationService.createTaxExemption({
      ...request,
      is_active: true
    });
  }

  async updateTaxExemption(id: string, updates: Partial<TaxExemptionCreateRequest>): Promise<TaxExemption> {
    const { data, error } = await supabase
      .from('tax_exemptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update tax exemption: ${error.message}`);
    }

    return data as TaxExemption;
  }

  async verifyTaxExemption(
    id: string, 
    verifiedBy: string, 
    notes?: string
  ): Promise<TaxExemption> {
    const { data, error } = await supabase
      .from('tax_exemptions')
      .update({
        verified_at: new Date().toISOString(),
        verified_by: verifiedBy,
        verification_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to verify tax exemption: ${error.message}`);
    }

    return data as TaxExemption;
  }

  async deactivateTaxExemption(id: string): Promise<TaxExemption> {
    return await this.updateTaxExemption(id, {
      is_active: false,
      valid_until: new Date().toISOString()
    } as any);
  }

  /**
   * Product Tax Category Management
   */
  async getProductTaxCategories(
    filters: {
      is_active?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: ProductTaxCategory[]; count: number }> {
    let query = supabase
      .from('product_tax_categories')
      .select('*', { count: 'exact' })
      .order('category_name', { ascending: true });

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch product tax categories: ${error.message}`);
    }

    return {
      data: (data as ProductTaxCategory[]) || [],
      count: count || 0
    };
  }

  async createProductTaxCategory(request: ProductTaxCategoryCreateRequest): Promise<ProductTaxCategory> {
    const { data, error } = await supabase
      .from('product_tax_categories')
      .insert({
        ...request,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product tax category: ${error.message}`);
    }

    return data as ProductTaxCategory;
  }

  async updateProductTaxCategory(
    id: string, 
    updates: Partial<ProductTaxCategoryCreateRequest>
  ): Promise<ProductTaxCategory> {
    const { data, error } = await supabase
      .from('product_tax_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product tax category: ${error.message}`);
    }

    return data as ProductTaxCategory;
  }

  /**
   * Analytics and Reporting
   */
  async getTaxAdminStats(): Promise<TaxAdminStats> {
    const today = new Date().toISOString().split('T')[0];

    // Get tax rates stats
    const { count: totalTaxRates } = await supabase
      .from('tax_rates')
      .select('id', { count: 'exact' });

    const { count: activeTaxRates } = await supabase
      .from('tax_rates')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    const { data: jurisdictionsData } = await supabase
      .from('tax_rates')
      .select('country_code')
      .eq('is_active', true);

    const jurisdictionsCovered = new Set(
      jurisdictionsData?.map(row => row.country_code) || []
    ).size;

    // Get exemptions stats
    const { count: totalExemptions } = await supabase
      .from('tax_exemptions')
      .select('id', { count: 'exact' });

    const { count: activeExemptions } = await supabase
      .from('tax_exemptions')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    // Get today's calculation stats
    const { count: calculationsToday } = await supabase
      .from('tax_calculation_log')
      .select('id', { count: 'exact' })
      .gte('calculated_at', `${today}T00:00:00.000Z`)
      .lt('calculated_at', `${today}T23:59:59.999Z`);

    const { data: taxCollectedData } = await supabase
      .from('tax_calculation_log')
      .select('total_tax_amount')
      .gte('calculated_at', `${today}T00:00:00.000Z`)
      .lt('calculated_at', `${today}T23:59:59.999Z`);

    const totalTaxCollectedToday = taxCollectedData?.reduce(
      (sum, record) => sum + record.total_tax_amount, 
      0
    ) || 0;

    return {
      total_tax_rates: totalTaxRates || 0,
      active_tax_rates: activeTaxRates || 0,
      jurisdictions_covered: jurisdictionsCovered,
      total_exemptions: totalExemptions || 0,
      active_exemptions: activeExemptions || 0,
      total_calculations_today: calculationsToday || 0,
      total_tax_collected_today: totalTaxCollectedToday
    };
  }

  /**
   * Bulk Operations
   */
  async importTaxRates(rates: TaxRateCreateRequest[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const rate of rates) {
      try {
        await this.createTaxRate(rate);
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to import rate for ${rate.jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { successful, failed, errors };
  }

  async updateTaxRatesByCountry(
    countryCode: string, 
    newRate: number, 
    effectiveDate: string
  ): Promise<{
    updated: number;
    errors: string[];
  }> {
    const { data: existingRates } = await supabase
      .from('tax_rates')
      .select('id')
      .eq('country_code', countryCode.toUpperCase())
      .eq('is_active', true);

    let updated = 0;
    const errors: string[] = [];

    for (const rate of existingRates || []) {
      try {
        // Deactivate old rate
        await this.updateTaxRate(rate.id, {
          is_active: false,
          expiry_date: effectiveDate
        } as any);

        // Create new rate (this would need more logic in a real implementation)
        updated++;
      } catch (error) {
        errors.push(`Failed to update rate ${rate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { updated, errors };
  }

  /**
   * Cache Management
   */
  clearTaxCalculationCache(): void {
    taxCalculationService.clearCache();
  }

  /**
   * Test tax calculation
   */
  async testTaxCalculation(
    customerCountry: string,
    customerState?: string,
    lineItems: Array<{
      amount: number;
      productCategory?: string;
    }> = [{ amount: 10000 }] // Default $100 test
  ) {
    try {
      const taxRequest = {
        customer_id: 'test-customer',
        customer_country: customerCountry,
        customer_state: customerState,
        line_items: lineItems.map((item, index) => ({
          id: `test-item-${index}`,
          description: `Test item ${index + 1}`,
          amount: item.amount,
          quantity: 1,
          product_tax_category: item.productCategory || 'digital_services'
        })),
        currency: 'usd',
        transaction_date: new Date().toISOString()
      };

      return await taxCalculationService.calculateTax(taxRequest);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        total_tax_amount: 0,
        tax_rate: 0,
        tax_details: [],
        line_item_taxes: [],
        nexus_jurisdictions: [],
        calculation_method: 'database' as const,
        calculated_at: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const taxAdminService = new TaxAdminService(); 