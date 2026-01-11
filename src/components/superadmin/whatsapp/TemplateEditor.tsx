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
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  X, 
  Loader2, 
  RotateCcw, 
  Eye,
  EyeOff,
  Sparkles
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
}

interface TemplateEditorProps {
  template: Template;
  onClose: () => void;
}

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editContent, setEditContent] = useState(template.content);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description || "");
  const [showPreview, setShowPreview] = useState(true);

  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon;

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      content,
      name,
      description,
    }: {
      id: string;
      content: string;
      name: string;
      description: string;
    }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ content, name, description })
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={`grid h-full ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor Panel */}
          <ScrollArea className="h-full">
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
          </ScrollArea>

          {/* Preview Panel - Desktop only */}
          {showPreview && (
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

      {/* Mobile Preview - Collapsible */}
      {showPreview && (
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
