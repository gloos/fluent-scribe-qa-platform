import { describe, it, expect, beforeEach, vi } from 'vitest'

// Import the setup FIRST before any other imports
import './integration-test-setup'
import { PaymentProcessingService } from '@/lib/services/payment-processing-service'
import { StripeUsageReporter } from '@/lib/services/stripe-usage-reporter'
import { SubscriptionService } from '@/lib/services/subscription-service'

describe('Payment Processing Integration Tests', () => {
  let paymentService: PaymentProcessingService
  let usageReporter: StripeUsageReporter
  let subscriptionService: SubscriptionService

  beforeEach(async () => {
    // Clear any existing mock data first
    testUtils.supabase.__clearMockData()
    
    // Initialize services
    paymentService = new PaymentProcessingService()
    usageReporter = new StripeUsageReporter()
    subscriptionService = new SubscriptionService()

    // Setup mock data for payment processing tests
    testUtils.supabase.__setMockData('billing_invoices', [
      {
        id: 'test-invoice-id',
        billing_customer_id: 'test-customer-id',
        billing_subscription_id: 'test-subscription-id',
        amount_total: 2000,
        amount_remaining: 2000,
        currency: 'usd',
        status: 'open',
        created_at: new Date().toISOString()
      }
    ])

    // Add mock customer data
    testUtils.supabase.__setMockData('billing_customers', [
      {
        id: 'test-customer-id',
        stripe_customer_id: 'cus_test_customer',
        email: 'test@example.com',
        name: 'Test Customer',
        created_at: new Date().toISOString()
      }
    ])

    // Add mock subscription data
    testUtils.supabase.__setMockData('billing_subscriptions', [
      {
        id: 'test-subscription-id',
        billing_customer_id: 'test-customer-id',
        stripe_subscription_id: 'sub_test_subscription',
        pricing_plan: 'professional',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      }
    ])

    // Add mock payment method data
    testUtils.supabase.__setMockData('billing_payment_methods', [
      {
        id: 'test-payment-method-id',
        billing_customer_id: 'test-customer-id',
        stripe_payment_method_id: 'pm_test_card',
        type: 'card',
        is_default: true,
        status: 'active',
        metadata: { brand: 'visa', last4: '4242' },
        created_at: new Date().toISOString()
      }
    ])

    // Add mock usage records for batch usage reporting test
    testUtils.supabase.__setMockData('billing_usage_records', [
      {
        id: 'test-usage-record-id',
        billing_subscription_id: 'test-subscription-id',
        qa_session_id: 'qa-session-test',
        words_processed: 25,
        processing_type: 'qa_analysis',
        billing_period_start: new Date().toISOString(),
        billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        price_per_word: 0.0004,
        total_cost: 0.01,
        stripe_usage_record_id: null,
        reported_to_stripe: false,
        reported_at: null,
        invoiced: false,
        invoice_id: null,
        metadata: { source: 'test' },
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      }
    ])
  })

  describe('Mock Verification', () => {
    it('should verify mock supabase is working', async () => {
      const result = await testUtils.supabase
        .from('billing_invoices')
        .select('*')
        .eq('id', 'test-invoice-id')
        .single()

      expect(result.data).toBeDefined()
      expect(result.data.id).toBe('test-invoice-id')
      expect(result.error).toBeNull()
    })

    it('should handle non-existent records', async () => {
      const result = await testUtils.supabase
        .from('billing_invoices')
        .select('*')
        .eq('id', 'non-existent-id')
        .single()

      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('PGRST116')
    })
  })

  describe('Payment Processing Chain', () => {
    it('should create payment intent successfully', async () => {
      const result = await paymentService.createPaymentIntent(
        'test-invoice-id',
        'pm_test_card',
        { confirm: false }
      )

      expect(result.success).toBe(true)
      expect(result.payment_intent).toBeDefined()
      expect(result.payment_intent?.amount).toBe(2000)
      expect(result.payment_intent?.currency).toBe('usd')
      expect(result.client_secret).toBeDefined()
    })

    it('should handle payment confirmation', async () => {
      const result = await paymentService.confirmPayment(
        'pi_test_payment_intent',
        'pm_test_card',
        'https://example.com/return'
      )

      expect(result.success).toBe(true)
      expect(result.payment_intent).toBeDefined()
      expect(result.payment_intent?.status).toMatch(/^(succeeded|requires_action)$/)
      expect(result.client_secret).toBeDefined()
    })

    it('should handle invalid invoice ID', async () => {
      const result = await paymentService.createPaymentIntent(
        'invalid-invoice-id',
        'pm_test_card'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.code).toBe('invoice_not_found')
    })
  })

  describe('Usage Reporting Integration', () => {
    it('should report usage record successfully', async () => {
      const usageRecord = {
        id: 'usage-test-id',
        billing_subscription_id: 'test-subscription-id',
        qa_session_id: 'qa-session-test',
        words_processed: 50,
        processing_type: 'qa_analysis' as const,
        billing_period_start: new Date().toISOString(),
        billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        price_per_word: 0.0004,
        total_cost: 0.02,
        stripe_usage_record_id: null,
        reported_to_stripe: false,
        reported_at: null,
        invoiced: false,
        invoice_id: null,
        metadata: { source: 'integration_test' },
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      }

      const result = await usageReporter.reportUsageRecord(usageRecord)

      expect(result.success).toBe(true)
      expect(result.stripeUsageRecordId).toBeDefined()
    })

    it('should report batch usage successfully', async () => {
      const result = await usageReporter.batchReportUsage(10)

      expect(result.processed).toBeGreaterThanOrEqual(0)
      expect(result.successful).toBeGreaterThanOrEqual(0)
      expect(result.failed).toBe(0)
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })

  describe('Subscription Management Integration', () => {
    it('should create subscription successfully', async () => {
      const subscription = await subscriptionService.createSubscription(
        'test-customer-id',
        'professional',
        {
          trialDays: 14,
          paymentMethodId: 'pm_test_card'
        }
      )

      expect(subscription).toBeDefined()
      expect(subscription.billing_customer_id).toBe('test-customer-id')
      expect(subscription.pricing_plan).toBe('professional')
    })

    it('should change subscription plan successfully', async () => {
      const updatedSubscription = await subscriptionService.changeSubscriptionPlan(
        'test-subscription-id',
        {
          newPlanId: 'enterprise',
          prorationBehavior: 'create_prorations'
        }
      )

      expect(updatedSubscription).toBeDefined()
      expect(updatedSubscription.pricing_plan).toBe('enterprise')
    })
  })
}) 