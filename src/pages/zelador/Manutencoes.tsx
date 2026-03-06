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
import { Wrench, CheckCircle2, Clock, AlertTriangle, ClipboardCheck, Loader2, Calendar, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO, format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface MaintenanceTask {
  id: string;
  condominium_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  periodicity: string;
  periodicity_days: number | null;
  next_due_date: string;
  notification_days_before: number;
  responsible_notes: string | null;
  estimated_cost: number | null;
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
const periodicityLabels: Record<string, string> = {
  semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", bimestral: "Bimestral",
  trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", personalizado: "Personalizado",
};

const emptyTaskForm = {
  title: "", description: "", priority: "media", periodicity: "mensal",
  periodicity_days: "", next_due_date: "", notification_days_before: "7",
  responsible_notes: "", estimated_cost: "", category_id: "",
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

  // Task CRUD dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<MaintenanceTask | null>(null);

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

  const { data: condominiums = [] } = useQuery({
    queryKey: ["zelador-condos-details", condoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .in("id", condoIds);
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["zelador-categories", condoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_categories")
        .select("id, name, condominium_id")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: condoIds.length > 0,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["zelador-all-tasks", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(`
          id, condominium_id, category_id, title, description, priority, periodicity, periodicity_days,
          next_due_date, notification_days_before, responsible_notes, estimated_cost,
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

  // --- Execution mutation ---
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
        await supabase.from("maintenance_tasks").update({
          last_completed_at: new Date().toISOString(),
          next_due_date: nextDate.toISOString().split("T")[0],
        }).eq("id", selectedTask.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-recent-execs"] });
      setExecDialogOpen(false);
      toast({ title: "Execução registrada!", description: "A manutenção foi registrada com sucesso" });
    },
    onError: (error) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  // --- Task CRUD mutations ---
  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const condominiumId = editingTask?.condominium_id || (condoIds.length === 1 ? condoIds[0] : taskForm.category_id ? categories.find(c => c.id === taskForm.category_id)?.condominium_id : condoIds[0]);
      if (!condominiumId) throw new Error("Condomínio não encontrado");

      const payload = {
        title: taskForm.title,
        description: taskForm.description || null,
        priority: taskForm.priority,
        periodicity: taskForm.periodicity as any,
        periodicity_days: taskForm.periodicity === "personalizado" && taskForm.periodicity_days ? parseInt(taskForm.periodicity_days) : null,
        next_due_date: taskForm.next_due_date,
        notification_days_before: parseInt(taskForm.notification_days_before) || 7,
        responsible_notes: taskForm.responsible_notes || null,
        estimated_cost: taskForm.estimated_cost ? parseFloat(taskForm.estimated_cost) : null,
        category_id: taskForm.category_id || null,
        condominium_id: condominiumId,
      };

      if (editingTask) {
        const { error } = await supabase.from("maintenance_tasks").update(payload).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_tasks").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      setTaskDialogOpen(false);
      toast({ title: editingTask ? "Manutenção atualizada!" : "Manutenção criada!", description: "Operação realizada com sucesso" });
    },
    onError: (error) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskToDelete) return;
      const { error } = await supabase.from("maintenance_tasks").update({ is_active: false }).eq("id", taskToDelete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      setDeleteDialogOpen(false);
      toast({ title: "Manutenção removida" });
    },
    onError: (error) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const openNewTaskDialog = () => {
    setEditingTask(null);
    setTaskForm({ ...emptyTaskForm, next_due_date: new Date().toISOString().split("T")[0] });
    setTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: MaintenanceTask) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      periodicity: task.periodicity,
      periodicity_days: task.periodicity_days?.toString() || "",
      next_due_date: task.next_due_date,
      notification_days_before: task.notification_days_before.toString(),
      responsible_notes: task.responsible_notes || "",
      estimated_cost: task.estimated_cost?.toString() || "",
      category_id: task.category_id || "",
    });
    setTaskDialogOpen(true);
  };

  const openExecDialog = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setExecForm({ observations: "", status: "concluida", cost: "" });
    setExecDialogOpen(true);
  };

  const selectedCondoId = editingTask?.condominium_id || (condoIds.length === 1 ? condoIds[0] : null);
  const filteredCategories = selectedCondoId ? categories.filter(c => c.condominium_id === selectedCondoId) : categories;

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-primary" />
              Manutenções
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie e registre manutenções</p>
          </div>
          <Button onClick={openNewTaskDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Manutenção
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="atrasado">Atrasadas</SelectItem>
              <SelectItem value="proximo">Próximas</SelectItem>
              <SelectItem value="em_dia">Em dia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Columns */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">
                {tasks.length === 0 ? "Nenhuma manutenção cadastrada" : "Nenhuma tarefa encontrada"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {tasks.length === 0 ? 'Clique em "Nova Manutenção" para começar' : "Tente alterar os filtros"}
              </p>
            </CardContent>
          </Card>
        ) : (() => {
          const overdue = filteredTasks.filter(t => getTaskStatus(t.next_due_date, t.notification_days_before).key === "atrasado");
          const upcoming = filteredTasks.filter(t => getTaskStatus(t.next_due_date, t.notification_days_before).key === "proximo");
          const onTrack = filteredTasks.filter(t => getTaskStatus(t.next_due_date, t.notification_days_before).key === "em_dia");

          const columnColors = {
            overdue: { border: "border-destructive/60", header: "bg-destructive/10 text-destructive", accent: "border-l-destructive" },
            upcoming: { border: "border-amber-500/60", header: "bg-amber-500/10 text-amber-700 dark:text-amber-400", accent: "border-l-amber-500" },
            onTrack: { border: "border-emerald-500/60", header: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", accent: "border-l-emerald-500" },
          };

          const renderTaskCard = (task: MaintenanceTask) => {
            const daysUntilDue = differenceInDays(parseISO(task.next_due_date), new Date());
            const statusInfo = getTaskStatus(task.next_due_date, task.notification_days_before);
            return (
              <div
                key={task.id}
                className={`rounded-lg border bg-card p-3 space-y-2 border-l-4 ${
                  statusInfo.key === "atrasado" ? columnColors.overdue.accent :
                  statusInfo.key === "proximo" ? columnColors.upcoming.accent :
                  columnColors.onTrack.accent
                }`}
              >
                {/* Header: condominium + code */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{task.condominiums?.name || "Condomínio"}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">#{task.id.slice(0, 4)}</span>
                </div>

                {/* Category badge + priority */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {task.maintenance_categories?.name && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {task.maintenance_categories.name}
                    </Badge>
                  )}
                  <Badge variant={priorityVariants[task.priority] || "outline"} className="text-[10px] px-1.5 py-0">
                    {priorityLabels[task.priority] || task.priority}
                  </Badge>
                </div>

                {/* Title + description */}
                <p className="text-sm font-medium text-foreground leading-tight">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                )}

                {/* Date info */}
                <p className="text-[10px] text-muted-foreground">
                  {daysUntilDue < 0
                    ? `Atrasada há ${Math.abs(daysUntilDue)} dias`
                    : daysUntilDue === 0
                    ? "Vence hoje"
                    : `Em ${daysUntilDue} dias • ${format(parseISO(task.next_due_date), "dd/MM/yyyy")}`}
                </p>

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1 border-t border-border/50">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditTaskDialog(task)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openExecDialog(task)}>
                    <ClipboardCheck className="w-3 h-3 mr-1" /> Registrar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          };

          const renderColumn = (title: string, items: MaintenanceTask[], colors: typeof columnColors.overdue) => (
            <div className="flex flex-col gap-3">
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${colors.header}`}>
                <span className="text-sm font-semibold">{title} ({items.length})</span>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>
                ) : (
                  items.map(renderTaskCard)
                )}
              </div>
            </div>
          );

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderColumn("Vencidas", overdue, columnColors.overdue)}
              {renderColumn("Pendentes", upcoming, columnColors.upcoming)}
              {renderColumn("Em dia", onTrack, columnColors.onTrack)}
            </div>
          );
        })()}

        {/* Task Create/Edit Dialog */}
        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
              <DialogDescription>Preencha os dados da manutenção preventiva</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Título *</Label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Limpeza da caixa d'água" />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea value={taskForm.description} onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Detalhes da manutenção..." rows={3} />
              </div>
              {condoIds.length > 1 && !editingTask && (
                <div className="grid gap-2">
                  <Label>Condomínio *</Label>
                  <Select value={selectedCondoId || ""} onValueChange={(v) => setTaskForm(p => ({ ...p, category_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {condominiums.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={taskForm.category_id} onValueChange={(v) => setTaskForm(p => ({ ...p, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Prioridade</Label>
                  <Select value={taskForm.priority} onValueChange={(v) => setTaskForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Periodicidade</Label>
                  <Select value={taskForm.periodicity} onValueChange={(v) => setTaskForm(p => ({ ...p, periodicity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(periodicityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {taskForm.periodicity === "personalizado" && (
                  <div className="grid gap-2">
                    <Label>Intervalo (dias)</Label>
                    <Input type="number" value={taskForm.periodicity_days} onChange={(e) => setTaskForm(p => ({ ...p, periodicity_days: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Próxima data *</Label>
                  <Input type="date" value={taskForm.next_due_date} onChange={(e) => setTaskForm(p => ({ ...p, next_due_date: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Notificar antes (dias)</Label>
                  <Input type="number" value={taskForm.notification_days_before} onChange={(e) => setTaskForm(p => ({ ...p, notification_days_before: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Custo estimado (R$)</Label>
                <Input type="number" step="0.01" value={taskForm.estimated_cost} onChange={(e) => setTaskForm(p => ({ ...p, estimated_cost: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="grid gap-2">
                <Label>Instruções / Observações</Label>
                <Textarea value={taskForm.responsible_notes} onChange={(e) => setTaskForm(p => ({ ...p, responsible_notes: e.target.value }))} placeholder="Instruções para execução..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveTaskMutation.mutate()} disabled={saveTaskMutation.isPending || !taskForm.title || !taskForm.next_due_date}>
                {saveTaskMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingTask ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <Select value={execForm.status} onValueChange={(v) => setExecForm(p => ({ ...p, status: v }))}>
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
                <Input type="number" step="0.01" value={execForm.cost} onChange={(e) => setExecForm(p => ({ ...p, cost: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea value={execForm.observations} onChange={(e) => setExecForm(p => ({ ...p, observations: e.target.value }))} placeholder="Descreva o que foi feito..." rows={4} />
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

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover manutenção?</AlertDialogTitle>
              <AlertDialogDescription>
                A manutenção "{taskToDelete?.title}" será desativada. Esta ação pode ser revertida pelo síndico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTaskMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteTaskMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
