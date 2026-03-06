import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, CheckCircle2, Clock, AlertTriangle, ClipboardCheck, Loader2, Calendar, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface MaintenanceTask {
  id: string;
  condominium_id: string;
  title: string;
  description: string | null;
  priority: string;
  periodicity: string;
  periodicity_days: number | null;
  next_due_date: string;
  notification_days_before: number;
  responsible_notes: string | null;
  maintenance_categories: { name: string } | null;
  condominiums: { name: string } | null;
}

function getTaskStatus(nextDueDate: string, notificationDaysBefore: number) {
  const daysUntilDue = differenceInDays(parseISO(nextDueDate), new Date());
  if (daysUntilDue < 0) return { key: "atrasado", label: "Atrasada", icon: AlertTriangle, color: "text-destructive" };
  if (daysUntilDue <= notificationDaysBefore) return { key: "proximo", label: "Próxima", icon: Clock, color: "text-amber-600 dark:text-amber-400" };
  return { key: "em_dia", label: "Em dia", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" };
}

const priorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const priorityVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixa: "secondary", media: "outline", alta: "default", critica: "destructive",
};

export default function ZeladorManutencoes() {
  const { user } = useAuth();
  const { profileInfo } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Execution dialog
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [execForm, setExecForm] = useState({ observations: "", status: "concluida", cost: "" });

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

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["zelador-all-tasks", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(`
          id, condominium_id, title, description, priority, periodicity, periodicity_days,
          next_due_date, notification_days_before, responsible_notes,
          maintenance_categories(name),
          condominiums(name)
        `)
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data as MaintenanceTask[];
    },
    enabled: condoIds.length > 0,
  });

  const filteredTasks = tasks.filter((task) => {
    const status = getTaskStatus(task.next_due_date, task.notification_days_before);
    if (statusFilter !== "all" && status.key !== statusFilter) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !user) throw new Error("Tarefa não selecionada");

      const { error } = await supabase.from("maintenance_executions").insert({
        task_id: selectedTask.id,
        condominium_id: selectedTask.condominium_id,
        executed_by: user.id,
        executed_by_name: profileInfo?.full_name || user.email || "Zelador",
        observations: execForm.observations || null,
        cost: execForm.cost ? parseFloat(execForm.cost) : null,
        status: execForm.status as any,
      });
      if (error) throw error;

      // If completed, recalculate next_due_date
      if (execForm.status === "concluida") {
        const periodicityDaysMap: Record<string, number> = {
          semanal: 7, quinzenal: 15, mensal: 30, bimestral: 60,
          trimestral: 90, semestral: 180, anual: 365,
        };
        const days = selectedTask.periodicity === "personalizado"
          ? (selectedTask.periodicity_days || 30)
          : (periodicityDaysMap[selectedTask.periodicity] || 30);

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + days);

        await supabase
          .from("maintenance_tasks")
          .update({
            last_completed_at: new Date().toISOString(),
            next_due_date: nextDate.toISOString().split("T")[0],
          })
          .eq("id", selectedTask.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-recent-execs"] });
      setExecDialogOpen(false);
      toast({ title: "Execução registrada!", description: "A manutenção foi registrada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const openExecDialog = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setExecForm({ observations: "", status: "concluida", cost: "" });
    setExecDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Manutenções
          </h1>
          <p className="text-muted-foreground mt-1">Registre a execução das manutenções</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="atrasado">Atrasadas</SelectItem>
              <SelectItem value="proximo">Próximas</SelectItem>
              <SelectItem value="em_dia">Em dia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">
                {tasks.length === 0 ? "Nenhuma manutenção cadastrada" : "Nenhuma tarefa encontrada"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {tasks.length === 0
                  ? "O síndico ainda não cadastrou manutenções para o condomínio"
                  : "Tente alterar os filtros"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => {
              const statusInfo = getTaskStatus(task.next_due_date, task.notification_days_before);
              const StatusIcon = statusInfo.icon;
              const daysUntilDue = differenceInDays(parseISO(task.next_due_date), new Date());

              return (
                <Card key={task.id} className={statusInfo.key === "atrasado" ? "border-destructive/50" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {task.maintenance_categories?.name && <span className="mr-2">{task.maintenance_categories.name}</span>}
                          {task.condominiums?.name && <span>• {task.condominiums.name}</span>}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Badge variant={statusInfo.key === "atrasado" ? "destructive" : statusInfo.key === "proximo" ? "outline" : "default"} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                        <Badge variant={priorityVariants[task.priority] || "outline"}>
                          {priorityLabels[task.priority] || task.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {format(parseISO(task.next_due_date), "dd/MM/yyyy")} 
                            {daysUntilDue < 0
                              ? ` (${Math.abs(daysUntilDue)} dias atrasada)`
                              : daysUntilDue === 0
                              ? " (vence hoje)"
                              : ` (em ${daysUntilDue} dias)`}
                          </span>
                        </div>
                        {task.responsible_notes && (
                          <p className="text-xs italic">📝 {task.responsible_notes}</p>
                        )}
                      </div>
                      <Button onClick={() => openExecDialog(task)} className="gap-2 flex-shrink-0">
                        <ClipboardCheck className="w-4 h-4" />
                        Registrar Execução
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Execution Dialog */}
        <Dialog open={execDialogOpen} onOpenChange={setExecDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Execução</DialogTitle>
              <DialogDescription>{selectedTask?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Status da execução</Label>
                <Select value={execForm.status} onValueChange={(v) => setExecForm((prev) => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concluida">✅ Concluída</SelectItem>
                    <SelectItem value="parcial">⚠️ Parcial</SelectItem>
                    <SelectItem value="nao_realizada">❌ Não realizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={execForm.cost}
                  onChange={(e) => setExecForm((prev) => ({ ...prev, cost: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea
                  value={execForm.observations}
                  onChange={(e) => setExecForm((prev) => ({ ...prev, observations: e.target.value }))}
                  placeholder="Descreva o que foi feito..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExecDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
