import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  X, 
  Loader2, 
  RotateCcw, 
  Eye,
  EyeOff,
  Sparkles,
  GripVertical,
  MessageSquare,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Unlink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { TemplatePreview } from "./TemplatePreview";
import { TEMPLATE_COLORS, getCategoryForSlug, VARIABLE_EXAMPLES } from "./TemplateCategories";
import { DEFAULT_TEMPLATES } from "./DefaultTemplates";
import { WabaTemplateSelector } from "./WabaTemplateSelector";

interface ButtonConfig {
  type: "url" | "quick_reply" | "call";
  text: string;
  url_base?: string;
  has_dynamic_suffix?: boolean;
}

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  waba_template_name?: string | null;
  waba_language?: string | null;
  params_order?: string[] | null;
  button_config?: ButtonConfig | null;
}

interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text?: string; url?: string }>;
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  components?: MetaTemplateComponent[];
}

interface TemplateEditorProps {
  template: Template;
  onClose: () => void;
}

const WABA_LANGUAGES = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editContent, setEditContent] = useState(template.content);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description || "");
  const [showPreview, setShowPreview] = useState(true);
  
  // WABA fields
  const [wabaTemplateName, setWabaTemplateName] = useState(template.waba_template_name || "");
  const [wabaLanguage, setWabaLanguage] = useState(template.waba_language || "pt_BR");
  const [paramsOrder, setParamsOrder] = useState<string[]>(template.params_order || template.variables);
  const [activeTab, setActiveTab] = useState<"content" | "waba">("content");
  
  // Meta template content state
  const [metaTemplate, setMetaTemplate] = useState<MetaTemplate | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaLoadError, setMetaLoadError] = useState<string | null>(null);
  
  // Button configuration state - initialize from template
  const [hasButton, setHasButton] = useState(!!template.button_config);
  const [buttonType, setButtonType] = useState<"url" | "quick_reply" | "call">(
    template.button_config?.type || "url"
  );
  const [buttonText, setButtonText] = useState(template.button_config?.text || "Ver Detalhes");
  const [buttonUrlBase, setButtonUrlBase] = useState(template.button_config?.url_base || "");
  const [hasDynamicSuffix, setHasDynamicSuffix] = useState(template.button_config?.has_dynamic_suffix || false);
  
  // Test dialog state
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [testImageUrl, setTestImageUrl] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testPayloadFormat, setTestPayloadFormat] = useState<"meta" | "zpro_simplified">("meta");

  // Initialize test params when dialog opens
  const initializeTestParams = () => {
    const initialParams: Record<string, string> = {};
    paramsOrder.forEach((param) => {
      initialParams[param] = "";
    });
    setTestParams(initialParams);
    setTestImageUrl("");
    setTestResult(null);
    setTestPayloadFormat("meta");
  };

  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon;

  // Update params order when variables change
  useEffect(() => {
    if (!template.params_order || template.params_order.length === 0) {
      setParamsOrder(template.variables);
    }
  }, [template.variables, template.params_order]);

  // Fetch Meta template content when linked
  const fetchMetaTemplate = async () => {
    if (!wabaTemplateName) {
      setMetaTemplate(null);
      return;
    }

    setIsLoadingMeta(true);
    setMetaLoadError(null);

    try {
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;

      if (data?.success && data.templates) {
        const found = data.templates.find(
          (t: MetaTemplate) => t.name === wabaTemplateName && t.status === "APPROVED"
        );
        if (found) {
          setMetaTemplate(found);
        } else {
          setMetaLoadError("Template não encontrado ou não aprovado na Meta");
          setMetaTemplate(null);
        }
      }
    } catch (err: any) {
      console.error("Error fetching Meta template:", err);
      setMetaLoadError(err.message || "Erro ao carregar template da Meta");
    } finally {
      setIsLoadingMeta(false);
    }
  };

  // Load Meta template when wabaTemplateName changes
  useEffect(() => {
    if (wabaTemplateName) {
      fetchMetaTemplate();
    } else {
      setMetaTemplate(null);
      setMetaLoadError(null);
    }
  }, [wabaTemplateName]);

  // Extract Meta body content
  const metaBody = metaTemplate?.components?.find(c => c.type === "BODY");
  const metaHeader = metaTemplate?.components?.find(c => c.type === "HEADER");
  const metaFooter = metaTemplate?.components?.find(c => c.type === "FOOTER");
  const metaButtons = metaTemplate?.components?.find(c => c.type === "BUTTONS");

  // Determine which content to show in preview
  const isLinked = !!wabaTemplateName;
  const hasMetaContent = isLinked && metaBody?.text;

  // Replace Meta-style variables {{1}}, {{2}} with examples
  const replaceMetaVariables = (text: string) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
      const paramName = paramsOrder[parseInt(num) - 1];
      if (paramName && VARIABLE_EXAMPLES[paramName]) {
        return VARIABLE_EXAMPLES[paramName];
      }
      const examples = ["Residencial Primavera", "Maria Santos", "Advertência", "Barulho após horário permitido", "https://app.exemplo.com/xyz123"];
      return examples[parseInt(num) - 1] || match;
    });
  };

  // Get the content to display in preview
  const getPreviewContent = () => {
    if (hasMetaContent && metaBody?.text) {
      return replaceMetaVariables(metaBody.text);
    }
    return editContent.replace(/\{(\w+)\}/g, (match, variable) => {
      return VARIABLE_EXAMPLES[variable] || match;
    });
  };

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      content,
      name,
      description,
      waba_template_name,
      waba_language,
      params_order,
      button_config,
    }: {
      id: string;
      content: string;
      name: string;
      description: string;
      waba_template_name: string | null;
      waba_language: string;
      params_order: string[];
      button_config: ButtonConfig | null;
    }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ 
          content, 
          name, 
          description,
          waba_template_name: waba_template_name || null,
          waba_language,
          params_order,
          button_config: button_config as any,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
      toast({ title: "Template atualizado com sucesso!" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const defaultContent = DEFAULT_TEMPLATES[slug];
      if (!defaultContent) throw new Error("Template padrão não encontrado");

      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ content: defaultContent })
        .eq("id", id);

      if (error) throw error;
      return defaultContent;
    },
    onSuccess: (defaultContent) => {
      setEditContent(defaultContent);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "Template restaurado para o padrão!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao restaurar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Build button config if enabled
    const buttonConfig: ButtonConfig | null = hasButton
      ? {
          type: buttonType,
          text: buttonText,
          ...(buttonType === "url" && {
            url_base: buttonUrlBase,
            has_dynamic_suffix: hasDynamicSuffix,
          }),
        }
      : null;

    updateMutation.mutate({
      id: template.id,
      content: editContent,
      name: editName,
      description: editDescription,
      waba_template_name: wabaTemplateName.trim() || null,
      waba_language: wabaLanguage,
      params_order: paramsOrder,
      button_config: buttonConfig,
    });
  };

  const handleReset = () => {
    if (confirm("Tem certeza que deseja restaurar este template para o padrão?")) {
      resetMutation.mutate({ id: template.id, slug: template.slug });
    }
  };

  const insertVariable = (variable: string) => {
    setEditContent((prev) => prev + `{${variable}}`);
  };

  const handleTestWaba = async () => {
    if (!testPhone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Informe o número para teste",
        variant: "destructive",
      });
      return;
    }

    const templateToTest = wabaTemplateName.trim() || "hello_world";
    const languageToTest = wabaTemplateName.trim() ? wabaLanguage : "en_US";
    
    // Build params array in order
    const paramsArray = paramsOrder.map((param) => testParams[param] || `[${param}]`);

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-template-test", {
        body: {
          phone: testPhone.replace(/\D/g, ""),
          templateName: templateToTest,
          language: languageToTest,
          params: paramsArray.length > 0 ? paramsArray : undefined,
          mediaUrl: testImageUrl.trim() || undefined,
          payloadFormat: testPayloadFormat,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({
          success: true,
          message: `Template "${templateToTest}" enviado com sucesso!`,
        });
        toast({ title: "Teste enviado!", description: "Verifique o WhatsApp do número informado" });
      } else {
        setTestResult({
          success: false,
          message: data?.error || data?.message || "Erro desconhecido",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Erro ao enviar teste",
      });
      toast({
        title: "Erro no teste",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const moveParamUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...paramsOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setParamsOrder(newOrder);
  };

  const moveParamDown = (index: number) => {
    if (index === paramsOrder.length - 1) return;
    const newOrder = [...paramsOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setParamsOrder(newOrder);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {CategoryIcon && (
            <div className={`p-1.5 sm:p-2 rounded-lg ${category?.bgColor} shrink-0`}>
              <CategoryIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${category?.color}`} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-sm sm:text-lg truncate">Editar Template</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1 sm:gap-2 h-8 px-2 sm:px-3 text-xs sm:text-sm"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            <span className="hidden sm:inline">{showPreview ? "Ocultar" : "Preview"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-9 sm:w-9">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-3 sm:px-4">
        <button
          onClick={() => setActiveTab("content")}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "content"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Conteúdo</span>
        </button>
        <button
          onClick={() => setActiveTab("waba")}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "waba"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>WABA Template</span>
          {wabaTemplateName && (
            <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">
              Configurado
            </Badge>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`grid h-full ${showPreview && activeTab === "content" ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor Panel */}
          <ScrollArea className="h-[calc(90vh-180px)]">
            {activeTab === "content" ? (
              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="template-name" className="text-xs sm:text-sm">Nome do Template</Label>
                  <Input
                    id="template-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do template"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="template-description" className="text-xs sm:text-sm">Descrição</Label>
                  <Input
                    id="template-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Descrição breve do template"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>

                <Separator />

                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="template-content" className="text-xs sm:text-sm">Conteúdo da Mensagem</Label>
                    <Badge variant="outline" className="text-[10px] sm:text-xs gap-1 shrink-0">
                      <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      <span className="hidden xs:inline">Formatação</span> WhatsApp
                    </Badge>
                  </div>
                  <Textarea
                    id="template-content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[200px] sm:min-h-[300px] font-mono text-xs sm:text-sm resize-none"
                    placeholder="Digite o conteúdo da mensagem..."
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Use *texto* para <strong>negrito</strong>. Use {"{variavel}"} para dados dinâmicos.
                  </p>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Variáveis Disponíveis</Label>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
                    Toque para inserir
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {template.variables.map((variable) => (
                      <Badge
                        key={variable}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-[10px] sm:text-xs py-0.5 px-1.5 sm:py-1 sm:px-2"
                        onClick={() => insertVariable(variable)}
                      >
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 sm:p-4">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Configuração WABA (API Oficial)
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Configure aqui as informações do template aprovado na Meta para envio via API oficial do WhatsApp Business.
                    Os templates devem ser aprovados previamente no Meta Business Manager.
                  </p>
                </div>

                {/* Current Template Status */}
                {wabaTemplateName && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Template Vinculado
                      </p>
                      <p className="text-xs font-mono text-green-700 dark:text-green-300 truncate">
                        {wabaTemplateName} ({wabaLanguage})
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setWabaTemplateName("");
                        setWabaLanguage("pt_BR");
                      }}
                      className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Desvincular
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="waba-template-name" className="text-xs sm:text-sm">
                      Nome do Template WABA
                    </Label>
                    <WabaTemplateSelector
                      currentTemplateName={wabaTemplateName || null}
                      onSelect={(name, language) => {
                        setWabaTemplateName(name);
                        setWabaLanguage(language);
                      }}
                    />
                  </div>
                  <Input
                    id="waba-template-name"
                    value={wabaTemplateName}
                    onChange={(e) => setWabaTemplateName(e.target.value)}
                    placeholder="ex: encomenda_chegou_v1"
                    className="h-9 sm:h-10 text-sm font-mono"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Nome exato do template como aprovado na Meta. Você pode digitar manualmente ou selecionar da lista de templates aprovados.
                  </p>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="waba-language" className="text-xs sm:text-sm">
                    Idioma do Template
                  </Label>
                  <Select value={wabaLanguage} onValueChange={setWabaLanguage}>
                    <SelectTrigger className="h-9 sm:h-10 text-sm">
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      {WABA_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">
                    Ordem dos Parâmetros
                  </Label>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Organize as variáveis na ordem em que aparecem no template WABA.
                    Use os botões para reordenar.
                  </p>
                  
                  <div className="space-y-1.5 mt-2">
                    {paramsOrder.map((param, index) => (
                      <div
                        key={param}
                        className="flex items-center gap-2 p-2 rounded-md border bg-card"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="font-mono text-xs">
                          {`{{${index + 1}}}`}
                        </Badge>
                        <span className="text-sm flex-1">{param}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveParamUp(index)}
                            disabled={index === 0}
                          >
                            <span className="text-xs">↑</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveParamDown(index)}
                            disabled={index === paramsOrder.length - 1}
                          >
                            <span className="text-xs">↓</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Button Configuration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs sm:text-sm">Botão de Ação</Label>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Adicione um botão interativo ao template
                      </p>
                    </div>
                    <Switch
                      checked={hasButton}
                      onCheckedChange={setHasButton}
                    />
                  </div>

                  {hasButton && (
                    <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo do Botão</Label>
                        <Select value={buttonType} onValueChange={(v) => setButtonType(v as "url" | "quick_reply" | "call")}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="url">🔗 Abrir URL</SelectItem>
                            <SelectItem value="quick_reply">💬 Resposta Rápida</SelectItem>
                            <SelectItem value="call">📞 Ligar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Texto do Botão</Label>
                        <Input
                          value={buttonText}
                          onChange={(e) => setButtonText(e.target.value)}
                          placeholder="Ex: Ver Detalhes"
                          className="h-9 text-sm"
                          maxLength={25}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Máximo 25 caracteres
                        </p>
                      </div>

                      {buttonType === "url" && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">URL Base</Label>
                            <Input
                              value={buttonUrlBase}
                              onChange={(e) => setButtonUrlBase(e.target.value)}
                              placeholder="https://notificacondo.lovable.app/acesso/"
                              className="h-9 text-sm font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Sufixo Dinâmico</Label>
                              <p className="text-[10px] text-muted-foreground">
                                Adicionar variável ao final da URL (ex: token)
                              </p>
                            </div>
                            <Switch
                              checked={hasDynamicSuffix}
                              onCheckedChange={setHasDynamicSuffix}
                            />
                          </div>

                          {hasDynamicSuffix && (
                            <div className="rounded-lg bg-muted p-2 text-xs">
                              <p className="text-muted-foreground mb-1">URL final:</p>
                              <code className="font-mono text-[10px]">
                                {buttonUrlBase || "https://..."}{`{{1}}`}
                              </code>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Test Button */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Testar Envio WABA</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {wabaTemplateName 
                          ? `Enviar template "${wabaTemplateName}" para um número de teste`
                          : "Configure o nome do template acima ou teste com 'hello_world'"}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        initializeTestParams();
                        setShowTestDialog(true);
                      }}
                      className="shrink-0 gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Testar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Preview Panel - Desktop only (only for content tab) */}
          {showPreview && activeTab === "content" && (
            <div className="border-l bg-muted/30 hidden lg:block overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Preview da Mensagem</span>
                  </div>
                  {isLinked && (
                    <Badge 
                      variant={hasMetaContent ? "default" : "secondary"} 
                      className={`text-[10px] ${hasMetaContent ? "bg-green-600" : ""}`}
                    >
                      {hasMetaContent ? "Conteúdo Meta" : "Exemplo Local"}
                    </Badge>
                  )}
                </div>
                
                {/* Show loading state */}
                {isLinked && isLoadingMeta && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando conteúdo da Meta...
                  </div>
                )}

                {/* Show error state */}
                {isLinked && !isLoadingMeta && metaLoadError && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Conteúdo da Meta não disponível
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                        {metaLoadError}. Exibindo conteúdo local como exemplo.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchMetaTemplate}
                        className="mt-2 h-7 text-xs gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                )}

                {/* Meta preview with full components */}
                {hasMetaContent ? (
                  <div className="relative">
                    <div className="bg-[#0b141a] rounded-xl p-4 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0">
                          <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">Condomínio Legal</p>
                          <p className="text-white/60 text-xs">online</p>
                        </div>
                      </div>

                      {/* Chat area */}
                      <div className="pt-4 space-y-2">
                        <div className="flex justify-start">
                          <div className="max-w-[85%] bg-[#005C4B] rounded-lg rounded-tl-none p-3 shadow-sm relative">
                            <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-[#005C4B] border-l-[8px] border-l-transparent" />
                            
                            {/* Meta Header */}
                            {metaHeader?.text && (
                              <p className="text-white font-bold text-sm mb-2">
                                {replaceMetaVariables(metaHeader.text)}
                              </p>
                            )}
                            
                            {/* Body */}
                            <div className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed">
                              {getPreviewContent()}
                            </div>
                            
                            {/* Footer */}
                            {metaFooter?.text && (
                              <p className="text-white/60 text-[11px] mt-2 pt-2 border-t border-white/10">
                                {metaFooter.text}
                              </p>
                            )}
                            
                            {/* Buttons */}
                            {metaButtons?.buttons && metaButtons.buttons.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                                {metaButtons.buttons.map((btn, idx) => (
                                  <div 
                                    key={idx} 
                                    className="text-center py-1.5 text-[13px] text-[#00A884] font-medium"
                                  >
                                    {btn.text}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex justify-end mt-1">
                              <span className="text-white/40 text-[10px]">14:32</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
                      * Conteúdo aprovado pela Meta. Os valores são exemplos.
                    </p>
                  </div>
                ) : (
                  <div>
                    <TemplatePreview content={editContent} />
                    {isLinked && !isLoadingMeta && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 text-center italic">
                        * Exibindo conteúdo local como exemplo (Meta não carregado).
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Preview - Collapsible (only for content tab) */}
      {showPreview && activeTab === "content" && (
        <div className="lg:hidden border-t bg-muted/30 p-3 sm:p-4 max-h-[40vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm font-medium">Preview</span>
            </div>
            {isLinked && (
              <Badge 
                variant={hasMetaContent ? "default" : "secondary"} 
                className={`text-[10px] ${hasMetaContent ? "bg-green-600" : ""}`}
              >
                {hasMetaContent ? "Meta" : "Local"}
              </Badge>
            )}
          </div>
          {hasMetaContent ? (
            <div className="bg-[#0b141a] rounded-xl p-3 overflow-hidden">
              <div className="bg-[#005C4B] rounded-lg p-2 text-white/90 text-xs whitespace-pre-wrap">
                {metaHeader?.text && (
                  <p className="font-bold mb-1">{replaceMetaVariables(metaHeader.text)}</p>
                )}
                {getPreviewContent()}
                {metaFooter?.text && (
                  <p className="text-white/60 text-[10px] mt-2 pt-1 border-t border-white/10">{metaFooter.text}</p>
                )}
              </div>
            </div>
          ) : (
            <TemplatePreview content={editContent} />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 border-t bg-background">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={resetMutation.isPending}
          className="text-muted-foreground text-xs sm:text-sm h-9 order-2 sm:order-1"
        >
          <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          Restaurar Padrão
        </Button>
        <div className="flex gap-2 order-1 sm:order-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-9 text-xs sm:text-sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1 sm:flex-none h-9 text-xs sm:text-sm">
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Testar Template WABA</DialogTitle>
            <DialogDescription>
              {wabaTemplateName 
                ? `Enviar "${wabaTemplateName}" (${wabaLanguage}) para um número de teste`
                : "Enviar template 'hello_world' para verificar a conexão"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="test-phone">Número do WhatsApp *</Label>
              <Input
                id="test-phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5511999999999"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Digite o número com código do país (ex: 5511999999999)
              </p>
            </div>

            {/* Image URL (if template has media) */}
            {wabaTemplateName && (
              <div className="space-y-2">
                <Label htmlFor="test-image">URL da Imagem (Header)</Label>
                <Input
                  id="test-image"
                  value={testImageUrl}
                  onChange={(e) => setTestImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco se o template não usar imagem de cabeçalho
                </p>
              </div>
            )}

            {/* Payload format */}
            <div className="space-y-2">
              <Label className="text-sm">Formato do payload</Label>
              <Select value={testPayloadFormat} onValueChange={(v) => setTestPayloadFormat(v as any)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (padrão)</SelectItem>
                  <SelectItem value="zpro_simplified">Z-PRO (simplificado)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se o provedor estiver repassando o payload direto para a Meta, use “Meta (padrão)”.
              </p>
            </div>

            {/* Dynamic Params */}
            {wabaTemplateName && paramsOrder.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Parâmetros do Template</Label>
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
                  {paramsOrder.map((param, index) => (
                    <div key={param} className="space-y-1">
                      <Label htmlFor={`param-${param}`} className="text-xs flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] py-0">
                          {`{{${index + 1}}}`}
                        </Badge>
                        <span>{param}</span>
                      </Label>
                      <Input
                        id={`param-${param}`}
                        value={testParams[param] || ""}
                        onChange={(e) => setTestParams((prev) => ({ ...prev, [param]: e.target.value }))}
                        placeholder={`Valor para ${param}`}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Preencha os valores que serão substituídos no template
                </p>
              </div>
            )}

            {/* Result feedback */}
            {testResult && (
              <div className={`rounded-lg p-3 flex items-start gap-2 ${
                testResult.success 
                  ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" 
                  : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                )}
                <p className={`text-xs ${
                  testResult.success 
                    ? "text-green-700 dark:text-green-300" 
                    : "text-red-700 dark:text-red-300"
                }`}>
                  {testResult.message}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Fechar
            </Button>
            <Button onClick={handleTestWaba} disabled={isTesting}>
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Teste
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
