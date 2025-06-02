/**
 * Financial Reports Page
 * 
 * Page component for financial reporting and analytics dashboard.
 * Provides navigation context and page layout for the billing analytics.
 */

import React from 'react';
import { FinancialDashboard } from '@/components/billing/FinancialDashboard';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function FinancialReports() {
  const { user, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FinancialDashboard />
      </div>
    </div>
  );
} 