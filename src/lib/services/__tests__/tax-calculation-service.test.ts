import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  taxCalculationService, 
  TaxCalculationRequest,
  TaxRateData,
  TaxExemption 
} from '../tax-calculation-service';

// Mock supabase
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              or: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-id' },
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'test-id' },
              error: null
            }))
          }))
        }))
      }))
    })),
    rpc: vi.fn(() => ({ error: null }))
  }
}));

describe('TaxCalculationService', () => {
  beforeEach(() => {
    // Clear cache before each test
    taxCalculationService.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTax', () => {
    it('should return zero tax when no applicable rates exist', async () => {
      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'XX', // Non-existent country
        line_items: [
          {
            id: 'item-1',
            description: 'Test service',
            amount: 10000, // $100
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const result = await taxCalculationService.calculateTax(request);

      expect(result.success).toBe(true);
      expect(result.total_tax_amount).toBe(0);
      expect(result.tax_rate).toBe(0);
      expect(result.tax_details).toEqual([]);
    });

    it('should calculate tax correctly for a single jurisdiction', async () => {
      // Mock tax rates for US
      const mockTaxRates: TaxRateData[] = [
        {
          id: 'rate-1',
          jurisdiction: 'United States',
          jurisdiction_type: 'country',
          tax_type: 'sales_tax',
          rate: 0.08, // 8%
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          applies_to_digital_services: true,
          description: 'US Sales Tax',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock the supabase call to return our tax rates
      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockTaxRates,
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any);

      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Digital service',
            amount: 10000, // $100
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const result = await taxCalculationService.calculateTax(request);

      expect(result.success).toBe(true);
      expect(result.total_tax_amount).toBe(800); // 8% of $100 = $8
      expect(result.tax_rate).toBe(0.08);
      expect(result.tax_details).toHaveLength(1);
      expect(result.tax_details[0].jurisdiction).toBe('United States');
      expect(result.tax_details[0].amount).toBe(800);
    });

    it('should handle multiple jurisdictions (state + country)', async () => {
      const mockTaxRates: TaxRateData[] = [
        {
          id: 'rate-1',
          jurisdiction: 'United States',
          jurisdiction_type: 'country',
          tax_type: 'sales_tax',
          rate: 0.05, // 5% federal
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          applies_to_digital_services: true,
          description: 'US Federal Tax',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'rate-2',
          jurisdiction: 'California',
          jurisdiction_type: 'state',
          tax_type: 'sales_tax',
          rate: 0.0725, // 7.25% state
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          state_code: 'CA',
          applies_to_digital_services: true,
          description: 'California State Tax',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockTaxRates,
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any);

      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        customer_state: 'CA',
        line_items: [
          {
            id: 'item-1',
            description: 'Digital service',
            amount: 10000, // $100
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const result = await taxCalculationService.calculateTax(request);

      expect(result.success).toBe(true);
      // Total should be 5% + 7.25% = 12.25% of $100 = $12.25 = 1225 cents
      expect(result.total_tax_amount).toBe(1225);
      expect(result.tax_details).toHaveLength(2);
    });

    it('should apply tax exemptions correctly', async () => {
      const mockTaxRates: TaxRateData[] = [
        {
          id: 'rate-1',
          jurisdiction: 'United States',
          jurisdiction_type: 'country',
          tax_type: 'sales_tax',
          rate: 0.08,
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          applies_to_digital_services: true,
          description: 'US Sales Tax',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockExemptions: TaxExemption[] = [
        {
          id: 'exemption-1',
          customer_id: 'customer-1',
          exemption_type: 'tax_exempt_organization',
          jurisdiction: 'US',
          certificate_number: 'EXEMPT-001',
          valid_from: '2024-01-01T00:00:00Z',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockSupabase = await import('../../supabase');
      
      // Mock multiple calls - first for tax rates, second for exemptions
      let callCount = 0;
      vi.mocked(mockSupabase.supabase.from).mockImplementation((table: string) => {
        if (table === 'tax_rates') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    or: vi.fn(() => ({
                      order: vi.fn(() => ({
                        data: mockTaxRates,
                        error: null
                      }))
                    }))
                  }))
                }))
              }))
            }))
          } as any;
        } else if (table === 'tax_exemptions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    or: vi.fn(() => ({
                      data: mockExemptions,
                      error: null
                    }))
                  }))
                }))
              }))
            }))
          } as any;
        }
        return {} as any;
      });

      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Digital service',
            amount: 10000,
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const result = await taxCalculationService.calculateTax(request);

      expect(result.success).toBe(true);
      expect(result.total_tax_amount).toBe(0); // Should be exempt
      expect(result.line_item_taxes[0].exempt).toBe(true);
      expect(result.line_item_taxes[0].exemption_reason).toContain('tax_exempt_organization');
    });

    it('should handle minimum threshold correctly', async () => {
      const mockTaxRates: TaxRateData[] = [
        {
          id: 'rate-1',
          jurisdiction: 'United States',
          jurisdiction_type: 'country',
          tax_type: 'sales_tax',
          rate: 0.08,
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          applies_to_digital_services: true,
          minimum_threshold: 5000, // $50 minimum
          description: 'US Sales Tax with threshold',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockTaxRates,
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any);

      // Test below threshold
      const requestBelowThreshold: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Small purchase',
            amount: 3000, // $30 - below $50 threshold
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const resultBelowThreshold = await taxCalculationService.calculateTax(requestBelowThreshold);
      expect(resultBelowThreshold.total_tax_amount).toBe(0);

      // Test above threshold
      const requestAboveThreshold: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Large purchase',
            amount: 10000, // $100 - above $50 threshold
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const resultAboveThreshold = await taxCalculationService.calculateTax(requestAboveThreshold);
      expect(resultAboveThreshold.total_tax_amount).toBe(800); // 8% of $100
    });

    it('should cache calculation results', async () => {
      const mockTaxRates: TaxRateData[] = [
        {
          id: 'rate-1',
          jurisdiction: 'United States',
          jurisdiction_type: 'country',
          tax_type: 'sales_tax',
          rate: 0.08,
          effective_date: '2024-01-01T00:00:00Z',
          is_active: true,
          country_code: 'US',
          applies_to_digital_services: true,
          description: 'US Sales Tax',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockSupabase = await import('../../supabase');
      const fromSpy = vi.mocked(mockSupabase.supabase.from);
      
      fromSpy.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockTaxRates,
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any);

      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Digital service',
            amount: 10000,
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      // First call
      const result1 = await taxCalculationService.calculateTax(request);
      expect(result1.success).toBe(true);
      
      // Clear the spy call count
      fromSpy.mockClear();
      
      // Second call - should use cache, not make DB calls
      const result2 = await taxCalculationService.calculateTax(request);
      expect(result2.success).toBe(true);
      expect(result2.total_tax_amount).toBe(result1.total_tax_amount);
      
      // Should not have made additional DB calls for tax rates
      // (might still call for exemptions, but fewer calls overall)
      expect(fromSpy).toHaveBeenCalledTimes(1); // Only exemptions call
    });

    it('should handle errors gracefully', async () => {
      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              lte: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: null,
                    error: { message: 'Database connection failed' }
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any);

      const request: TaxCalculationRequest = {
        customer_id: 'customer-1',
        customer_country: 'US',
        line_items: [
          {
            id: 'item-1',
            description: 'Digital service',
            amount: 10000,
            quantity: 1
          }
        ],
        currency: 'usd'
      };

      const result = await taxCalculationService.calculateTax(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.total_tax_amount).toBe(0);
    });
  });

  describe('seedInitialTaxRates', () => {
    it('should create initial tax rates without errors', async () => {
      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'new-rate-id' },
              error: null
            }))
          }))
        }))
      } as any);

      // Should not throw
      await expect(taxCalculationService.seedInitialTaxRates()).resolves.not.toThrow();
    });
  });

  describe('createTaxRate', () => {
    it('should create a new tax rate successfully', async () => {
      const mockSupabase = await import('../../supabase');
      vi.mocked(mockSupabase.supabase.from).mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { 
                id: 'new-rate-id',
                jurisdiction: 'Test State',
                rate: 0.05,
                is_active: true
              },
              error: null
            }))
          }))
        }))
      } as any);

      const newRate = {
        jurisdiction: 'Test State',
        jurisdiction_type: 'state' as const,
        tax_type: 'sales_tax' as const,
        rate: 0.05,
        effective_date: '2024-01-01T00:00:00Z',
        is_active: true,
        country_code: 'US',
        state_code: 'TS',
        applies_to_digital_services: true,
        description: 'Test state tax',
        source: 'manual' as const
      };

      const result = await taxCalculationService.createTaxRate(newRate);
      expect(result.id).toBe('new-rate-id');
      expect(result.jurisdiction).toBe('Test State');
    });
  });

  describe('cache management', () => {
    it('should clear cache successfully', () => {
      // Should not throw
      expect(() => taxCalculationService.clearCache()).not.toThrow();
    });
  });
}); 