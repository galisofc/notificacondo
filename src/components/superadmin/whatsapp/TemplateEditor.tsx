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
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {CategoryIcon && (
            <div className={`p-2 rounded-lg ${category?.bgColor}`}>
              <CategoryIcon className={`h-5 w-5 ${category?.color}`} />
            </div>
          )}
          <div>
            <h2 className="font-semibold text-lg">Editar Template</h2>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Ocultar Preview" : "Mostrar Preview"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={`grid h-full ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor Panel */}
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do template"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Descrição</Label>
                <Input
                  id="template-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição breve do template"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" />
                    Formatação WhatsApp
                  </Badge>
                </div>
                <Textarea
                  id="template-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[300px] font-mono text-sm resize-none"
                  placeholder="Digite o conteúdo da mensagem..."
                />
                <p className="text-xs text-muted-foreground">
                  Use *texto* para <strong>negrito</strong>. Use {"{variavel}"} para inserir dados dinâmicos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Variáveis Disponíveis</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Clique para inserir no cursor
                </p>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <Badge
                      key={variable}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => insertVariable(variable)}
                    >
                      {`{${variable}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Preview Panel */}
          {showPreview && (
            <div className="border-l bg-muted/30 hidden lg:block">
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

      {/* Mobile Preview */}
      {showPreview && (
        <div className="lg:hidden border-t bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Preview</span>
          </div>
          <TemplatePreview content={editContent} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-background">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={resetMutation.isPending}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar Padrão
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Template
          </Button>
        </div>
      </div>
    </div>
  );
}
