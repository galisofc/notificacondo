import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ClipboardCheck, GripVertical } from "lucide-react";

const DEFAULT_CATEGORIES = ["Equipamentos", "Segurança", "Limpeza", "Geral"];

interface TemplateItem {
  id: string;
  item_name: string;
  category: string;
  is_active: boolean;
  display_order: number;
}

export default function ShiftChecklistSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");

  // Fetch condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      if (data) {
        setCondominiums(data);
        if (data.length === 1) setSelectedCondominium(data[0].id);
      }
    };
    fetchCondominiums();
  }, [user]);

  // Fetch templates
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shift-checklist-templates-admin", selectedCondominium],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_checklist_templates")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as TemplateItem[];
    },
    enabled: !!selectedCondominium,
  });

  // Add item
  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.display_order)) + 1 : 0;
      const { error } = await supabase.from("shift_checklist_templates").insert({
        condominium_id: selectedCondominium,
        item_name: newItemName,
        category: newCategory,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-templates-admin"] });
      toast({ title: "Item adicionado com sucesso!" });
      setAddDialogOpen(false);
      setNewItemName("");
      setNewCategory("Geral");
    },
    onError: () => toast({ title: "Erro ao adicionar item", variant: "destructive" }),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("shift_checklist_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shift-checklist-templates-admin"] }),
  });

  // Delete item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-checklist-templates-admin"] });
      toast({ title: "Item removido!" });
    },
    onError: () => toast({ title: "Erro ao remover item", variant: "destructive" }),
  });

  // Group by category
  const grouped = items.reduce<Record<string, TemplateItem[]>>((acc, item) => {
    const cat = item.category || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checklist de Passagem de Plantão</h1>
            <p className="text-muted-foreground">Configure os itens que os porteiros devem verificar na troca de turno</p>
          </div>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)} disabled={!selectedCondominium}>
            <Plus className="w-4 h-4" /> Adicionar Item
          </Button>
        </div>

        {condominiums.length > 1 && (
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecionar condomínio" /></SelectTrigger>
            <SelectContent>
              {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {!selectedCondominium ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um condomínio.</CardContent></Card>
        ) : isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum item cadastrado.</p>
              <p className="text-sm text-muted-foreground">Adicione itens que os porteiros devem verificar na passagem de plantão.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryItems]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5" />
                    {category}
                    <Badge variant="secondary">{categoryItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <span className={`flex-1 text-sm ${!item.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.item_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Item ao Checklist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do item</Label>
                <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ex: Rádio comunicador" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => addMutation.mutate()} disabled={!newItemName || addMutation.isPending}>
                {addMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
