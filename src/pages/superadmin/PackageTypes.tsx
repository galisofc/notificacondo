import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  GripVertical,
  Mail,
  Truck,
  ShoppingBag,
  FileText,
  UtensilsCrossed,
  Box,
  ArrowDownAZ,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

interface PackageType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

const ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Mail", label: "Correios", icon: Mail },
  { value: "Truck", label: "Transportadora", icon: Truck },
  { value: "ShoppingBag", label: "E-commerce", icon: ShoppingBag },
  { value: "FileText", label: "Documento", icon: FileText },
  { value: "UtensilsCrossed", label: "Alimentação", icon: UtensilsCrossed },
  { value: "Box", label: "Outros", icon: Box },
  { value: "Package", label: "Pacote", icon: Package },
];

const getIconComponent = (iconName: string | null): LucideIcon => {
  const found = ICON_OPTIONS.find((opt) => opt.value === iconName);
  return found?.icon || Package;
};

// Sortable Table Row Component
function SortableTableRow({
  type,
  onEdit,
  onDelete,
}: {
  type: PackageType;
  onEdit: (type: PackageType) => void;
  onDelete: (type: PackageType) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = getIconComponent(type.icon);

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          <span className="font-mono text-sm">{type.display_order}</span>
        </div>
      </TableCell>
      <TableCell className="font-medium">{type.name}</TableCell>
      <TableCell className="text-muted-foreground max-w-xs truncate">
        {type.description || "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">{type.icon}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={type.is_active ? "default" : "secondary"}>
          {type.is_active ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(type)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(type)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Sortable Mobile Card Component
function SortableMobileCard({
  type,
  onEdit,
  onDelete,
}: {
  type: PackageType;
  onEdit: (type: PackageType) => void;
  onDelete: (type: PackageType) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = getIconComponent(type.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 space-y-3 bg-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconComponent className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium truncate">{type.name}</h3>
            <p className="text-xs text-muted-foreground">
              Ordem: {type.display_order}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(type)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(type)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {type.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {type.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <IconComponent className="w-3.5 h-3.5" />
          <span>{type.icon}</span>
        </div>
        <Badge variant={type.is_active ? "default" : "secondary"}>
          {type.is_active ? "Ativo" : "Inativo"}
        </Badge>
      </div>
    </div>
  );
}

export default function PackageTypes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<PackageType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<PackageType | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    icon: "Package",
    is_active: true,
    display_order: 0,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch package types
  const { data: packageTypesRaw, isLoading } = useQuery({
    queryKey: ["package-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_types")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as PackageType[];
    },
  });

  // Sort alphabetically for initial display (by name) but respect display_order
  const packageTypes = useMemo(() => {
    if (!packageTypesRaw) return [];
    return [...packageTypesRaw].sort((a, b) => {
      // Primary sort by display_order
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      // Secondary sort by name (alphabetically)
      return a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [packageTypesRaw]);

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (reorderedTypes: { id: string; display_order: number }[]) => {
      // Update all items in parallel
      const updates = reorderedTypes.map(({ id, display_order }) =>
        supabase
          .from("package_types")
          .update({ display_order })
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-types"] });
      toast({ title: "Ordem atualizada com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reordenar",
        description: error.message,
        variant: "destructive",
      });
      // Refetch to reset state
      queryClient.invalidateQueries({ queryKey: ["package-types"] });
    },
  });

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = packageTypes.findIndex((t) => t.id === active.id);
      const newIndex = packageTypes.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(packageTypes, oldIndex, newIndex);

      // Update display_order for all items
      const updates = newOrder.map((type, index) => ({
        id: type.id,
        display_order: index + 1,
      }));

      // Optimistic update
      queryClient.setQueryData(["package-types"], () =>
        newOrder.map((type, index) => ({ ...type, display_order: index + 1 }))
      );

      reorderMutation.mutate(updates);
    }
  };

  // Sort alphabetically
  const handleSortAlphabetically = () => {
    if (!packageTypes || packageTypes.length === 0) return;

    const sorted = [...packageTypes].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" })
    );

    const updates = sorted.map((type, index) => ({
      id: type.id,
      display_order: index + 1,
    }));

    // Optimistic update
    queryClient.setQueryData(["package-types"], () =>
      sorted.map((type, index) => ({ ...type, display_order: index + 1 }))
    );

    reorderMutation.mutate(updates);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("package_types").insert({
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        is_active: data.is_active,
        display_order: data.display_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-types"] });
      toast({ title: "Tipo de encomenda criado com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("package_types")
        .update({
          name: data.name,
          description: data.description || null,
          icon: data.icon,
          is_active: data.is_active,
          display_order: data.display_order,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-types"] });
      toast({ title: "Tipo de encomenda atualizado com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if there are packages using this type
      const { count, error: countError } = await supabase
        .from("packages")
        .select("*", { count: "exact", head: true })
        .eq("package_type_id", id);

      if (countError) throw countError;

      if (count && count > 0) {
        const plural = count > 1;
        throw new Error(
          `Não é possível excluir este tipo. ${plural ? "Existem" : "Existe"} ${count} encomenda${plural ? "s associadas" : " associada"}. Desative o tipo em vez de excluí-lo.`
        );
      }

      const { error } = await supabase
        .from("package_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package-types"] });
      toast({ title: "Tipo de encomenda excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (type?: PackageType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || "",
        icon: type.icon || "Package",
        is_active: type.is_active,
        display_order: type.display_order,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: "",
        description: "",
        icon: "Package",
        is_active: true,
        display_order: (packageTypes?.length || 0) + 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setFormData({
      name: "",
      description: "",
      icon: "Package",
      is_active: true,
      display_order: 0,
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do tipo de encomenda.",
        variant: "destructive",
      });
      return;
    }

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmDelete = () => {
    if (typeToDelete) {
      deleteMutation.mutate(typeToDelete.id);
    }
  };

  const handleEdit = (type: PackageType) => handleOpenDialog(type);
  const handleDelete = (type: PackageType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <Helmet>
        <title>Tipos de Encomenda | Super Admin</title>
      </Helmet>

      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Tipos de Encomenda" }]} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Tipos de Encomenda
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os tipos de encomenda disponíveis
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSortAlphabetically}
              disabled={reorderMutation.isPending || !packageTypes?.length}
              className="gap-2"
            >
              <ArrowDownAZ className="w-4 h-4" />
              <span className="hidden sm:inline">Ordenar A-Z</span>
            </Button>
            <Button onClick={() => handleOpenDialog()} className="gap-2 flex-1 sm:flex-none">
              <Plus className="w-4 h-4" />
              Novo Tipo
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Tipos Cadastrados
            </CardTitle>
            <CardDescription>
              {packageTypes?.length || 0} tipo(s) de encomenda cadastrado(s).
              Arraste para reordenar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : packageTypes && packageTypes.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={packageTypes.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {/* Desktop Table - hidden on mobile */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Ordem</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Ícone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packageTypes.map((type) => (
                          <SortableTableRow
                            key={type.id}
                            type={type}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards - visible only on mobile */}
                  <div className="md:hidden space-y-3">
                    {packageTypes.map((type) => (
                      <SortableMobileCard
                        key={type.id}
                        type={type}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg">
                  Nenhum tipo cadastrado
                </h3>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  Crie o primeiro tipo de encomenda para começar
                </p>
                <Button onClick={() => handleOpenDialog()} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Tipo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Editar Tipo" : "Novo Tipo de Encomenda"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Atualize as informações do tipo de encomenda"
                : "Preencha as informações para criar um novo tipo"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ex: Correios, Transportadora..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descrição opcional do tipo de encomenda"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = formData.icon === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, icon: opt.value }))
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs">{opt.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Ordem de Exibição</Label>
              <Input
                id="display_order"
                type="number"
                min={0}
                value={formData.display_order}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    display_order: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Tipos inativos não aparecem na lista de seleção
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseDialog} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingType ? "Salvar Alterações" : "Criar Tipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o tipo "{typeToDelete?.name}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
