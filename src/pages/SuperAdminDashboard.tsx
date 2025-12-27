import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  CreditCard,
  MessageCircle,
  TrendingUp,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function SuperAdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: async () => {
      const [sindicos, condominiums, subscriptions, notifications] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact" }).eq("role", "sindico"),
        supabase.from("condominiums").select("id", { count: "exact" }),
        supabase.from("subscriptions").select("id, plan, active"),
        supabase.from("notifications_sent").select("id", { count: "exact" }),
      ]);

      const activeSubscriptions = subscriptions.data?.filter((s) => s.active) || [];
      const paidPlans = activeSubscriptions.filter((s) => s.plan !== "start");

      return {
        totalSindicos: sindicos.count || 0,
        totalCondominiums: condominiums.count || 0,
        activeSubscriptions: activeSubscriptions.length,
        paidSubscriptions: paidPlans.length,
        totalNotifications: notifications.count || 0,
      };
    },
  });

  const statCards = [
    {
      title: "Síndicos",
      value: stats?.totalSindicos ?? 0,
      icon: Users,
      gradient: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-500",
      trend: "+12%",
    },
    {
      title: "Condomínios",
      value: stats?.totalCondominiums ?? 0,
      icon: Building2,
      gradient: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-500",
      trend: "+8%",
    },
    {
      title: "Assinaturas Ativas",
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      gradient: "from-violet-500 to-violet-600",
      bgColor: "bg-violet-500/10",
      textColor: "text-violet-500",
      trend: "+5%",
    },
    {
      title: "Planos Pagos",
      value: stats?.paidSubscriptions ?? 0,
      icon: TrendingUp,
      gradient: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-500",
      trend: "+18%",
    },
    {
      title: "Notificações",
      value: stats?.totalNotifications ?? 0,
      icon: MessageCircle,
      gradient: "from-primary to-accent",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      trend: "+24%",
    },
  ];

  return (
    <DashboardLayout>
      <Helmet>
        <title>Super Admin | NotificaCondo</title>
        <meta name="description" content="Painel administrativo da plataforma" />
      </Helmet>

      <div className="space-y-8 animate-fade-up">
        {/* Page Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral da plataforma NotificaCondo
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300 group overflow-hidden"
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div
                    className={`w-9 h-9 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-accent">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.trend}
                  </div>
                </div>
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-7 md:h-9 w-16 md:w-20 mb-1" />
                  ) : (
                    <p className="font-display text-xl md:text-3xl font-bold text-foreground">
                      {stat.value.toLocaleString("pt-BR")}
                    </p>
                  )}
                  <p className="text-xs md:text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-card border-border shadow-card">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-base md:text-lg font-semibold text-foreground">
                    Atividade Recente
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Últimas ações na plataforma</p>
                </div>
              </div>
              <div className="space-y-2 md:space-y-4">
                {[
                  { action: "Novo síndico cadastrado", time: "Há 2 minutos" },
                  { action: "Condomínio atualizado", time: "Há 15 minutos" },
                  { action: "Assinatura renovada", time: "Há 1 hora" },
                  { action: "Notificação enviada", time: "Há 2 horas" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-secondary/50 border border-border"
                  >
                    <span className="text-xs md:text-sm text-foreground">{item.action}</span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Distribuição de Planos
                  </h3>
                  <p className="text-sm text-muted-foreground">Assinaturas por tipo</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { plan: "Start (Grátis)", percentage: 45, color: "bg-muted" },
                  { plan: "Essencial", percentage: 30, color: "bg-blue-500" },
                  { plan: "Profissional", percentage: 20, color: "bg-violet-500" },
                  { plan: "Enterprise", percentage: 5, color: "bg-primary" },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.plan}</span>
                      <span className="text-muted-foreground">{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
