import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  Eye,
  Check,
  Download,
} from "lucide-react";

interface InvoiceWithDetails {
  id: string;
  subscription_id: string;
  condominium_id: string;
  amount: number;
  due_date: string;
  period_start: string;
  period_end: string;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  description: string | null;
  created_at: string;
  condominium: {
    name: string;
    owner_id: string;
  } | null;
  owner_profile: {
    full_name: string;
    email: string;
  } | null;
}

export function InvoicesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["superadmin-invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*")
        .order("due_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const invoicesWithDetails = await Promise.all(
        (data || []).map(async (invoice) => {
          const { data: condo } = await supabase
            .from("condominiums")
            .select("name, owner_id")
            .eq("id", invoice.condominium_id)
            .single();

          let ownerProfile = null;
          if (condo?.owner_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", condo.owner_id)
              .single();
            ownerProfile = profile;
          }

          return {
            ...invoice,
            condominium: condo,
            owner_profile: ownerProfile,
          } as InvoiceWithDetails;
        })
      );

      return invoicesWithDetails;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["superadmin-invoice-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("status, amount, due_date");

      if (error) throw error;

      const today = new Date();
      const currentMonthStart = startOfMonth(today);
      const currentMonthEnd = endOfMonth(today);

      const result = {
        pending: { count: 0, total: 0 },
        paid: { count: 0, total: 0 },
        overdue: { count: 0, total: 0 },
        thisMonth: { count: 0, total: 0 },
      };

      data.forEach((invoice) => {
        const dueDate = new Date(invoice.due_date);
        const isPastDue = dueDate < today && invoice.status === "pending";

        if (invoice.status === "paid") {
          result.paid.count++;
          result.paid.total += Number(invoice.amount);
        } else if (isPastDue) {
          result.overdue.count++;
          result.overdue.total += Number(invoice.amount);
        } else if (invoice.status === "pending") {
          result.pending.count++;
          result.pending.total += Number(invoice.amount);
        }

        if (dueDate >= currentMonthStart && dueDate <= currentMonthEnd) {
          result.thisMonth.count++;
          result.thisMonth.total += Number(invoice.amount);
        }
      });

      return result;
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      method,
      reference,
    }: {
      invoiceId: string;
      method: string;
      reference: string;
    }) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: method,
          payment_reference: reference,
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-invoice-stats"] });
      toast({
        title: "Pagamento registrado",
        description: "A fatura foi marcada como paga com sucesso.",
      });
      setShowPaymentDialog(false);
      setPaymentMethod("");
      setPaymentReference("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível registrar o pagamento.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const isPastDue = due < today && status === "pending";

    if (status === "paid") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }

    if (isPastDue) {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Vencido
        </Badge>
      );
    }

    const daysUntilDue = differenceInDays(due, today);
    if (daysUntilDue <= 7) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Vence em {daysUntilDue} dias
        </Badge>
      );
    }

    return (
      <Badge className="bg-primary/10 text-primary border-primary/20">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesSearch =
      searchQuery === "" ||
      invoice.condominium?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.owner_profile?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.owner_profile?.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const handleMarkAsPaid = () => {
    if (!selectedInvoice || !paymentMethod) return;
    markAsPaidMutation.mutate({
      invoiceId: selectedInvoice.id,
      method: paymentMethod,
      reference: paymentReference,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-xl font-bold">{stats?.thisMonth.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.thisMonth.total || 0)}
                </p>
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
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold">{stats?.pending.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.pending.total || 0)}
                </p>
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
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold">{stats?.paid.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.paid.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-xl font-bold">{stats?.overdue.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.overdue.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Central de Faturas</CardTitle>
              <CardDescription>
                Gerencie todas as faturas dos condomínios
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar condomínio ou síndico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInvoices?.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condomínio</TableHead>
                    <TableHead>Síndico</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {invoice.condominium?.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {invoice.owner_profile?.full_name || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.owner_profile?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(invoice.due_date)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold">
                            {formatCurrency(Number(invoice.amount))}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status, invoice.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPaymentDialog(true);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Fatura</DialogTitle>
            <DialogDescription>
              Informações completas sobre a fatura
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Condomínio</Label>
                  <p className="font-medium">{selectedInvoice.condominium?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Síndico</Label>
                  <p className="font-medium">{selectedInvoice.owner_profile?.full_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Valor</Label>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedInvoice.amount))}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedInvoice.status, selectedInvoice.due_date)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Período</Label>
                  <p className="text-sm">
                    {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Vencimento</Label>
                  <p className="text-sm">{formatDate(selectedInvoice.due_date)}</p>
                </div>
              </div>

              {selectedInvoice.paid_at && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <Label className="text-muted-foreground text-xs">Data do Pagamento</Label>
                    <p className="text-sm">{formatDate(selectedInvoice.paid_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Método</Label>
                    <p className="text-sm">{selectedInvoice.payment_method || "—"}</p>
                  </div>
                  {selectedInvoice.payment_reference && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Referência</Label>
                      <p className="text-sm">{selectedInvoice.payment_reference}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoice.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição</Label>
                  <p className="text-sm">{selectedInvoice.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Marque esta fatura como paga e registre os detalhes do pagamento
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedInvoice.condominium?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento: {formatDate(selectedInvoice.due_date)}
                    </p>
                  </div>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedInvoice.amount))}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-method">Método de Pagamento *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="payment-reference">Referência / Comprovante</Label>
                  <Input
                    id="payment-reference"
                    placeholder="ID da transação, número do comprovante, etc."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={!paymentMethod || markAsPaidMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {markAsPaidMutation.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
