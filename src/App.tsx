import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Reports from "./pages/Reports";
import DetailedReport from "./pages/DetailedReport";
import Billing from "./pages/Billing";
import FinancialReports from "./pages/FinancialReports";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmailVerification from "./pages/EmailVerification";
import UserManagement from "./pages/UserManagement";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import SecurityAdmin from '@/pages/SecurityAdmin';
import FeedbackDemo from './pages/FeedbackDemo';
import QAErrors from './pages/QAErrors';
import Monitoring from './pages/Monitoring';
import PermissionDemo from './components/demo/PermissionDemo';
import { UserRole, Permission } from '@/lib/rbac';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Protected Routes - Basic Authentication Required */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/upload" element={
            <RoleProtectedRoute requiredPermission={Permission.UPLOAD_FILES}>
              <Upload />
            </RoleProtectedRoute>
          } />
          <Route path="/reports" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_REPORTS}>
              <Reports />
            </RoleProtectedRoute>
          } />
          <Route path="/report/:reportId" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_REPORTS}>
              <DetailedReport />
            </RoleProtectedRoute>
          } />
          <Route path="/billing" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_BILLING}>
              <Billing />
            </RoleProtectedRoute>
          } />
          <Route path="/financial-reports" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_ALL_BILLING}>
              <FinancialReports />
            </RoleProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes - Role-Based Access Control */}
          <Route path="/admin/users" element={
            <RoleProtectedRoute 
              requiredPermission={Permission.VIEW_USERS}
              minRole={UserRole.MANAGER}
            >
              <UserManagement />
            </RoleProtectedRoute>
          } />
          <Route path="/admin/security" element={
            <RoleProtectedRoute 
              requiredPermission={Permission.VIEW_SECURITY_LOGS}
              minRole={UserRole.ADMIN}
            >
              <SecurityAdmin />
            </RoleProtectedRoute>
          } />
          
          {/* Demo Routes - Development */}
          <Route path="/demo/feedback" element={
            <ProtectedRoute>
              <FeedbackDemo />
            </ProtectedRoute>
          } />
          <Route path="/demo/qa-errors" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_REPORTS}>
              <QAErrors />
            </RoleProtectedRoute>
          } />
          <Route path="/demo/permissions" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_USERS}>
              <PermissionDemo />
            </RoleProtectedRoute>
          } />
          <Route path="/demo/monitoring" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_REPORTS}>
              <Monitoring />
            </RoleProtectedRoute>
          } />
          
          {/* Authentication Routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<EmailVerification />} />
          
          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
