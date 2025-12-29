import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { MercadoPagoTransparentCheckout } from "@/components/mercadopago/MercadoPagoTransparentCheckout";
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
  ShieldCheck,
  ShieldX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type InvoiceStatus = "all" | "pending" | "paid" | "overdue" | "cancelled";

interface Invoice {
  id: string;
  invoice_number: string | null;
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
  const { date: formatDate } = useDateFormatter();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("all");
  const [condominiumFilter, setCondominiumFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Subscribe to realtime updates on invoices table
  useEffect(() => {
    const channel = supabase
      .channel("invoices-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invoices",
        },
        (payload) => {
          console.log("Invoice updated via realtime:", payload);
          // Invalidate queries to refresh the list
          queryClient.invalidateQueries({ queryKey: ["sindico-invoices"] });
          
          // Show toast if payment was confirmed
          if (payload.new?.status === "paid" && payload.old?.status !== "paid") {
            toast({
              title: "Pagamento confirmado!",
              description: "Uma fatura foi paga com sucesso.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Fetch user profile to get email
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch MercadoPago config status
  const { data: mpConfig } = useQuery({
    queryKey: ["mercadopago-public-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "get-mercadopago-public-config",
        { body: {} }
      );
      if (error) {
        console.error("Error fetching MercadoPago config:", error);
        return null;
      }
      return (data?.config as
        | { public_key: string | null; is_sandbox: boolean; is_active: boolean }
        | null) ?? null;
    },
  });

  // Mask public key for display
  const maskPublicKey = (key: string | null) => {
    if (!key) return null;
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  };

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
          invoice_number,
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
        .order("invoice_number", { ascending: false, nullsFirst: false });

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, condominiumFilter]);

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

  // Pagination calculations
  const totalItems = invoices?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = invoices?.slice(startIndex, endIndex) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // formatDate já vem do import @/lib/dateUtils

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
        <title>Faturas | NotificaCondo</title>
        <meta name="description" content="Acompanhe as faturas dos seus condomínios" />
      </Helmet>

      <div className="space-y-6">
        <SindicoBreadcrumbs items={[{ label: "Faturas" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturas</h1>
            <p className="text-muted-foreground">
              Acompanhe as faturas de cada condomínio
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* MercadoPago Status Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
                    mpConfig?.is_active
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {mpConfig?.is_active ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <ShieldX className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {mpConfig?.is_active ? "Pagamentos Ativos" : "Pagamentos Inativos"}
                  </span>
                  {mpConfig?.is_sandbox && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Sandbox
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">
                    {mpConfig?.is_active
                      ? "Mercado Pago configurado"
                      : "Mercado Pago não configurado"}
                  </p>
                  {mpConfig?.public_key && (
                    <p className="text-xs text-muted-foreground">
                      Public Key: {maskPublicKey(mpConfig.public_key)}
                    </p>
                  )}
                  {!mpConfig?.is_active && (
                    <p className="text-xs text-muted-foreground">
                      Entre em contato com o administrador para ativar pagamentos.
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

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

        {/* Invoices Table */}
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
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Fatura</TableHead>
                        <TableHead>Condomínio</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInvoices.map((invoice) => {
                        const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending;
                        // Detecta se é fatura avulsa: period_start === period_end ou descrição não começa com "Assinatura"
                        const isAvulsa = invoice.period_start === invoice.period_end || 
                          (invoice.description && !invoice.description.startsWith("Assinatura"));

                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <span className="font-mono text-sm font-medium text-primary">
                                {invoice.invoice_number || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{invoice.condominium?.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {isAvulsa ? (
                                <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 border-violet-500/20">
                                  Avulsa
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  {PLAN_NAMES[invoice.subscription?.plan] || invoice.subscription?.plan}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px]">
                              {isAvulsa ? (
                                <span className="truncate block" title={invoice.description || "Fatura Avulsa"}>
                                  {invoice.description || "Fatura Avulsa"}
                                </span>
                              ) : (
                                <span>
                                  {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                                </span>
                              )}
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
                                userProfile?.email ? (
                                  <MercadoPagoTransparentCheckout
                                    invoiceId={invoice.id}
                                    payerEmail={userProfile.email}
                                    amount={invoice.amount}
                                    buttonText="Pagar"
                                    onPaymentSuccess={() => {
                                      queryClient.invalidateQueries({ queryKey: ["sindico-invoices"] });
                                    }}
                                  />
                                ) : (
                                  <Button size="sm" variant="outline" disabled>
                                    <CreditCard className="h-4 w-4 mr-1" />
                                    Pagar
                                  </Button>
                                )
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

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Exibindo</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>de {totalItems} faturas</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm font-medium">{currentPage}</span>
                      <span className="text-sm text-muted-foreground">de</span>
                      <span className="text-sm font-medium">{totalPages || 1}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
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
