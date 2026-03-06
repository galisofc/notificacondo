import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, ClipboardCheck, Calendar, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { differenceInDays, parseISO, format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

function getTaskStatus(nextDueDate: string, notificationDaysBefore: number) {
  const daysUntilDue = differenceInDays(parseISO(nextDueDate), new Date());
  if (daysUntilDue < 0) return "atrasado";
  if (daysUntilDue <= notificationDaysBefore) return "proximo";
  return "em_dia";
}

const CHART_COLORS = {
  concluida: "#22c55e",
  parcial: "#f59e0b",
  nao_realizada: "#ef4444",
  em_andamento: "#3b82f6",
};

const STATUS_LABELS: Record<string, string> = {
  concluida: "Concluídas",
  parcial: "Parciais",
  nao_realizada: "Não realizadas",
};

export default function ZeladorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: condoIds = [] } = useQuery({
    queryKey: ["zelador-condos", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_condominiums")
        .select("condominium_id")
        .eq("user_id", user!.id);
      return data?.map((c) => c.condominium_id) || [];
    },
    enabled: !!user?.id,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["zelador-tasks", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("id, title, next_due_date, notification_days_before, priority, periodicity, estimated_cost, maintenance_categories(name)")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  const { data: executions = [], isLoading: execLoading } = useQuery({
    queryKey: ["zelador-all-execs", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, executed_at, status, cost, maintenance_tasks(title)")
        .in("condominium_id", condoIds)
        .order("executed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["zelador-dash-categories", condoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_categories")
        .select("id, name")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const loading = tasksLoading || execLoading;

  // --- Compute stats ---
  const totalTasks = tasks.length;
  const totalCost = executions.reduce((sum, e: any) => sum + (e.cost || 0), 0);
  const totalExecutions = executions.length;

  // Execution score (donut)
  const execByStatus = executions.reduce((acc: Record<string, number>, e: any) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  const donutData = Object.entries(execByStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count as number,
    fill: CHART_COLORS[status as keyof typeof CHART_COLORS] || "hsl(var(--chart-5))",
  }));

  const completionRate = totalExecutions > 0
    ? Math.round(((execByStatus["concluida"] || 0) / totalExecutions) * 100)
    : 0;

  // Timeline (last 8 months) - based on task due dates
  const timelineData = Array.from({ length: 8 }).map((_, i) => {
    const monthDate = subMonths(new Date(), 7 - i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthLabel = format(monthDate, "MMM/yyyy", { locale: ptBR });

    // Tasks with due dates in this month
    const monthTasks = tasks.filter((t: any) => {
      const dueDate = parseISO(t.next_due_date);
      return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
    });

    // Executions completed in this month
    const monthExecs = executions.filter((e: any) => {
      const execDate = parseISO(e.executed_at);
      return isWithinInterval(execDate, { start: monthStart, end: monthEnd }) && e.status === "concluida";
    });
    const completedTaskIds = new Set(monthExecs.map((e: any) => e.maintenance_tasks?.title));

    const concluidas = monthExecs.length;
    const vencidos = monthTasks.filter((t: any) => {
      const dueDate = parseISO(t.next_due_date);
      return dueDate < new Date() && !completedTaskIds.has(t.title);
    }).length;
    const pendentes = monthTasks.filter((t: any) => {
      const dueDate = parseISO(t.next_due_date);
      return dueDate >= new Date() && !completedTaskIds.has(t.title);
    }).length;

    return { month: monthLabel, Concluídas: concluidas, Pendentes: pendentes, Vencidos: vencidos };
  });

  // Task status summary
  const taskStatusCounts = tasks.reduce(
    (acc, t: any) => {
      const s = getTaskStatus(t.next_due_date, t.notification_days_before);
      acc[s]++;
      return acc;
    },
    { em_dia: 0, proximo: 0, atrasado: 0 } as Record<string, number>
  );

  // Categories with task count
  const categoriesWithCount = categories.map((cat: any) => ({
    ...cat,
    taskCount: tasks.filter((t: any) => t.maintenance_categories?.name === cat.name).length,
  }));

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              Painel do Zelador
            </h1>
            <p className="text-muted-foreground mt-1">Acompanhe as manutenções do condomínio</p>
          </div>
          <Button onClick={() => navigate("/zelador/manutencoes")} className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Ver Manutenções
          </Button>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de manutenções</CardTitle>
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{totalTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskStatusCounts.atrasado > 0 && (
                    <span className="text-destructive font-medium">{taskStatusCounts.atrasado} atrasada{taskStatusCounts.atrasado > 1 ? "s" : ""}</span>
                  )}
                  {taskStatusCounts.atrasado > 0 && taskStatusCounts.proximo > 0 && " · "}
                  {taskStatusCounts.proximo > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{taskStatusCounts.proximo} próxima{taskStatusCounts.proximo > 1 ? "s" : ""}</span>
                  )}
                  {(taskStatusCounts.atrasado === 0 && taskStatusCounts.proximo === 0) && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Todas em dia ✓</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Execuções realizadas</CardTitle>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{totalExecutions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completionRate}% concluídas com sucesso
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor investido</CardTitle>
                <DollarSign className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  custo total registrado
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Linha do tempo de manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
              <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={timelineData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis dataKey="month" type="category" width={75} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Concluídas" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Pendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Vencidos" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Score donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score de manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : totalExecutions === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Nenhuma execução registrada
                </div>
              ) : (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 20 }}>
                    <div className="text-center">
                      <span className="text-2xl font-bold text-foreground">{completionRate}%</span>
                      <p className="text-xs text-muted-foreground">Concluídas</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {donutData.map((entry, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom row: Categories + Recent Executions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorias de Manutenção</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : categoriesWithCount.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Nenhuma categoria cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {categoriesWithCount.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium text-foreground">{cat.name}</span>
                      <Badge variant="secondary">{cat.taskCount} tarefa{cat.taskCount !== 1 ? "s" : ""}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Executions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : executions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Nenhuma execução registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {executions.slice(0, 6).map((exec: any) => (
                    <div key={exec.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{exec.maintenance_tasks?.title || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(exec.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={exec.status === "concluida" ? "default" : exec.status === "parcial" ? "secondary" : "destructive"}>
                        {STATUS_LABELS[exec.status] || exec.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
