import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ResidentDashboard from "./pages/ResidentDashboard";
import ResidentOccurrenceDetails from "./pages/ResidentOccurrenceDetails";
import ResidentProfile from "./pages/ResidentProfile";
import Condominiums from "./pages/Condominiums";
import CondominiumDetails from "./pages/CondominiumDetails";
import Occurrences from "./pages/Occurrences";
import OccurrenceDetails from "./pages/OccurrenceDetails";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import SindicoSettings from "./pages/SindicoSettings";
import SindicoProfile from "./pages/SindicoProfile";
import ResidentAccess from "./pages/ResidentAccess";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Sindicos from "./pages/superadmin/Sindicos";
import SuperAdminCondominiums from "./pages/superadmin/Condominiums";
import Subscriptions from "./pages/superadmin/Subscriptions";
import Logs from "./pages/superadmin/Logs";
import WhatsApp from "./pages/superadmin/WhatsApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Síndico Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/condominiums"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <Condominiums />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/condominiums/:id"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <CondominiumDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/occurrences"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <Occurrences />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/occurrences/:id"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <OccurrenceDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/profile"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoProfile />
                  </ProtectedRoute>
                }
              />

              {/* Resident Routes */}
              <Route
                path="/resident"
                element={
                  <ProtectedRoute requiredRole="morador">
                    <ResidentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resident/occurrences/:id"
                element={
                  <ProtectedRoute requiredRole="morador">
                    <ResidentOccurrenceDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resident/profile"
                element={
                  <ProtectedRoute requiredRole="morador">
                    <ResidentProfile />
                  </ProtectedRoute>
                }
              />
              <Route path="/acesso/:token" element={<ResidentAccess />} />

              {/* Super Admin Routes */}
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/sindicos"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <Sindicos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/condominiums"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <SuperAdminCondominiums />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/subscriptions"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <Subscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/logs"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <Logs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/whatsapp"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <WhatsApp />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
