import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Wrench, Plus, Search, CheckCircle2, Clock, AlertTriangle, Pencil, Trash2, Calendar, Filter,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  last_completed_at: string | null;
  notification_days_before: number;
  status: string;
  responsible_notes: string | null;
  estimated_cost: number | null;
  is_active: boolean;
  created_at: string;
  maintenance_categories?: { name: string } | null;
}

const periodicityLabels: Record<string, string> = {
  unica: "Única",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  personalizado: "Personalizado",
};

const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  baixa: { label: "Baixa", variant: "secondary" },
  media: { label: "Média", variant: "outline" },
  alta: { label: "Alta", variant: "default" },
  critica: { label: "Crítica", variant: "destructive" },
};

function getTaskStatus(nextDueDate: string, notificationDaysBefore: number, maintenanceType?: string, lastCompletedAt?: string | null) {
  // Corrective tasks that have been completed are finalized (one-time)
  if (maintenanceType === "corretiva" && lastCompletedAt) {
    return { label: "Finalizada", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10", icon: CheckCircle2 };
  }

  const today = new Date();
  const dueDate = parseISO(nextDueDate);
  const daysUntilDue = differenceInDays(dueDate, today);

  if (daysUntilDue < 0) return { label: "Atrasada", color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle };
  if (daysUntilDue <= notificationDaysBefore) return { label: "Próxima", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10", icon: Clock };
  return { label: "Em dia", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10", icon: CheckCircle2 };
}

export default function SindicoManutencoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "media",
    periodicity: "mensal",
    periodicity_days: "",
    next_due_date: "",
    notification_days_before: "7",
    responsible_notes: "",
    estimated_cost: "",
    category_id: "",
    maintenance_type: "preventiva",
  });

  const { data: condominiums = [] } = useQuery({
    queryKey: ["condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const condoIds = selectedCondominium === "all"
    ? condominiums.map((c) => c.id)
    : [selectedCondominium];

  const { data: categories = [] } = useQuery({
    queryKey: ["maintenance-categories", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_categories")
        .select("id, name, condominium_id")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["maintenance-tasks", condoIds, statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("maintenance_tasks")
        .select("*, maintenance_categories(name)")
        .in("condominium_id", condoIds)
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });

      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaintenanceTask[];
    },
    enabled: condoIds.length > 0,
  });

  // Filter tasks by computed status and search
  const filteredTasks = tasks.filter((task) => {
    const status = getTaskStatus(task.next_due_date, task.notification_days_before, (task as any).maintenance_type, task.last_completed_at);
    const statusKey = status.label === "Atrasada" ? "atrasado" : status.label === "Próxima" ? "proximo" : status.label === "Finalizada" ? "finalizada" : "em_dia";
    if (statusFilter !== "all" && statusKey !== statusFilter) return false;
    if (typeFilter !== "all" && (task as any).maintenance_type !== typeFilter) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const statusCounts = tasks.reduce(
    (acc, task) => {
      const s = getTaskStatus(task.next_due_date, task.notification_days_before, (task as any).maintenance_type, task.last_completed_at);
      if (s.label === "Finalizada") acc.em_dia++;
      else if (s.label === "Atrasada") acc.atrasado++;
      else if (s.label === "Próxima") acc.proximo++;
      else acc.em_dia++;
      return acc;
    },
    { em_dia: 0, proximo: 0, atrasado: 0 }
  );

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      priority: "media",
      periodicity: "mensal",
      periodicity_days: "",
      next_due_date: "",
      notification_days_before: "7",
      responsible_notes: "",
      estimated_cost: "",
      category_id: "",
      maintenance_type: "preventiva",
    });
    setEditingTask(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (task: MaintenanceTask) => {
    setEditingTask(task);
    setForm({
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
      maintenance_type: (task as any).maintenance_type || "preventiva",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const condoId = editingTask
        ? editingTask.condominium_id
        : selectedCondominium !== "all"
        ? selectedCondominium
        : condominiums[0]?.id;

      if (!condoId) throw new Error("Selecione um condomínio");

      const payload = {
        condominium_id: condoId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        periodicity: form.periodicity as any,
        periodicity_days: form.periodicity === "personalizado" ? parseInt(form.periodicity_days) || null : null,
        next_due_date: form.next_due_date,
        notification_days_before: parseInt(form.notification_days_before) || 7,
        responsible_notes: form.responsible_notes || null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
        category_id: form.category_id || null,
        created_by: user!.id,
        maintenance_type: form.maintenance_type,
      };

      if (editingTask) {
        const { error } = await supabase
          .from("maintenance_tasks")
          .update(payload)
          .eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingTask ? "Tarefa atualizada!" : "Tarefa criada!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar tarefa", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_tasks")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      setDeleteTaskId(null);
      toast({ title: "Tarefa removida!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
        <SindicoBreadcrumbs
          items={[
            { label: "Manutenção", href: "/sindico/manutencoes" },
            { label: "Dashboard" },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Manutenções</h2>
            <p className="text-muted-foreground">Gerencie as tarefas de manutenção preventiva e corretiva</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os condomínios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {condominiums.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openNewDialog} disabled={condominiums.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            className={`cursor-pointer transition-colors ${statusFilter === "em_dia" ? "ring-2 ring-emerald-500" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "em_dia" ? "all" : "em_dia")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em dia</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{statusCounts.em_dia}</div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors ${statusFilter === "proximo" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "proximo" ? "all" : "proximo")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximas</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{statusCounts.proximo}</div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors ${statusFilter === "atrasado" ? "ring-2 ring-destructive" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "atrasado" ? "all" : "atrasado")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{statusCounts.atrasado}</div>
            </CardContent>
          </Card>
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="corretiva">Corretiva</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {tasks.length === 0 ? "Nenhuma tarefa cadastrada. Crie sua primeira tarefa de manutenção." : "Nenhuma tarefa encontrada com os filtros selecionados."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden md:table-cell">Periodicidade</TableHead>
                  <TableHead>Próx. Vencimento</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const statusInfo = getTaskStatus(task.next_due_date, task.notification_days_before, (task as any).maintenance_type, task.last_completed_at);
                  const StatusIcon = statusInfo.icon;
                  const pConfig = priorityConfig[task.priority] || priorityConfig.media;
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${statusInfo.color}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-medium hidden sm:inline">{statusInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={(task as any).maintenance_type === "corretiva" ? "destructive" : "default"} className="text-xs">
                          {(task as any).maintenance_type === "corretiva" ? "Corretiva" : "Preventiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {task.maintenance_categories?.name || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {periodicityLabels[task.periodicity] || task.periodicity}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(parseISO(task.next_due_date), "dd/MM/yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={pConfig.variant}>{pConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditDialog(task)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTaskId(task.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa de Manutenção"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editingTask && selectedCondominium === "all" && (
                <div className="grid gap-2">
                  <Label>Condomínio *</Label>
                  <Select
                    value={form.category_id ? undefined : undefined}
                    onValueChange={(v) => setForm({ ...form, category_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {condominiums.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Troca de óleo do gerador" />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes da tarefa..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo *</Label>
                  <Select value={form.maintenance_type} onValueChange={(v) => setForm({ ...form, maintenance_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventiva">Preventiva</SelectItem>
                      <SelectItem value="corretiva">Corretiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Label>Periodicidade *</Label>
                  <Select value={form.periodicity} onValueChange={(v) => setForm({ ...form, periodicity: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(periodicityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.periodicity === "personalizado" && (
                  <div className="grid gap-2">
                    <Label>Dias</Label>
                    <Input type="number" value={form.periodicity_days} onChange={(e) => setForm({ ...form, periodicity_days: e.target.value })} placeholder="Ex: 45" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Próximo Vencimento *</Label>
                  <Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Alertar (dias antes)</Label>
                  <Input type="number" value={form.notification_days_before} onChange={(e) => setForm({ ...form, notification_days_before: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Custo Estimado (R$)</Label>
                <Input type="number" step="0.01" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} placeholder="0,00" />
              </div>
              <div className="grid gap-2">
                <Label>Instruções para o Zelador</Label>
                <Textarea value={form.responsible_notes} onChange={(e) => setForm({ ...form, responsible_notes: e.target.value })} placeholder="Instruções detalhadas..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.title || !form.next_due_date || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : editingTask ? "Atualizar" : "Criar Tarefa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                A tarefa será desativada e não aparecerá mais na listagem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTaskId && deleteMutation.mutate(deleteTaskId)}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
