import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, CheckCircle2, Clock, AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface MaintenanceTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  periodicity: string;
  next_due_date: string;
  status: string;
  responsible_notes: string | null;
  category: { name: string } | null;
  condominium: { name: string } | null;
}

export default function ZeladorManutencoes() {
  const { user } = useAuth();
  const { profileInfo } = useUserRole();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Execution dialog
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [execForm, setExecForm] = useState({ observations: "", status: "concluida" as string });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    if (!user) return;

    const { data: userCondos } = await supabase
      .from("user_condominiums")
      .select("condominium_id")
      .eq("user_id", user.id);

    const condoIds = userCondos?.map((c) => c.condominium_id) || [];
    if (condoIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("maintenance_tasks")
      .select(`
        id, title, description, priority, periodicity, next_due_date, status, responsible_notes,
        category:maintenance_categories(name),
        condominium:condominiums(name)
      `)
      .in("condominium_id", condoIds)
      .eq("is_active", true)
      .order("next_due_date", { ascending: true });

    setTasks((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const handleOpenExecDialog = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setExecForm({ observations: "", status: "concluida" });
    setExecDialogOpen(true);
  };

  const handleSubmitExecution = async () => {
    if (!selectedTask || !user) return;

    setIsSubmitting(true);
    try {
      // Get condominium_id from task
      const { data: taskData } = await supabase
        .from("maintenance_tasks")
        .select("condominium_id")
        .eq("id", selectedTask.id)
        .single();

      if (!taskData) throw new Error("Tarefa não encontrada");

      const { error } = await supabase.from("maintenance_executions").insert({
        task_id: selectedTask.id,
        condominium_id: taskData.condominium_id,
        executed_by: user.id,
        executed_by_name: profileInfo?.full_name || user.email || "Zelador",
        observations: execForm.observations || null,
        status: execForm.status as any,
      });

      if (error) throw error;

      // Update task's last_completed_at if concluida
      if (execForm.status === "concluida") {
        // Calculate next due date based on periodicity
        const periodicityDaysMap: Record<string, number> = {
          semanal: 7,
          quinzenal: 15,
          mensal: 30,
          bimestral: 60,
          trimestral: 90,
          semestral: 180,
          anual: 365,
        };

        const days = periodicityDaysMap[selectedTask.periodicity] || 30;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + days);

        await supabase
          .from("maintenance_tasks")
          .update({
            last_completed_at: new Date().toISOString(),
            next_due_date: nextDate.toISOString().split("T")[0],
            status: "em_dia",
          })
          .eq("id", selectedTask.id);
      }

      toast({ title: "Execução registrada!", description: "A manutenção foi registrada com sucesso" });
      setExecDialogOpen(false);
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_dia":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Em dia</Badge>;
      case "proximo":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="w-3 h-3 mr-1" />Próxima</Badge>;
      case "atrasado":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Atrasada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      baixa: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      media: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      critica: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return <Badge className={map[priority] || ""}>{priority}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Manutenções
          </h1>
          <p className="text-muted-foreground mt-1">Registre a execução das manutenções</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhuma manutenção cadastrada</h3>
              <p className="text-muted-foreground mt-2">O síndico ainda não cadastrou manutenções para o condomínio</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tasks.map((task) => (
              <Card key={task.id} className={task.status === "atrasado" ? "border-destructive/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {task.category?.name && <span className="mr-2">{task.category.name}</span>}
                        {task.condominium?.name && <span>• {task.condominium.name}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>📅 Próxima: {format(new Date(task.next_due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</p>
                      {task.responsible_notes && <p>📝 {task.responsible_notes}</p>}
                    </div>
                    <Button onClick={() => handleOpenExecDialog(task)} className="gap-2 flex-shrink-0">
                      <ClipboardCheck className="w-4 h-4" />
                      Registrar Execução
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Execution Dialog */}
        <Dialog open={execDialogOpen} onOpenChange={setExecDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Execução</DialogTitle>
              <DialogDescription>
                {selectedTask?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status da execução</Label>
                <Select value={execForm.status} onValueChange={(v) => setExecForm((prev) => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="nao_realizada">Não realizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
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
              <Button onClick={handleSubmitExecution} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
