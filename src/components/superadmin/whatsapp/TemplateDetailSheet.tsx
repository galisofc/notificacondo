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
  Send,
  Pencil,
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
  onEdit?: (template: LocalTemplate) => void;
  onSubmitToMeta?: (template: LocalTemplate) => void;
}

export function TemplateDetailSheet({
  template,
  metaTemplate,
  onClose,
  onRefresh,
  onEdit,
  onSubmitToMeta,
}: TemplateDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);

  if (!template) return null;

  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon || MessageSquare;
  const isLinked = !!template.waba_template_name;

  // Extract Meta WABA components for preview
  const getMetaComponent = (type: string) =>
    metaTemplate?.components?.find((component) => component.type?.toUpperCase() === type);

  const metaHeader = getMetaComponent("HEADER");
  const metaBody = getMetaComponent("BODY");
  const metaFooter = getMetaComponent("FOOTER");
  const metaButtons = getMetaComponent("BUTTONS");

  const metaBodyText = metaBody?.text?.trim() || "";
  const localBodyText = template.content?.trim() || "";
  const headerFallbackText = metaHeader?.text?.trim() || "";

  const replaceTemplateVariables = (text: string) => {
    const numericExamples = [
      "Residencial Primavera",
      "Maria Santos",
      "Advertência",
      "Barulho após horário permitido",
      "https://app.exemplo.com/xyz123",
    ];

    return text
      .replace(/\{\{(\d+)\}\}/g, (match, num) => numericExamples[parseInt(num, 10) - 1] || match)
      .replace(/\{\{(\w+)\}\}/g, (match, variable) => VARIABLE_EXAMPLES[variable] || `[${variable}]`)
      .replace(/\{(\w+)\}/g, (match, variable) => VARIABLE_EXAMPLES[variable] || `[${variable}]`);
  };

  const contentToPreview = metaBodyText || localBodyText || headerFallbackText;
  const previewContent = contentToPreview ? replaceTemplateVariables(contentToPreview) : "";
  const hasPreviewContent = previewContent.trim().length > 0;
  const previewCopyValue = contentToPreview || template.description || template.name;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const handleUnlink = async () => {
    if (!template) return;
    setIsUnlinking(true);
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ waba_template_name: null, waba_language: null })
        .eq("id", template.id);
      if (error) throw error;
      toast({ title: "Template desvinculado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Erro ao desvincular", description: err.message, variant: "destructive" });
    } finally {
      setIsUnlinking(false);
    }
  };

  const getStatusInfo = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED": return { icon: ShieldCheck, label: "Aprovado", color: "text-green-600", bg: "bg-green-500/10" };
      case "REJECTED": return { icon: ShieldX, label: "Rejeitado", color: "text-red-600", bg: "bg-red-500/10" };
      case "PENDING": return { icon: ShieldAlert, label: "Pendente", color: "text-amber-600", bg: "bg-amber-500/10" };
      default: return { icon: Clock, label: status || "Desconhecido", color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const statusInfo = metaTemplate ? getStatusInfo(metaTemplate.status) : null;
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <>
      <Sheet open={!!template} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CategoryIcon className="h-5 w-5" />
              {template.name}
            </SheetTitle>
            <SheetDescription>{template.description}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Status & Link Info */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? "Ativo" : "Inativo"}
              </Badge>
              {isLinked ? (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
                  <Link2 className="h-3 w-3" />
                  {template.waba_template_name}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <LinkIcon className="h-3 w-3" />
                  Não vinculado
                </Badge>
              )}
              {statusInfo && (
                <Badge variant="outline" className={`gap-1 ${statusInfo.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo.label}
                </Badge>
              )}
            </div>

            {metaTemplate?.rejected_reason && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Motivo da rejeição:</p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">{metaTemplate.rejected_reason}</p>
              </div>
            )}

            <Separator />

            {/* Content Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview da Mensagem
                  {isLinked && (
                    <Badge
                      variant={metaBodyText ? "default" : "secondary"}
                      className={`text-[10px] ${metaBodyText ? "bg-green-500" : ""}`}
                    >
                      {metaBodyText ? "Conteúdo Meta" : "Conteúdo Local"}
                    </Badge>
                  )}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(previewCopyValue, "Conteúdo")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              {isLinked && !metaBodyText && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Conteúdo da Meta não carregado
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      Clique em "Atualizar Meta" para ver o conteúdo aprovado. Exibindo conteúdo local.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-[#0B141A] p-4 space-y-2">
                <div className="bg-[#005C4B] text-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                  {isLinked && metaHeader?.text && (
                    <p className="text-sm font-bold mb-2">{replaceTemplateVariables(metaHeader.text)}</p>
                  )}

                  {hasPreviewContent ? (
                    <p className="text-sm whitespace-pre-wrap">{previewContent}</p>
                  ) : (
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      Nenhum conteúdo disponível para este template ainda.
                    </p>
                  )}

                  {isLinked && metaFooter?.text && (
                    <p className="text-[11px] text-white/70 mt-2 pt-2 border-t border-white/10">
                      {replaceTemplateVariables(metaFooter.text)}
                    </p>
                  )}

                  {isLinked && metaButtons?.buttons && metaButtons.buttons.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/10 space-y-1">
                      {metaButtons.buttons.map((btn, idx) => (
                        <div
                          key={idx}
                          className="text-center py-1.5 text-[13px] text-[#00A884] font-medium flex items-center justify-center gap-1.5"
                        >
                          {btn.type?.toUpperCase() === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
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
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => onSubmitToMeta?.(template)}
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Aprovação da Meta
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => onEdit?.(template)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Template
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
