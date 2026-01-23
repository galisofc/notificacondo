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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  FileText
} from "lucide-react";
import { TemplatePreview } from "./TemplatePreview";
import { TEMPLATE_COLORS, getCategoryForSlug } from "./TemplateCategories";
import { DEFAULT_TEMPLATES } from "./DefaultTemplates";

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

  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon;

  // Update params order when variables change
  useEffect(() => {
    if (!template.params_order || template.params_order.length === 0) {
      setParamsOrder(template.variables);
    }
  }, [template.variables, template.params_order]);

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      content,
      name,
      description,
      waba_template_name,
      waba_language,
      params_order,
    }: {
      id: string;
      content: string;
      name: string;
      description: string;
      waba_template_name: string | null;
      waba_language: string;
      params_order: string[];
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
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
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
    updateMutation.mutate({
      id: template.id,
      content: editContent,
      name: editName,
      description: editDescription,
      waba_template_name: wabaTemplateName.trim() || null,
      waba_language: wabaLanguage,
      params_order: paramsOrder,
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
      <div className="flex-1 overflow-hidden">
        <div className={`grid h-full ${showPreview && activeTab === "content" ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor Panel */}
          <ScrollArea className="h-full">
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

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="waba-template-name" className="text-xs sm:text-sm">
                    Nome do Template WABA
                  </Label>
                  <Input
                    id="waba-template-name"
                    value={wabaTemplateName}
                    onChange={(e) => setWabaTemplateName(e.target.value)}
                    placeholder="ex: encomenda_chegou_v1"
                    className="h-9 sm:h-10 text-sm font-mono"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Nome exato do template como aprovado na Meta (sem espaços, apenas letras, números e underscores)
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

                <div className="rounded-lg border p-3 bg-muted/30">
                  <h4 className="text-xs font-medium mb-2">Preview do Payload WABA</h4>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    💡 Se o template tiver header de imagem dinâmica (ex: foto da encomenda), 
                    a URL será incluída automaticamente no campo "image".
                  </p>
                <pre className="text-[10px] sm:text-xs font-mono bg-background p-2 rounded overflow-x-auto">
{`{
  "templateName": "${wabaTemplateName || "nome_do_template"}",
  "language": "${wabaLanguage}",
  "image": "https://storage.../foto.jpg",
  "header": { "type": "image", "url": "..." },
  "params": [
${paramsOrder.map((p, i) => `    "${p}"`).join(",\n")}
  ]
}`}
                  </pre>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Preview Panel - Desktop only (only for content tab) */}
          {showPreview && activeTab === "content" && (
            <div className="border-l bg-muted/30 hidden lg:block overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview da Mensagem</span>
                </div>
                <TemplatePreview content={editContent} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Preview - Collapsible (only for content tab) */}
      {showPreview && activeTab === "content" && (
        <div className="lg:hidden border-t bg-muted/30 p-3 sm:p-4 max-h-[40vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-medium">Preview</span>
          </div>
          <TemplatePreview content={editContent} />
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
    </div>
  );
}
