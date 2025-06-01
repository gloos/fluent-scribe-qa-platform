import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, BarChart3, Shield, CreditCard, Zap, MessageSquare } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />
      
      {/* Hero Section */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            AI-Powered <span className="text-blue-600">Linguistic QA</span> Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Upload XLIFF files, leverage advanced LLM analysis, and get comprehensive quality assessment reports with detailed error categorization and scoring.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/upload">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                <Upload className="mr-2 h-5 w-5" />
                Start Analysis
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="px-8 py-3">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Upload className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>XLIFF Upload & Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Seamlessly upload and process XLIFF files with advanced AI-powered linguistic analysis and quality assessment.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>Comprehensive Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Get detailed quality metrics, error analysis, and performance insights with visual dashboards and reporting.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Shield className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle>Enterprise Security</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Enterprise-grade security with encrypted file handling, secure processing, and comprehensive audit trails.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <FileText className="h-12 w-12 text-orange-600 mb-4" />
                <CardTitle>Detailed Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate comprehensive quality assessment reports with MQM scoring and detailed error categorization.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <MessageSquare className="h-12 w-12 text-pink-600 mb-4" />
                <CardTitle>User Feedback System</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Continuous improvement through integrated feedback collection on error categorization and assessment quality.
                </CardDescription>
                <div className="mt-4">
                  <Link to="/feedback-demo">
                    <Button size="sm" variant="outline" className="w-full">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Try Feedback Demo
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Zap className="h-12 w-12 text-yellow-600 mb-4" />
                <CardTitle>Fast Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Lightning-fast analysis powered by optimized AI models for quick turnaround on quality assessments.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Shield className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Role-based access control with Owner and Collaborator permissions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CreditCard className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>Flexible Billing</CardTitle>
                <CardDescription>
                  Pay-per-use model based on words processed with transparent pricing
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-blue-600 mb-2" />
                <CardTitle>MQM Scoring</CardTitle>
                <CardDescription>
                  Industry-standard Multidimensional Quality Metrics evaluation
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
