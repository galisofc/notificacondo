import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Receipt,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  CreditCard,
  TrendingUp,
  FileText,
  RefreshCw,
  Crown,
  Bell,
  AlertOctagon,
  Gavel,
} from "lucide-react";

type InvoiceStatus = "all" | "pending" | "paid" | "overdue" | "cancelled";

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

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  description: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
  condominium: {
    id: string;
    name: string;
  };
  subscription: {
    id: string;
    plan: string;
  };
}

const PLAN_NAMES: Record<string, string> = {
  start: "Start",
  essencial: "Essencial",
  profissional: "Profissional",
  enterprise: "Enterprise",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pendente",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
  paid: {
    label: "Pago",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  overdue: {
    label: "Vencido",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-muted text-muted-foreground border-border",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const SindicoInvoices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("all");
  const [condominiumFilter, setCondominiumFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateInvoices = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoices", {
        body: {},
      });

      if (error) throw error;

      toast({
        title: "Faturas geradas!",
        description: `${data.results.invoicesCreated} fatura(s) criada(s) com sucesso.`,
      });

      queryClient.invalidateQueries({ queryKey: ["sindico-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sindico-subscriptions"] });
    } catch (error: any) {
      console.error("Error generating invoices:", error);
      toast({
        title: "Erro ao gerar faturas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
  const { data: subscriptions } = useQuery({
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

  // Fetch condominiums for filter
  const { data: condominiums } = useQuery({
    queryKey: ["sindico-condominiums", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch invoices
  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["sindico-invoices", user?.id, statusFilter, condominiumFilter],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("invoices")
        .select(`
          id,
          amount,
          status,
          due_date,
          paid_at,
          payment_method,
          description,
          period_start,
          period_end,
          created_at,
          condominium:condominiums(id, name),
          subscription:subscriptions(id, plan)
        `)
        .order("due_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (condominiumFilter !== "all") {
        query = query.eq("condominium_id", condominiumFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Invoice[]) || [];
    },
    enabled: !!user,
  });

  // Calculate stats
  const stats = {
    total: invoices?.length || 0,
    pending: invoices?.filter((i) => i.status === "pending").length || 0,
    paid: invoices?.filter((i) => i.status === "paid").length || 0,
    overdue: invoices?.filter((i) => i.status === "overdue").length || 0,
    totalAmount: invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0,
    paidAmount: invoices?.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0) || 0,
    pendingAmount: invoices?.filter((i) => i.status === "pending" || i.status === "overdue").reduce((sum, i) => sum + Number(i.amount), 0) || 0,
  };

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


  if (isLoadingInvoices) {
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
        <title>Central de Faturas | NotificaCondo</title>
        <meta name="description" content="Acompanhe as faturas e assinaturas dos seus condomínios" />
      </Helmet>

      <div className="space-y-6">
        <SindicoBreadcrumbs items={[{ label: "Central de Faturas" }]} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Faturas</h1>
            <p className="text-muted-foreground">
              Acompanhe as faturas e assinaturas de cada condomínio
            </p>
          </div>
          <Button onClick={handleGenerateInvoices} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Faturas
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Faturas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.paidAmount)}</p>
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <DollarSign className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground">Em Aberto</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions - View Only */}
        {subscriptions && subscriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Uso por Condomínio
              </CardTitle>
              <CardDescription>
                Para alterar o plano, acesse a edição do condomínio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptions.map((sub) => {
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
                      className="p-4 rounded-xl border border-border bg-card"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{sub.condominium.name}</span>
                        </div>
                        <Badge className={`${getPlanColor(sub.plan)} text-white`}>
                          {PLAN_NAMES[sub.plan] || sub.plan}
                        </Badge>
                      </div>

                      {currentPlan && (
                        <p className="text-lg font-bold text-foreground mb-3">
                          {formatCurrency(currentPlan.price)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </p>
                      )}

                      <div className="space-y-2">
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
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Faturas
            </CardTitle>
            <CardDescription>
              Histórico de cobranças por condomínio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Select value={condominiumFilter} onValueChange={setCondominiumFilter}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por condomínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Condomínios</SelectItem>
                  {condominiums?.map((condo) => (
                    <SelectItem key={condo.id} value={condo.id}>
                      {condo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {invoices && invoices.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending;

                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{invoice.condominium?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {PLAN_NAMES[invoice.subscription?.plan] || invoice.subscription?.plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(invoice.due_date)}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(invoice.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invoice.status === "pending" || invoice.status === "overdue" ? (
                              <Button size="sm" variant="outline">
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                            ) : invoice.status === "paid" ? (
                              <span className="text-xs text-muted-foreground">
                                Pago em {invoice.paid_at && formatDate(invoice.paid_at)}
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As faturas serão geradas automaticamente conforme os planos dos condomínios
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default SindicoInvoices;
