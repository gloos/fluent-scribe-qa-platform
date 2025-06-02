/**
 * Financial Reporting Service
 * 
 * Provides comprehensive financial reporting and analytics for billing,
 * revenue tracking, compliance, and business intelligence.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  BillingCustomer, 
  BillingSubscription, 
  BillingInvoice, 
  BillingUsageRecord,
  BillingPaymentMethod 
} from '@/lib/types/billing';

export interface FinancialMetrics {
  revenue: RevenueMetrics;
  subscriptions: SubscriptionMetrics;
  payments: PaymentMetrics;
  usage: UsageMetrics;
  churn: ChurnMetrics;
  forecasting: ForecastingMetrics;
}

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  revenueGrowth: number;
  revenueByPlan: Record<string, number>;
  revenueByPeriod: Array<{
    period: string;
    amount: number;
    recurring: number;
    oneTime: number;
  }>;
  averageRevenuePerUser: number;
  averageRevenuePerAccount: number;
  revenueLeakage: {
    amount: number;
    causes: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
  };
}

export interface SubscriptionMetrics {
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  upgrades: number;
  downgrades: number;
  trialConversions: number;
  subscriptionsByPlan: Record<string, number>;
  subscriptionGrowthRate: number;
  lifetimeValue: number;
}

export interface PaymentMetrics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  paymentSuccessRate: number;
  averagePaymentAmount: number;
  paymentMethodDistribution: Record<string, number>;
  paymentFailureReasons: Array<{
    reason: string;
    count: number;
    totalAmount: number;
  }>;
  processingTimes: {
    average: number;
    median: number;
    p95: number;
  };
}

export interface UsageMetrics {
  totalWordsProcessed: number;
  averageWordsPerCustomer: number;
  usageGrowthRate: number;
  usageByPlan: Record<string, number>;
  costPerWord: number;
  usageEfficiency: number;
  peakUsagePeriods: Array<{
    period: string;
    usage: number;
    revenue: number;
  }>;
}

export interface ChurnMetrics {
  churnRate: number;
  churnReasons: Record<string, number>;
  churnedRevenue: number;
  retentionRate: number;
  customerLifetime: number;
  churnPredictors: Array<{
    factor: string;
    correlation: number;
    impact: string;
  }>;
}

export interface ForecastingMetrics {
  projectedRevenue: Array<{
    period: string;
    projected: number;
    confidence: number;
  }>;
  projectedChurn: Array<{
    period: string;
    churnRate: number;
    confidence: number;
  }>;
  growthTrajectory: {
    rate: number;
    projection: number;
    confidence: number;
  };
}

export interface FinancialReportFilters {
  dateRange?: {
    from: string;
    to: string;
  };
  currency?: string;
  plans?: string[];
  customerSegments?: string[];
  paymentMethods?: string[];
  subscriptionStatus?: string[];
  includeTrials?: boolean;
  includeCanceled?: boolean;
}

export interface ComplianceReporting {
  auditLogs: Array<{
    timestamp: string;
    event: string;
    entityType: string;
    entityId: string;
    changes: Record<string, any>;
    userId?: string;
  }>;
  taxCompliance: {
    totalTaxCollected: number;
    taxByJurisdiction: Record<string, number>;
    exemptions: number;
    taxReports: Array<{
      period: string;
      jurisdiction: string;
      amount: number;
      status: string;
    }>;
  };
  dataRetention: {
    scheduledDeletions: number;
    retentionPolicies: Array<{
      dataType: string;
      retentionPeriod: number;
      lastCleanup: string;
    }>;
  };
  financialCompliance: {
    revenueRecognition: Array<{
      period: string;
      recognized: number;
      deferred: number;
    }>;
    accountingStandards: string;
    lastAudit: string;
  };
}

export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
  customFields?: string[];
  dateFormat?: string;
  currency?: string;
}

/**
 * Financial Reporting Service Class
 */
