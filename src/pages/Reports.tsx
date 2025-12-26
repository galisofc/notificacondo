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
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, eachMonthOfInterval, startOfDay, endOfDay } from "date-fns";
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
  LineChart,
  Line,
  Area,
  AreaChart,
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
      const from = startOfDay(parseISO(dateFrom));
      const to = endOfDay(parseISO(dateTo));
      const withinPeriod = isWithinInterval(date, { start: from, end: to });
      const matchesCondo = selectedCondominium === "all" || o.condominium_id === selectedCondominium;
      return withinPeriod && matchesCondo;
    });
  }, [occurrences, dateFrom, dateTo, selectedCondominium]);

  const filteredFines = useMemo(() => {
    return fines.filter((f) => {
      const date = parseISO(f.created_at);
      const from = startOfDay(parseISO(dateFrom));
      const to = endOfDay(parseISO(dateTo));
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

  // Monthly evolution data
  const monthlyEvolutionData = useMemo(() => {
    const from = parseISO(dateFrom);
    const to = parseISO(dateTo);
    const months = eachMonthOfInterval({ start: from, end: to });

    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthOccurrences = filteredOccurrences.filter((o) => {
        const date = parseISO(o.created_at);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      const monthFines = filteredFines.filter((f) => {
        const date = parseISO(f.created_at);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      const finesAmount = monthFines.reduce((sum, f) => sum + Number(f.amount), 0);

      return {
        month: format(month, "MMM/yy", { locale: ptBR }),
        ocorrencias: monthOccurrences.length,
        advertencias: monthOccurrences.filter((o) => o.type === "advertencia").length,
        notificacoes: monthOccurrences.filter((o) => o.type === "notificacao").length,
        multas: monthOccurrences.filter((o) => o.type === "multa").length,
        valorMultas: finesAmount,
      };
    });
  }, [filteredOccurrences, filteredFines, dateFrom, dateTo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Ocorrências e Multas", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const selectedCondoName = selectedCondominium === "all" 
      ? "Todos os Condomínios" 
      : condominiums.find(c => c.id === selectedCondominium)?.name || "";
    doc.text(`Condomínio: ${selectedCondoName}`, pageWidth / 2, yPos, { align: "center" });
    
    yPos += 6;
    doc.text(`Período: ${format(parseISO(dateFrom), "dd/MM/yyyy", { locale: ptBR })} a ${format(parseISO(dateTo), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
    
    yPos += 6;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
    doc.setTextColor(0);

    // Summary Section
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Geral", 14, yPos);

    yPos += 8;
    autoTable(doc, {
      startY: yPos,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Ocorrências", stats.totalOccurrences.toString()],
        ["Total em Multas", formatCurrency(stats.totalFinesAmount)],
        ["Taxa de Pagamento", `${stats.paymentRate.toFixed(1)}%`],
        ["Taxa de Inadimplência", `${stats.delinquencyRate.toFixed(1)}%`],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Occurrences by Type
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Ocorrências por Tipo", 14, yPos);

    yPos += 8;
    autoTable(doc, {
      startY: yPos,
      head: [["Tipo", "Quantidade"]],
      body: [
        ["Advertências", stats.byType.advertencia.toString()],
        ["Notificações", stats.byType.notificacao.toString()],
        ["Multas", stats.byType.multa.toString()],
      ],
      theme: "striped",
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Occurrences by Status
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Ocorrências por Status", 14, yPos);

    yPos += 8;
    const statusRows = [
      ["Registrada", stats.byStatus.registrada.toString()],
      ["Notificado", stats.byStatus.notificado.toString()],
      ["Em Defesa", stats.byStatus.em_defesa.toString()],
      ["Analisando", stats.byStatus.analisando.toString()],
      ["Arquivada", stats.byStatus.arquivada.toString()],
      ["Advertido", stats.byStatus.advertido.toString()],
      ["Multado", stats.byStatus.multado.toString()],
    ].filter(([_, count]) => parseInt(count) > 0);

    autoTable(doc, {
      startY: yPos,
      head: [["Status", "Quantidade"]],
      body: statusRows,
      theme: "striped",
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    // Fines Details
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalhamento de Multas", 14, yPos);

    yPos += 8;
    autoTable(doc, {
      startY: yPos,
      head: [["Status", "Quantidade", "Valor Total"]],
      body: [
        ["Pagas", stats.paidCount.toString(), formatCurrency(stats.paidAmount)],
        ["Em Aberto", stats.pendingCount.toString(), formatCurrency(stats.pendingAmount)],
        ["Vencidas", stats.overdueCount.toString(), formatCurrency(stats.overdueAmount)],
        ["TOTAL", stats.totalFines.toString(), formatCurrency(stats.totalFinesAmount)],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      bodyStyles: { textColor: 50 },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save the PDF
    const fileName = `relatorio_${format(new Date(), "yyyy-MM-dd_HH-mm")}.pdf`;
    doc.save(fileName);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
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
          <Button onClick={exportToPDF} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
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

        {/* Monthly Evolution Chart */}
        <Card className="bg-gradient-card border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyEvolutionData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Nenhum dado no período
              </div>
            ) : (
              <div className="space-y-8">
                {/* Occurrences Evolution */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Ocorrências por Mês</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyEvolutionData}>
                      <defs>
                        <linearGradient id="colorAdvertencias" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNotificacoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorMultas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="advertencias"
                        name="Advertências"
                        stroke={COLORS.warning}
                        fillOpacity={1}
                        fill="url(#colorAdvertencias)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="notificacoes"
                        name="Notificações"
                        stroke={COLORS.blue}
                        fillOpacity={1}
                        fill="url(#colorNotificacoes)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="multas"
                        name="Multas"
                        stroke={COLORS.danger}
                        fillOpacity={1}
                        fill="url(#colorMultas)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Fines Amount Evolution */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">Valor de Multas por Mês</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyEvolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickFormatter={(value) => `R$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Valor"]}
                      />
                      <Bar 
                        dataKey="valorMultas" 
                        name="Valor em Multas"
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
