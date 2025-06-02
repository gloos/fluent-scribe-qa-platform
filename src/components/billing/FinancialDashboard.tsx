/**
 * Financial Dashboard Component
 * 
 * Displays comprehensive financial reporting and analytics
 * for billing performance, revenue tracking, and compliance.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Calendar,
  FileText
} from 'lucide-react';
import { 
  FinancialReportingService, 
  FinancialMetrics, 
  FinancialReportFilters,
  ExportOptions,
  ComplianceReporting 
} from '@/lib/services/financial-reporting-service';
import { ReportsOverviewChart } from '@/components/charts/ReportsOverviewChart';
import { QualityDistributionChart } from '@/components/charts/QualityDistributionChart';
import { ProcessingEfficiencyChart } from '@/components/charts/ProcessingEfficiencyChart';

interface FinancialDashboardProps {
  className?: string;
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' }
];

const EXPORT_FORMATS = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'pdf', label: 'PDF Report' },
  { value: 'json', label: 'JSON Data' }
];

const PLAN_COLORS = {
  starter: '#3B82F6', // blue
  professional: '#10B981', // green
  enterprise: '#8B5CF6', // purple
  basic: '#F59E0B', // amber
  premium: '#EF4444' // red
};

export function FinancialDashboard({ className }: FinancialDashboardProps) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReporting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [filters, setFilters] = useState<FinancialReportFilters>({
    currency: 'USD',
    includeTrials: true,
    includeCanceled: false,
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    }
  });

  const financialService = FinancialReportingService.getInstance();

  useEffect(() => {
    loadFinancialData();
  }, [filters]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, complianceData] = await Promise.all([
        financialService.getFinancialMetrics(filters),
        financialService.getComplianceReporting(filters)
      ]);

      setMetrics(metricsData);
      setCompliance(complianceData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError('Failed to load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!metrics) return;

    try {
      setExporting(true);
      const exportOptions: ExportOptions = {
        format: format as 'excel' | 'csv' | 'pdf' | 'json',
        includeCharts: true,
        includeRawData: true,
        currency: filters.currency
      };

      const result = await financialService.exportFinancialData(metrics, exportOptions);
      
      // Handle download based on format
      if (typeof result === 'string') {
        // JSON or CSV
        const blob = new Blob([result], { 
          type: format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Blob (Excel, PDF)
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('Failed to export financial data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number, currency = filters.currency || 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };

  // Transform revenue by plan data for the chart
  const getRevenueByPlanChartData = () => {
    if (!metrics) return [];
    
    const totalRevenue = metrics.revenue.totalRevenue;
    
    return Object.entries(metrics.revenue.revenueByPlan).map(([plan, amount]) => ({
      range: plan,
      count: amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
      color: PLAN_COLORS[plan as keyof typeof PLAN_COLORS] || '#64748B' // default gray
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">Loading financial data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            onClick={loadFinancialData} 
            variant="outline" 
            size="sm" 
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive billing analytics and revenue reporting
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={filters.currency} onValueChange={(value) => 
            setFilters(prev => ({ ...prev, currency: value }))
          }>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(value) => handleExport(value)}>
            <SelectTrigger className="w-40">
              <Download className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_FORMATS.map(format => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={loadFinancialData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.revenue.totalRevenue)}
                </div>
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="flex items-center mt-2">
                  {metrics.revenue.revenueGrowth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${
                    metrics.revenue.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercentage(Math.abs(metrics.revenue.revenueGrowth))}
                  </span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.subscriptions.activeSubscriptions}
                </div>
                <div className="text-sm text-gray-600">Active Subscriptions</div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">
                    +{metrics.subscriptions.newSubscriptions} this month
                  </span>
                </div>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatPercentage(metrics.payments.paymentSuccessRate)}
                </div>
                <div className="text-sm text-gray-600">Payment Success Rate</div>
                <div className="flex items-center mt-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    {metrics.payments.successfulPayments} successful
                  </span>
                </div>
              </div>
              <CreditCard className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.revenue.averageRevenuePerUser)}
                </div>
                <div className="text-sm text-gray-600">Average Revenue Per User</div>
                <div className="flex items-center mt-2">
                  <Activity className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    {metrics.usage.totalWordsProcessed.toLocaleString()} words
                  </span>
                </div>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReportsOverviewChart 
                  data={metrics.revenue.revenueByPeriod.map(period => ({
                    date: period.period,
                    files: period.amount,
                    avgScore: period.recurring + period.oneTime
                  }))}
                  height={300}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Revenue by Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QualityDistributionChart 
                  data={getRevenueByPlanChartData()}
                  height={300}
                />
              </CardContent>
            </Card>
          </div>

          {/* Revenue Leakage Alert */}
          {metrics.revenue.revenueLeakage.amount > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Revenue Leakage Detected</div>
                <div className="mt-2">
                  {formatCurrency(metrics.revenue.revenueLeakage.amount)} in potential revenue loss identified.
                  <div className="mt-2 space-y-1">
                    {metrics.revenue.revenueLeakage.causes.map((cause, index) => (
                      <div key={index} className="text-sm">
                        • {cause.type}: {formatCurrency(cause.amount)} - {cause.description}
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Recurring Revenue</span>
                  <span className="font-medium">
                    {formatCurrency(metrics.revenue.recurringRevenue)}
                  </span>
                </div>
                <Progress 
                  value={(metrics.revenue.recurringRevenue / metrics.revenue.totalRevenue) * 100} 
                  className="h-2"
                />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">One-time Revenue</span>
                  <span className="font-medium">
                    {formatCurrency(metrics.revenue.oneTimeRevenue)}
                  </span>
                </div>
                <Progress 
                  value={(metrics.revenue.oneTimeRevenue / metrics.revenue.totalRevenue) * 100} 
                  className="h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(metrics.revenue.averageRevenuePerUser)}
                  </div>
                  <div className="text-sm text-gray-600">ARPU</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(metrics.subscriptions.lifetimeValue)}
                  </div>
                  <div className="text-sm text-gray-600">Customer LTV</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Churn Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {formatPercentage(metrics.churn.churnRate)}
                  </div>
                  <div className="text-sm text-gray-600">Monthly Churn Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatPercentage(metrics.churn.retentionRate)}
                  </div>
                  <div className="text-sm text-gray-600">Retention Rate</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.subscriptions.activeSubscriptions}
                    </div>
                    <div className="text-sm text-gray-600">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.subscriptions.newSubscriptions}
                    </div>
                    <div className="text-sm text-gray-600">New This Month</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.subscriptions.canceledSubscriptions}
                    </div>
                    <div className="text-sm text-gray-600">Canceled</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatPercentage(metrics.subscriptions.subscriptionGrowthRate)}
                    </div>
                    <div className="text-sm text-gray-600">Growth Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscriptions by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metrics.subscriptions.subscriptionsByPlan).map(([plan, count]) => (
                    <div key={plan} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Badge variant="outline" className="mr-2">
                          {plan}
                        </Badge>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {metrics.usage.totalWordsProcessed.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Words Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {Math.round(metrics.usage.averageWordsPerCustomer).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Avg Words per Customer</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {formatCurrency(metrics.usage.costPerWord)}
                  </div>
                  <div className="text-sm text-gray-600">Cost per Word</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {formatPercentage(metrics.usage.usageEfficiency)}
                  </div>
                  <div className="text-sm text-gray-600">Usage Efficiency</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth Trends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatPercentage(metrics.usage.usageGrowthRate)}
                  </div>
                  <div className="text-sm text-gray-600">Usage Growth Rate</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          {compliance && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {compliance.auditLogs.slice(0, 10).map((log, index) => (
                      <div key={index} className="border-l-2 border-blue-200 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">{log.event}</div>
                            <div className="text-xs text-gray-600">
                              {log.entityType}: {log.entityId}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Tax Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Tax Collected</span>
                    <span className="font-medium">
                      {formatCurrency(compliance.taxCompliance.totalTaxCollected)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tax Exemptions</span>
                    <span className="font-medium">
                      {compliance.taxCompliance.exemptions}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Accounting Standards</span>
                    <Badge variant="outline">
                      {compliance.financialCompliance.accountingStandards}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Last Audit</span>
                    <span className="text-sm text-gray-600">
                      {new Date(compliance.financialCompliance.lastAudit).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 