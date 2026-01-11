import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Pencil,
  Save,
  X,
  Loader2,
  RotateCcw,
  Info,
  Check,
  Sparkles,
} from "lucide-react";

interface DefaultTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
}

interface CustomTemplate {
  id: string;
  condominium_id: string;
  template_slug: string;
  content: string;
  is_active: boolean;
}

const TEMPLATE_COLORS: Record<string, string> = {
  notification_occurrence: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  decision_archived: "bg-green-500/10 text-green-500 border-green-500/20",
  decision_warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  decision_fine: "bg-red-500/10 text-red-500 border-red-500/20",
  notify_sindico_defense: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  party_hall_reminder: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  party_hall_cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const VARIABLE_EXAMPLES: Record<string, string> = {
  nome: "João Silva",
  condominio: "Residencial Primavera",
  tipo: "Advertência",
  titulo: "Barulho após horário permitido",
  link: "https://app.exemplo.com/xyz123",
  justificativa: "Após análise, consideramos procedente a reclamação.",
  nome_morador: "Maria Santos",
  espaco: "Salão de Festas",
  data: "15/01/2026",
  horario_inicio: "14:00",
  horario_fim: "22:00",
  checklist: "*Cozinha:*\n  • Fogão\n  • Geladeira\n*Salão:*\n  • Mesas\n  • Cadeiras",
};

// Templates available for síndicos to customize
const SINDICO_TEMPLATES = [
  "notification_occurrence",
  "decision_archived",
  "decision_warning",
  "decision_fine",
  "party_hall_reminder",
  "party_hall_cancelled",
];

interface Props {
  condominiumId: string;
}

export function CondominiumWhatsAppTemplates({ condominiumId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [useCustom, setUseCustom] = useState(true);

  // Fetch default templates
  const { data: defaultTemplates, isLoading: loadingDefaults } = useQuery({
    queryKey: ["whatsapp-templates-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .in("slug", SINDICO_TEMPLATES)
        .order("created_at");

      if (error) throw error;
      return data as DefaultTemplate[];
    },
  });

  // Fetch custom templates for this condominium
  const { data: customTemplates, isLoading: loadingCustom } = useQuery({
    queryKey: ["condominium-whatsapp-templates", condominiumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominium_whatsapp_templates")
        .select("*")
        .eq("condominium_id", condominiumId);

      if (error) throw error;
      return data as CustomTemplate[];
    },
  });

  const customTemplatesMap = useMemo(() => {
    const map: Record<string, CustomTemplate> = {};
    customTemplates?.forEach((t) => {
      map[t.template_slug] = t;
    });
    return map;
  }, [customTemplates]);

  const saveMutation = useMutation({
    mutationFn: async ({
      slug,
      content,
      isActive,
    }: {
      slug: string;
      content: string;
      isActive: boolean;
    }) => {
      const existing = customTemplatesMap[slug];

      if (existing) {
        const { error } = await supabase
          .from("condominium_whatsapp_templates")
          .update({ content, is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("condominium_whatsapp_templates")
          .insert({
            condominium_id: condominiumId,
            template_slug: slug,
            content,
            is_active: isActive,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-whatsapp-templates", condominiumId] });
      toast({ title: "Template personalizado salvo!" });
      setEditingSlug(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const existing = customTemplatesMap[slug];
      if (!existing) return;

      const { error } = await supabase
        .from("condominium_whatsapp_templates")
        .delete()
        .eq("id", existing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condominium-whatsapp-templates", condominiumId] });
      toast({ title: "Voltando ao template padrão" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover personalização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (template: DefaultTemplate) => {
    const custom = customTemplatesMap[template.slug];
    setEditingSlug(template.slug);
    setEditContent(custom?.content || template.content);
    setUseCustom(custom?.is_active ?? true);
  };

  const handleSave = () => {
    if (!editingSlug) return;
    saveMutation.mutate({
      slug: editingSlug,
      content: editContent,
      isActive: useCustom,
    });
  };

  const handleReset = (slug: string) => {
    if (confirm("Deseja remover a personalização e voltar ao template padrão?")) {
      deleteMutation.mutate(slug);
    }
  };

  const currentEditingDefault = defaultTemplates?.find((t) => t.slug === editingSlug);

  const isLoading = loadingDefaults || loadingCustom;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Mensagem</CardTitle>
              <CardDescription>
                Personalize as mensagens de WhatsApp do seu condomínio
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-500 mb-1">Como funciona</p>
              <p className="text-muted-foreground">
                Você pode personalizar os templates de mensagem do seu condomínio. 
                Se não personalizar, será usado o template padrão do sistema.
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {defaultTemplates?.map((template) => {
              const custom = customTemplatesMap[template.slug];
              const isCustomized = !!custom;
              const currentContent = custom?.content || template.content;

              return (
                <AccordionItem key={template.id} value={template.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge className={TEMPLATE_COLORS[template.slug] || "bg-muted"}>
                        {template.name}
                      </Badge>
                      {isCustomized && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Personalizado
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {template.description}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm whitespace-pre-wrap">
                        {currentContent}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Variáveis:</span>
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {`{${variable}}`}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          {isCustomized ? "Editar" : "Personalizar"}
                        </Button>
                        {isCustomized && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReset(template.slug)}
                            disabled={deleteMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Usar Padrão
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingSlug} onOpenChange={() => setEditingSlug(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar Template</DialogTitle>
            <DialogDescription>
              {currentEditingDefault?.name} - {currentEditingDefault?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="space-y-0.5">
                <Label>Usar template personalizado</Label>
                <p className="text-xs text-muted-foreground">
                  Desative para usar o template padrão do sistema
                </p>
              </div>
              <Switch
                checked={useCustom}
                onCheckedChange={setUseCustom}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
              <Textarea
                id="template-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[250px] font-mono text-sm"
                disabled={!useCustom}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Clique para inserir:</span>
              {currentEditingDefault?.variables.map((variable) => (
                <Badge
                  key={variable}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() => setEditContent((prev) => prev + `{${variable}}`)}
                >
                  {`{${variable}}`}
                </Badge>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-medium text-green-600">Preview da Mensagem</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-border/50">
                <div className="font-mono text-sm whitespace-pre-wrap text-foreground">
                  {editContent.replace(/\{(\w+)\}/g, (match, variable) => {
                    return VARIABLE_EXAMPLES[variable] || match;
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                * Os valores acima são exemplos.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingSlug(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
