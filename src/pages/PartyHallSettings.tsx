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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, Building2, ClipboardList, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface PartyHallSetting {
  id: string;
  condominium_id: string;
  name: string;
  rental_fee: number;
  rules: string | null;
  advance_days_required: number;
  check_in_time: string;
  check_out_time: string;
  max_guests: number;
  is_active: boolean;
  condominium?: {
    name: string;
  };
}

interface ChecklistTemplate {
  id: string;
  condominium_id: string;
  item_name: string;
  category: string;
  is_active: boolean;
  display_order: number;
}

export default function PartyHallSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [newSpaceDialogOpen, setNewSpaceDialogOpen] = useState(false);
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<PartyHallSetting | null>(null);
  
  // Form states for new space
  const [newSpace, setNewSpace] = useState({
    name: "",
    rental_fee: 0,
    rules: "",
    advance_days_required: 3,
    check_in_time: "08:00",
    check_out_time: "22:00",
    max_guests: 50,
  });

  // Form state for new template item
  const [newTemplateItem, setNewTemplateItem] = useState({
    item_name: "",
    category: "Geral",
  });

  // Fetch condominiums
  const { data: condominiums = [] } = useQuery({
    queryKey: ["condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch party hall settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["party-hall-settings", selectedCondominium],
    queryFn: async () => {
      let query = supabase
        .from("party_hall_settings")
        .select(`
          *,
          condominium:condominiums(name)
        `)
        .order("name");

      if (selectedCondominium) {
        query = query.eq("condominium_id", selectedCondominium);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PartyHallSetting[];
    },
    enabled: !!user?.id,
  });

  // Fetch checklist templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["checklist-templates", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("party_hall_checklist_templates")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("display_order");
      if (error) throw error;
      return data as ChecklistTemplate[];
    },
    enabled: !!selectedCondominium,
  });

  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCondominium) throw new Error("Selecione um condomínio");
      const { error } = await supabase
        .from("party_hall_settings")
        .insert({
          condominium_id: selectedCondominium,
          ...newSpace,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-settings"] });
      setNewSpaceDialogOpen(false);
      setNewSpace({
        name: "",
        rental_fee: 0,
        rules: "",
        advance_days_required: 3,
        check_in_time: "08:00",
        check_out_time: "22:00",
        max_guests: 50,
      });
      toast({ title: "Espaço criado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar espaço", description: error.message, variant: "destructive" });
    },
  });

  // Update space mutation
  const updateSpaceMutation = useMutation({
    mutationFn: async (space: PartyHallSetting) => {
      const { error } = await supabase
        .from("party_hall_settings")
        .update({
          name: space.name,
          rental_fee: space.rental_fee,
          rules: space.rules,
          advance_days_required: space.advance_days_required,
          check_in_time: space.check_in_time,
          check_out_time: space.check_out_time,
          max_guests: space.max_guests,
          is_active: space.is_active,
        })
        .eq("id", space.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-settings"] });
      setEditingSpace(null);
      toast({ title: "Espaço atualizado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar espaço", description: error.message, variant: "destructive" });
    },
  });

  // Delete space mutation
  const deleteSpaceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("party_hall_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-settings"] });
      toast({ title: "Espaço excluído com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir espaço", description: error.message, variant: "destructive" });
    },
  });

  // Create template item mutation
  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCondominium) throw new Error("Selecione um condomínio");
      const { error } = await supabase
        .from("party_hall_checklist_templates")
        .insert({
          condominium_id: selectedCondominium,
          item_name: newTemplateItem.item_name,
          category: newTemplateItem.category,
          display_order: templates.length,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      setNewTemplateDialogOpen(false);
      setNewTemplateItem({ item_name: "", category: "Geral" });
      toast({ title: "Item de checklist criado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar item", description: error.message, variant: "destructive" });
    },
  });

  // Delete template item mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("party_hall_checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast({ title: "Item excluído com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir item", description: error.message, variant: "destructive" });
    },
  });

  const categories = ["Geral", "Elétrica", "Móveis", "Limpeza", "Utensílios", "Decoração", "Segurança"];

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
        <SindicoBreadcrumbs 
          items={[
            { label: "Salão de Festas", href: "/party-hall" },
            { label: "Configurações" }
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações do Salão</h2>
            <p className="text-muted-foreground">
              Configure espaços e templates de checklist
            </p>
          </div>
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Selecione um condomínio" />
            </SelectTrigger>
            <SelectContent>
              {condominiums.map((condo) => (
                <SelectItem key={condo.id} value={condo.id}>
                  {condo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="spaces" className="space-y-4">
          <TabsList>
            <TabsTrigger value="spaces" className="gap-2">
              <Building2 className="h-4 w-4" />
              Espaços
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2" disabled={!selectedCondominium}>
              <ClipboardList className="h-4 w-4" />
              Template de Checklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spaces" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={newSpaceDialogOpen} onOpenChange={setNewSpaceDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!selectedCondominium}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Espaço
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Novo Espaço</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nome do Espaço</Label>
                      <Input
                        id="name"
                        value={newSpace.name}
                        onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                        placeholder="Ex: Salão de Festas"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="rental_fee">Taxa de Locação (R$)</Label>
                        <Input
                          id="rental_fee"
                          type="number"
                          value={newSpace.rental_fee}
                          onChange={(e) => setNewSpace({ ...newSpace, rental_fee: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="check_in">Horário Entrada</Label>
                        <Input
                          id="check_in"
                          type="time"
                          value={newSpace.check_in_time}
                          onChange={(e) => setNewSpace({ ...newSpace, check_in_time: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="check_out">Horário Saída</Label>
                        <Input
                          id="check_out"
                          type="time"
                          value={newSpace.check_out_time}
                          onChange={(e) => setNewSpace({ ...newSpace, check_out_time: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="advance_days">Antecedência Mínima (dias)</Label>
                        <Input
                          id="advance_days"
                          type="number"
                          value={newSpace.advance_days_required}
                          onChange={(e) => setNewSpace({ ...newSpace, advance_days_required: Number(e.target.value) })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="max_guests">Capacidade Máxima</Label>
                        <Input
                          id="max_guests"
                          type="number"
                          value={newSpace.max_guests}
                          onChange={(e) => setNewSpace({ ...newSpace, max_guests: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rules">Regras de Uso</Label>
                      <Textarea
                        id="rules"
                        value={newSpace.rules}
                        onChange={(e) => setNewSpace({ ...newSpace, rules: e.target.value })}
                        placeholder="Regras e orientações para uso do espaço..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewSpaceDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => createSpaceMutation.mutate()}
                      disabled={!newSpace.name || createSpaceMutation.isPending}
                    >
                      Criar Espaço
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {settingsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : settings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {selectedCondominium 
                      ? "Nenhum espaço cadastrado. Clique em 'Novo Espaço' para começar."
                      : "Selecione um condomínio para ver os espaços"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {settings.map((space) => (
                  <Card key={space.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {space.name}
                            {!space.is_active && <Badge variant="secondary">Inativo</Badge>}
                          </CardTitle>
                          <CardDescription>{space.condominium?.name}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setEditingSpace(space)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => deleteSpaceMutation.mutate(space.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Taxa</p>
                          <p className="font-medium">R$ {space.rental_fee?.toFixed(2) || "0,00"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horário</p>
                          <p className="font-medium">{space.check_in_time?.slice(0,5)} - {space.check_out_time?.slice(0,5)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Capacidade</p>
                          <p className="font-medium">{space.max_guests} pessoas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="checklist" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={newTemplateDialogOpen} onOpenChange={setNewTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Item de Checklist</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="item_name">Nome do Item</Label>
                      <Input
                        id="item_name"
                        value={newTemplateItem.item_name}
                        onChange={(e) => setNewTemplateItem({ ...newTemplateItem, item_name: e.target.value })}
                        placeholder="Ex: Ar Condicionado"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Select 
                        value={newTemplateItem.category} 
                        onValueChange={(value) => setNewTemplateItem({ ...newTemplateItem, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewTemplateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => createTemplateMutation.mutate()}
                      disabled={!newTemplateItem.item_name || createTemplateMutation.isPending}
                    >
                      Adicionar Item
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {templatesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum item de checklist cadastrado. Clique em 'Novo Item' para começar.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Itens do Checklist</CardTitle>
                  <CardDescription>
                    Estes itens serão usados nos checklists de entrada e saída
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {templates.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{item.category}</Badge>
                          <span>{item.item_name}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => deleteTemplateMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Space Dialog */}
        <Dialog open={!!editingSpace} onOpenChange={() => setEditingSpace(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Espaço</DialogTitle>
            </DialogHeader>
            {editingSpace && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Nome do Espaço</Label>
                  <Input
                    id="edit-name"
                    value={editingSpace.name}
                    onChange={(e) => setEditingSpace({ ...editingSpace, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-rental_fee">Taxa de Locação (R$)</Label>
                    <Input
                      id="edit-rental_fee"
                      type="number"
                      value={editingSpace.rental_fee}
                      onChange={(e) => setEditingSpace({ ...editingSpace, rental_fee: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-check_in">Horário Entrada</Label>
                    <Input
                      id="edit-check_in"
                      type="time"
                      value={editingSpace.check_in_time}
                      onChange={(e) => setEditingSpace({ ...editingSpace, check_in_time: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-check_out">Horário Saída</Label>
                    <Input
                      id="edit-check_out"
                      type="time"
                      value={editingSpace.check_out_time}
                      onChange={(e) => setEditingSpace({ ...editingSpace, check_out_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-advance_days">Antecedência Mínima (dias)</Label>
                    <Input
                      id="edit-advance_days"
                      type="number"
                      value={editingSpace.advance_days_required}
                      onChange={(e) => setEditingSpace({ ...editingSpace, advance_days_required: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-max_guests">Capacidade Máxima</Label>
                    <Input
                      id="edit-max_guests"
                      type="number"
                      value={editingSpace.max_guests}
                      onChange={(e) => setEditingSpace({ ...editingSpace, max_guests: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-rules">Regras de Uso</Label>
                  <Textarea
                    id="edit-rules"
                    value={editingSpace.rules || ""}
                    onChange={(e) => setEditingSpace({ ...editingSpace, rules: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-active"
                    checked={editingSpace.is_active}
                    onCheckedChange={(checked) => setEditingSpace({ ...editingSpace, is_active: checked })}
                  />
                  <Label htmlFor="edit-active">Espaço Ativo</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSpace(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => editingSpace && updateSpaceMutation.mutate(editingSpace)}
                disabled={updateSpaceMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}