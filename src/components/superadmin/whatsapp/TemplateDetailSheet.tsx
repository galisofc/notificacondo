import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Link2,
  LinkIcon,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
  FileText,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Copy,
} from "lucide-react";
import { getCategoryForSlug, VARIABLE_EXAMPLES } from "./TemplateCategories";

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
    buttons?: Array<{ type: string; text?: string; url?: string }>;
  }>;
}

interface TemplateDetailSheetProps {
  template: LocalTemplate | null;
  metaTemplate?: MetaTemplate;
  onClose: () => void;
  onRefresh: () => void;
}

export function TemplateDetailSheet({
  template,
  metaTemplate,
  onClose,
  onRefresh,
}: TemplateDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);

  if (!template) return null;

  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon || MessageSquare;
  const isLinked = !!template.waba_template_name;

  // Extract Meta WABA components for preview
  const metaHeader = metaTemplate?.components?.find(c => c.type === "HEADER");
  const metaBody = metaTemplate?.components?.find(c => c.type === "BODY");
  const metaFooter = metaTemplate?.components?.find(c => c.type === "FOOTER");
  const metaButtons = metaTemplate?.components?.find(c => c.type === "BUTTONS");

  // Use Meta content if linked and available, otherwise use local content
  const contentToPreview = (isLinked && metaBody?.text) ? metaBody.text : template.content;

  // Replace Meta-style variables {{1}}, {{2}} with examples
  const replaceMetaVariables = (text: string) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
      const examples = ["Residencial Primavera", "Maria Santos", "Advertência", "Barulho após horário permitido", "https://app.exemplo.com/xyz123"];
      return examples[parseInt(num) - 1] || match;
    });
  };

  // Replace local-style variables {nome} with examples
  const replaceLocalVariables = (text: string) => {
    return text.replace(/\{(\w+)\}/g, (match, variable) => VARIABLE_EXAMPLES[variable] || `[${variable}]`);
  };

  // Get preview content with example values
  const previewContent = isLinked && metaBody?.text
    ? replaceMetaVariables(contentToPreview)
    : replaceLocalVariables(contentToPreview);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ waba_template_name: null, waba_language: null })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: "Template desvinculado",
        description: "Você pode vincular novamente a qualquer momento",
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Erro ao desvincular",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
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

  const getQualityBadge = () => {
    if (!metaTemplate?.quality_score) return null;
    
    const config = {
      GREEN: { icon: ShieldCheck, color: "text-green-600 border-green-500/30 bg-green-500/10", label: "Qualidade Alta" },
      YELLOW: { icon: ShieldAlert, color: "text-yellow-600 border-yellow-500/30 bg-yellow-500/10", label: "Qualidade Média" },
      RED: { icon: ShieldX, color: "text-red-600 border-red-500/30 bg-red-500/10", label: "Qualidade Baixa" },
    }[metaTemplate.quality_score];
    
    if (!config) return null;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={`gap-1 ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Sheet open={!!template} onOpenChange={() => onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-lg ${category?.bgColor || "bg-muted"} ${category?.color || ""}`}>
                <CategoryIcon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-left">{template.name}</SheetTitle>
                <SheetDescription className="text-left">
                  {template.description || "Sem descrição"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6 py-4">
            {/* Status Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                {isLinked ? <Link2 className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
                Status de Vinculação
              </h4>
              
              <div className={`rounded-lg p-4 ${isLinked ? "bg-green-500/10 border border-green-500/20" : "bg-muted"}`}>
                {isLinked ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Template Meta:</span>
                      <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                        {template.waba_template_name}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Idioma:</span>
                      <span className="text-sm">{template.waba_language || "pt_BR"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {getStatusBadge(metaTemplate?.status)}
                    </div>
                    {metaTemplate?.category && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Categoria:</span>
                        <Badge variant="outline" className="text-xs">
                          {metaTemplate.category === "UTILITY" ? "Utilitário" : 
                           metaTemplate.category === "MARKETING" ? "Marketing" : 
                           metaTemplate.category}
                        </Badge>
                      </div>
                    )}
                    {metaTemplate?.quality_score && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Qualidade:</span>
                        {getQualityBadge()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Este template não está vinculado à Meta. Use a página de vinculação para enviar para aprovação.
                    </p>
                  </div>
                )}
              </div>

              {metaTemplate?.rejected_reason && (
                <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20">
                  <p className="text-sm font-medium text-red-600 mb-1">Motivo da Rejeição:</p>
                  <p className="text-sm text-muted-foreground">{metaTemplate.rejected_reason}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Content Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview da Mensagem
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(template.content, "Conteúdo")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="rounded-lg bg-[#0B141A] p-4 space-y-2">
                <div className="bg-[#005C4B] text-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                  {/* Meta Header */}
                  {isLinked && metaHeader?.text && (
                    <p className="text-sm font-bold mb-2">{replaceMetaVariables(metaHeader.text)}</p>
                  )}
                  {/* Body */}
                  <p className="text-sm whitespace-pre-wrap">{previewContent}</p>
                  {/* Meta Footer */}
                  {isLinked && metaFooter?.text && (
                    <p className="text-[11px] text-white/70 mt-2 pt-2 border-t border-white/10">
                      {metaFooter.text}
                    </p>
                  )}
                  {/* Meta Buttons */}
                  {isLinked && metaButtons?.buttons && metaButtons.buttons.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                      {metaButtons.buttons.map((btn, idx) => (
                        <div 
                          key={idx} 
                          className="text-center py-1.5 text-[13px] text-[#00A884] font-medium flex items-center justify-center gap-1.5"
                        >
                          {btn.type === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
                          {btn.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-white/60 text-right mt-1">12:00</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Variables */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Variáveis ({template.variables.length})
              </h4>
              
              {template.variables.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="outline" className="font-mono text-xs">
                      {`{${variable}}`}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma variável</p>
              )}
            </div>

            {/* Meta Content (if linked) */}
            {metaTemplate?.components && metaTemplate.components.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Componentes WABA
                  </h4>
                  
                  <div className="space-y-2">
                    {metaTemplate.components.map((component, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs uppercase">
                            {component.type}
                          </Badge>
                          {component.format && (
                            <Badge variant="outline" className="text-xs">
                              {component.format}
                            </Badge>
                          )}
                        </div>
                        {component.text && (
                          <p className="text-sm font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap">
                            {component.text}
                          </p>
                        )}
                        {component.buttons && component.buttons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {component.buttons.map((btn, btnIdx) => (
                              <Badge key={btnIdx} variant="outline" className="gap-1">
                                {btn.type === "URL" && "🔗"}
                                {btn.type === "PHONE_NUMBER" && "📞"}
                                {btn.type === "QUICK_REPLY" && "💬"}
                                {btn.text}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isLinked ? (
                <Button
                  variant="outline"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="gap-2 text-amber-600 hover:text-amber-700"
                >
                  {isUnlinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Desvincular Template
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Para vincular este template, use o botão "Enviar para Meta" na seção de status acima.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
