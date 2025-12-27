import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  CreditCard,
  MessageCircle,
  TrendingUp,
  Activity,
  Plus,
  Settings,
  FileText,
  Zap,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  
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
      gradient: "from-blue-500 via-blue-600 to-blue-700",
      borderColor: "border-l-blue-500",
    },
    {
      title: "Condomínios",
      value: stats?.totalCondominiums ?? 0,
      icon: Building2,
      gradient: "from-cyan-500 via-cyan-600 to-teal-600",
      borderColor: "border-l-cyan-500",
    },
    {
      title: "Assinaturas Ativas",
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      gradient: "from-indigo-500 via-indigo-600 to-violet-600",
      borderColor: "border-l-indigo-500",
    },
    {
      title: "Planos Pagos",
      value: stats?.paidSubscriptions ?? 0,
      icon: TrendingUp,
      gradient: "from-sky-500 via-blue-500 to-indigo-500",
      borderColor: "border-l-sky-500",
    },
    {
      title: "Notificações",
      value: stats?.totalNotifications ?? 0,
      icon: MessageCircle,
      gradient: "from-slate-500 via-slate-600 to-gray-700",
      borderColor: "border-l-slate-500",
    },
  ];

  const quickActions = [
    {
      title: "Novo Síndico",
      description: "Cadastrar um novo síndico na plataforma",
      icon: Users,
      url: "/superadmin/sindicos",
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      title: "Novo Condomínio",
      description: "Adicionar um condomínio ao sistema",
      icon: Building2,
      url: "/superadmin/condominiums",
      color: "bg-cyan-500/10 text-cyan-600",
    },
    {
      title: "Gerenciar Assinaturas",
      description: "Visualizar e gerenciar planos ativos",
      icon: CreditCard,
      url: "/superadmin/subscriptions",
      color: "bg-indigo-500/10 text-indigo-600",
    },
    {
      title: "Configurações",
      description: "Ajustar configurações do sistema",
      icon: Settings,
      url: "/superadmin/settings",
      color: "bg-slate-500/10 text-slate-600",
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
          <h1 className="font-display text-3xl font-bold text-foreground">
            Olá, Administrador! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie síndicos, condomínios e assinaturas
          </p>
        </div>

        {/* Stats Grid - Cards com Gradiente */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className={`relative overflow-hidden bg-gradient-to-br ${stat.gradient} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group`}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col h-full">
                  <p className="text-white/80 text-xs md:text-sm font-medium mb-2">
                    {stat.title}
                  </p>
                  <div className="flex items-end justify-between">
                    {statsLoading ? (
                      <Skeleton className="h-8 md:h-10 w-12 md:w-16 bg-white/20" />
                    ) : (
                      <p className="font-display text-2xl md:text-4xl font-bold text-white">
                        {stat.value.toLocaleString("pt-BR")}
                      </p>
                    )}
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">Ações Rápidas</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                onClick={() => navigate(action.url)}
                className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
              >
                <CardContent className="p-4 md:p-5">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <h3 className="font-semibold text-sm md:text-base text-foreground mb-1">
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
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
