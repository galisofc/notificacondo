import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users,
  Building2,
  CreditCard,
  FileText,
  MessageCircle,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SindicosManagement } from "@/components/superadmin/SindicosManagement";
import { CondominiumsOverview } from "@/components/superadmin/CondominiumsOverview";
import { SubscriptionsMonitor } from "@/components/superadmin/SubscriptionsMonitor";
import { AuditLogs } from "@/components/superadmin/AuditLogs";
import { WhatsAppConfig } from "@/components/superadmin/WhatsAppConfig";

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Até logo!", description: "Você saiu da sua conta." });
    navigate("/");
  };

  // Stats queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: async () => {
      const [sindicos, condominiums, subscriptions, notifications] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact" }).eq("role", "sindico"),
        supabase.from("condominiums").select("id", { count: "exact" }),
        supabase.from("subscriptions").select("id, plan, active"),
        supabase.from("notifications_sent").select("id", { count: "exact" }),
      ]);

      const activeSubscriptions = subscriptions.data?.filter(s => s.active) || [];
      const paidPlans = activeSubscriptions.filter(s => s.plan !== "start");

      return {
        totalSindicos: sindicos.count || 0,
        totalCondominiums: condominiums.count || 0,
        activeSubscriptions: activeSubscriptions.length,
        paidSubscriptions: paidPlans.length,
        totalNotifications: notifications.count || 0,
      };
    },
  });

  return (
    <>
      <Helmet>
        <title>Super Admin | NotificaCondo</title>
        <meta name="description" content="Painel administrativo da plataforma" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-display text-xl font-bold text-foreground">
                    Super Admin
                  </span>
                  <p className="text-xs text-muted-foreground">Painel Administrativo</p>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <p className="text-2xl font-bold">{stats?.totalSindicos}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Síndicos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Building2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <p className="text-2xl font-bold">{stats?.totalCondominiums}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Condomínios</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <CreditCard className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <p className="text-2xl font-bold">{stats?.activeSubscriptions}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <p className="text-2xl font-bold">{stats?.paidSubscriptions}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Planos Pagos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <p className="text-2xl font-bold">{stats?.totalNotifications}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Notificações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="sindicos" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="sindicos" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden md:inline">Síndicos</span>
              </TabsTrigger>
              <TabsTrigger value="condominiums" className="gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden md:inline">Condomínios</span>
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden md:inline">Assinaturas</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden md:inline">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden md:inline">WhatsApp</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sindicos">
              <SindicosManagement />
            </TabsContent>

            <TabsContent value="condominiums">
              <CondominiumsOverview />
            </TabsContent>

            <TabsContent value="subscriptions">
              <SubscriptionsMonitor />
            </TabsContent>

            <TabsContent value="logs">
              <AuditLogs />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsAppConfig />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
