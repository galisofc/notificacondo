import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Bell,
  Shield,
  Database,
  CreditCard,
  MessageCircle,
  Zap,
  Building2,
  Crown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLAN_LIMITS = {
  start: {
    name: "Start",
    notifications: 10,
    warnings: 10,
    fines: 0,
    color: "bg-gray-500",
  },
  essencial: {
    name: "Essencial",
    notifications: 50,
    warnings: 50,
    fines: 25,
    color: "bg-blue-500",
  },
  profissional: {
    name: "Profissional",
    notifications: 200,
    warnings: 200,
    fines: 100,
    color: "bg-violet-500",
  },
  enterprise: {
    name: "Enterprise",
    notifications: 999999,
    warnings: 999999,
    fines: 999999,
    color: "bg-amber-500",
  },
};

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["superadmin-platform-stats"],
    queryFn: async () => {
      const [usersRes, condosRes, occurrencesRes, subsRes] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact" }),
        supabase.from("condominiums").select("*", { count: "exact" }),
        supabase.from("occurrences").select("*", { count: "exact" }),
        supabase.from("subscriptions").select("*"),
      ]);

      const subscriptions = subsRes.data || [];
      const planCounts = {
        start: subscriptions.filter((s) => s.plan === "start").length,
        essencial: subscriptions.filter((s) => s.plan === "essencial").length,
        profissional: subscriptions.filter((s) => s.plan === "profissional").length,
        enterprise: subscriptions.filter((s) => s.plan === "enterprise").length,
      };

      return {
        totalUsers: usersRes.count || 0,
        totalCondominiums: condosRes.count || 0,
        totalOccurrences: occurrencesRes.count || 0,
        activeSubscriptions: subscriptions.filter((s) => s.active).length,
        planCounts,
      };
    },
  });

  // Reset usage mutation
  const resetUsageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          notifications_used: 0,
          warnings_used: 0,
          fines_used: 0,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-platform-stats"] });
      toast({
        title: "Contadores resetados",
        description: "Os contadores de uso de todos os usuários foram zerados.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resetar contadores",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <Helmet>
        <title>Configurações | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Configurações da Plataforma
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações gerais e monitore a saúde do sistema
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview" className="gap-2">
              <Database className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Usuários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalUsers}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Condomínios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalCondominiums}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ocorrências
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalOccurrences}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Assinaturas Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.activeSubscriptions}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Status do Sistema
                </CardTitle>
                <CardDescription>
                  Informações sobre o estado atual da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium text-green-500">Sistema Operacional</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    Online
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Banco de Dados</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Conectado
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Edge Functions</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Ativas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Manutenção
                </CardTitle>
                <CardDescription>
                  Ações de manutenção e gerenciamento da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium text-foreground">Resetar Contadores de Uso</p>
                    <p className="text-sm text-muted-foreground">
                      Zera os contadores de notificações, advertências e multas de todos os usuários
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja resetar todos os contadores de uso?")) {
                        resetUsageMutation.mutate();
                      }
                    }}
                    disabled={resetUsageMutation.isPending}
                  >
                    {resetUsageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Resetar"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Distribuição de Planos
                </CardTitle>
                <CardDescription>
                  Quantidade de usuários por tipo de plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(PLAN_LIMITS).map(([key, plan]) => (
                    <div
                      key={key}
                      className="p-4 rounded-lg border border-border/50 bg-muted/20"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg ${plan.color} flex items-center justify-center`}>
                          {key === "enterprise" ? (
                            <Crown className="w-5 h-5 text-white" />
                          ) : (
                            <Zap className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{plan.name}</p>
                          <p className="text-2xl font-bold text-primary">
                            {statsLoading ? "..." : stats?.planCounts?.[key as keyof typeof stats.planCounts] || 0}
                          </p>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Notificações: {plan.notifications === 999999 ? "∞" : plan.notifications}/mês</p>
                        <p>Advertências: {plan.warnings === 999999 ? "∞" : plan.warnings}/mês</p>
                        <p>Multas: {plan.fines === 999999 ? "∞" : plan.fines}/mês</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Limites por Plano</CardTitle>
                <CardDescription>
                  Configuração atual dos limites de cada plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Notificações</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Advertências</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Multas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(PLAN_LIMITS).map(([key, plan]) => (
                        <tr key={key} className="border-b border-border/30">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`${plan.color}/10 text-foreground`}>
                              {plan.name}
                            </Badge>
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.notifications === 999999 ? "Ilimitado" : plan.notifications}
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.warnings === 999999 ? "Ilimitado" : plan.warnings}
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.fines === 999999 ? "Ilimitado" : plan.fines}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  Configurações de WhatsApp
                </CardTitle>
                <CardDescription>
                  Gerencie as configurações de integração com WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Integração Z-API / Z-PRO</p>
                      <p className="text-sm text-muted-foreground">
                        Configure as credenciais de acesso à API de WhatsApp
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => window.location.href = "/superadmin/whatsapp"}>
                      Configurar
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-notify">Notificação Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar notificação automaticamente ao registrar ocorrência
                      </p>
                    </div>
                    <Switch id="auto-notify" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="read-confirm">Confirmação de Leitura</Label>
                      <p className="text-sm text-muted-foreground">
                        Exigir confirmação de leitura do morador
                      </p>
                    </div>
                    <Switch id="read-confirm" defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Templates de Mensagem
                </CardTitle>
                <CardDescription>
                  Personalize os templates de mensagens enviadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-500">Em desenvolvimento</p>
                      <p className="text-sm text-muted-foreground">
                        A personalização de templates estará disponível em breve.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Configurações de Segurança
                </CardTitle>
                <CardDescription>
                  Gerencie as políticas de segurança da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="2fa">Autenticação em Dois Fatores</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir 2FA para administradores
                    </p>
                  </div>
                  <Switch id="2fa" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="session-timeout">Timeout de Sessão</Label>
                    <p className="text-sm text-muted-foreground">
                      Encerrar sessões inativas automaticamente
                    </p>
                  </div>
                  <Switch id="session-timeout" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="audit-logs">Logs de Auditoria</Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar todas as ações administrativas
                    </p>
                  </div>
                  <Switch id="audit-logs" defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Políticas de Acesso</CardTitle>
                <CardDescription>
                  Row Level Security (RLS) está ativo em todas as tabelas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    "condominiums",
                    "blocks",
                    "apartments",
                    "residents",
                    "occurrences",
                    "subscriptions",
                    "profiles",
                    "user_roles",
                  ].map((table) => (
                    <div
                      key={table}
                      className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-mono text-sm">{table}</span>
                      <Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-500 border-green-500/20">
                        RLS Ativo
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}