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
  Image,
  File,
  Search,
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

const HEADER_TYPES = [
  { value: "NONE", label: "Sem Cabeçalho", icon: null },
  { value: "TEXT", label: "Texto", icon: FileText },
  { value: "IMAGE", label: "Imagem", icon: Image },
  { value: "DOCUMENT", label: "Documento", icon: File },
];

export function TemplateWabaLinkingCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  
  // Create new template dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLocalTemplate, setSelectedLocalTemplate] = useState<LocalTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("UTILITY");
  const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "DOCUMENT">("TEXT");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variableExamples, setVariableExamples] = useState<Record<string, string>>({});

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

  // Verify linked templates and unlink those not found in Meta
  const handleVerifyAndUnlink = async () => {
    setIsVerifying(true);
    try {
      // Reload Meta templates first to get fresh data
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      
      const freshMetaTemplates = data?.templates || [];
      setMetaTemplates(freshMetaTemplates);
      
      // Get all Meta template names
      const metaTemplateNames = new Set(freshMetaTemplates.map((t: MetaTemplate) => t.name));
      
      // Find local templates that are linked but don't exist in Meta
      const linkedTemplates = localTemplates?.filter(t => t.waba_template_name) || [];
      const orphanedTemplates = linkedTemplates.filter(t => !metaTemplateNames.has(t.waba_template_name!));
      
      if (orphanedTemplates.length === 0) {
        toast({
          title: "✅ Tudo certo!",
          description: "Todos os templates vinculados existem no Meta",
        });
        setIsVerifying(false);
        return;
      }
      
      // Unlink orphaned templates
      let successCount = 0;
      for (const template of orphanedTemplates) {
        const { error: updateError } = await supabase
          .from("whatsapp_templates")
          .update({
            waba_template_name: null,
            waba_language: null,
          })
          .eq("id", template.id);
        
        if (!updateError) successCount++;
      }
      
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-linking"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      
      toast({
        title: "✅ Verificação concluída!",
        description: `${successCount} template(s) desvinculado(s) - não existiam no Meta`,
      });
    } catch (err: any) {
      toast({
        title: "Erro na verificação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Sanitize header text for Meta API - remove emojis, asterisks, formatting
  const sanitizeHeaderText = (text: string): string => {
    return text
      // Remove emojis (unicode ranges for emojis)
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
      .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, Hourglass
      .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Various symbols
      .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Various symbols
      .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
      .replace(/[\u{25B6}]/gu, '')            // Play button
      .replace(/[\u{25C0}]/gu, '')            // Reverse button
      .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
      .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, Hot beverage
      .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
      .replace(/[\u{267F}]/gu, '')            // Wheelchair
      .replace(/[\u{2693}]/gu, '')            // Anchor
      .replace(/[\u{26A1}]/gu, '')            // High voltage
      .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
      .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, Baseball
      .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, Sun
      .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
      .replace(/[\u{26D4}]/gu, '')            // No entry
      .replace(/[\u{26EA}]/gu, '')            // Church
      .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, Golf
      .replace(/[\u{26F5}]/gu, '')            // Sailboat
      .replace(/[\u{26FA}]/gu, '')            // Tent
      .replace(/[\u{26FD}]/gu, '')            // Fuel pump
      // Remove asterisks and formatting characters
      .replace(/\*/g, '')
      // Remove newlines and carriage returns
      .replace(/[\r\n]/g, ' ')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim();
  };

  // Extract variables from body text
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  // Open create dialog for unlinked template
  const openCreateDialog = (template: LocalTemplate) => {
    setSelectedLocalTemplate(template);
    // Suggest name based on slug
    setTemplateName(template.slug.toLowerCase().replace(/-/g, "_"));
    // Convert local content to WABA format
    const convertedContent = template.content.replace(/\{(\w+)\}/g, "{{$1}}");
    const lines = template.content.split("\n").filter(l => l.trim());
    if (lines.length > 0) {
      // First line as header - sanitize for Meta API
      const rawHeader = lines[0].replace(/\{(\w+)\}/g, "{{$1}}");
      setHeaderType("TEXT");
      setHeaderText(sanitizeHeaderText(rawHeader).substring(0, 60));
      setHeaderMediaUrl("");
      // Rest as body
      setBodyText(convertedContent);
    } else {
      setHeaderType("NONE");
      setHeaderText("");
      setHeaderMediaUrl("");
      setBodyText(convertedContent);
    }
    setFooterText("Mensagem Automatica - NotificaCondo");
    
    // Initialize variable examples with defaults based on variable names
    const vars = extractVariables(convertedContent);
    const defaultExamples: Record<string, string> = {};
    vars.forEach(v => {
      // Generate sensible defaults based on common variable names
      const lowerV = v.toLowerCase();
      if (lowerV.includes('nome') || lowerV.includes('name')) {
        defaultExamples[v] = 'João Silva';
      } else if (lowerV.includes('condominio') || lowerV.includes('condominium')) {
        defaultExamples[v] = 'Residencial Exemplo';
      } else if (lowerV.includes('bloco') || lowerV.includes('block')) {
        defaultExamples[v] = 'Bloco A';
      } else if (lowerV.includes('apartamento') || lowerV.includes('apartment') || lowerV.includes('apto')) {
        defaultExamples[v] = '101';
      } else if (lowerV.includes('tipo') || lowerV.includes('type')) {
        defaultExamples[v] = 'Advertência';
      } else if (lowerV.includes('titulo') || lowerV.includes('title')) {
        defaultExamples[v] = 'Ocorrência Exemplo';
      } else if (lowerV.includes('link') || lowerV.includes('url')) {
        defaultExamples[v] = 'https://notificacondo.com.br/acesso';
      } else if (lowerV.includes('data') || lowerV.includes('date')) {
        defaultExamples[v] = '25/01/2026';
      } else if (lowerV.includes('valor') || lowerV.includes('value') || lowerV.includes('price')) {
        defaultExamples[v] = 'R$ 150,00';
      } else if (lowerV.includes('codigo') || lowerV.includes('code')) {
        defaultExamples[v] = '123456';
      } else if (lowerV.includes('porteiro') || lowerV.includes('porter')) {
        defaultExamples[v] = 'Carlos Portaria';
      } else if (lowerV.includes('rastreio') || lowerV.includes('tracking')) {
        defaultExamples[v] = 'BR123456789';
      } else if (lowerV.includes('encomenda') || lowerV.includes('package')) {
        defaultExamples[v] = 'Correios';
      } else if (lowerV.includes('justificativa')) {
        defaultExamples[v] = 'Motivo da decisão informado aqui';
      } else if (lowerV.includes('periodo') || lowerV.includes('period')) {
        defaultExamples[v] = 'Janeiro/2026';
      } else if (lowerV.includes('vencimento') || lowerV.includes('due')) {
        defaultExamples[v] = '10/02/2026';
      } else if (lowerV.includes('fatura') || lowerV.includes('invoice')) {
        defaultExamples[v] = 'FAT-202600001';
      } else if (lowerV.includes('metodo') || lowerV.includes('method')) {
        defaultExamples[v] = 'PIX';
      } else {
        defaultExamples[v] = `exemplo_${v}`;
      }
    });
    setVariableExamples(defaultExamples);
    
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
      
      // Build header component based on type
      if (headerType === "TEXT") {
        const sanitizedHeader = sanitizeHeaderText(headerText);
        if (sanitizedHeader) {
          components.push({ type: "HEADER", format: "TEXT", text: sanitizedHeader });
        }
      } else if (headerType === "IMAGE" && headerMediaUrl.trim()) {
        components.push({ 
          type: "HEADER", 
          format: "IMAGE",
          example: { 
            header_handle: [headerMediaUrl.trim()] 
          }
        });
      } else if (headerType === "DOCUMENT" && headerMediaUrl.trim()) {
        components.push({ 
          type: "HEADER", 
          format: "DOCUMENT",
          example: { 
            header_handle: [headerMediaUrl.trim()] 
          }
        });
      }
      
      // Convert {{varName}} to {{1}}, {{2}}, etc for Meta format
      let bodyConverted = bodyText;
      const vars = extractVariables(bodyText);
      const uniqueVars = [...new Set(vars)];
      
      // Create mapping of variable name to positional number
      const varMapping: Record<string, number> = {};
      uniqueVars.forEach((v, i) => {
        varMapping[v] = i + 1;
      });
      
      // Replace all occurrences with positional parameters
      uniqueVars.forEach((v) => {
        const regex = new RegExp(`\\{\\{${v}\\}\\}`, 'g');
        bodyConverted = bodyConverted.replace(regex, `{{${varMapping[v]}}}`);
      });
      
      const bodyComponent: any = { type: "BODY", text: bodyConverted };
      if (uniqueVars.length > 0) {
        // Use the user-provided examples for each variable
        const examples = uniqueVars.map(v => variableExamples[v] || `exemplo_${v}`);
        bodyComponent.example = { body_text: [examples] };
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
    setHeaderType("TEXT");
    setHeaderText("");
    setHeaderMediaUrl("");
    setBodyText("");
    setFooterText("");
    setSelectedLocalTemplate(null);
    setVariableExamples({});
  };
  
  // Get current variables from body text for the form
  const currentVariables = extractVariables(bodyText);

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyAndUnlink}
                disabled={isVerifying || isLoadingMeta}
                className="gap-2"
                title="Verifica templates vinculados e libera para edição os que não existem no Meta"
              >
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Verificar
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

            <div className="space-y-3">
              <Label>Cabeçalho (opcional)</Label>
              <div className="grid grid-cols-4 gap-2">
                {HEADER_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    type="button"
                    variant={headerType === type.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setHeaderType(type.value as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT");
                      if (type.value === "NONE") {
                        setHeaderText("");
                        setHeaderMediaUrl("");
                      }
                    }}
                    className="gap-1.5 text-xs"
                  >
                    {type.icon && <type.icon className="h-3.5 w-3.5" />}
                    {type.label}
                  </Button>
                ))}
              </div>
              
              {headerType === "TEXT" && (
                <div className="space-y-1">
                  <Input
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Título da mensagem"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo 60 caracteres. Sem emojis ou formatação especial.
                  </p>
                </div>
              )}
              
              {(headerType === "IMAGE" || headerType === "DOCUMENT") && (
                <div className="space-y-1">
                  <Input
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    placeholder={headerType === "IMAGE" 
                      ? "https://exemplo.com/imagem.jpg" 
                      : "https://exemplo.com/documento.pdf"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {headerType === "IMAGE" 
                      ? "URL pública da imagem (JPG, PNG). A imagem será usada como exemplo para aprovação."
                      : "URL pública do documento (PDF). O documento será usado como exemplo para aprovação."
                    }
                  </p>
                </div>
              )}
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

            {/* Variable Examples Section */}
            {currentVariables.length > 0 && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <Label className="text-sm font-medium">Exemplos das Variáveis (obrigatório para aprovação)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  A Meta exige exemplos para cada variável. Estes valores serão usados apenas para revisão.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentVariables.map((varName, index) => (
                    <div key={varName} className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {`{{${index + 1}}}`}
                        </Badge>
                        {varName}
                      </Label>
                      <Input
                        value={variableExamples[varName] || ''}
                        onChange={(e) => setVariableExamples(prev => ({
                          ...prev,
                          [varName]: e.target.value
                        }))}
                        placeholder={`Exemplo para ${varName}`}
                        className="text-sm h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

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
