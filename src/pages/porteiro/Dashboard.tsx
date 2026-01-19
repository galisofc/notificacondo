import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, PackagePlus, PackageCheck, Clock, Search, QrCode, Calendar, TrendingUp, FileText } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type PeriodFilter = "today" | "7days" | "15days" | "custom";

interface Stats {
  registeredToday: number;
  totalPending: number;
  pickedUpToday: number;
}

interface ChartDataPoint {
  date: string;
  label: string;
  cadastradas: number;
  retiradas: number;
}

export default function PorteiroDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [condominiumIds, setCondominiumIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState<Stats>({
    registeredToday: 0,
    totalPending: 0,
    pickedUpToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("7days");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Fetch porter's condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data: userCondos } = await supabase
        .from("user_condominiums")
        .select("condominium_id")
        .eq("user_id", user.id);

      if (userCondos) {
        setCondominiumIds(userCondos.map((uc) => uc.condominium_id));
      }

      // Fetch user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setUserName(profile.full_name.split(" ")[0]);
      }
    };

    fetchCondominiums();
  }, [user]);

  // Calculate date range based on filter
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    switch (periodFilter) {
      case "today":
        return { startDate: todayStart, endDate: todayEnd };
      case "7days":
        return { startDate: startOfDay(subDays(today, 6)), endDate: todayEnd };
      case "15days":
        return { startDate: startOfDay(subDays(today, 14)), endDate: todayEnd };
      case "custom":
        return {
          startDate: dateRange.from ? startOfDay(dateRange.from) : todayStart,
          endDate: dateRange.to ? endOfDay(dateRange.to) : todayEnd,
        };
      default:
        return { startDate: todayStart, endDate: todayEnd };
    }
  }, [periodFilter, dateRange]);

  // Fetch stats from database
  useEffect(() => {
    const fetchStats = async () => {
      if (!condominiumIds.length) return;

      setLoading(true);
      try {
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const todayEnd = endOfDay(today).toISOString();

        // Registered in period (based on filter)
        const { count: registeredCount } = await supabase
          .from("packages")
          .select("*", { count: "exact", head: true })
          .in("condominium_id", condominiumIds)
          .gte("received_at", startDate.toISOString())
          .lte("received_at", endDate.toISOString());

        // Total pending from entire database
        const { count: pendingCount } = await supabase
          .from("packages")
          .select("*", { count: "exact", head: true })
          .in("condominium_id", condominiumIds)
          .eq("status", "pendente");

        // Picked up today
        const { count: pickedUpTodayCount } = await supabase
          .from("packages")
          .select("*", { count: "exact", head: true })
          .in("condominium_id", condominiumIds)
          .eq("status", "retirada")
          .gte("picked_up_at", todayStart)
          .lte("picked_up_at", todayEnd);

        setStats({
          registeredToday: registeredCount || 0,
          totalPending: pendingCount || 0,
          pickedUpToday: pickedUpTodayCount || 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [condominiumIds, startDate, endDate]);

  // Fetch chart data
  useEffect(() => {
    const fetchChartData = async () => {
      if (!condominiumIds.length) return;

      setLoadingChart(true);
      try {
        // Get all days in the range
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // Fetch all packages in the period
        const { data: registeredPackages } = await supabase
          .from("packages")
          .select("received_at")
          .in("condominium_id", condominiumIds)
          .gte("received_at", startDate.toISOString())
          .lte("received_at", endDate.toISOString());

        const { data: pickedUpPackages } = await supabase
          .from("packages")
          .select("picked_up_at")
          .in("condominium_id", condominiumIds)
          .eq("status", "retirada")
          .gte("picked_up_at", startDate.toISOString())
          .lte("picked_up_at", endDate.toISOString());

        // Group by date
        const registeredByDate: Record<string, number> = {};
        const pickedUpByDate: Record<string, number> = {};

        registeredPackages?.forEach((pkg) => {
          const date = format(parseISO(pkg.received_at), "yyyy-MM-dd");
          registeredByDate[date] = (registeredByDate[date] || 0) + 1;
        });

        pickedUpPackages?.forEach((pkg) => {
          if (pkg.picked_up_at) {
            const date = format(parseISO(pkg.picked_up_at), "yyyy-MM-dd");
            pickedUpByDate[date] = (pickedUpByDate[date] || 0) + 1;
          }
        });

        // Build chart data
        const data: ChartDataPoint[] = days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          return {
            date: dateKey,
            label: format(day, "dd/MM", { locale: ptBR }),
            cadastradas: registeredByDate[dateKey] || 0,
            retiradas: pickedUpByDate[dateKey] || 0,
          };
        });

        setChartData(data);
      } catch (error) {
        console.error("Error fetching chart data:", error);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchChartData();
  }, [condominiumIds, startDate, endDate]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case "today":
        return "Hoje";
      case "7days":
        return "Últimos 7 dias";
      case "15days":
        return "Últimos 15 dias";
      case "custom":
        if (dateRange.from && dateRange.to) {
          return `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
        }
        return "Período personalizado";
      default:
        return "";
    }
  };

  const chartConfig = {
    cadastradas: {
      label: "Cadastradas",
      color: "hsl(var(--primary))",
    },
    retiradas: {
      label: "Retiradas",
      color: "hsl(142, 76%, 36%)",
    },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {userName || "Porteiro"}! 👋
            </h1>
            <p className="text-muted-foreground">
              Gerencie as encomendas do condomínio
            </p>
          </div>
          <Button onClick={() => navigate("/porteiro/registrar")} className="gap-2">
            <PackagePlus className="w-4 h-4" />
            Registrar Encomenda
          </Button>
        </div>

        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={periodFilter === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("today")}
            >
              Hoje
            </Button>
            <Button
              variant={periodFilter === "7days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("7days")}
            >
              7 dias
            </Button>
            <Button
              variant={periodFilter === "15days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("15days")}
            >
              15 dias
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={periodFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => setPeriodFilter("custom")}
                >
                  <Calendar className="h-4 w-4" />
                  {periodFilter === "custom" && dateRange.from && dateRange.to
                    ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                    : "Período"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    setDateRange({ from: range?.from, to: range?.to });
                    if (range?.from && range?.to) {
                      setPeriodFilter("custom");
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cadastradas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stats.registeredToday}
              </div>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {loading ? "..." : stats.totalPending}
              </div>
              <p className="text-xs text-muted-foreground">Total no sistema</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retiradas Hoje</CardTitle>
              <PackageCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? "..." : stats.pickedUpToday}
              </div>
              <p className="text-xs text-muted-foreground">Entregues aos moradores</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {periodFilter !== "today" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Evolução de Encomendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingChart ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Carregando gráfico...
                </div>
              ) : chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        className="text-muted-foreground"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cadastradas"
                        name="Cadastradas"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="retiradas"
                        name="Retiradas"
                        stroke="hsl(142, 76%, 36%)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/registrar")}
            >
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <PackagePlus className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-sm text-center">Nova Encomenda</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}
            >
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-blue-500" />
                </div>
                <p className="font-medium text-sm text-center">Buscar Unidade</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}
            >
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <p className="font-medium text-sm text-center">Pendentes</p>
                {stats.totalPending > 0 && (
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                    {stats.totalPending}
                  </span>
                )}
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}
            >
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <QrCode className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-medium text-sm text-center">Confirmar Retirada</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/historico")}
            >
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <p className="font-medium text-sm text-center">Histórico</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
