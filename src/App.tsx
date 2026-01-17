import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Force rebuild - v2

// Pages
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminConsole from "./pages/AdminConsole";
import PayrollExport from "./pages/PayrollExport";
import AuditLog from "./pages/AuditLog";
import TimeEntry from "./pages/TimeEntry";
import Employees from "./pages/Employees";
import Projects from "./pages/Projects";
import Specialties from "./pages/Specialties";
import Reports from "./pages/Reports";
import Corrections from "./pages/Corrections";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import AnnouncementsList from "./pages/AnnouncementsList";
import AnnouncementCreate from "./pages/AnnouncementCreate";
import AnnouncementDetails from "./pages/AnnouncementDetails";

// Procurement Pages
import ProcurementLayout from "./pages/procurement/ProcurementLayout";
import ProcurementDashboard from "./pages/procurement/ProcurementDashboard";
import PurchaseRequests from "./pages/procurement/PurchaseRequests";
import RFQs from "./pages/procurement/RFQs";
import PurchaseOrders from "./pages/procurement/PurchaseOrders";
import Receiving from "./pages/procurement/Receiving";
import Suppliers from "./pages/procurement/Suppliers";
import ProcurementReports from "./pages/procurement/ProcurementReports";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  children, 
  requiredRoles 
}: { 
  children: React.ReactNode;
  requiredRoles?: ('admin' | 'hr' | 'timekeeper')[];
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && role && !requiredRoles.includes(role)) {
    // Redirect to home launcher for unauthorized roles
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

// Smart redirect based on user role
function RoleBasedRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // All authenticated users go to /home launcher
  return <Navigate to="/home" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route path="/" element={<RoleBasedRedirect />} />
      
      {/* Home Launcher - All authenticated users */}
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin Console - Admin only */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminConsole />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin Dashboard - Admin and HR only */}
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Payroll Export - Admin and HR only */}
      <Route 
        path="/admin/payroll-export" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <PayrollExport />
          </ProtectedRoute>
        } 
      />
      
      {/* Audit Log - Admin and HR only */}
      <Route 
        path="/admin/audit-log" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AuditLog />
          </ProtectedRoute>
        } 
      />
      
      {/* Announcements - Admin and HR only */}
      <Route 
        path="/announcements" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AnnouncementsList />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/announcements/new" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AnnouncementCreate />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/announcements/:id" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AnnouncementDetails />
          </ProtectedRoute>
        } 
      />
      
      {/* Timekeeper Dashboard */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/time-entry" 
        element={
          <ProtectedRoute>
            <TimeEntry />
          </ProtectedRoute>
        } 
      />
      
      {/* Employees - Admin and HR */}
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <Employees />
          </ProtectedRoute>
        } 
      />
      
      {/* Projects - Admin and HR */}
      <Route 
        path="/projects" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <Projects />
          </ProtectedRoute>
        } 
      />
      
      {/* Specialties - Admin and HR */}
      <Route 
        path="/specialties" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <Specialties />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <Reports />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/corrections" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <Corrections />
          </ProtectedRoute>
        } 
      />
      
      {/* Procurement Module - Admin only */}
      <Route 
        path="/procurement" 
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <ProcurementLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProcurementDashboard />} />
        <Route path="purchase-requests" element={<PurchaseRequests />} />
        <Route path="rfqs" element={<RFQs />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="receiving" element={<Receiving />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<ProcurementReports />} />
      </Route>
      
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
