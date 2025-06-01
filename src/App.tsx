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
          
          {/* Demo and Development Routes */}
          <Route path="/demo/permissions" element={
            <ProtectedRoute>
              <PermissionDemo />
            </ProtectedRoute>
          } />
          
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          
          {/* Feedback and QA Routes */}
          <Route path="/feedback-demo" element={
            <ProtectedRoute>
              <FeedbackDemo />
            </ProtectedRoute>
          } />
          <Route path="/qa-errors" element={
            <RoleProtectedRoute requiredPermission={Permission.VIEW_QA_SESSION}>
              <QAErrors />
            </RoleProtectedRoute>
          } />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
