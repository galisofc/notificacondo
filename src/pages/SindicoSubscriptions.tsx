import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Building2,
  Crown,
  ArrowUpCircle,
  Bell,
  AlertOctagon,
  Gavel,
  Calculator,
  AlertTriangle,
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  color: string;
  notifications_limit: number;
  warnings_limit: number;
  fines_limit: number;
  description: string | null;
}

interface Subscription {
  id: string;
  plan: string;
  active: boolean;
  notifications_limit: number;
  notifications_used: number;
  warnings_limit: number;
  warnings_used: number;
  fines_limit: number;
  fines_used: number;
  current_period_start: string | null;
  current_period_end: string | null;
  condominium: {
    id: string;
    name: string;
  };
}

const PLAN_NAMES: Record<string, string> = {
  start: "Start",
  essencial: "Essencial",
  profissional: "Profissional",
  enterprise: "Enterprise",
};

const SindicoSubscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changePlanDialog, setChangePlanDialog] = useState<{ open: boolean; subscription: Subscription | null }>({
    open: false,
    subscription: null,
  });
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch plans
  const { data: plans } = useQuery({
    queryKey: ["active-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Fetch subscriptions with condominiums
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["sindico-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          plan,
          active,
          notifications_limit,
          notifications_used,
          warnings_limit,
          warnings_used,
          fines_limit,
          fines_used,
          current_period_start,
          current_period_end,
          condominium:condominiums!inner(id, name, owner_id)
        `)
        .eq("condominiums.owner_id", user.id);
      if (error) throw error;
      return (data as unknown as Subscription[]) || [];
    },
    enabled: !!user,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const getPlanColor = (planSlug: string) => {
    const plan = plans?.find((p) => p.slug === planSlug);
    return plan?.color || "bg-gray-500";
  };

  const openChangePlanDialog = (subscription: Subscription) => {
    setSelectedPlan(subscription.plan);
    setChangePlanDialog({ open: true, subscription });
  };

  const handleChangePlan = async () => {
    if (!changePlanDialog.subscription || !selectedPlan) return;

    const sub = changePlanDialog.subscription;
    setIsChangingPlan(true);
    
    try {
      const newPlan = plans?.find((p) => p.slug === selectedPlan);
      const oldPlan = plans?.find((p) => p.slug === sub.plan);
      
      if (!newPlan) throw new Error("Plano não encontrado");
      if (!oldPlan) throw new Error("Plano atual não encontrado");

      const priceDifference = newPlan.price - oldPlan.price;
      const isUpgrade = priceDifference > 0;

      // Calculate pro-rata if upgrading
      let proratedAmount = 0;
      let proratedDescription = "";

      if (isUpgrade && sub.current_period_start && sub.current_period_end) {
        const periodStart = new Date(sub.current_period_start);
        const periodEnd = new Date(sub.current_period_end);
        const today = new Date();

        const totalDays = differenceInDays(periodEnd, periodStart);
        const daysUsed = differenceInDays(today, periodStart);
        const daysRemaining = Math.max(0, totalDays - daysUsed);

        if (daysRemaining > 0 && totalDays > 0) {
          // Credit for unused time on old plan
          const oldPlanCredit = (daysRemaining / totalDays) * oldPlan.price;
          // Charge for remaining time on new plan
          const newPlanCharge = (daysRemaining / totalDays) * newPlan.price;
          // Net amount to charge
          proratedAmount = Math.max(0, newPlanCharge - oldPlanCredit);

          proratedDescription = `Upgrade de ${oldPlan.name} para ${newPlan.name} - Proporcional ${daysRemaining} dias restantes`;
        }
      }

      // Update subscription
      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          plan: selectedPlan as "start" | "essencial" | "profissional" | "enterprise",
          notifications_limit: newPlan.notifications_limit,
          warnings_limit: newPlan.warnings_limit,
          fines_limit: newPlan.fines_limit,
        })
        .eq("id", sub.id);

      if (subError) throw subError;

      // Create prorated invoice if upgrading with amount > 0
      if (isUpgrade && proratedAmount > 0) {
        const today = new Date();
        const dueDate = addDays(today, 7); // 7 days to pay the upgrade difference

        const { error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            subscription_id: sub.id,
            condominium_id: sub.condominium.id,
            amount: Math.round(proratedAmount * 100) / 100, // Round to 2 decimal places
            status: "pending",
            due_date: dueDate.toISOString().split("T")[0],
            period_start: today.toISOString().split("T")[0],
            period_end: sub.current_period_end?.split("T")[0] || today.toISOString().split("T")[0],
            description: proratedDescription,
          });

        if (invoiceError) throw invoiceError;

        toast({
          title: "Plano alterado com sucesso!",
          description: `Upgrade realizado. Uma fatura proporcional de ${formatCurrency(proratedAmount)} foi gerada.`,
        });
      } else if (isUpgrade) {
        toast({
          title: "Plano alterado!",
          description: `O plano foi alterado para ${newPlan.name}. A diferença será cobrada no próximo ciclo.`,
        });
      } else {
        toast({
          title: "Plano alterado!",
          description: `O plano foi alterado para ${newPlan.name}. A alteração será aplicada no próximo ciclo.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sindico-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["sindico-invoices"] });
      setChangePlanDialog({ open: false, subscription: null });
    } catch (error: any) {
      console.error("Error changing plan:", error);
      toast({
        title: "Erro ao alterar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Calculate prorated amount for display in dialog
  const calculateProratedAmount = () => {
    if (!changePlanDialog.subscription || !selectedPlan || !plans) return null;

    const sub = changePlanDialog.subscription;
    const newPlan = plans.find((p) => p.slug === selectedPlan);
    const oldPlan = plans.find((p) => p.slug === sub.plan);

    if (!newPlan || !oldPlan) return null;

    const priceDifference = newPlan.price - oldPlan.price;
    if (priceDifference <= 0) return null; // No charge for downgrade

    if (!sub.current_period_start || !sub.current_period_end) return null;

    const periodStart = new Date(sub.current_period_start);
    const periodEnd = new Date(sub.current_period_end);
    const today = new Date();

    const totalDays = differenceInDays(periodEnd, periodStart);
    const daysUsed = differenceInDays(today, periodStart);
    const daysRemaining = Math.max(0, totalDays - daysUsed);

    if (daysRemaining <= 0 || totalDays <= 0) return null;

    const oldPlanCredit = (daysRemaining / totalDays) * oldPlan.price;
    const newPlanCharge = (daysRemaining / totalDays) * newPlan.price;
    const proratedAmount = Math.max(0, newPlanCharge - oldPlanCredit);

    return {
      amount: Math.round(proratedAmount * 100) / 100,
      daysRemaining,
      oldPlanName: oldPlan.name,
      newPlanName: newPlan.name,
    };
  };

  const proratedInfo = calculateProratedAmount();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Assinaturas | NotificaCondo</title>
        <meta name="description" content="Gerencie as assinaturas dos seus condomínios" />
      </Helmet>

      <div className="space-y-6">
        <SindicoBreadcrumbs items={[{ label: "Assinaturas" }]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie os planos e acompanhe o uso de cada condomínio
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{subscriptions?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Condomínios</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {subscriptions?.filter((s) => s.active).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Bell className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {subscriptions?.reduce((acc, s) => acc + s.notifications_used, 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Notificações Usadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Crown className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      subscriptions?.reduce((acc, s) => {
                        const plan = plans?.find((p) => p.slug === s.plan);
                        return acc + (plan?.price || 0);
                      }, 0) || 0
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Mensal</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Assinaturas por Condomínio
            </CardTitle>
            <CardDescription>
              Clique em "Alterar Plano" para fazer upgrade ou downgrade
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar condomínio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Planos</SelectItem>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.slug} value={plan.slug}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const filteredSubscriptions = subscriptions?.filter((sub) => {
                const matchesSearch = searchQuery === "" || 
                  sub.condominium.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesPlan = planFilter === "all" || sub.plan === planFilter;
                const matchesStatus = statusFilter === "all" || 
                  (statusFilter === "active" && sub.active) || 
                  (statusFilter === "inactive" && !sub.active);
                return matchesSearch && matchesPlan && matchesStatus;
              });

              return filteredSubscriptions && filteredSubscriptions.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSubscriptions.map((sub) => {
                  const currentPlan = plans?.find((p) => p.slug === sub.plan);
                  const notificationsPercent = sub.notifications_limit > 0 
                    ? Math.round((sub.notifications_used / sub.notifications_limit) * 100) 
                    : 0;
                  const warningsPercent = sub.warnings_limit > 0 
                    ? Math.round((sub.warnings_used / sub.warnings_limit) * 100) 
                    : 0;
                  const finesPercent = sub.fines_limit > 0 
                    ? Math.round((sub.fines_used / sub.fines_limit) * 100) 
                    : 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{sub.condominium.name}</span>
                          </div>
                          <Badge 
                            variant={sub.active ? "default" : "secondary"}
                            className={sub.active 
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20" 
                              : "bg-muted text-muted-foreground"
                            }
                          >
                            {sub.active ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Inativo
                              </>
                            )}
                          </Badge>
                        </div>
                        <Badge className={`${getPlanColor(sub.plan)} text-white`}>
                          {PLAN_NAMES[sub.plan] || sub.plan}
                        </Badge>
                      </div>

                      {currentPlan && (
                        <p className="text-lg font-bold text-foreground mb-1">
                          {formatCurrency(currentPlan.price)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                      )}

                      {sub.current_period_end && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Próxima renovação: {formatDate(sub.current_period_end)}
                        </p>
                      )}

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <Bell className="h-3 w-3 text-muted-foreground" />
                            <span>Notificações</span>
                          </div>
                          <span className={notificationsPercent >= 80 ? "text-destructive" : "text-muted-foreground"}>
                            {sub.notifications_used}/{sub.notifications_limit}
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${notificationsPercent >= 80 ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${Math.min(notificationsPercent, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs mt-2">
                          <div className="flex items-center gap-1">
                            <AlertOctagon className="h-3 w-3 text-muted-foreground" />
                            <span>Advertências</span>
                          </div>
                          <span className={warningsPercent >= 80 ? "text-destructive" : "text-muted-foreground"}>
                            {sub.warnings_used}/{sub.warnings_limit}
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${warningsPercent >= 80 ? "bg-destructive" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(warningsPercent, 100)}%` }}
                          />
                        </div>

                        {sub.fines_limit > 0 && (
                          <>
                            <div className="flex items-center justify-between text-xs mt-2">
                              <div className="flex items-center gap-1">
                                <Gavel className="h-3 w-3 text-muted-foreground" />
                                <span>Multas</span>
                              </div>
                              <span className={finesPercent >= 80 ? "text-destructive" : "text-muted-foreground"}>
                                {sub.fines_used}/{sub.fines_limit}
                              </span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${finesPercent >= 80 ? "bg-destructive" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(finesPercent, 100)}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => openChangePlanDialog(sub)}
                      >
                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                        Alterar Plano
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || planFilter !== "all" || statusFilter !== "all"
                    ? "Nenhuma assinatura encontrada com os filtros aplicados" 
                    : "Nenhuma assinatura encontrada"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || planFilter !== "all" || statusFilter !== "all"
                    ? "Tente ajustar os filtros de busca" 
                    : "Cadastre um condomínio para começar"}
                </p>
              </div>
            );
            })()}
          </CardContent>
        </Card>

        {/* Change Plan Dialog */}
        <Dialog open={changePlanDialog.open} onOpenChange={(open) => setChangePlanDialog({ open, subscription: open ? changePlanDialog.subscription : null })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Alterar Plano
              </DialogTitle>
              <DialogDescription>
                Selecione um novo plano para {changePlanDialog.subscription?.condominium.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {plans?.map((plan) => {
                const isCurrentPlan = plan.slug === changePlanDialog.subscription?.plan;
                const isSelected = plan.slug === selectedPlan;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.slug)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${plan.color}`}>
                          <Crown className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{plan.name}</span>
                            {isCurrentPlan && (
                              <Badge variant="secondary" className="text-xs">Atual</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {plan.notifications_limit} notificações • {plan.warnings_limit} advertências
                            {plan.fines_limit > 0 && ` • ${plan.fines_limit} multas`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(plan.price)}</p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prorated Amount Info */}
            {proratedInfo && selectedPlan !== changePlanDialog.subscription?.plan && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calculator className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Cálculo Pro-Rata</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Como ainda restam {proratedInfo.daysRemaining} dias no período atual, 
                      será gerada uma fatura proporcional pela diferença entre os planos.
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Valor a pagar agora:</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(proratedInfo.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Downgrade Warning */}
            {selectedPlan !== changePlanDialog.subscription?.plan && 
             plans?.find(p => p.slug === selectedPlan)?.price! < plans?.find(p => p.slug === changePlanDialog.subscription?.plan)?.price! && (
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Downgrade de Plano</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ao fazer downgrade, os novos limites serão aplicados imediatamente. 
                      Se o uso atual exceder os limites do novo plano, você não poderá criar novas ocorrências até o próximo ciclo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePlanDialog({ open: false, subscription: null })}>
                Cancelar
              </Button>
              <Button 
                onClick={handleChangePlan} 
                disabled={isChangingPlan || selectedPlan === changePlanDialog.subscription?.plan}
              >
                {isChangingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Alterando...
                  </>
                ) : proratedInfo ? (
                  `Confirmar e Pagar ${formatCurrency(proratedInfo.amount)}`
                ) : (
                  "Confirmar Alteração"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SindicoSubscriptions;
