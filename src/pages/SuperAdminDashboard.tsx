import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  UserPlus,
  UserMinus,
  Calendar,
  Bell,
  Home,
  DoorOpen,
  Receipt,
  Edit,
  Trash2,
  PlusCircle,
  Tag,
  Banknote,
  ShieldCheck,
  Gavel,
  MessageSquare,
  LayoutTemplate,
  Wallet,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

// Função para obter ícone baseado na ação
const getActionIcon = (tableName: string, action: string, newData: any): LucideIcon => {
  // Ações especiais
  if (newData?.action === "create_sindico") return UserPlus;
  if (newData?.action === "delete_sindico") return UserMinus;
  if (newData?.action === "add_extra_days") return Calendar;

  // Por tabela
  const tableIcons: Record<string, LucideIcon> = {
    user_roles: Users,
    condominiums: Building2,
    subscriptions: CreditCard,
    profiles: Users,
    occurrences: FileText,
    notifications_sent: Bell,
    invoices: Receipt,
    residents: Home,
    blocks: Building2,
    apartments: DoorOpen,
    plans: Tag,
    fines: Banknote,
    defenses: ShieldCheck,
    decisions: Gavel,
    whatsapp_config: MessageSquare,
    whatsapp_templates: LayoutTemplate,
    mercadopago_config: Wallet,
    audit_logs: ScrollText,
  };

  return tableIcons[tableName] || Activity;
};

// Função para obter cor do ícone baseado na ação e tabela
const getActionIconColor = (action: string, newData: any, tableName?: string): string => {
  if (newData?.action === "create_sindico") return "bg-emerald-500/10 text-emerald-500";
  if (newData?.action === "delete_sindico") return "bg-red-500/10 text-red-500";
  if (newData?.action === "add_extra_days") return "bg-blue-500/10 text-blue-500";

  // Cores por tabela
  const tableColors: Record<string, string> = {
    plans: "bg-violet-500/10 text-violet-500",
    fines: "bg-rose-500/10 text-rose-500",
    defenses: "bg-teal-500/10 text-teal-500",
    decisions: "bg-indigo-500/10 text-indigo-500",
    whatsapp_config: "bg-green-500/10 text-green-500",
    whatsapp_templates: "bg-green-500/10 text-green-500",
    mercadopago_config: "bg-sky-500/10 text-sky-500",
    audit_logs: "bg-slate-500/10 text-slate-500",
    subscriptions: "bg-purple-500/10 text-purple-500",
    condominiums: "bg-cyan-500/10 text-cyan-500",
    residents: "bg-orange-500/10 text-orange-500",
    invoices: "bg-lime-500/10 text-lime-500",
  };

  if (tableName && tableColors[tableName]) {
    return tableColors[tableName];
  }

  const actionColors: Record<string, string> = {
    INSERT: "bg-emerald-500/10 text-emerald-500",
    UPDATE: "bg-amber-500/10 text-amber-500",
    DELETE: "bg-red-500/10 text-red-500",
    ADD_EXTRA_DAYS: "bg-blue-500/10 text-blue-500",
  };

  return actionColors[action] || "bg-primary/10 text-primary";
};

