import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { UserRoleProvider } from "@/hooks/useUserRole";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const Contact = lazy(() => import("./pages/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const CivilCode = lazy(() => import("./pages/CivilCode"));
const Plans = lazy(() => import("./pages/Plans"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResidentDashboard = lazy(() => import("./pages/ResidentDashboard"));
const ResidentOccurrences = lazy(() => import("./pages/ResidentOccurrences"));
const ResidentOccurrenceDetails = lazy(() => import("./pages/ResidentOccurrenceDetails"));
const ResidentProfile = lazy(() => import("./pages/ResidentProfile"));
const Condominiums = lazy(() => import("./pages/Condominiums"));
const CondominiumDetails = lazy(() => import("./pages/CondominiumDetails"));
const Occurrences = lazy(() => import("./pages/Occurrences"));
const OccurrenceDetails = lazy(() => import("./pages/OccurrenceDetails"));
const Reports = lazy(() => import("./pages/Reports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const DefenseAnalysis = lazy(() => import("./pages/DefenseAnalysis"));
const SindicoSettings = lazy(() => import("./pages/SindicoSettings"));
const SindicoInvoices = lazy(() => import("./pages/SindicoInvoices"));
const SindicoSubscriptions = lazy(() => import("./pages/SindicoSubscriptions"));
const SindicoPorteiros = lazy(() => import("./pages/sindico/Porteiros"));
const SindicoBanners = lazy(() => import("./pages/sindico/Banners"));
const PackagesDashboard = lazy(() => import("./pages/sindico/PackagesDashboard"));
const SindicoPackages = lazy(() => import("./pages/sindico/Packages"));
const PackagesHistory = lazy(() => import("./pages/sindico/PackagesHistory"));
const PackagesCondominiumHistory = lazy(() => import("./pages/sindico/PackagesCondominiumHistory"));
const PartyHall = lazy(() => import("./pages/PartyHall"));
const PartyHallSettings = lazy(() => import("./pages/PartyHallSettings"));
const PartyHallNotifications = lazy(() => import("./pages/PartyHallNotifications"));
const ResidentAccess = lazy(() => import("./pages/ResidentAccess"));
const ResidentPackages = lazy(() => import("./pages/resident/Packages"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const Sindicos = lazy(() => import("./pages/superadmin/Sindicos"));
const SuperAdminCondominiums = lazy(() => import("./pages/superadmin/Condominiums"));
const Subscriptions = lazy(() => import("./pages/superadmin/Subscriptions"));
const SubscriptionDetails = lazy(() => import("./pages/superadmin/SubscriptionDetails"));
const SuperAdminInvoices = lazy(() => import("./pages/superadmin/Invoices"));
const Logs = lazy(() => import("./pages/superadmin/Logs"));
const MagicLinkLogs = lazy(() => import("./pages/superadmin/MagicLinkLogs"));
const EdgeFunctionLogs = lazy(() => import("./pages/superadmin/EdgeFunctionLogs"));
const WabaLogs = lazy(() => import("./pages/superadmin/WabaLogs"));
const BsuidMigration = lazy(() => import("./pages/superadmin/BsuidMigration"));
const CronJobs = lazy(() => import("./pages/superadmin/CronJobs"));
const Transfers = lazy(() => import("./pages/superadmin/Transfers"));
const WhatsApp = lazy(() => import("./pages/superadmin/WhatsApp"));
const WhatsAppConfig = lazy(() => import("./pages/superadmin/WhatsAppConfig"));
const SuperAdminSettings = lazy(() => import("./pages/superadmin/Settings"));
const PorteiroSettings = lazy(() => import("./pages/porteiro/Settings"));
const ContactMessages = lazy(() => import("./pages/superadmin/ContactMessages"));
const PackageTypes = lazy(() => import("./pages/superadmin/PackageTypes"));
const ExportDatabase = lazy(() => import("./pages/superadmin/ExportDatabase"));
const PorteiroDashboard = lazy(() => import("./pages/porteiro/Dashboard"));
const RegisterPackage = lazy(() => import("./pages/porteiro/RegisterPackage"));
const PorteiroPackages = lazy(() => import("./pages/porteiro/Packages"));
const PorteiroCondominio = lazy(() => import("./pages/porteiro/Condominio"));
const PorteiroPackagesHistory = lazy(() => import("./pages/porteiro/PackagesHistory"));
const PortariaOccurrences = lazy(() => import("./pages/porteiro/PortariaOccurrences"));
const ShiftHandover = lazy(() => import("./pages/porteiro/ShiftHandover"));
const ShiftChecklistSettings = lazy(() => import("./pages/sindico/ShiftChecklistSettings"));
const SindicoPortariaOccurrences = lazy(() => import("./pages/sindico/PortariaOccurrences"));
const SindicoPortariaShiftHandovers = lazy(() => import("./pages/sindico/PortariaShiftHandovers"));
const SindicoZeladores = lazy(() => import("./pages/sindico/Zeladores"));
const SindicoManutencoes = lazy(() => import("./pages/sindico/Manutencoes"));
const ManutencoesCategorias = lazy(() => import("./pages/sindico/ManutencoesCategorias"));
const ManutencoesHistorico = lazy(() => import("./pages/sindico/ManutencoesHistorico"));
const ZeladorDashboard = lazy(() => import("./pages/zelador/Dashboard"));
const ZeladorManutencoes = lazy(() => import("./pages/zelador/Manutencoes"));
const ZeladorSettings = lazy(() => import("./pages/zelador/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <UserRoleProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/planos" element={<Plans />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/termos" element={<TermsOfUse />} />
              <Route path="/codigo-civil" element={<CivilCode />} />
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
                path="/sindico/porteiros"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoPorteiros />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/banners"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoBanners />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/portaria/checklist"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <ShiftChecklistSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/portaria/ocorrencias"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoPortariaOccurrences />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/portaria/plantoes"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoPortariaShiftHandovers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/encomendas"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <SindicoPackages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/packages/dashboard"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PackagesDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/packages"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <SindicoPackages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/packages/historico"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PackagesHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/packages/historico-condominio"
                element={
                  <ProtectedRoute requiredRole={["sindico", "super_admin"]}>
                    <PackagesCondominiumHistory />
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
              <Route
                path="/resident/packages"
                element={
                  <ProtectedRoute requiredRole="morador">
                    <ResidentPackages />
                  </ProtectedRoute>
                }
              />
              <Route path="/acesso/:token" element={<ResidentAccess />} />
              <Route path="/resident/access" element={<ResidentAccess />} />

              {/* Porteiro Routes */}
              <Route
                path="/porteiro"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PorteiroDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/registrar"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <RegisterPackage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/encomendas"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PorteiroPackages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/configuracoes"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PorteiroSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/condominio"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PorteiroCondominio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/historico"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PorteiroPackagesHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/portaria/ocorrencias"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <PortariaOccurrences />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/porteiro/portaria/plantao"
                element={
                  <ProtectedRoute requiredRole="porteiro">
                    <ShiftHandover />
                  </ProtectedRoute>
                }
              />

              {/* Sindico Manutenção */}
              <Route
                path="/sindico/zeladores"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoZeladores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/manutencoes"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <SindicoManutencoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/manutencoes/categorias"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <ManutencoesCategorias />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sindico/manutencoes/historico"
                element={
                  <ProtectedRoute requiredRole="sindico">
                    <ManutencoesHistorico />
                  </ProtectedRoute>
                }
              />

              {/* Zelador Routes */}
              <Route
                path="/zelador"
                element={
                  <ProtectedRoute requiredRole="zelador">
                    <ZeladorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/zelador/manutencoes"
                element={
                  <ProtectedRoute requiredRole="zelador">
                    <ZeladorManutencoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/zelador/configuracoes"
                element={
                  <ProtectedRoute requiredRole="zelador">
                    <ZeladorSettings />
                  </ProtectedRoute>
                }
              />

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
                path="/superadmin/logs/edge-functions"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <EdgeFunctionLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/logs/waba"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <WabaLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/bsuid-migration"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <BsuidMigration />
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
                path="/superadmin/whatsapp/config"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <WhatsAppConfig />
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
              <Route
                path="/superadmin/package-types"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <PackageTypes />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/superadmin/export-database"
                element={
                  <ProtectedRoute requiredRole="super_admin">
                    <ExportDatabase />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </UserRoleProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
