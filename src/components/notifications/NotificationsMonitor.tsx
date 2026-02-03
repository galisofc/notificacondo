import { useState, useEffect } from "react";
import { formatPhone } from "@/components/ui/masked-input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  MessageCircle,
  Check,
  AlertCircle,
  Search,
  Package,
  AlertTriangle,
  FileWarning,
  DollarSign,
  PartyPopper,
  TrendingUp,
  Calendar,
  Send,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type ModuleFilter = "all" | "packages" | "occurrences" | "party_hall" | "other";

interface WabaLog {
  id: string;
  created_at: string;
  function_name: string;
  phone: string | null;
  template_name: string | null;
  success: boolean;
  error_message: string | null;
  message_id: string | null;
}

// Mapeamento de function_name para módulo
const functionToModule: Record<string, { module: string; label: string; icon: React.ReactNode; color: string }> = {
  "notify-package-arrival": { 
    module: "packages", 
    label: "Encomendas", 
    icon: <Package className="h-4 w-4" />,
    color: "hsl(262, 83%, 58%)" 
  },
  "notify-resident-decision": { 
    module: "occurrences", 
    label: "Ocorrências", 
    icon: <FileWarning className="h-4 w-4" />,
    color: "hsl(var(--primary))" 
  },
  "notify-sindico-defense": { 
    module: "occurrences", 
    label: "Ocorrências", 
    icon: <FileWarning className="h-4 w-4" />,
    color: "hsl(var(--primary))" 
  },
  "send-whatsapp-notification": { 
    module: "occurrences", 
    label: "Ocorrências", 
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "hsl(var(--primary))" 
  },
  "send-party-hall-notification": { 
    module: "party_hall", 
    label: "Salão de Festas", 
    icon: <PartyPopper className="h-4 w-4" />,
    color: "hsl(142, 76%, 36%)" 
  },
  "notify-party-hall-reminders": { 
    module: "party_hall", 
    label: "Salão de Festas", 
    icon: <PartyPopper className="h-4 w-4" />,
    color: "hsl(142, 76%, 36%)" 
  },
  "notify-trial-ending": { 
    module: "other", 
    label: "Sistema", 
    icon: <MessageCircle className="h-4 w-4" />,
    color: "hsl(var(--muted-foreground))" 
  },
  "notify-transfer": { 
    module: "other", 
    label: "Sistema", 
    icon: <MessageCircle className="h-4 w-4" />,
    color: "hsl(var(--muted-foreground))" 
  },
};

const getModuleInfo = (functionName: string) => {
  return functionToModule[functionName] || { 
    module: "other", 
    label: "Outros", 
    icon: <MessageCircle className="h-4 w-4" />,
    color: "hsl(var(--muted-foreground))" 
  };
};

const chartConfig = {
  packages: { label: "Encomendas", color: "hsl(262, 83%, 58%)" },
  occurrences: { label: "Ocorrências", color: "hsl(var(--primary))" },
  party_hall: { label: "Salão de Festas", color: "hsl(142, 76%, 36%)" },
  other: { label: "Outros", color: "hsl(var(--muted-foreground))" },
};

const moduleColors = {
  packages: "hsl(262, 83%, 58%)",
  occurrences: "hsl(221, 83%, 53%)",
  party_hall: "hsl(142, 76%, 36%)",
  other: "hsl(220, 9%, 46%)",
};

