import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, CheckCircle2, Clock, AlertTriangle, ClipboardCheck, Calendar } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function getTaskStatus(nextDueDate: string, notificationDaysBefore: number) {
  const daysUntilDue = differenceInDays(parseISO(nextDueDate), new Date());
  if (daysUntilDue < 0) return "atrasado";
  if (daysUntilDue <= notificationDaysBefore) return "proximo";
  return "em_dia";
}

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
        .select("id, title, next_due_date, notification_days_before, priority")
        .in("condominium_id", condoIds)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  const { data: recentExecutions = [], isLoading: execLoading } = useQuery({
    queryKey: ["zelador-recent-execs", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("id, executed_at, status, observations, maintenance_tasks(title)")
        .in("condominium_id", condoIds)
        .eq("executed_by", user!.id)
        .order("executed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0 && !!user?.id,
  });

  const stats = tasks.reduce(
    (acc, t) => {
      const s = getTaskStatus(t.next_due_date, t.notification_days_before);
      if (s === "em_dia") acc.emDia++;
      else if (s === "proximo") acc.proximas++;
      else acc.atrasadas++;
      return acc;
    },
    { emDia: 0, proximas: 0, atrasadas: 0 }
  );

  const loading = tasksLoading || execLoading;

  const statusLabels: Record<string, string> = {
    concluida: "Concluída",
    parcial: "Parcial",
    nao_realizada: "Não realizada",
  };

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

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em dia</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? "—" : stats.emDia}
              </div>
              <p className="text-xs text-muted-foreground">manutenções em dia</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximas</CardTitle>
              <Clock className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {loading ? "—" : stats.proximas}
              </div>
              <p className="text-xs text-muted-foreground">manutenções próximas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {loading ? "—" : stats.atrasadas}
              </div>
              <p className="text-xs text-muted-foreground">manutenções atrasadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentExecutions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Nenhuma execução registrada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {recentExecutions.map((exec: any) => (
                  <div key={exec.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{exec.maintenance_tasks?.title || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(exec.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={exec.status === "concluida" ? "default" : exec.status === "parcial" ? "secondary" : "destructive"}>
                      {statusLabels[exec.status] || exec.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
