import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import ResidentDashboard from "./pages/ResidentDashboard";
import ResidentOccurrences from "./pages/ResidentOccurrences";
import ResidentOccurrenceDetails from "./pages/ResidentOccurrenceDetails";
import ResidentProfile from "./pages/ResidentProfile";
import Condominiums from "./pages/Condominiums";
import CondominiumDetails from "./pages/CondominiumDetails";
import Occurrences from "./pages/Occurrences";
import OccurrenceDetails from "./pages/OccurrenceDetails";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import DefenseAnalysis from "./pages/DefenseAnalysis";
import SindicoSettings from "./pages/SindicoSettings";
import SindicoInvoices from "./pages/SindicoInvoices";
import SindicoSubscriptions from "./pages/SindicoSubscriptions";

import PartyHall from "./pages/PartyHall";
import PartyHallSettings from "./pages/PartyHallSettings";
import PartyHallNotifications from "./pages/PartyHallNotifications";
import { Navigate } from "react-router-dom";
import ResidentAccess from "./pages/ResidentAccess";
import AuthCallback from "./pages/AuthCallback";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Sindicos from "./pages/superadmin/Sindicos";
import SuperAdminCondominiums from "./pages/superadmin/Condominiums";
import Subscriptions from "./pages/superadmin/Subscriptions";
import SubscriptionDetails from "./pages/superadmin/SubscriptionDetails";
import SuperAdminInvoices from "./pages/superadmin/Invoices";
import Logs from "./pages/superadmin/Logs";
import MagicLinkLogs from "./pages/superadmin/MagicLinkLogs";
import CronJobs from "./pages/superadmin/CronJobs";
import Transfers from "./pages/superadmin/Transfers";
import WhatsApp from "./pages/superadmin/WhatsApp";
import SuperAdminSettings from "./pages/superadmin/Settings";
import ContactMessages from "./pages/superadmin/ContactMessages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/callback/next/:next" element={<AuthCallback />} />
              
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
                path="/defenses"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <DefenseAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/party-hall"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PartyHall />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/party-hall/settings"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PartyHallSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/party-hall/notifications"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PartyHallNotifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/settings"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/invoices"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoInvoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/subscriptions"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoSubscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/profile"
                element={<Navigate to="/sindico/settings" replace />}
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
                path="/resident/occurrences"
                element={
                  <ProtectedRoute requiredRole="morador">
                    <ResidentOccurrences />
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
              <Route path="/resident/access" element={<ResidentAccess />} />

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
                path="/superadmin/subscriptions/:id"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <SubscriptionDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/invoices"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <SuperAdminInvoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/transfers"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <Transfers />
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
                path="/superadmin/logs/magic-link"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <MagicLinkLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/cron-jobs"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <CronJobs />
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
              <Route
                path="/superadmin/settings"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <SuperAdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/contact-messages"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <ContactMessages />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
