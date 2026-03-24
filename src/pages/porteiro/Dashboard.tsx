import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight as ChevronRightIcon, Megaphone, Package, PackagePlus, PackageCheck, Clock, Search, QrCode, Calendar, TrendingUp, FileText, BookOpen, Send, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
  const { porteiroCondominiums, profileInfo } = useUserRole();
  const condominiumIds = useMemo(() => porteiroCondominiums.map(c => c.id), [porteiroCondominiums]);
  const userName = profileInfo?.full_name?.split(" ")[0] || "";
  const [stats, setStats] = useState<Stats>({
    registeredToday: 0,
    totalPending: 0,
    pickedUpToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today");
  const [dateRange, setDateRange] = useState<{from: Date | undefined;to: Date | undefined;}>({
    from: undefined,
    to: undefined
  });

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
          endDate: dateRange.to ? endOfDay(dateRange.to) : todayEnd
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
        const { count: registeredCount } = await supabase.
        from("packages").
        select("*", { count: "exact", head: true }).
        in("condominium_id", condominiumIds).
        gte("received_at", startDate.toISOString()).
        lte("received_at", endDate.toISOString());

        // Total pending from entire database
        const { count: pendingCount } = await supabase.
        from("packages").
        select("*", { count: "exact", head: true }).
        in("condominium_id", condominiumIds).
        eq("status", "pendente");

        // Picked up in period (based on filter)
        const { count: pickedUpTodayCount } = await supabase.
        from("packages").
        select("*", { count: "exact", head: true }).
        in("condominium_id", condominiumIds).
        eq("status", "retirada").
        gte("picked_up_at", startDate.toISOString()).
        lte("picked_up_at", endDate.toISOString());

        setStats({
          registeredToday: registeredCount || 0,
          totalPending: pendingCount || 0,
          pickedUpToday: pickedUpTodayCount || 0
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
        const { data: registeredPackages } = await supabase.
        from("packages").
        select("received_at").
        in("condominium_id", condominiumIds).
        gte("received_at", startDate.toISOString()).
        lte("received_at", endDate.toISOString());

        const { data: pickedUpPackages } = await supabase.
        from("packages").
        select("picked_up_at").
        in("condominium_id", condominiumIds).
        eq("status", "retirada").
        gte("picked_up_at", startDate.toISOString()).
        lte("picked_up_at", endDate.toISOString());

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
            retiradas: pickedUpByDate[dateKey] || 0
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
      color: "hsl(var(--primary))"
    },
    retiradas: {
      label: "Retiradas",
      color: "hsl(142, 76%, 36%)"
    }
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

        {/* Banners do Condomínio */}
        <CondominiumBanners condominiumIds={condominiumIds} />

        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={periodFilter === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("today")}>

              Hoje
            </Button>
            <Button
              variant={periodFilter === "7days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("7days")}>

              7 dias
            </Button>
            <Button
              variant={periodFilter === "15days" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodFilter("15days")}>

              15 dias
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={periodFilter === "custom" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => setPeriodFilter("custom")}>

                  <Calendar className="h-4 w-4" />
                  {periodFilter === "custom" && dateRange.from && dateRange.to ?
                  `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}` :
                  "Período"}
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
                  numberOfMonths={2} />

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
              <CardTitle className="text-sm font-medium">Retiradas</CardTitle>
              <PackageCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? "..." : stats.pickedUpToday}
              </div>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {periodFilter !== "today" &&
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Evolução de Encomendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingChart ?
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Carregando gráfico...
                </div> :
            chartData.length > 0 ?
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground" />

                      <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    className="text-muted-foreground" />

                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line
                    type="monotone"
                    dataKey="cadastradas"
                    name="Cadastradas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }} />

                      <Line
                    type="monotone"
                    dataKey="retiradas"
                    name="Retiradas"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }} />

                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer> :

            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </div>
            }
            </CardContent>
          </Card>
        }

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/registrar")}>

              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <PackagePlus className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-sm text-center">Nova Encomenda</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}>

              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-blue-500" />
                </div>
                <p className="font-medium text-sm text-center">Buscar Unidade</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}>

              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <p className="font-medium text-sm text-center">Pendentes</p>
                {stats.totalPending > 0 &&
                <span className="mt-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                    {stats.totalPending}
                  </span>
                }
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/encomendas")}>

              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <QrCode className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-medium text-sm text-center">Confirmar Retirada</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate("/porteiro/historico")}>

              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <p className="font-medium text-sm text-center">Histórico</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Livro de Recados */}
        <PorterMessageBook condominiumIds={condominiumIds} />
      </div>
    </DashboardLayout>);

}

function CondominiumBanners({ condominiumIds }: { condominiumIds: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: banners = [] } = useQuery({
    queryKey: ["porteiro-banners", condominiumIds],
    queryFn: async () => {
      if (condominiumIds.length === 0) return [];
      const { data, error } = await supabase
        .from("condominium_banners")
        .select("*")
        .in("condominium_id", condominiumIds)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: condominiumIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const total = banners.length;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-advance every 10s
  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(goNext, 10000);
    return () => clearInterval(timer);
  }, [total, goNext]);

  // Reset index if banners change
  useEffect(() => {
    setCurrentIndex(0);
  }, [total]);

  if (total === 0) return null;

  const banner = banners[currentIndex] as any;

  return (
    <div className="relative">
      <div
        className="rounded-lg p-4 flex items-start gap-3 animate-fade-in transition-all"
        style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
      >
        <Megaphone className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{banner.title}</p>
          <p className="text-sm mt-0.5 whitespace-pre-line">{banner.content}</p>
        </div>

        {total > 1 && (
          <div className="flex items-center gap-1 shrink-0 self-center">
            <button
              onClick={goPrev}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
              style={{ color: banner.text_color }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium min-w-[36px] text-center">
              {currentIndex + 1}/{total}
            </span>
            <button
              onClick={goNext}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
              style={{ color: banner.text_color }}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Dots indicator */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? "bg-primary scale-125" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PorterMessageBook({ condominiumIds }: { condominiumIds: string[] }) {
  const [newMessage, setNewMessage] = useState("");
  const { profileInfo } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["porter-messages", condominiumIds],
    queryFn: async () => {
      if (condominiumIds.length === 0) return [];
      const { data, error } = await supabase
        .from("porter_messages")
        .select("*")
        .in("condominium_id", condominiumIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: condominiumIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newMessage.trim() || condominiumIds.length === 0) return;
      const { error } = await supabase.from("porter_messages").insert({
        condominium_id: condominiumIds[0],
        author_id: user.id,
        author_name: profileInfo?.full_name || "Porteiro",
        content: newMessage.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["porter-messages", condominiumIds] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("porter_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["porter-messages", condominiumIds] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Livro de Recados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum recado registrado.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1 py-2 scrollbar-thin">
            {[...messages].reverse().map((msg: any) => {
              const isMe = user && msg.author_id === user.id;
              return (
                <div key={msg.id} className={`flex items-center gap-1 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {isMe && (
                    <button
                      onClick={() => deleteMutation.mutate(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                    {!isMe && (
                      <p className="text-xs font-semibold mb-0.5 text-primary">{msg.author_name}</p>
                    )}
                    <p className={`text-sm whitespace-pre-line ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>{msg.content}</p>
                    <div className={`flex items-center mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  {!isMe && (
                    <button
                      onClick={() => deleteMutation.mutate(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Deixe um recado para o próximo plantão..."
            rows={2}
            className="resize-none"
            maxLength={500}
          />
          <Button
            size="icon"
            className="shrink-0 self-end h-10 w-10"
            disabled={!newMessage.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}