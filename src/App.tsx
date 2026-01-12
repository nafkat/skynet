import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Force rebuild

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PayrollExport from "./pages/PayrollExport";
import TimeEntry from "./pages/TimeEntry";
import Employees from "./pages/Employees";
import Projects from "./pages/Projects";
import Specialties from "./pages/Specialties";
import Reports from "./pages/Reports";
import Corrections from "./pages/Corrections";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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
    // Redirect based on role
    if (role === 'admin' || role === 'hr') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Smart redirect based on user role
function RoleBasedRedirect() {
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

  // Admin and HR go to admin dashboard, timekeepers go to regular dashboard
  if (role === 'admin' || role === 'hr') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<RoleBasedRedirect />} />
      
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
