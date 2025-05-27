
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Download, TrendingUp, FileText, Calendar } from "lucide-react";
import Header from "@/components/layout/Header";

interface BillingData {
  currentPlan: string;
  wordsProcessed: number;
  wordsLimit: number;
  monthlySpend: number;
  nextBilling: string;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  wordsProcessed: number;
  downloadUrl: string;
}

const Billing = () => {
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  const billingData: BillingData = {
    currentPlan: "Professional",
    wordsProcessed: 125430,
    wordsLimit: 200000,
    monthlySpend: 89.50,
    nextBilling: "2024-02-15",
  };

  const invoices: Invoice[] = [
    {
      id: "INV-2024-001",
      date: "2024-01-15",
      amount: 89.50,
      status: "paid",
      wordsProcessed: 125430,
      downloadUrl: "#",
    },
    {
      id: "INV-2023-012",
      date: "2023-12-15",
      amount: 76.20,
      status: "paid",
      wordsProcessed: 106800,
      downloadUrl: "#",
    },
    {
      id: "INV-2023-011",
      date: "2023-11-15",
      amount: 92.30,
      status: "paid",
      wordsProcessed: 129400,
      downloadUrl: "#",
    },
    {
      id: "INV-2023-010",
      date: "2023-10-15",
      amount: 83.70,
      status: "paid",
      wordsProcessed: 117200,
      downloadUrl: "#",
    },
  ];

  const usagePercentage = (billingData.wordsProcessed / billingData.wordsLimit) * 100;

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

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

        {/* Invoice History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>
                  Download and view your past invoices
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Words Processed</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{formatDate(invoice.date)}</TableCell>
                    <TableCell>{invoice.wordsProcessed.toLocaleString()}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Billing;
