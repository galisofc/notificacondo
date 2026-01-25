import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Link2,
  LinkIcon,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface LocalTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  waba_template_name: string | null;
  waba_language: string | null;
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  rejected_reason?: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
  }>;
}

// Mapeamento explícito de templates locais para templates WABA da Meta
const TEMPLATE_MAPPING: Record<string, string> = {
  "package_arrival": "encomenda_management_5",
  "notification_occurrence": "notificacao_ocorrencia",
  "notify_sindico_defense": "nova_defesa",
};

const TEMPLATE_CATEGORIES = [
  { value: "UTILITY", label: "Utilitário" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Autenticação" },
];

export function TemplateWabaLinkingCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  
  // Create new template dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLocalTemplate, setSelectedLocalTemplate] = useState<LocalTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("UTILITY");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query local templates
  const { data: localTemplates, isLoading: isLoadingLocal } = useQuery({
    queryKey: ["whatsapp-templates-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as LocalTemplate[];
    },
  });

  // Load Meta templates on mount
  useEffect(() => {
    loadMetaTemplates();
  }, []);

  const loadMetaTemplates = async () => {
    setIsLoadingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      if (data?.success) {
        setMetaTemplates(data.templates || []);
      }
    } catch (err: any) {
      console.error("Error loading Meta templates:", err);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  // Find Meta template by name
  const findMetaTemplate = (wabaName: string | null): MetaTemplate | undefined => {
    if (!wabaName) return undefined;
    return metaTemplates.find(t => t.name === wabaName);
  };

  // Get WABA content for a linked template
  const getWabaContent = (template: MetaTemplate): { header?: string; body?: string; footer?: string } => {
    const result: { header?: string; body?: string; footer?: string } = {};
    
    for (const component of template.components || []) {
      if (component.type === "HEADER" && component.text) {
        result.header = component.text;
      } else if (component.type === "BODY" && component.text) {
        result.body = component.text;
      } else if (component.type === "FOOTER" && component.text) {
        result.footer = component.text;
      }
    }
    
    return result;
  };

  // Auto-sync all templates
  const handleAutoSync = async () => {
    setIsSyncing(true);
    try {
      const approvedMeta = metaTemplates.filter(t => t.status === "APPROVED");
      const localUnlinked = localTemplates?.filter(t => !t.waba_template_name) || [];
      
      const matches: { localId: string; localSlug: string; metaName: string; metaLanguage: string }[] = [];
      
      for (const local of localUnlinked) {
        // 1. Check explicit mapping first
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
        
        // 2. Try name similarity
        const match = approvedMeta.find(meta => {
          const metaNameNormalized = meta.name.toLowerCase();
          const slugNormalized = local.slug.toLowerCase();
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
      
      let successCount = 0;
      for (const match of matches) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({
            waba_template_name: match.metaName,
            waba_language: match.metaLanguage,
          })
          .eq("id", match.localId);
        
        if (!error) successCount++;
      }
      
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-linking"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      
      toast({
        title: "✅ Sincronização concluída!",
        description: `${successCount} template(s) vinculado(s)`,
      });
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Open create dialog for unlinked template
  const openCreateDialog = (template: LocalTemplate) => {
    setSelectedLocalTemplate(template);
    // Suggest name based on slug
    setTemplateName(template.slug.toLowerCase().replace(/-/g, "_"));
    // Convert local content to WABA format
    const lines = template.content.split("\n").filter(l => l.trim());
    if (lines.length > 0) {
      // First line as header
      setHeaderText(lines[0].replace(/\*/g, "").replace(/\{(\w+)\}/g, "{{$1}}").substring(0, 60));
      // Rest as body
      setBodyText(template.content.replace(/\{(\w+)\}/g, "{{$1}}"));
    } else {
      setBodyText(template.content.replace(/\{(\w+)\}/g, "{{$1}}"));
    }
    setFooterText("NotificaCondo");
    setShowCreateDialog(true);
  };

  // Submit new template to Meta
  const handleSubmitToMeta = async () => {
    if (!templateName.trim() || !bodyText.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e corpo são obrigatórios",
        variant: "destructive",
      });
      return;
    }

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
      
      if (headerText.trim()) {
        components.push({ type: "HEADER", format: "TEXT", text: headerText });
      }
      
      // Convert {var} to {{1}}, {{2}}, etc for Meta format
      let bodyConverted = bodyText;
      const vars = bodyText.match(/\{\{(\w+)\}\}/g) || [];
      vars.forEach((v, i) => {
        bodyConverted = bodyConverted.replace(v, `{{${i + 1}}}`);
      });
      
      const bodyComponent: any = { type: "BODY", text: bodyConverted };
      if (vars.length > 0) {
        bodyComponent.example = { body_text: [vars.map((_, i) => `exemplo_${i + 1}`)] };
      }
      components.push(bodyComponent);
      
      if (footerText.trim()) {
        components.push({ type: "FOOTER", text: footerText });
      }

      const { data, error } = await supabase.functions.invoke("create-waba-template", {
        body: {
          name: templateName,
          category: templateCategory,
          language: "pt_BR",
          components,
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Link the local template to the new Meta template
        if (selectedLocalTemplate) {
          await supabase
            .from("whatsapp_templates")
            .update({
              waba_template_name: templateName,
              waba_language: "pt_BR",
            })
            .eq("id", selectedLocalTemplate.id);
        }
        
        queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-linking"] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
        await loadMetaTemplates();
        
        toast({
          title: "✅ Template enviado!",
          description: `"${templateName}" foi enviado para aprovação da Meta`,
        });
        setShowCreateDialog(false);
        resetForm();
      } else {
        toast({
          title: "Erro ao enviar",
          description: data?.error || "Falha ao enviar template",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTemplateName("");
    setTemplateCategory("UTILITY");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setSelectedLocalTemplate(null);
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedTemplates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTemplates(newSet);
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
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const linkedCount = localTemplates?.filter(t => t.waba_template_name).length || 0;
  const unlinkedCount = localTemplates?.filter(t => !t.waba_template_name).length || 0;

  if (isLoadingLocal) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Vinculação com Templates WABA</CardTitle>
                <CardDescription>
                  Vincule templates locais com templates aprovados na Meta
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMetaTemplates}
                disabled={isLoadingMeta}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingMeta ? "animate-spin" : ""}`} />
              </Button>
              {unlinkedCount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAutoSync}
                  disabled={isSyncing || isLoadingMeta}
                  className="gap-2"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Sincronizar Todos
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-2xl font-bold">{localTemplates?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{linkedCount}</p>
              <p className="text-xs text-muted-foreground">Vinculados</p>
            </div>
            <div className="rounded-lg border bg-amber-500/10 border-amber-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{unlinkedCount}</p>
              <p className="text-xs text-muted-foreground">Não Vinculados</p>
            </div>
          </div>

          {/* Templates List */}
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {localTemplates?.map((template) => {
                const metaTemplate = findMetaTemplate(template.waba_template_name);
                const isLinked = !!template.waba_template_name;
                const isExpanded = expandedTemplates.has(template.id);
                const wabaContent = metaTemplate ? getWabaContent(metaTemplate) : null;

                return (
                  <Collapsible
                    key={template.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(template.id)}
                  >
                    <div className={`rounded-lg border transition-colors ${
                      isLinked 
                        ? "border-green-500/30 bg-green-500/5" 
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}>
                      <CollapsibleTrigger asChild>
                        <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="mt-0.5">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{template.name}</span>
                                  {isLinked ? (
                                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 text-xs">
                                      <Link2 className="h-3 w-3" />
                                      WABA
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <LinkIcon className="h-3 w-3" />
                                      Não Vinculado
                                    </Badge>
                                  )}
                                  {metaTemplate && getStatusBadge(metaTemplate.status)}
                                </div>
                                {isLinked && template.waba_template_name && (
                                  <p className="text-xs text-muted-foreground font-mono">
                                    Meta: {template.waba_template_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isLinked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreateDialog(template);
                                  }}
                                  className="gap-1.5 text-xs"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Enviar para Meta
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-4">
                          <div className="h-px bg-border" />
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Local Content */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                Template Local
                              </div>
                              <div className="rounded-lg bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                                {template.content}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {template.variables.map((v) => (
                                  <Badge key={v} variant="outline" className="text-xs">
                                    {`{${v}}`}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* WABA Content */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                                Conteúdo Aprovado (Meta)
                              </div>
                              {wabaContent ? (
                                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2 max-h-48 overflow-auto">
                                  {wabaContent.header && (
                                    <div>
                                      <span className="text-[10px] uppercase text-muted-foreground">Header</span>
                                      <p className="text-xs font-mono">{wabaContent.header}</p>
                                    </div>
                                  )}
                                  {wabaContent.body && (
                                    <div>
                                      <span className="text-[10px] uppercase text-muted-foreground">Body</span>
                                      <p className="text-xs font-mono whitespace-pre-wrap">{wabaContent.body}</p>
                                    </div>
                                  )}
                                  {wabaContent.footer && (
                                    <div>
                                      <span className="text-[10px] uppercase text-muted-foreground">Footer</span>
                                      <p className="text-xs font-mono">{wabaContent.footer}</p>
                                    </div>
                                  )}
                                </div>
                              ) : isLinked ? (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Template vinculado mas não encontrado na Meta</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Clique em "Atualizar" para recarregar os templates da Meta
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground">
                                  <p className="text-sm">Template não vinculado</p>
                                  <p className="text-xs mt-1">
                                    Clique em "Enviar para Meta" para submeter este template para aprovação
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Template para Aprovação
            </DialogTitle>
            <DialogDescription>
              {selectedLocalTemplate && (
                <>Enviando "{selectedLocalTemplate.name}" para aprovação na Meta</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template (Meta)</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="meu_template"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Apenas letras minúsculas, números e underscores
                </p>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cabeçalho (opcional)</Label>
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Título da mensagem"
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Corpo da Mensagem *</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Olá {{nome}}, sua {{tipo}} foi registrada..."
                className="font-mono text-sm min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variavel}}"} para variáveis dinâmicas
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rodapé (opcional)</Label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="NotificaCondo"
                maxLength={60}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitToMeta} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar para Aprovação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
