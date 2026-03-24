import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Pencil, Trash2, Eye, GripVertical, Megaphone } from "lucide-react";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";

interface Banner {
  id: string;
  condominium_id: string;
  title: string;
  content: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface BannerForm {
  title: string;
  content: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

const COLOR_PRESETS = [
  { label: "Azul", bg: "#3b82f6", text: "#ffffff" },
  { label: "Verde", bg: "#22c55e", text: "#ffffff" },
  { label: "Amarelo", bg: "#eab308", text: "#1a1a1a" },
  { label: "Vermelho", bg: "#ef4444", text: "#ffffff" },
  { label: "Roxo", bg: "#8b5cf6", text: "#ffffff" },
  { label: "Laranja", bg: "#f97316", text: "#ffffff" },
  { label: "Cinza", bg: "#6b7280", text: "#ffffff" },
  { label: "Escuro", bg: "#1e293b", text: "#ffffff" },
];

const defaultForm: BannerForm = {
  title: "",
  content: "",
  bg_color: "#3b82f6",
  text_color: "#ffffff",
  is_active: true,
};

export default function SindicoBanners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profileInfo } = useUserRole();

  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(defaultForm);

  // Fetch condominiums
  const { data: condominiums = [] } = useQuery({
    queryKey: ["sindico-condominiums-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select first condominium
  if (condominiums.length > 0 && !selectedCondominium) {
    setSelectedCondominium(condominiums[0].id);
  }

  // Fetch banners
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["condominium-banners", selectedCondominium],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominium_banners")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Banner[];
    },
    enabled: !!selectedCondominium,
    staleTime: 1000 * 60 * 2,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingBanner) {
        const { error } = await supabase
          .from("condominium_banners")
          .update({
            title: form.title,
            content: form.content,
            bg_color: form.bg_color,
            text_color: form.text_color,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingBanner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("condominium_banners")
          .insert({
            condominium_id: selectedCondominium,
            title: form.title,
            content: form.content,
            bg_color: form.bg_color,
            text_color: form.text_color,
            is_active: form.is_active,
            display_order: banners.length,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
      toast({ title: editingBanner ? "Banner atualizado!" : "Banner criado!" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar banner", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("condominium_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
      toast({ title: "Banner excluído!" });
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("condominium_banners")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-banners", selectedCondominium] });
    },
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(defaultForm);
    setShowDialog(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      content: banner.content,
      bg_color: banner.bg_color,
      text_color: banner.text_color,
      is_active: banner.is_active,
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingBanner(null);
    setForm(defaultForm);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SindicoBreadcrumbs items={[{ label: "Banners" }]} />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-6 h-6" />
              Banners da Portaria
            </h1>
            <p className="text-muted-foreground">Crie avisos que aparecem no painel do porteiro</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {condominiums.length > 1 && (
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione o condomínio" />
                </SelectTrigger>
                <SelectContent>
                  {condominiums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Banner
            </Button>
          </div>
        </div>

        {/* Banner List */}
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : banners.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum banner cadastrado para este condomínio.</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                Criar primeiro banner
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {banners.map((banner) => (
              <Card key={banner.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div
                      className="flex-1 rounded-lg p-4 min-h-[60px]"
                      style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
                    >
                      <p className="font-semibold text-sm">{banner.title}</p>
                      <p className="text-sm mt-1 whitespace-pre-line">{banner.content}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <Switch
                        checked={banner.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: banner.id, is_active: checked })
                        }
                      />
                      <Badge variant={banner.is_active ? "default" : "secondary"} className="text-xs">
                        {banner.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <div className="flex gap-1 mt-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(banner)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Deseja excluir este banner?")) {
                              deleteMutation.mutate(banner.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Aviso importante"
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Escreva a mensagem do banner..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Color presets */}
              <div>
                <Label>Cor do banner</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.bg}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.bg_color === preset.bg ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: preset.bg }}
                      onClick={() => setForm({ ...form, bg_color: preset.bg, text_color: preset.text })}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              {/* Custom colors */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Cor de fundo (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.bg_color}
                      onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.bg_color}
                      onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Cor do texto (hex)</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.text_color}
                      onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.text_color}
                      onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div
                  className="rounded-lg p-4 mt-1"
                  style={{ backgroundColor: form.bg_color, color: form.text_color }}
                >
                  <p className="font-semibold text-sm">{form.title || "Título do banner"}</p>
                  <p className="text-sm mt-1">{form.content || "Mensagem do banner..."}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Banner ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.title.trim() || !form.content.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : editingBanner ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
