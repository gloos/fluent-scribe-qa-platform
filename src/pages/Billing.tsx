import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard } from "lucide-react";
import Header from "@/components/layout/Header";
import ReceiptList from "@/components/billing/ReceiptList";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface BillingData {
  currentPlan: string;
  wordsProcessed: number;
  wordsLimit: number;
  monthlySpend: number;
  nextBilling: string;
}

const Billing = () => {
  const [billingCustomerId, setBillingCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  const billingData: BillingData = {
    currentPlan: "Professional",
    wordsProcessed: 125430,
    wordsLimit: 200000,
    monthlySpend: 89.50,
    nextBilling: "2024-02-15",
  };

  // Fetch billing customer ID for the current user
  useEffect(() => {
    const fetchBillingCustomer = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const { data, error } = await supabase
          .from('billing_customers')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No billing customer found - this is okay for new users
            setError('No billing account found. Please contact support to set up billing.');
          } else {
            throw error;
          }
        } else {
          setBillingCustomerId(data.id);
        }
      } catch (err) {
        console.error('Error fetching billing customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingCustomer();
  }, [user?.id]);

  const usagePercentage = (billingData.wordsProcessed / billingData.wordsLimit) * 100;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view billing information</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Usage</h1>
            <p className="text-gray-600">
              Manage your subscription and view usage statistics
            </p>
          </div>
          <Button variant="outline">
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment Method
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <div className="text-red-600">⚠️</div>
                <p className="text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan & Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <CardDescription>
                Words processed this billing cycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Words Processed</span>
                  <span className="text-sm text-gray-500">
                    {billingData.wordsProcessed.toLocaleString()} / {billingData.wordsLimit.toLocaleString()}
                  </span>
                </div>
                <Progress value={usagePercentage} className="h-3" />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{usagePercentage.toFixed(1)}% used</span>
                  <span>{(billingData.wordsLimit - billingData.wordsProcessed).toLocaleString()} remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{billingData.currentPlan}</p>
                  <p className="text-sm text-gray-500">Current plan</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{formatCurrency(billingData.monthlySpend)}</p>
                  <p className="text-sm text-gray-500">This month's usage</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Next billing: {formatDate(billingData.nextBilling)}</p>
                </div>
                <Button className="w-full" variant="outline">
                  Change Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Tiers */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Pricing Plans</CardTitle>
            <CardDescription>
              Choose the plan that best fits your needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Starter Plan */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Starter</h3>
                <p className="text-3xl font-bold mb-4">$0.0005<span className="text-base font-normal text-gray-500">/word</span></p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li>• Up to 50,000 words/month</li>
                  <li>• Basic error detection</li>
                  <li>• Email support</li>
                  <li>• Standard processing speed</li>
                </ul>
                <Button variant="outline" className="w-full">Current Plan</Button>
              </div>

              {/* Professional Plan */}
              <div className="border-2 border-blue-500 rounded-lg p-6 relative">
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                  Popular
                </Badge>
                <h3 className="text-lg font-semibold mb-2">Professional</h3>
                <p className="text-3xl font-bold mb-4">$0.0004<span className="text-base font-normal text-gray-500">/word</span></p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li>• Up to 200,000 words/month</li>
                  <li>• Advanced error categorization</li>
                  <li>• Priority support</li>
                  <li>• Fast processing speed</li>
                  <li>• Custom style guides</li>
                </ul>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Upgrade</Button>
              </div>

              {/* Enterprise Plan */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Enterprise</h3>
                <p className="text-3xl font-bold mb-4">$0.0003<span className="text-base font-normal text-gray-500">/word</span></p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li>• Unlimited words</li>
                  <li>• Full MQM compliance</li>
                  <li>• Dedicated support</li>
                  <li>• Fastest processing</li>
                  <li>• API access</li>
                  <li>• Custom integrations</li>
                </ul>
                <Button variant="outline" className="w-full">Contact Sales</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipt History - Real Implementation */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Payment Receipts</CardTitle>
                <CardDescription>
                  View and download your payment receipts
                </CardDescription>
              </div>
              {/* Remove the Download All button as it's not needed with the ReceiptList component */}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading billing information...</span>
              </div>
            ) : billingCustomerId ? (
              <ReceiptList 
                customerId={billingCustomerId}
                className="mt-0"
              />
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg mb-2">📧</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No billing account found</h3>
                <p className="text-gray-500">
                  Please contact support to set up your billing account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Billing;
