import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Check,
  CheckCheck,
  Eye,
  AlertCircle,
  Clock,
  Search,
  Radio,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type NotificationStatus = "all" | "sent" | "delivered" | "read" | "failed" | "pending";

interface NotificationWithDetails {
  id: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  zpro_status: string | null;
  message_content: string;
  sent_via: string;
  resident: {
    full_name: string;
    phone: string | null;
  } | null;
  occurrence: {
    title: string;
    id: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent: { label: "Enviado", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: <Check className="h-3 w-3" /> },
  delivered: { label: "Entregue", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: <CheckCheck className="h-3 w-3" /> },
  read: { label: "Lido", color: "bg-violet-500/10 text-violet-500 border-violet-500/20", icon: <Eye className="h-3 w-3" /> },
  failed: { label: "Falha", color: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertCircle className="h-3 w-3" /> },
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: <Clock className="h-3 w-3" /> },
};

const chartConfig = {
  total: { label: "Total", color: "hsl(var(--primary))" },
  delivered: { label: "Entregues", color: "hsl(142, 76%, 36%)" },
  read: { label: "Lidos", color: "hsl(262, 83%, 58%)" },
  failed: { label: "Falhas", color: "hsl(var(--destructive))" },
};

export function NotificationsMonitor() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<NotificationStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"7" | "14" | "30">("7");

  // Realtime subscription
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications_sent",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ["notifications-monitor"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, queryClient]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications-monitor", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("notifications_sent")
        .select(`
          id,
          sent_at,
          delivered_at,
          read_at,
          zpro_status,
          message_content,
          sent_via,
          resident:residents(full_name, phone),
          occurrence:occurrences(id, title)
        `)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        // Some providers don't reliably set a "read" zpro_status,
        // so we infer read/delivered from timestamps.
        if (statusFilter === "read") {
          query = query.not("read_at", "is", null);
        } else if (statusFilter === "delivered") {
          query = query.is("read_at", null).not("delivered_at", "is", null);
        } else {
          query = query.eq("zpro_status", statusFilter);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as NotificationWithDetails[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["notifications-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_sent")
        .select("sent_at, zpro_status, delivered_at, read_at");

      if (error) throw error;

      const rows = data ?? [];

      const counts = {
        total: rows.length,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        pending: 0,
      };

      rows.forEach((n) => {
        // "Enviados" = tudo que saiu (sent/read/delivered). "Pendente" = sem status e sem timestamps.
        const isRead = Boolean(n.read_at);
        const isDelivered = Boolean(n.delivered_at) || isRead;
        const isFailed = n.zpro_status === "failed";
        const isExplicitSent = n.zpro_status === "sent";

        if (isRead) {
          counts.read++;
          counts.delivered++;
          counts.sent++;
          return;
        }

        if (isDelivered) {
          counts.delivered++;
          counts.sent++;
          return;
        }

        if (isFailed) {
          counts.failed++;
          return;
        }

        if (isExplicitSent) {
          counts.sent++;
          return;
        }

        // If it has a sent_at but no other indicators, treat as pending (provider hasn't confirmed yet)
        counts.pending++;
      });

      return counts;
    },
  });

  // Chart data query
  const { data: chartData } = useQuery({
    queryKey: ["notifications-chart", chartPeriod],
    queryFn: async () => {
      const days = parseInt(chartPeriod);
      const startDate = startOfDay(subDays(new Date(), days - 1));
      
      const { data, error } = await supabase
        .from("notifications_sent")
        .select("sent_at, zpro_status, delivered_at, read_at")
        .gte("sent_at", startDate.toISOString())
        .order("sent_at", { ascending: true });

      if (error) throw error;

      // Generate all days in the range
      const allDays = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      // Group by day
      const dayMap = new Map<string, { total: number; delivered: number; read: number; failed: number }>();
      
      allDays.forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        dayMap.set(key, { total: 0, delivered: 0, read: 0, failed: 0 });
      });

      data.forEach((n) => {
        const key = format(new Date(n.sent_at), "yyyy-MM-dd");
        const dayData = dayMap.get(key);
        if (dayData) {
          dayData.total++;
          // "Lidos" também conta como "entregue"
          if (n.read_at) {
            dayData.read++;
            dayData.delivered++;
          } else if (n.delivered_at) {
            dayData.delivered++;
          } else if (n.zpro_status === "failed") {
            dayData.failed++;
          }
        }
      });

      return Array.from(dayMap.entries()).map(([date, counts]) => ({
        date,
        displayDate: format(new Date(date), "dd/MM", { locale: ptBR }),
        ...counts,
      }));
    },
  });

  const filteredNotifications = notifications?.filter((n) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      n.resident?.full_name?.toLowerCase().includes(query) ||
      n.resident?.phone?.includes(query) ||
      n.occurrence?.title?.toLowerCase().includes(query)
    );
  });

  const getDisplayStatus = (notification: NotificationWithDetails): string => {
    if (notification.read_at) return "read";
    if (notification.delivered_at) return "delivered";
    if (notification.zpro_status) return notification.zpro_status;
    return "pending";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setStatusFilter("sent")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Check className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => setStatusFilter("delivered")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.delivered || 0}</p>
                <p className="text-xs text-muted-foreground">Entregues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-violet-500/50 transition-colors" onClick={() => setStatusFilter("read")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Eye className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.read || 0}</p>
                <p className="text-xs text-muted-foreground">Lidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setStatusFilter("failed")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Evolução de Notificações</CardTitle>
                <CardDescription>
                  Acompanhe o volume de notificações ao longo do tempo
                </CardDescription>
              </div>
            </div>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as "7" | "14" | "30")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
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
                  <Bar 
                    dataKey="total" 
                    name="Total" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="delivered" 
                    name="Entregues" 
                    fill="hsl(142, 76%, 36%)" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="read" 
                    name="Lidos" 
                    fill="hsl(262, 83%, 58%)" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="failed" 
                    name="Falhas" 
                    fill="hsl(var(--destructive))" 
                    radius={[4, 4, 0, 0]}
                  />
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

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Notificações Enviadas</CardTitle>
              <CardDescription>
                Monitoramento de status das mensagens WhatsApp
              </CardDescription>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isLive
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              <Radio className={`h-3 w-3 ${isLive ? "animate-pulse" : ""}`} />
              {isLive ? "Ao vivo" : "Pausado"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por morador, telefone ou ocorrência..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as NotificationStatus)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="read">Lido</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredNotifications?.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Morador</TableHead>
                    <TableHead>Ocorrência</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entregue</TableHead>
                    <TableHead>Lido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications?.map((notification) => {
                    const status = getDisplayStatus(notification);
                    const config = statusConfig[status] || statusConfig.pending;

                    return (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{notification.resident?.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">
                              {notification.resident?.phone || "Sem telefone"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[200px] truncate">
                            {notification.occurrence?.title || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {format(new Date(notification.sent_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notification.sent_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${config.color} gap-1`}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {notification.delivered_at ? (
                            <p className="text-sm">
                              {format(new Date(notification.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {notification.read_at ? (
                            <p className="text-sm">
                              {format(new Date(notification.read_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
