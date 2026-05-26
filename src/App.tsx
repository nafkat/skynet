import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";

// Force rebuild - v2

// Pages
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PayrollExport from "./pages/PayrollExport";

// Admin Console Pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminAudit from "./pages/admin/AdminAudit";
import Companies from "./pages/admin/Companies";

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
import Messages from "./pages/Messages";
import DevicePending from "./pages/DevicePending";

// Procurement Pages
import ProcurementLayout from "./pages/procurement/ProcurementLayout";
import ProcurementDashboard from "./pages/procurement/ProcurementDashboard";
import RequestOffersList from "./pages/procurement/RequestOffersList";
import RequestOfferCreate from "./pages/procurement/RequestOfferCreate";
import RequestOfferDetails from "./pages/procurement/RequestOfferDetails";
import Suppliers from "./pages/procurement/Suppliers";
import ProcurementReports from "./pages/procurement/ProcurementReports";

// Dashboard Pages
import AnnouncementsDashboard from "./pages/AnnouncementsDashboard";
import MessagesDashboard from "./pages/MessagesDashboard";

// Module Layouts
import AnnouncementsLayout from "./pages/announcements/AnnouncementsLayout";
import MessagesLayout from "./pages/messages/MessagesLayout";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  children, 
  requiredRoles 
}: { 
  children: React.ReactNode;
  requiredRoles?: ('admin' | 'hr' | 'timekeeper')[];
}) {
  const { user, role, loading, deviceStatus } = useAuth();

  if (loading || deviceStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Device not approved — redirect to pending screen
  if (deviceStatus === 'pending' || deviceStatus === 'blocked') {
    return <Navigate to="/device-pending" replace />;
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
      <Route path="/device-pending" element={<DevicePending />} />
      
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
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminUsers />} />
        <Route path="templates" element={<AdminTemplates />} />
        <Route path="companies" element={<Companies />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="devices" element={<AdminTrustedDevices />} />
      </Route>
      
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
      
      
      {/* Announcements Module - Admin and HR only */}
      <Route 
        path="/announcements" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <AnnouncementsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AnnouncementsDashboard />} />
        <Route path="dashboard" element={<AnnouncementsDashboard />} />
        <Route path="list" element={<AnnouncementsList />} />
        <Route path="new" element={<AnnouncementCreate />} />
        <Route path=":id" element={<AnnouncementDetails />} />
      </Route>
      
      {/* Messages Module - Admin and HR only */}
      <Route 
        path="/messages" 
        element={
          <ProtectedRoute requiredRoles={['admin', 'hr']}>
            <MessagesLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MessagesDashboard />} />
        <Route path="dashboard" element={<MessagesDashboard />} />
        <Route path="conversations" element={<Messages />} />
      </Route>
      
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
        <Route path="dashboard" element={<ProcurementDashboard />} />
        <Route path="request-offers" element={<RequestOffersList />} />
        <Route path="request-offers/new" element={<RequestOfferCreate />} />
        <Route path="request-offers/:id" element={<RequestOfferDetails />} />
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