// Função para formatar ações de auditoria
const formatAuditAction = (tableName: string, action: string, newData: any): string => {
  const tableNames: Record<string, string> = {
    user_roles: "Usuário",
    condominiums: "Condomínio",
    subscriptions: "Assinatura",
    profiles: "Perfil",
    occurrences: "Ocorrência",
    notifications_sent: "Notificação",
    invoices: "Fatura",
    residents: "Morador",
    blocks: "Bloco",
    apartments: "Apartamento",
    plans: "Plano",
    fines: "Multa",
    defenses: "Defesa",
    decisions: "Decisão",
    whatsapp_config: "Config WhatsApp",
    whatsapp_templates: "Template WhatsApp",
    mercadopago_config: "Config MercadoPago",
    audit_logs: "Log de Auditoria",
  };

  const actionNames: Record<string, string> = {
    INSERT: "criado",
    UPDATE: "atualizado",
    DELETE: "removido",
    ADD_EXTRA_DAYS: "dias extras adicionados",
  };

  // Ações especiais baseadas em new_data
  if (newData?.action === "create_sindico") {
    return `Síndico criado: ${newData.created_user_name || "N/A"}`;
  }
  if (newData?.action === "delete_sindico") {
    return `Síndico removido: ${newData.deleted_user_name || "N/A"}`;
  }
  if (newData?.action === "add_extra_days") {
    return `+${newData.days_added} dias: ${newData.condominium_name || "Assinatura"}`;
  }

  const table = tableNames[tableName] || tableName;
  const actionText = actionNames[action] || action.toLowerCase();

  return `${table} ${actionText}`;
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime subscription para audit_logs
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs'
        },
        () => {
          // Invalidar a query para buscar dados atualizados
          queryClient.invalidateQueries({ queryKey: ["superadmin-recent-activity"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
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

      // Calcular distribuição de planos
      const allSubscriptions = subscriptions.data || [];
      const totalSubs = allSubscriptions.length;
      
      const planCounts = {
        start: allSubscriptions.filter((s) => s.plan === "start").length,
        essencial: allSubscriptions.filter((s) => s.plan === "essencial").length,
        profissional: allSubscriptions.filter((s) => s.plan === "profissional").length,
        enterprise: allSubscriptions.filter((s) => s.plan === "enterprise").length,
      };

      const planDistribution = {
        start: totalSubs > 0 ? Math.round((planCounts.start / totalSubs) * 100) : 0,
        essencial: totalSubs > 0 ? Math.round((planCounts.essencial / totalSubs) * 100) : 0,
        profissional: totalSubs > 0 ? Math.round((planCounts.profissional / totalSubs) * 100) : 0,
        enterprise: totalSubs > 0 ? Math.round((planCounts.enterprise / totalSubs) * 100) : 0,
      };

      return {
        totalSindicos: sindicos.count || 0,
        totalCondominiums: condominiums.count || 0,
        activeSubscriptions: activeSubscriptions.length,
        paidSubscriptions: paidPlans.length,
        totalNotifications: notifications.count || 0,
        planDistribution,
        planCounts,
      };
    },
  });

  // Query para atividade recente
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["superadmin-recent-activity"],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("audit_logs")
        .select("id, table_name, action, new_data, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = [...new Set(logs?.map((log) => log.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

      return logs?.map((log) => ({
        id: log.id,
        action: formatAuditAction(log.table_name, log.action, log.new_data),
        time: formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR }),
        user: profileMap.get(log.user_id) || "Sistema",
        icon: getActionIcon(log.table_name, log.action, log.new_data),
        iconColor: getActionIconColor(log.action, log.new_data, log.table_name),
      })) || [];
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
        <SuperAdminBreadcrumbs items={[{ label: "Dashboard" }]} />
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
              <div className="space-y-2 md:space-y-3">
                {activityLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 md:p-3 rounded-lg bg-secondary/50 border border-border"
                      >
                        <div className={`w-8 h-8 rounded-lg ${item.iconColor} flex items-center justify-center flex-shrink-0`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-xs md:text-sm text-foreground truncate">{item.action}</span>
                          <span className="text-xs text-muted-foreground">{item.user}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{item.time}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhuma atividade recente
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => navigate("/superadmin/logs")}
              >
                Ver mais
              </Button>
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
                {statsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  [
                    { 
                      plan: "Start (Grátis)", 
                      percentage: stats?.planDistribution?.start ?? 0, 
                      count: stats?.planCounts?.start ?? 0,
                      color: "bg-muted" 
                    },
                    { 
                      plan: "Essencial", 
                      percentage: stats?.planDistribution?.essencial ?? 0, 
                      count: stats?.planCounts?.essencial ?? 0,
                      color: "bg-blue-500" 
                    },
                    { 
                      plan: "Profissional", 
                      percentage: stats?.planDistribution?.profissional ?? 0, 
                      count: stats?.planCounts?.profissional ?? 0,
                      color: "bg-violet-500" 
                    },
                    { 
                      plan: "Enterprise", 
                      percentage: stats?.planDistribution?.enterprise ?? 0, 
                      count: stats?.planCounts?.enterprise ?? 0,
                      color: "bg-primary" 
                    },
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{item.plan}</span>
                        <span className="text-muted-foreground">
                          {item.count} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
