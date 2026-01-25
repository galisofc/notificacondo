import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Send,
  Link2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  rejected_reason?: string;
}

interface WabaTemplateSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateLinked?: (templateName: string, language: string) => void;
}

const TEMPLATE_CATEGORIES = [
  { value: "UTILITY", label: "Utilitário", description: "Notificações de pedidos, atualizações de conta" },
  { value: "MARKETING", label: "Marketing", description: "Promoções, ofertas e campanhas" },
  { value: "AUTHENTICATION", label: "Autenticação", description: "Códigos de verificação" },
];

const LANGUAGES = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function WabaTemplateSubmitDialog({ 
  open, 
  onOpenChange,
  onTemplateLinked 
}: WabaTemplateSubmitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"create" | "link">("link");
  
  // Create new template state
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState<string>("UTILITY");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Link existing template state
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<Array<{ id: string; slug: string; waba_template_name: string | null }>>([]);

  // Load Meta templates and local templates when dialog opens on link tab
  useEffect(() => {
    if (open && activeTab === "link") {
      loadMetaTemplates();
      loadLocalTemplates();
    }
  }, [open, activeTab]);

  const loadLocalTemplates = async () => {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, slug, waba_template_name");
    if (data) {
      setLocalTemplates(data);
    }
  };

  const loadMetaTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      
      if (error) throw error;
      
      if (data?.success) {
        setMetaTemplates(data.templates || []);
      } else {
        toast({
          title: "Erro ao carregar templates",
          description: data?.error || "Falha ao buscar templates da Meta",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Erro ao carregar templates",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !bodyText.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e conteúdo do corpo são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validate name format
    const namePattern = /^[a-z0-9_]+$/;
    if (!namePattern.test(templateName)) {
      toast({
        title: "Nome inválido",
        description: "Use apenas letras minúsculas, números e underscores",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const components: any[] = [];
      
      // Add header if provided
      if (headerText.trim()) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: headerText,
        });
      }
      
      // Add body (required)
      // Extract variables from body
      const bodyVariables = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const bodyComponent: any = {
        type: "BODY",
        text: bodyText,
      };
      
      if (bodyVariables.length > 0) {
        bodyComponent.example = {
          body_text: [bodyVariables.map((_, i) => `exemplo_${i + 1}`)],
        };
      }
      
      components.push(bodyComponent);
      
      // Add footer if provided
      if (footerText.trim()) {
        components.push({
          type: "FOOTER",
          text: footerText,
        });
      }

      const { data, error } = await supabase.functions.invoke("create-waba-template", {
        body: {
          name: templateName,
          category: templateCategory,
          language: templateLanguage,
          components,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✅ Template enviado para aprovação!",
          description: `Template "${templateName}" foi enviado para análise da Meta.`,
        });
        onOpenChange(false);
        resetForm();
        // Reload templates list
        loadMetaTemplates();
      } else {
        toast({
          title: "Erro ao criar template",
          description: data?.error || "Falha ao enviar template",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Erro ao criar template",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkTemplate = () => {
    if (!selectedTemplate) {
      toast({
        title: "Selecione um template",
        description: "Escolha um template da lista para vincular",
        variant: "destructive",
      });
      return;
    }

    onTemplateLinked?.(selectedTemplate.name, selectedTemplate.language);
    toast({
      title: "✅ Template vinculado!",
      description: `Template "${selectedTemplate.name}" foi selecionado. Salve para confirmar.`,
    });
    onOpenChange(false);
  };

  // Mapeamento explícito de templates locais para templates WABA da Meta
  const TEMPLATE_MAPPING: Record<string, string> = {
    "package_arrival": "encomenda_management_5",
    "notification_occurrence": "notificacao_ocorrencia",
    "notify_sindico_defense": "nova_defesa",
  };

  // Auto-sync templates by matching Meta template name to local slug
  const handleAutoSync = async () => {
    setIsSyncing(true);
    try {
      // Get approved Meta templates
      const approvedMeta = metaTemplates.filter(t => t.status === "APPROVED");
      
      // Find matches between local slugs and Meta template names
      const matches: { localId: string; localSlug: string; metaName: string; metaLanguage: string }[] = [];
      
      for (const local of localTemplates) {
        // Skip if already linked
        if (local.waba_template_name) continue;
        
        // 1. First check explicit mapping
        const explicitMapping = TEMPLATE_MAPPING[local.slug];
        if (explicitMapping) {
          const metaMatch = approvedMeta.find(m => m.name === explicitMapping);
          if (metaMatch) {
            matches.push({
              localId: local.id,
              localSlug: local.slug,
              metaName: metaMatch.name,
              metaLanguage: metaMatch.language,
            });
            continue;
          }
        }
        
        // 2. Try to find a matching Meta template by name similarity
        const match = approvedMeta.find(meta => {
          const metaNameNormalized = meta.name.toLowerCase();
          const slugNormalized = local.slug.toLowerCase();
          
          // Exact match or contains match
          return metaNameNormalized === slugNormalized || 
                 metaNameNormalized.includes(slugNormalized) ||
                 slugNormalized.includes(metaNameNormalized);
        });
        
        if (match) {
          matches.push({
            localId: local.id,
            localSlug: local.slug,
            metaName: match.name,
            metaLanguage: match.language,
          });
        }
      }
      
      if (matches.length === 0) {
        toast({
          title: "Nenhum match encontrado",
          description: "Nenhum template local corresponde a templates aprovados na Meta",
        });
        setIsSyncing(false);
        return;
      }
      
      // Update local templates with matched Meta names
      let successCount = 0;
      for (const match of matches) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({
            waba_template_name: match.metaName,
            waba_language: match.metaLanguage,
          })
          .eq("id", match.localId);
        
        if (!error) {
          successCount++;
        }
      }
      
      // Refresh data
      await loadLocalTemplates();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      
      toast({
        title: "✅ Sincronização concluída!",
        description: `${successCount} de ${matches.length} templates foram vinculados automaticamente`,
      });
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message || "Erro ao sincronizar templates",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setTemplateName("");
    setTemplateCategory("UTILITY");
    setTemplateLanguage("pt_BR");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setSelectedTemplate(null);
    setSearchQuery("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
            <CheckCircle className="h-3 w-3" />
            Aprovado
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
            <XCircle className="h-3 w-3" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  const filteredTemplates = metaTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerenciar Templates WABA
          </DialogTitle>
          <DialogDescription>
            Crie novos templates para aprovação ou vincule templates já aprovados na Meta
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "link")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Vincular Existente
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Send className="h-4 w-4" />
              Criar Novo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder="Buscar template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={loadMetaTemplates}
                disabled={isLoadingTemplates}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingTemplates ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Nenhum template encontrado" : "Nenhum template disponível na conta Meta"}
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium truncate">
                              {template.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {getStatusBadge(template.status)}
                              <Badge variant="outline" className="text-xs">
                                {template.language}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            {template.rejected_reason && (
                              <p className="text-xs text-red-500 mt-1.5">
                                Motivo: {template.rejected_reason}
                              </p>
                            )}
                          </div>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4 border-t mt-4">
              <Button 
                variant="secondary"
                onClick={handleAutoSync}
                disabled={isSyncing || isLoadingTemplates || metaTemplates.length === 0}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Sincronizar por Slug
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleLinkTemplate}
                  disabled={!selectedTemplate || selectedTemplate.status !== "APPROVED"}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Vincular
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-hidden flex flex-col mt-4">
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>Dica:</strong> Templates devem seguir as políticas da Meta. Use {"{{1}}"}, {"{{2}}"} para variáveis.
                    O template será analisado e pode levar de minutos a horas para aprovação.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do Template *</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      placeholder="meu_template_v1"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas letras minúsculas, números e underscores
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select value={templateCategory} onValueChange={setTemplateCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div>
                              <p>{cat.label}</p>
                              <p className="text-xs text-muted-foreground">{cat.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cabeçalho (opcional)</Label>
                  <Input
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Título do template"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Corpo da Mensagem *</Label>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Olá {{1}}, sua encomenda chegou no bloco {{2}}..."
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"}, {"{{3}}"} para variáveis dinâmicas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Rodapé (opcional)</Label>
                  <Input
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Não responda a esta mensagem"
                  />
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateTemplate}
                disabled={isSubmitting || !templateName.trim() || !bodyText.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar para Aprovação
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}