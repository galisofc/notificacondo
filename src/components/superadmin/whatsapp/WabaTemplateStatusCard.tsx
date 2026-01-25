import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileCheck,
  AlertTriangle,
  ArrowLeft,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateStatusData {
  configured: boolean;
  templates?: Array<{
    name: string;
    status: string;
    category: string;
    language: string;
    qualityScore?: string;
    rejectedReason?: string;
    components?: Array<{
      type: string;
      format?: string;
      text?: string;
      example?: any;
      buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string }>;
    }>;
  }>;
  total?: number;
  approved?: number;
  pending?: number;
  rejected?: number;
  error?: string;
}

export function WabaTemplateStatusCard() {
  const { toast } = useToast();
  const [isCheckingTemplates, setIsCheckingTemplates] = useState(false);
  const [templateStatusOpen, setTemplateStatusOpen] = useState(false);
  const [templateStatusData, setTemplateStatusData] = useState<TemplateStatusData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleCheckTemplateStatus = async () => {
    setIsCheckingTemplates(true);
    setTemplateStatusData(null);

    try {
      const { data, error } = await supabase.functions.invoke("check-whatsapp-template-status", {
        body: {},
      });

      if (error) throw error;

      setTemplateStatusData(data);
      setTemplateStatusOpen(true);

      if (!data?.configured) {
        toast({
          title: "Configuração incompleta",
          description: "O META_WHATSAPP_BUSINESS_ACCOUNT_ID não está configurado.",
          variant: "destructive",
        });
      } else if (data?.templates?.length === 0) {
        toast({
          title: "Nenhum template encontrado",
          description: "Não foram encontrados templates na sua conta Meta Business.",
        });
      }
    } catch (error: any) {
      console.error("[Template Status] Error:", error);
      toast({
        title: "Erro ao verificar templates",
        description: error.message || "Não foi possível verificar o status dos templates.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingTemplates(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1">
            <CheckCircle className="h-3 w-3" />
            Aprovado
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <XCircle className="h-3 w-3" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case "HEADER":
        return "📋";
      case "BODY":
        return "📝";
      case "FOOTER":
        return "📎";
      case "BUTTONS":
        return "🔘";
      default:
        return "📄";
    }
  };

  const getSelectedTemplateData = () => {
    if (!selectedTemplate || !templateStatusData?.templates) return null;
    return templateStatusData.templates.find((t) => t.name === selectedTemplate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Status dos Templates WABA
        </CardTitle>
        <CardDescription>
          Verifique o status de aprovação dos seus templates no Meta Business Manager
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Consulte a API da Meta para verificar se seus templates estão aprovados e prontos para uso.
        </p>

        <Dialog open={templateStatusOpen} onOpenChange={setTemplateStatusOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCheckTemplateStatus} disabled={isCheckingTemplates} className="gap-2">
              {isCheckingTemplates ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4" />
              )}
              Verificar Status dos Templates
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Status dos Templates WABA
              </DialogTitle>
              <DialogDescription>Lista de templates registrados na sua conta Meta Business</DialogDescription>
            </DialogHeader>

            {templateStatusData && (
              <div className="space-y-4">
                {!templateStatusData.configured ? (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      O secret <code className="bg-muted px-1 rounded">META_WHATSAPP_BUSINESS_ACCOUNT_ID</code> não está
                      configurado. Adicione-o no Supabase Secrets para verificar seus templates.
                    </AlertDescription>
                  </Alert>
                ) : templateStatusData.error ? (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{templateStatusData.error}</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">{templateStatusData.total || 0}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-3 text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {templateStatusData.approved || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Aprovados</p>
                      </div>
                      <div className="rounded-lg border bg-yellow-500/10 border-yellow-500/20 p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {templateStatusData.pending || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Pendentes</p>
                      </div>
                      <div className="rounded-lg border bg-destructive/10 border-destructive/20 p-3 text-center">
                        <p className="text-2xl font-bold text-destructive">{templateStatusData.rejected || 0}</p>
                        <p className="text-xs text-muted-foreground">Rejeitados</p>
                      </div>
                    </div>

                    {/* Templates Table or Detail View */}
                    {selectedTemplate ? (
                      <div className="space-y-4">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="gap-2">
                          <ArrowLeft className="h-4 w-4" />
                          Voltar para lista
                        </Button>

                        {(() => {
                          const template = getSelectedTemplateData();
                          if (!template) return null;

                          return (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 pb-3 border-b">
                                <div>
                                  <h3 className="font-mono font-semibold text-lg">{template.name}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(template.status)}
                                    <Badge variant="outline" className="text-xs">
                                      {template.category}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {template.language}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {template.rejectedReason && (
                                <Alert variant="destructive">
                                  <XCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    <strong>Motivo da rejeição:</strong> {template.rejectedReason}
                                  </AlertDescription>
                                </Alert>
                              )}

                              <ScrollArea className="h-[320px]">
                                <div className="space-y-4 pr-4">
                                  {template.components && template.components.length > 0 ? (
                                    template.components.map((component, idx) => (
                                      <div key={idx} className="rounded-lg border p-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">{getComponentIcon(component.type)}</span>
                                            <span className="font-semibold text-sm uppercase tracking-wide">
                                              {component.type}
                                            </span>
                                            {component.format && (
                                              <Badge variant="secondary" className="text-xs">
                                                {component.format}
                                              </Badge>
                                            )}
                                          </div>
                                          {component.text && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                navigator.clipboard.writeText(component.text || "");
                                                toast({
                                                  title: "✅ Copiado!",
                                                  description: `Conteúdo do ${component.type} copiado para a área de transferência.`,
                                                });
                                              }}
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                        </div>

                                        {component.text && (
                                          <div className="bg-muted/50 rounded-md p-3 font-mono text-sm whitespace-pre-wrap">
                                            {component.text}
                                          </div>
                                        )}

                                        {component.buttons && component.buttons.length > 0 && (
                                          <div className="mt-3 space-y-2">
                                            <p className="text-xs text-muted-foreground font-medium">Botões:</p>
                                            <div className="flex flex-wrap gap-2">
                                              {component.buttons.map((btn, btnIdx) => (
                                                <Badge key={btnIdx} variant="outline" className="gap-1 text-xs py-1">
                                                  {btn.type === "URL" && "🔗"}
                                                  {btn.type === "PHONE_NUMBER" && "📞"}
                                                  {btn.type === "QUICK_REPLY" && "💬"}
                                                  {btn.text || btn.url || btn.phone_number}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {component.example && (
                                          <details className="mt-3">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                              Ver exemplo de parâmetros
                                            </summary>
                                            <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto">
                                              {JSON.stringify(component.example, null, 2)}
                                            </pre>
                                          </details>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center text-muted-foreground py-8">
                                      Nenhum componente encontrado para este template
                                    </div>
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Idioma</TableHead>
                              <TableHead>Qualidade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {templateStatusData.templates?.map((template, index) => (
                              <TableRow
                                key={index}
                                className="cursor-pointer hover:bg-accent/50"
                                onClick={() => setSelectedTemplate(template.name)}
                              >
                                <TableCell className="font-mono text-sm">{template.name}</TableCell>
                                <TableCell>{getStatusBadge(template.status)}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{template.category}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{template.language}</TableCell>
                                <TableCell>
                                  {template.qualityScore ? (
                                    <Badge variant="outline" className="text-xs">
                                      {template.qualityScore}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!templateStatusData.templates || templateStatusData.templates.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  Nenhum template encontrado
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground">
          💡 Certifique-se de que o secret{" "}
          <code className="bg-muted px-1 rounded">META_WHATSAPP_BUSINESS_ACCOUNT_ID</code> está configurado.
        </p>
      </CardContent>
    </Card>
  );
}