export class FinancialReportingService {
  private static instance: FinancialReportingService;
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  );
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): FinancialReportingService {
    if (!FinancialReportingService.instance) {
      FinancialReportingService.instance = new FinancialReportingService();
    }
    return FinancialReportingService.instance;
  }

  /**
   * Get comprehensive financial metrics
   */
  async getFinancialMetrics(filters?: FinancialReportFilters): Promise<FinancialMetrics> {
    const cacheKey = this.generateCacheKey('financial-metrics', filters);
    const cached = this.getFromCache<FinancialMetrics>(cacheKey);
    if (cached) return cached;

    try {
      const [revenue, subscriptions, payments, usage, churn, forecasting] = await Promise.all([
        this.getRevenueMetrics(filters),
        this.getSubscriptionMetrics(filters),
        this.getPaymentMetrics(filters),
        this.getUsageMetrics(filters),
        this.getChurnMetrics(filters),
        this.getForecastingMetrics(filters)
      ]);

      const metrics: FinancialMetrics = {
        revenue,
        subscriptions,
        payments,
        usage,
        churn,
        forecasting
      };

      this.setCache(cacheKey, metrics);
      return metrics;

    } catch (error) {
      console.error('Error generating financial metrics:', error);
      throw new Error('Failed to generate financial metrics');
    }
  }

  /**
   * Get revenue metrics and analytics
   */
  async getRevenueMetrics(filters?: FinancialReportFilters): Promise<RevenueMetrics> {
    try {
      // Build query with filters
      let query = this.supabase
        .from('billing_invoices')
        .select(`
          *,
          billing_customer:billing_customers(*),
          billing_subscription:billing_subscriptions(*)
        `)
        .eq('status', 'paid');

      if (filters?.dateRange) {
        query = query
          .gte('paid_at', filters.dateRange.from)
          .lte('paid_at', filters.dateRange.to);
      }

      if (filters?.currency) {
        query = query.eq('currency', filters.currency);
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      // Calculate revenue metrics
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total / 100), 0) || 0;
      
      // Calculate recurring vs one-time revenue
      const recurringRevenue = invoices?.filter(inv => inv.billing_subscription_id)
        .reduce((sum, inv) => sum + (inv.total / 100), 0) || 0;
      const oneTimeRevenue = totalRevenue - recurringRevenue;

      // Revenue by plan
      const revenueByPlan: Record<string, number> = {};
      invoices?.forEach(invoice => {
        if (invoice.billing_subscription?.pricing_plan) {
          const plan = invoice.billing_subscription.pricing_plan;
          revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (invoice.total / 100);
        }
      });

      // Revenue over time
      const revenueByPeriod = this.aggregateRevenueByPeriod(invoices || []);

      // Calculate ARPU and ARPA
      const { data: customers } = await this.supabase
        .from('billing_customers')
        .select('*');
      
      const activeCustomers = customers?.length || 1;
      const averageRevenuePerUser = totalRevenue / activeCustomers;
      const averageRevenuePerAccount = averageRevenuePerUser; // Same for now

      // Revenue leakage detection
      const revenueLeakage = await this.detectRevenueLeakage(filters);

      // Calculate growth (comparing to previous period)
      const revenueGrowth = await this.calculateRevenueGrowth(filters);

      return {
        totalRevenue,
        recurringRevenue,
        oneTimeRevenue,
        revenueGrowth,
        revenueByPlan,
        revenueByPeriod,
        averageRevenuePerUser,
        averageRevenuePerAccount,
        revenueLeakage
      };

    } catch (error) {
      console.error('Error calculating revenue metrics:', error);
      throw new Error('Failed to calculate revenue metrics');
    }
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(filters?: FinancialReportFilters): Promise<SubscriptionMetrics> {
    try {
      let query = this.supabase
        .from('billing_subscriptions')
        .select('*');

      if (filters?.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.from)
          .lte('created_at', filters.dateRange.to);
      }

      const { data: subscriptions, error } = await query;
      if (error) throw error;

      const activeSubscriptions = subscriptions?.filter(sub => sub.status === 'active').length || 0;
      const newSubscriptions = subscriptions?.filter(sub => 
        new Date(sub.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length || 0;
      
      const canceledSubscriptions = subscriptions?.filter(sub => sub.status === 'canceled').length || 0;

      // Subscriptions by plan
      const subscriptionsByPlan: Record<string, number> = {};
      subscriptions?.forEach(sub => {
        subscriptionsByPlan[sub.pricing_plan] = (subscriptionsByPlan[sub.pricing_plan] || 0) + 1;
      });

      // Calculate other metrics
      const subscriptionGrowthRate = this.calculateSubscriptionGrowthRate(subscriptions || []);
      const lifetimeValue = await this.calculateLifetimeValue();

      return {
        activeSubscriptions,
        newSubscriptions,
        canceledSubscriptions,
        upgrades: 0, // TODO: Implement upgrade tracking
        downgrades: 0, // TODO: Implement downgrade tracking
        trialConversions: 0, // TODO: Implement trial conversion tracking
        subscriptionsByPlan,
        subscriptionGrowthRate,
        lifetimeValue
      };

    } catch (error) {
      console.error('Error calculating subscription metrics:', error);
      throw new Error('Failed to calculate subscription metrics');
    }
  }

  /**
   * Get payment metrics
   */
  async getPaymentMetrics(filters?: FinancialReportFilters): Promise<PaymentMetrics> {
    try {
      let query = this.supabase
        .from('billing_invoices')
        .select('*');

      if (filters?.dateRange) {
        query = query
          .gte('created_at_stripe', filters.dateRange.from)
          .lte('created_at_stripe', filters.dateRange.to);
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      const totalPayments = invoices?.length || 0;
      const successfulPayments = invoices?.filter(inv => inv.status === 'paid').length || 0;
      const failedPayments = invoices?.filter(inv => inv.status === 'uncollectible').length || 0;
      const pendingPayments = invoices?.filter(inv => inv.status === 'open').length || 0;

      const paymentSuccessRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;
      
      const totalAmount = invoices?.filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.total, 0) || 0;
      const averagePaymentAmount = successfulPayments > 0 ? (totalAmount / 100) / successfulPayments : 0;

      // Payment method distribution
      const paymentMethodDistribution: Record<string, number> = {
        'card': 0,
        'bank_account': 0,
        'other': 0
      };

      return {
        totalPayments,
        successfulPayments,
        failedPayments,
        pendingPayments,
        paymentSuccessRate,
        averagePaymentAmount,
        paymentMethodDistribution,
        paymentFailureReasons: [], // TODO: Implement failure reason tracking
        processingTimes: {
          average: 0,
          median: 0,
          p95: 0
        }
      };

    } catch (error) {
      console.error('Error calculating payment metrics:', error);
      throw new Error('Failed to calculate payment metrics');
    }
  }

  /**
   * Get usage metrics
   */
  async getUsageMetrics(filters?: FinancialReportFilters): Promise<UsageMetrics> {
    try {
      let query = this.supabase
        .from('billing_usage_records')
        .select('*');

      if (filters?.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.from)
          .lte('created_at', filters.dateRange.to);
      }

      const { data: usageRecords, error } = await query;
      if (error) throw error;

      const totalWordsProcessed = usageRecords?.reduce((sum, record) => sum + record.words_processed, 0) || 0;
      
      // Get unique customers for average calculation
      const uniqueCustomers = new Set(usageRecords?.map(record => record.billing_subscription_id)).size || 1;
      const averageWordsPerCustomer = totalWordsProcessed / uniqueCustomers;

      const totalCost = usageRecords?.reduce((sum, record) => sum + record.total_cost, 0) || 0;
      const costPerWord = totalWordsProcessed > 0 ? totalCost / totalWordsProcessed : 0;

      return {
        totalWordsProcessed,
        averageWordsPerCustomer,
        usageGrowthRate: 0, // TODO: Calculate usage growth
        usageByPlan: {}, // TODO: Group by plan
        costPerWord,
        usageEfficiency: 0, // TODO: Define and calculate efficiency
        peakUsagePeriods: [] // TODO: Identify peak periods
      };

    } catch (error) {
      console.error('Error calculating usage metrics:', error);
      throw new Error('Failed to calculate usage metrics');
    }
  }

  /**
   * Get churn metrics
   */
  async getChurnMetrics(filters?: FinancialReportFilters): Promise<ChurnMetrics> {
    try {
      const { data: subscriptions, error } = await this.supabase
        .from('billing_subscriptions')
        .select('*');

      if (error) throw error;

      const totalSubscriptions = subscriptions?.length || 0;
      const canceledSubscriptions = subscriptions?.filter(sub => sub.status === 'canceled').length || 0;
      
      const churnRate = totalSubscriptions > 0 ? (canceledSubscriptions / totalSubscriptions) * 100 : 0;
      const retentionRate = 100 - churnRate;

      return {
        churnRate,
        churnReasons: {}, // TODO: Implement churn reason tracking
        churnedRevenue: 0, // TODO: Calculate churned revenue
        retentionRate,
        customerLifetime: 0, // TODO: Calculate customer lifetime
        churnPredictors: [] // TODO: Implement ML-based churn prediction
      };

    } catch (error) {
      console.error('Error calculating churn metrics:', error);
      throw new Error('Failed to calculate churn metrics');
    }
  }

  /**
   * Get forecasting metrics
   */
  async getForecastingMetrics(filters?: FinancialReportFilters): Promise<ForecastingMetrics> {
    // TODO: Implement sophisticated forecasting algorithms
    return {
      projectedRevenue: [],
      projectedChurn: [],
      growthTrajectory: {
        rate: 0,
        projection: 0,
        confidence: 0
      }
    };
  }

  /**
   * Get compliance reporting data
   */
  async getComplianceReporting(filters?: FinancialReportFilters): Promise<ComplianceReporting> {
    try {
      // Audit logs - using invoice changes as proxy
      const { data: invoices } = await this.supabase
        .from('billing_invoices')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);

      const auditLogs = invoices?.map(invoice => ({
        timestamp: invoice.updated_at,
        event: `Invoice ${invoice.status}`,
        entityType: 'invoice',
        entityId: invoice.id,
        changes: { status: invoice.status, amount: invoice.total },
        userId: undefined
      })) || [];

      // Tax compliance
      const taxCompliance = {
        totalTaxCollected: invoices?.reduce((sum, inv) => sum + (inv.tax_amount / 100), 0) || 0,
        taxByJurisdiction: {}, // TODO: Implement jurisdiction tracking
        exemptions: 0,
        taxReports: []
      };

      return {
        auditLogs,
        taxCompliance,
        dataRetention: {
          scheduledDeletions: 0,
          retentionPolicies: []
        },
        financialCompliance: {
          revenueRecognition: [],
          accountingStandards: 'GAAP',
          lastAudit: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw new Error('Failed to generate compliance report');
    }
  }

  /**
   * Export financial data
   */
  async exportFinancialData(
    metrics: FinancialMetrics, 
    options: ExportOptions
  ): Promise<Blob | string> {
    try {
      switch (options.format) {
        case 'json':
          return JSON.stringify(metrics, null, 2);
        
        case 'csv':
          return this.exportToCSV(metrics);
        
        case 'excel':
          return await this.exportToExcel(metrics, options);
        
        case 'pdf':
          return await this.exportToPDF(metrics, options);
        
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      console.error('Error exporting financial data:', error);
      throw new Error('Failed to export financial data');
    }
  }

  // Private helper methods

  private aggregateRevenueByPeriod(invoices: any[]): Array<{
    period: string;
    amount: number;
    recurring: number;
    oneTime: number;
  }> {
    const periods: Record<string, { total: number; recurring: number; oneTime: number }> = {};

    invoices.forEach(invoice => {
      if (invoice.paid_at) {
        const period = new Date(invoice.paid_at).toISOString().slice(0, 7); // YYYY-MM
        if (!periods[period]) {
          periods[period] = { total: 0, recurring: 0, oneTime: 0 };
        }
        
        const amount = invoice.total / 100;
        periods[period].total += amount;
        
        if (invoice.billing_subscription_id) {
          periods[period].recurring += amount;
        } else {
          periods[period].oneTime += amount;
        }
      }
    });

    return Object.entries(periods).map(([period, data]) => ({
      period,
      amount: data.total,
      recurring: data.recurring,
      oneTime: data.oneTime
    }));
  }

  private async detectRevenueLeakage(filters?: FinancialReportFilters) {
    // Simplified revenue leakage detection
    const { data: failedInvoices } = await this.supabase
      .from('billing_invoices')
      .select('*')
      .eq('status', 'uncollectible');

    const amount = failedInvoices?.reduce((sum, inv) => sum + (inv.total / 100), 0) || 0;
    
    return {
      amount,
      causes: [
        {
          type: 'Failed Payments',
          amount: amount * 0.7,
          description: 'Payments that failed due to insufficient funds or expired cards'
        },
        {
          type: 'Processing Errors',
          amount: amount * 0.3,
          description: 'Technical errors during payment processing'
        }
      ]
    };
  }

  private async calculateRevenueGrowth(filters?: FinancialReportFilters): Promise<number> {
    // TODO: Implement proper revenue growth calculation
    return 0;
  }

  private calculateSubscriptionGrowthRate(subscriptions: any[]): number {
    // Simplified growth rate calculation
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const currentMonthSubs = subscriptions.filter(sub => 
      new Date(sub.created_at) >= lastMonth
    ).length;

    const previousMonthSubs = subscriptions.filter(sub => 
      new Date(sub.created_at) >= twoMonthsAgo && new Date(sub.created_at) < lastMonth
    ).length;

    return previousMonthSubs > 0 ? ((currentMonthSubs - previousMonthSubs) / previousMonthSubs) * 100 : 0;
  }

  private async calculateLifetimeValue(): Promise<number> {
    // TODO: Implement proper LTV calculation
    return 0;
  }

  private exportToCSV(metrics: FinancialMetrics): string {
    // TODO: Implement CSV export
    return '';
  }

  private async exportToExcel(metrics: FinancialMetrics, options: ExportOptions): Promise<Blob> {
    // TODO: Implement Excel export using a library like xlsx
    return new Blob();
  }

  private async exportToPDF(metrics: FinancialMetrics, options: ExportOptions): Promise<Blob> {
    // TODO: Implement PDF export using a library like jsPDF
    return new Blob();
  }

  private generateCacheKey(operation: string, filters?: FinancialReportFilters): string {
    return `${operation}-${JSON.stringify(filters || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheTimeout) {
      return item.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }
} 