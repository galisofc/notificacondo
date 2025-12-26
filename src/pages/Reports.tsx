import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Occurrence {
  id: string;
  type: "advertencia" | "notificacao" | "multa";
  status: string;
  created_at: string;
  condominium_id: string;
}

interface Fine {
  id: string;
  amount: number;
  status: "em_aberto" | "pago" | "vencido";
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

interface Condominium {
  id: string;
  name: string;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#6b7280",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const PIE_COLORS = [COLORS.warning, COLORS.blue, COLORS.danger];

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);

  // Filters
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch condominiums
      const { data: condosData } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id);
      setCondominiums(condosData || []);

      if (condosData && condosData.length > 0) {
        const condoIds = condosData.map((c) => c.id);

        // Fetch occurrences
        const { data: occurrencesData } = await supabase
          .from("occurrences")
          .select("id, type, status, created_at, condominium_id")
          .in("condominium_id", condoIds);
        setOccurrences(occurrencesData || []);

        // Fetch fines
        const { data: finesData } = await supabase
          .from("fines")
          .select("id, amount, status, due_date, paid_at, created_at, occurrence_id")
          .in(
            "occurrence_id",
            (occurrencesData || []).map((o) => o.id)
          );
        setFines(finesData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filtered data based on period and condominium
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((o) => {
      const date = parseISO(o.created_at);
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      const withinPeriod = isWithinInterval(date, { start: from, end: to });
      const matchesCondo = selectedCondominium === "all" || o.condominium_id === selectedCondominium;
      return withinPeriod && matchesCondo;
    });
  }, [occurrences, dateFrom, dateTo, selectedCondominium]);

  const filteredFines = useMemo(() => {
    return fines.filter((f) => {
      const date = parseISO(f.created_at);
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      return isWithinInterval(date, { start: from, end: to });
    });
  }, [fines, dateFrom, dateTo]);

  // Statistics calculations
  const stats = useMemo(() => {
    const totalOccurrences = filteredOccurrences.length;
    const byType = {
      advertencia: filteredOccurrences.filter((o) => o.type === "advertencia").length,
      notificacao: filteredOccurrences.filter((o) => o.type === "notificacao").length,
      multa: filteredOccurrences.filter((o) => o.type === "multa").length,
    };
    const byStatus = {
      registrada: filteredOccurrences.filter((o) => o.status === "registrada").length,
      notificado: filteredOccurrences.filter((o) => o.status === "notificado").length,
      em_defesa: filteredOccurrences.filter((o) => o.status === "em_defesa").length,
      analisando: filteredOccurrences.filter((o) => o.status === "analisando").length,
      arquivada: filteredOccurrences.filter((o) => o.status === "arquivada").length,
      advertido: filteredOccurrences.filter((o) => o.status === "advertido").length,
      multado: filteredOccurrences.filter((o) => o.status === "multado").length,
    };

    const totalFines = filteredFines.length;
    const totalFinesAmount = filteredFines.reduce((sum, f) => sum + Number(f.amount), 0);
    const paidFines = filteredFines.filter((f) => f.status === "pago");
    const paidAmount = paidFines.reduce((sum, f) => sum + Number(f.amount), 0);
    const pendingFines = filteredFines.filter((f) => f.status === "em_aberto");
    const pendingAmount = pendingFines.reduce((sum, f) => sum + Number(f.amount), 0);
    const overdueFines = filteredFines.filter((f) => f.status === "vencido");
    const overdueAmount = overdueFines.reduce((sum, f) => sum + Number(f.amount), 0);

    const paymentRate = totalFinesAmount > 0 ? (paidAmount / totalFinesAmount) * 100 : 0;
    const delinquencyRate = totalFinesAmount > 0 ? (overdueAmount / totalFinesAmount) * 100 : 0;

    return {
      totalOccurrences,
      byType,
      byStatus,
      totalFines,
      totalFinesAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      paidCount: paidFines.length,
      pendingCount: pendingFines.length,
      overdueCount: overdueFines.length,
      paymentRate,
      delinquencyRate,
    };
  }, [filteredOccurrences, filteredFines]);

  // Chart data
  const occurrencesByTypeData = [
    { name: "Advertências", value: stats.byType.advertencia, color: COLORS.warning },
    { name: "Notificações", value: stats.byType.notificacao, color: COLORS.blue },
    { name: "Multas", value: stats.byType.multa, color: COLORS.danger },
  ];

  const finesStatusData = [
    { name: "Pagas", value: stats.paidCount, amount: stats.paidAmount, color: COLORS.success },
    { name: "Em Aberto", value: stats.pendingCount, amount: stats.pendingAmount, color: COLORS.warning },
    { name: "Vencidas", value: stats.overdueCount, amount: stats.overdueAmount, color: COLORS.danger },
  ];

  const statusData = [
    { name: "Registrada", count: stats.byStatus.registrada },
    { name: "Notificado", count: stats.byStatus.notificado },
    { name: "Em Defesa", count: stats.byStatus.em_defesa },
    { name: "Analisando", count: stats.byStatus.analisando },
    { name: "Arquivada", count: stats.byStatus.arquivada },
    { name: "Advertido", count: stats.byStatus.advertido },
    { name: "Multado", count: stats.byStatus.multado },
  ].filter((s) => s.count > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground">
              Estatísticas de ocorrências, multas e inadimplência
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Condomínio</Label>
                <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os condomínios</SelectItem>
                    {condominiums.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCondominium("all");
                    setDateFrom(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
                    setDateTo(format(new Date(), "yyyy-MM-dd"));
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Ocorrências</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalOccurrences}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total em Multas</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(stats.totalFinesAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Pagamento</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.paymentRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Inadimplência</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.delinquencyRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Occurrences by Type */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Ocorrências por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalOccurrences === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhuma ocorrência no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={occurrencesByTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {occurrencesByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Occurrences by Status */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Ocorrências por Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhuma ocorrência no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fines Details */}
        <Card className="bg-gradient-card border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Detalhamento de Multas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Paid */}
              <div className="p-6 rounded-xl bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Multas Pagas</p>
                    <p className="text-xl font-bold text-green-500">{stats.paidCount}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.paidAmount)}</p>
              </div>

              {/* Pending */}
              <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Em Aberto</p>
                    <p className="text-xl font-bold text-amber-500">{stats.pendingCount}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.pendingAmount)}</p>
              </div>

              {/* Overdue */}
              <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vencidas</p>
                    <p className="text-xl font-bold text-red-500">{stats.overdueCount}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.overdueAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Occurrences Type Breakdown */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Resumo por Tipo de Ocorrência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Advertências</p>
                    <p className="text-3xl font-bold text-amber-500">{stats.byType.advertencia}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Notificações</p>
                    <p className="text-3xl font-bold text-blue-500">{stats.byType.notificacao}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Multas</p>
                    <p className="text-3xl font-bold text-red-500">{stats.byType.multa}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;
