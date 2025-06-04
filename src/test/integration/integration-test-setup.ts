import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'

// Import the base setup
import '../setup'

// Simple Supabase mock for integration testing
const createMockSupabaseClient = () => {
  const mockData = new Map()
  const mockErrors = new Map()

  // Simple promise-based mock that doesn't create complex chains
  const createSimpleQuery = (tableName: string) => {
    let filters: any[] = []
    let shouldReturnSingle = false
    let selectColumns = '*'

    const executeQuery = async () => {
      const key = tableName
      const error = mockErrors.get(key)
      
      if (error) {
        return { data: null, error }
      }

      let data = mockData.get(key) || []
      
      // Apply filters
      for (const filter of filters) {
        if (filter.type === 'eq') {
          data = data.filter((item: any) => item[filter.column] === filter.value)
        }
      }

      // Return single record if requested
      if (shouldReturnSingle) {
        return { 
          data: data.length > 0 ? data[0] : null, 
          error: data.length === 0 ? { message: 'No rows found', code: 'PGRST116' } : null 
        }
      }

      return { data, error: null }
    }

    const queryBuilder = {
      select: (columns: string = '*') => {
        selectColumns = columns
        return queryBuilder
      },
      eq: (column: string, value: any) => {
        filters.push({ type: 'eq', column, value })
        return queryBuilder
      },
      order: (column: string, options: any = {}) => {
        // For integration tests, we don't need complex ordering
        // Just return the same queryBuilder to maintain chaining
        return queryBuilder
      },
      limit: (count: number) => {
        // For integration tests, we don't need complex limiting
        // Just return the same queryBuilder to maintain chaining
        return queryBuilder
      },
      single: () => {
        shouldReturnSingle = true
        return executeQuery()
      },
      then: (resolve: any) => executeQuery().then(resolve),
      catch: (reject: any) => executeQuery().catch(reject)
    }

    return queryBuilder
  }

  const createUpdateQuery = (tableName: string, updateData: any) => {
    let filters: any[] = []

    const executeUpdate = async () => {
      const key = tableName
      const error = mockErrors.get(key)
      
      if (error) {
        return { data: null, error }
      }

      let data = mockData.get(key) || []
      
      // Apply filters to find records to update
      let recordsToUpdate = data
      for (const filter of filters) {
        if (filter.type === 'eq') {
          recordsToUpdate = recordsToUpdate.filter((item: any) => item[filter.column] === filter.value)
        }
      }

      // Update the records
      const updatedRecords = recordsToUpdate.map((record: any) => ({
        ...record,
        ...updateData
      }))

      // Update the main data array
      const updatedData = data.map((record: any) => {
        const shouldUpdate = recordsToUpdate.some((r: any) => r.id === record.id)
        return shouldUpdate ? { ...record, ...updateData } : record
      })

      mockData.set(key, updatedData)
      return { data: updatedRecords, error: null }
    }

    return {
      eq: (column: string, value: any) => {
        filters.push({ type: 'eq', column, value })
        return {
          then: (resolve: any) => executeUpdate().then(resolve),
          catch: (reject: any) => executeUpdate().catch(reject)
        }
      }
    }
  }

  return {
    from: (tableName: string) => ({
      ...createSimpleQuery(tableName),
      insert: (data: any) => Promise.resolve({ data, error: null }),
      update: (updateData: any) => createUpdateQuery(tableName, updateData),
      delete: () => Promise.resolve({ data: null, error: null }),
      upsert: (data: any) => Promise.resolve({ data, error: null })
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null })
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null })
      })
    },
    // Test utilities
    __setMockData: (tableName: string, data: any[]) => {
      mockData.set(tableName, data)
    },
    __setMockError: (tableName: string, error: any) => {
      mockErrors.set(tableName, error)
    },
    __clearMockData: () => {
      mockData.clear()
      mockErrors.clear()
    },
    __getMockData: (tableName: string) => mockData.get(tableName) || []
  }
}

// Create the mock client
const mockSupabaseClient = createMockSupabaseClient()

// Mock the entire @/lib/supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
  onAuthStateChange: vi.fn(),
  uploadFile: vi.fn(),
  getPublicUrl: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
  SESSION_CONFIG: {
    WARNING_THRESHOLD: 5 * 60,
    IDLE_TIMEOUT: 30 * 60,
    REFRESH_THRESHOLD: 10 * 60,
    MAX_SESSION_DURATION: 24 * 60 * 60
  }
}))

// Enhanced Stripe mock
const mockStripe = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({
      id: 'pi_test_payment_intent',
      amount: 2000,
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: 'pi_test_client_secret'
    }),
    confirm: vi.fn().mockResolvedValue({
      id: 'pi_test_payment_intent',
      status: 'succeeded'
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'pi_test_payment_intent',
      status: 'succeeded'
    }),
    update: vi.fn().mockResolvedValue({
      id: 'pi_test_payment_intent',
      status: 'succeeded'
    })
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue({
      id: 'sub_test_subscription',
      status: 'active'
    }),
    update: vi.fn().mockResolvedValue({
      id: 'sub_test_subscription',
      status: 'active'
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'sub_test_subscription',
      status: 'active'
    })
  },
  customers: {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test_customer'
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'cus_test_customer'
    })
  }
}

// Mock Stripe module AND StripeService
vi.mock('@/integrations/stripe/stripe-service', () => ({
  StripeService: vi.fn().mockImplementation(() => ({
    ...mockStripe,
    createSubscription: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'sub_test_subscription',
        status: 'active',
        customer: 'cus_test_customer',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: { planId: 'professional', planName: 'Professional' },
        items: {
          data: [{ id: 'si_test_item' }]
        }
      },
      error: null
    }),
    updateSubscription: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'sub_test_subscription', 
        status: 'active',
        customer: 'cus_test_customer',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: { planId: 'enterprise', planName: 'Enterprise' },
        items: {
          data: [{ id: 'si_test_item' }]
        }
      },
      error: null
    }),
    // Add all the existing mock methods
    ...mockStripe
  }))
}))

// Mock Redis for rate limiting
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1)
}

vi.mock('@/lib/redis', () => ({
  redis: mockRedis
}))

// Global test utilities
declare global {
  var testUtils: {
    supabase: typeof mockSupabaseClient
    stripe: typeof mockStripe
    redis: typeof mockRedis
  }
}

globalThis.testUtils = {
  supabase: mockSupabaseClient,
  stripe: mockStripe,
  redis: mockRedis
}

// Setup and teardown
beforeEach(() => {
  // Clear all mocks
  vi.clearAllMocks()
  mockSupabaseClient.__clearMockData()
  
  // Reset Stripe mocks
  Object.values(mockStripe.paymentIntents).forEach(mock => mock.mockClear())
  Object.values(mockStripe.subscriptions).forEach(mock => mock.mockClear())
  Object.values(mockStripe.customers).forEach(mock => mock.mockClear())
  
  // Reset Redis mocks
  Object.values(mockRedis).forEach(mock => mock.mockClear())
})

afterEach(() => {
  // Additional cleanup if needed
  mockSupabaseClient.__clearMockData()
})

export { vi, beforeEach, afterEach } 