export function NotificationsMonitor() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { date: formatDate, custom: formatCustom } = useDateFormatter();

  const { containerRef, PullIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["waba-notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["waba-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-period"] });
    },
    isEnabled: isMobile,
  });

  // Buscar período da assinatura
  const { data: subscriptionPeriod } = useQuery({
    queryKey: ["subscription-period"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Buscar condomínios do usuário
      const { data: condos } = await supabase
        .from("condominiums")
        .select("id")
        .eq("owner_id", user.id);

      if (!condos || condos.length === 0) return null;

      // Buscar assinatura ativa
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("current_period_start, current_period_end, package_notifications_limit, package_notifications_used, package_notifications_extra")
        .eq("condominium_id", condos[0].id)
        .eq("active", true)
        .single();

      return subscription;
    },
  });

  // Buscar todas as notificações WABA no período
  const { data: wabaLogs, isLoading } = useQuery({
    queryKey: ["waba-notifications", subscriptionPeriod?.current_period_start, subscriptionPeriod?.current_period_end, moduleFilter],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_notification_logs")
        .select("id, created_at, function_name, phone, template_name, success, error_message, message_id")
        .order("created_at", { ascending: false })
        .limit(500);

      // Filtrar pelo período da assinatura se disponível
      if (subscriptionPeriod?.current_period_start) {
        query = query.gte("created_at", subscriptionPeriod.current_period_start);
      }
      if (subscriptionPeriod?.current_period_end) {
        query = query.lte("created_at", subscriptionPeriod.current_period_end);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtrar por módulo se necessário
      if (moduleFilter !== "all") {
        return (data as WabaLog[]).filter(log => {
          const info = getModuleInfo(log.function_name);
          return info.module === moduleFilter;
        });
      }

      return data as WabaLog[];
    },
    enabled: true,
  });

  // Estatísticas por módulo
  const { data: stats } = useQuery({
    queryKey: ["waba-stats", subscriptionPeriod?.current_period_start, subscriptionPeriod?.current_period_end],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_notification_logs")
        .select("function_name, success");

      if (subscriptionPeriod?.current_period_start) {
        query = query.gte("created_at", subscriptionPeriod.current_period_start);
      }
      if (subscriptionPeriod?.current_period_end) {
        query = query.lte("created_at", subscriptionPeriod.current_period_end);
      }

      const { data, error } = await query;
      if (error) throw error;

      const counts = {
        total: 0,
        success: 0,
        failed: 0,
        packages: { total: 0, success: 0, failed: 0 },
        occurrences: { total: 0, success: 0, failed: 0 },
        party_hall: { total: 0, success: 0, failed: 0 },
        other: { total: 0, success: 0, failed: 0 },
      };

      (data || []).forEach((log) => {
        counts.total++;
        if (log.success) counts.success++;
        else counts.failed++;

        const info = getModuleInfo(log.function_name);
        const moduleKey = info.module as keyof typeof counts;
        
        if (moduleKey in counts && typeof counts[moduleKey] === 'object') {
          const moduleStats = counts[moduleKey] as { total: number; success: number; failed: number };
          moduleStats.total++;
          if (log.success) moduleStats.success++;
          else moduleStats.failed++;
        }
      });

      return counts;
    },
    enabled: true,
  });

  // Dados do gráfico por dia
  const { data: chartData } = useQuery({
    queryKey: ["waba-chart", subscriptionPeriod?.current_period_start, subscriptionPeriod?.current_period_end],
    queryFn: async () => {
      if (!subscriptionPeriod?.current_period_start || !subscriptionPeriod?.current_period_end) {
        return [];
      }

      const { data, error } = await supabase
        .from("whatsapp_notification_logs")
        .select("created_at, function_name, success")
        .gte("created_at", subscriptionPeriod.current_period_start)
        .lte("created_at", subscriptionPeriod.current_period_end)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const startDate = startOfDay(new Date(subscriptionPeriod.current_period_start));
      const endDate = startOfDay(new Date(subscriptionPeriod.current_period_end));
      const allDays = eachDayOfInterval({ start: startDate, end: endDate > new Date() ? new Date() : endDate });

      const dayMap = new Map<string, { packages: number; occurrences: number; party_hall: number; other: number }>();
      
      allDays.forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        dayMap.set(key, { packages: 0, occurrences: 0, party_hall: 0, other: 0 });
      });

      (data || []).forEach((log) => {
        const key = format(new Date(log.created_at), "yyyy-MM-dd");
        const dayData = dayMap.get(key);
        if (dayData && log.success) {
          const info = getModuleInfo(log.function_name);
          const moduleKey = info.module as keyof typeof dayData;
          if (moduleKey in dayData) {
            dayData[moduleKey]++;
          }
        }
      });

      return Array.from(dayMap.entries()).map(([date, counts]) => ({
        date,
        displayDate: format(new Date(date), "dd/MM"),
        ...counts,
      }));
    },
    enabled: !!subscriptionPeriod?.current_period_start,
  });

  // Dados do gráfico de pizza
  const pieData = stats ? [
    { name: "Encomendas", value: stats.packages.success, color: moduleColors.packages },
    { name: "Ocorrências", value: stats.occurrences.success, color: moduleColors.occurrences },
    { name: "Salão de Festas", value: stats.party_hall.success, color: moduleColors.party_hall },
    { name: "Outros", value: stats.other.success, color: moduleColors.other },
  ].filter(item => item.value > 0) : [];

  const filteredLogs = wabaLogs?.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.phone?.includes(query) ||
      log.template_name?.toLowerCase().includes(query) ||
      log.function_name?.toLowerCase().includes(query)
    );
  });

  const periodLabel = subscriptionPeriod?.current_period_start && subscriptionPeriod?.current_period_end
    ? `${formatCustom(subscriptionPeriod.current_period_start, "dd/MM/yyyy")} - ${formatCustom(subscriptionPeriod.current_period_end, "dd/MM/yyyy")}`
    : "Período atual";

  return (
    <div ref={containerRef} className="space-y-6 overflow-auto">
      <PullIndicator />

      {/* Período da Assinatura */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Período da Assinatura</p>
              <p className="text-xs text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Resumo Geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setModuleFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.success || 0}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subscriptionPeriod?.package_notifications_extra || 0}</p>
                <p className="text-xs text-muted-foreground">Extras (R$ 0,10)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Módulo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-colors ${moduleFilter === "packages" ? "border-violet-500" : "hover:border-violet-500/50"}`}
          onClick={() => setModuleFilter(moduleFilter === "packages" ? "all" : "packages")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Package className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.packages.total || 0}</p>
                <p className="text-xs text-muted-foreground">Encomendas</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500">✓ {stats?.packages.success || 0}</span>
              <span className="text-destructive">✗ {stats?.packages.failed || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${moduleFilter === "occurrences" ? "border-primary" : "hover:border-primary/50"}`}
          onClick={() => setModuleFilter(moduleFilter === "occurrences" ? "all" : "occurrences")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileWarning className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.occurrences.total || 0}</p>
                <p className="text-xs text-muted-foreground">Ocorrências</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500">✓ {stats?.occurrences.success || 0}</span>
              <span className="text-destructive">✗ {stats?.occurrences.failed || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${moduleFilter === "party_hall" ? "border-emerald-500" : "hover:border-emerald-500/50"}`}
          onClick={() => setModuleFilter(moduleFilter === "party_hall" ? "all" : "party_hall")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <PartyPopper className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.party_hall.total || 0}</p>
                <p className="text-xs text-muted-foreground">Salão de Festas</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500">✓ {stats?.party_hall.success || 0}</span>
              <span className="text-destructive">✗ {stats?.party_hall.failed || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${moduleFilter === "other" ? "border-muted-foreground" : "hover:border-muted-foreground/50"}`}
          onClick={() => setModuleFilter(moduleFilter === "other" ? "all" : "other")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.other.total || 0}</p>
                <p className="text-xs text-muted-foreground">Outros</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500">✓ {stats?.other.success || 0}</span>
              <span className="text-destructive">✗ {stats?.other.failed || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras - Evolução */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Evolução por Módulo</CardTitle>
                <CardDescription>
                  Notificações enviadas com sucesso no período
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData && chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="displayDate" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="packages" name="Encomendas" stackId="a" fill={moduleColors.packages} />
                    <Bar dataKey="occurrences" name="Ocorrências" stackId="a" fill={moduleColors.occurrences} />
                    <Bar dataKey="party_hall" name="Salão de Festas" stackId="a" fill={moduleColors.party_hall} />
                    <Bar dataKey="other" name="Outros" stackId="a" fill={moduleColors.other} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Nenhum dado disponível para o período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Distribuição */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Módulo</CardTitle>
            <CardDescription>
              Proporção de envios com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Sem dados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Notificações */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Histórico de Envios</CardTitle>
              <CardDescription>
                Todas as notificações WhatsApp enviadas no período
              </CardDescription>
            </div>
            {moduleFilter !== "all" && (
              <Badge variant="outline" className="gap-1">
                Filtro: {chartConfig[moduleFilter]?.label || moduleFilter}
                <button onClick={() => setModuleFilter("all")} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4 md:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone, template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Módulos</SelectItem>
                <SelectItem value="packages">Encomendas</SelectItem>
                <SelectItem value="occurrences">Ocorrências</SelectItem>
                <SelectItem value="party_hall">Salão de Festas</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs?.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação encontrada no período</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredLogs?.slice(0, 50).map((log) => {
                  const moduleInfo = getModuleInfo(log.function_name);

                  return (
                    <Card key={log.id} className="bg-card border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-muted">
                              {moduleInfo.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{moduleInfo.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {log.phone ? formatPhone(log.phone) : "—"}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={log.success 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                              : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {log.success ? "Sucesso" : "Falha"}
                          </Badge>
                        </div>
                        {log.template_name && (
                          <p className="text-xs text-muted-foreground truncate mb-2">
                            Template: {log.template_name}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                          {formatCustom(log.created_at, "dd/MM/yyyy HH:mm")}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.slice(0, 100).map((log) => {
                      const moduleInfo = getModuleInfo(log.function_name);

                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-muted">
                                {moduleInfo.icon}
                              </div>
                              <span className="text-sm">{moduleInfo.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm max-w-[200px] truncate">
                              {log.template_name || "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">
                              {log.phone ? formatPhone(log.phone) : "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{formatDate(log.created_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCustom(log.created_at, "HH:mm:ss")}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={log.success 
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                : "bg-destructive/10 text-destructive border-destructive/20"
                              }
                            >
                              {log.success ? (
                                <><Check className="h-3 w-3 mr-1" /> Sucesso</>
                              ) : (
                                <><AlertCircle className="h-3 w-3 mr-1" /> Falha</>
                              )}
                            </Badge>
                            {log.error_message && (
                              <p className="text-xs text-destructive mt-1 max-w-[200px] truncate">
                                {log.error_message}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {filteredLogs && filteredLogs.length > 100 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Exibindo 100 de {filteredLogs.length} registros
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
