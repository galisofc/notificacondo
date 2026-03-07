import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, ClipboardCheck, Loader2, Search, Plus, Pencil, Play, GripVertical, Camera, MapPin, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO, format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";


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
  status: string;
  last_completed_at: string | null;
  maintenance_categories: { name: string } | null;
  condominiums: { name: string } | null;
}

const priorityLabels: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const priorityVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  baixa: "secondary", media: "outline", alta: "default", critica: "destructive",
};
const periodicityLabels: Record<string, string> = {
  unica: "Única", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", bimestral: "Bimestral",
  trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", personalizado: "Personalizado",
};

const emptyTaskForm = {
  title: "", description: "", priority: "media", periodicity: "mensal",
  periodicity_days: "", next_due_date: "", notification_days_before: "7",
  responsible_notes: "", estimated_cost: "", category_id: "", maintenance_type: "preventiva",
};

// --- Drag-and-drop helper components ---
function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: hovering } = useDroppable({ id });
  const active = isOver || hovering;
  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[100px] max-h-[65vh] overflow-y-auto rounded-lg transition-colors duration-200 p-1 ${
        active ? "bg-primary/10 ring-2 ring-primary/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export default function ZeladorManutencoes() {
  const { user } = useAuth();
  const { profileInfo } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Drag sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Execution dialog
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [execForm, setExecForm] = useState({ observations: "", status: "concluida", cost: "" });
  const [execPhotos, setExecPhotos] = useState<File[]>([]);
  const [execPhotosPreviews, setExecPhotosPreviews] = useState<string[]>([]);
  const [execLocation, setExecLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Task CRUD dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);

  // Show/hide finalizadas
  const [showFinalizadas, setShowFinalizadas] = useState(false);

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
          next_due_date, notification_days_before, responsible_notes, estimated_cost, status, last_completed_at,
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
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // --- Execution mutation ---
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !user) throw new Error("Tarefa não selecionada");

      // Upload photos
      let photoUrls: string[] = [];
      if (execPhotos.length > 0) {
        setUploadingPhotos(true);
        for (const photo of execPhotos) {
          const fileName = `${selectedTask.id}/${Date.now()}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from("maintenance-photos")
            .upload(fileName, photo);
          if (uploadError) throw uploadError;
          photoUrls.push(fileName);
        }
        setUploadingPhotos(false);
      }

      const { error } = await supabase.from("maintenance_executions").insert({
        task_id: selectedTask.id,
        condominium_id: selectedTask.condominium_id,
        executed_by: user.id,
        executed_by_name: profileInfo?.full_name || user.email || "Zelador",
        observations: execForm.observations || null,
        cost: execForm.cost ? parseFloat(execForm.cost) : null,
        status: execForm.status as any,
        photos: photoUrls,
        location: execLocation ? { lat: execLocation.lat, lng: execLocation.lng } : null,
      });
      if (error) throw error;

      if (execForm.status === "concluida") {
        // Corrective tasks are one-time — always finalize without recalculating next date
        if (selectedTask.periodicity === "unica" || (selectedTask as any).maintenance_type === "corretiva") {
          await supabase.from("maintenance_tasks").update({
            last_completed_at: new Date().toISOString(),
            status: "finalizada",
            is_active: (selectedTask as any).maintenance_type === "corretiva" ? true : true,
          }).eq("id", selectedTask.id);
        } else {
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
            status: "finalizada",
          }).eq("id", selectedTask.id);
        }
      } else if (execForm.status === "parcial") {
        await supabase.from("maintenance_tasks").update({
          status: "em_execucao",
        }).eq("id", selectedTask.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["zelador-recent-execs"] });
      setExecDialogOpen(false);
      setExecPhotos([]);
      setExecPhotosPreviews([]);
      setExecLocation(null);
      toast({ title: "Execução registrada!", description: "A manutenção foi registrada com sucesso" });
    },
    onError: (error) => {
      setUploadingPhotos(false);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
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
        maintenance_type: taskForm.maintenance_type,
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
      maintenance_type: (task as any).maintenance_type || "preventiva",
    });
    setTaskDialogOpen(true);
  };

  const startTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("maintenance_tasks").update({ status: "em_execucao" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      toast({ title: "Manutenção iniciada!", description: "A tarefa foi movida para Em execução" });
    },
    onError: (error) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const revertTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("maintenance_tasks").update({ status: "em_dia" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zelador-all-tasks"] });
      toast({ title: "Status revertido", description: "A tarefa voltou para a coluna anterior" });
    },
    onError: (error) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const captureGeolocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocalização não suportada");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setExecLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationLoading(false);
      },
      (err) => {
        setLocationError("Não foi possível obter localização");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setExecPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setExecPhotosPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setExecPhotos(prev => prev.filter((_, i) => i !== index));
    setExecPhotosPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const openExecDialog = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setExecForm({ observations: "", status: "concluida", cost: "" });
    setExecPhotos([]);
    setExecPhotosPreviews([]);
    setExecLocation(null);
    setLocationError(null);
    setExecDialogOpen(true);
    // Auto-capture geolocation
    captureGeolocation();
  };

  // --- Drag handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumn = over.id as string;
    const task = filteredTasks.find(t => t.id === taskId);
    if (!task) return;

    // Determine which column the task is currently in
    const daysUntilDue = differenceInDays(parseISO(task.next_due_date), new Date());
    let currentColumn: string;
    if (task.status === "em_execucao") currentColumn = "em_execucao";
    else if (daysUntilDue < 0) currentColumn = "vencidas";
    else currentColumn = "pendentes";

    // Same column = no-op
    if (currentColumn === targetColumn) return;

    // Move to "em_execucao"
    if (targetColumn === "em_execucao" && task.status !== "em_execucao") {
      startTaskMutation.mutate(taskId);
    }
    // Move from "em_execucao" back to pendentes/vencidas
    else if ((targetColumn === "pendentes" || targetColumn === "vencidas") && task.status === "em_execucao") {
      revertTaskMutation.mutate(taskId);
    }
  };

  const selectedCondoId = editingTask?.condominium_id || (condoIds.length === 1 ? condoIds[0] : null);
  const filteredCategories = selectedCondoId ? categories.filter(c => c.condominium_id === selectedCondoId) : categories;

  // Classify tasks into columns
  const vencidas: MaintenanceTask[] = [];
  const pendentes: MaintenanceTask[] = [];
  const emExecucao: MaintenanceTask[] = [];
  const finalizadas: MaintenanceTask[] = [];

  filteredTasks.forEach(task => {
    if (task.status === "finalizada") {
      finalizadas.push(task);
    } else if (task.status === "em_execucao") {
      emExecucao.push(task);
    } else {
      const daysUntilDue = differenceInDays(parseISO(task.next_due_date), new Date());
      if (daysUntilDue < 0) {
        vencidas.push(task);
      } else {
        pendentes.push(task);
      }
    }
  });

  const columnConfig = [
    { id: "vencidas", title: "Vencidas", items: vencidas, header: "bg-destructive/10 text-destructive", accent: "border-l-destructive" },
    { id: "pendentes", title: "Pendentes", items: pendentes, header: "bg-amber-500/10 text-amber-700 dark:text-amber-400", accent: "border-l-amber-500" },
    { id: "em_execucao", title: "Em execução", items: emExecucao, header: "bg-blue-500/10 text-blue-700 dark:text-blue-400", accent: "border-l-blue-500" },
  ];

  const draggedTask = activeDragId ? filteredTasks.find(t => t.id === activeDragId) : null;
  const draggedTaskColumn = draggedTask
    ? columnConfig.find(col => col.items.some(t => t.id === draggedTask.id))
    : null;

  const renderTaskCard = (task: MaintenanceTask, accentClass: string) => {
    const daysUntilDue = differenceInDays(parseISO(task.next_due_date), new Date());
    return (
      <div key={task.id} className={`rounded-lg border bg-card p-3 space-y-2 border-l-4 ${accentClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{task.condominiums?.name || "Condomínio"}</span>
          <span className="text-[10px] text-muted-foreground font-mono">#{task.id.slice(0, 4)}</span>
        </div>

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

        <p className="text-sm font-medium text-foreground leading-tight">{task.title}</p>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <p className="text-[10px] text-muted-foreground">
          {task.status === "finalizada"
            ? `Finalizada • ${task.last_completed_at ? format(parseISO(task.last_completed_at), "dd/MM/yyyy") : ""}`
            : task.status === "em_execucao" && daysUntilDue < 0
            ? `Em execução • Vencida em ${format(parseISO(task.next_due_date), "dd/MM")}`
            : daysUntilDue < 0
            ? `Atrasada há ${Math.abs(daysUntilDue)} dias`
            : daysUntilDue === 0
            ? "Vence hoje"
            : `Em ${daysUntilDue} dias • ${format(parseISO(task.next_due_date), "dd/MM/yyyy")}`}
        </p>

        {task.status !== "finalizada" && (
          <div className="flex gap-1.5 pt-1 border-t border-border/50">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditTaskDialog(task)}>
              <Pencil className="w-3 h-3 mr-1" /> Editar
            </Button>
            {task.status === "em_execucao" ? (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openExecDialog(task)}>
                <ClipboardCheck className="w-3 h-3 mr-1" /> Finalizar
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                onClick={() => startTaskMutation.mutate(task.id)}
                disabled={startTaskMutation.isPending}
              >
                <Play className="w-3 h-3 mr-1" /> Iniciar
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
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
        ) : (
          <div className="space-y-6">
            {/* Main 3 columns with drag-and-drop */}
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {columnConfig.map(col => (
                  <div key={col.id} className="flex flex-col gap-3">
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${col.header}`}>
                      <span className="text-sm font-semibold">{col.title} ({col.items.length})</span>
                    </div>
                    <DroppableColumn id={col.id}>
                      {col.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          {activeDragId ? "Solte aqui" : "Nenhuma tarefa"}
                        </p>
                      ) : (
                        col.items.map(t => (
                          <DraggableCard key={t.id} id={t.id}>
                            {renderTaskCard(t, col.accent)}
                          </DraggableCard>
                        ))
                      )}
                    </DroppableColumn>
                  </div>
                ))}
              </div>

              {/* Drag overlay */}
              <DragOverlay>
                {draggedTask && draggedTaskColumn ? (
                  <div className="opacity-80 rotate-2 scale-105 shadow-xl">
                    {renderTaskCard(draggedTask, draggedTaskColumn.accent)}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Finalizados section */}
            {finalizadas.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowFinalizadas(!showFinalizadas)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 w-full md:w-auto"
                >
                  <span className="text-sm font-semibold">Finalizados ({finalizadas.length})</span>
                  <span className="text-xs">{showFinalizadas ? "▲ Ocultar" : "▼ Mostrar"}</span>
                </button>
                {showFinalizadas && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {finalizadas.map(t => renderTaskCard(t, "border-l-emerald-500"))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                  <Label>Tipo *</Label>
                  <Select value={taskForm.maintenance_type} onValueChange={(v) => setTaskForm(p => ({ ...p, maintenance_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventiva">Preventiva</SelectItem>
                      <SelectItem value="corretiva">Corretiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Select value={taskForm.category_id} onValueChange={(v) => setTaskForm(p => ({ ...p, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                    <SelectItem value="parcial">⚠️ Parcial (Em execução)</SelectItem>
                    <SelectItem value="nao_realizada">❌ Não realizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Photo attachment */}
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  Fotos da execução
                </Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <div className="flex flex-wrap gap-2">
                  {execPhotosPreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[10px]">Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Geolocation */}
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Localização
                </Label>
                {locationLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Obtendo localização...
                  </div>
                ) : execLocation ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      {execLocation.lat.toFixed(6)}, {execLocation.lng.toFixed(6)}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={captureGeolocation}>
                      Atualizar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {locationError && <span className="text-xs text-destructive">{locationError}</span>}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={captureGeolocation}>
                      <MapPin className="w-3 h-3 mr-1" /> Capturar localização
                    </Button>
                  </div>
                )}
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
              <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || uploadingPhotos}>
                {(submitMutation.isPending || uploadingPhotos) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
