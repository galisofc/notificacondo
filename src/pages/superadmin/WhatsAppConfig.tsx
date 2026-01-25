import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Send, 
  TestTube, 
  CheckCircle, 
  XCircle,
  Phone,
  Settings,
  ArrowLeft,
  Shield,
  Zap,
  Info,
  ExternalLink,
  Clock,
  FileCheck,
  AlertTriangle,
  Copy
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

export default function WhatsAppConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [lastTestedAt, setLastTestedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem("whatsapp_last_tested_at");
    return stored ? new Date(stored) : null;
  });
  const [connectionInfo, setConnectionInfo] = useState<{
    phoneNumber?: string;
    businessName?: string;
  } | null>(null);
  const [isCheckingTemplates, setIsCheckingTemplates] = useState(false);
  const [templateStatusOpen, setTemplateStatusOpen] = useState(false);
  const [templateStatusData, setTemplateStatusData] = useState<{
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
  } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Persist lastTestedAt to localStorage
  useEffect(() => {
    if (lastTestedAt) {
      localStorage.setItem("whatsapp_last_tested_at", lastTestedAt.toISOString());
    }
  }, [lastTestedAt]);

  // Auto-test connection on page load
  useEffect(() => {
    const autoTestConnection = async () => {
      setIsTesting(true);
      setTestResult(null);
      setConnectionInfo(null);

      try {
        const { data, error } = await supabase.functions.invoke("test-whatsapp-connection", {
          body: {},
        });

        if (error) throw error;

        if (data?.success) {
          setTestResult("success");
          setLastTestedAt(new Date());
          setConnectionInfo({
            phoneNumber: data.phoneNumber,
            businessName: data.businessName,
          });
        } else {
          setTestResult("error");
          setLastTestedAt(new Date());
        }
      } catch (error) {
        setTestResult("error");
        setLastTestedAt(new Date());
      } finally {
        setIsTesting(false);
      }
    };

    autoTestConnection();
  }, []);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setConnectionInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp-connection", {
        body: {},
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult("success");
        setLastTestedAt(new Date());
        setConnectionInfo({
          phoneNumber: data.phoneNumber,
          businessName: data.businessName,
        });
        toast({ title: "✅ Conexão bem-sucedida com a Meta Cloud API!" });
      } else {
        setTestResult("error");
        setLastTestedAt(new Date());
        const errorCode = data?.errorCode;
        const errorMessage = data?.error || "Verifique as credenciais no Supabase Secrets.";
        
        toast({
          title: errorCode === "190" ? "Token inválido" : "Falha na conexão",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestResult("error");
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar à Meta Cloud API.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite um número de telefone para enviar o teste.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-test", {
        body: { phone: testPhone },
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: "✅ Mensagem enviada! Verifique seu WhatsApp." });
        setTestPhone("");
      } else {
        toast({
          title: "Erro ao enviar",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendTemplateTest = async () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite um número de telefone para enviar o template de teste.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTemplateTest(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-template-test", {
        body: { 
          phone: testPhone,
          templateName: "hello_world",
          language: "en_US"
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: "✅ Template enviado!", 
          description: "O template hello_world foi enviado. Verifique seu WhatsApp." 
        });
        setTestPhone("");
      } else {
        toast({
          title: "❌ Erro ao enviar template",
          description: data.error || "Falha ao enviar template",
          variant: "destructive",
        });
        console.error("[Template Test] Debug:", data.debug);
      }
    } catch (error: any) {
      console.error("[Template Test] Error:", error);
      toast({
        title: "Erro ao enviar template",
        description: error.message || "Não foi possível enviar o template de teste.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTemplateTest(false);
    }
  };

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
    return templateStatusData.templates.find(t => t.name === selectedTemplate);
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Configuração WhatsApp | Super Admin</title>
      </Helmet>

      <div className="space-y-4 sm:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs 
          items={[
            { label: "WhatsApp", href: "/superadmin/whatsapp" },
            { label: "Configuração" }
          ]} 
        />
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/superadmin/whatsapp")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-lg sm:text-xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
              Configuração WhatsApp
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
              Integração direta com a Meta WhatsApp Cloud API
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Meta Cloud API Info Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    Meta WhatsApp Cloud API
                    <Badge variant="secondary" className="text-xs">Oficial</Badge>
                  </CardTitle>
                  <CardDescription>
                    Integração direta com a API oficial do WhatsApp Business
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Credenciais Seguras</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      As credenciais são armazenadas de forma segura no Supabase Secrets
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Templates Aprovados</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Utilize templates aprovados pelo Meta Business Manager
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Para configurar ou alterar as credenciais, acesse o <strong>Supabase Secrets</strong> e atualize:
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">META_WHATSAPP_PHONE_ID</code> e
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">META_WHATSAPP_ACCESS_TOKEN</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Connection Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  Status da Conexão
                  {testResult === "success" && (
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Conectado
                    </Badge>
                  )}
                  {testResult === "error" && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1 text-xs">
                      <XCircle className="h-3 w-3" />
                      Falha
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Verifique se as credenciais estão configuradas corretamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionInfo && testResult === "success" && (
                  <div className="rounded-lg border bg-accent/50 border-accent p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Conta conectada</span>
                    </div>
                    {connectionInfo.businessName && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Empresa:</strong> {connectionInfo.businessName}
                      </p>
                    )}
                    {connectionInfo.phoneNumber && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Número:</strong> {connectionInfo.phoneNumber}
                      </p>
                    )}
                  </div>
                )}

                {testResult === "error" && (
                  <div className="rounded-lg border bg-destructive/10 border-destructive/20 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Falha na conexão</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Verifique se as credenciais estão corretas no Supabase Secrets.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="w-full gap-2"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Testar Conexão
                </Button>

                {lastTestedAt && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Último teste: {lastTestedAt.toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <a
                    href="https://business.facebook.com/settings/whatsapp-business-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Acessar Meta Business Manager
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Test Messages Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Enviar Mensagem de Teste</CardTitle>
                <CardDescription>
                  Teste o envio de mensagens pela Meta Cloud API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="test-phone" className="text-sm">Número de Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="test-phone"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (sem espaços ou traços)
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleSendTest}
                      disabled={isSendingTest || !testPhone}
                      className="w-full gap-2"
                    >
                      {isSendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar Mensagem de Texto
                    </Button>
                    <Button
                      onClick={handleSendTemplateTest}
                      disabled={isSendingTemplateTest || !testPhone}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      {isSendingTemplateTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Enviar Template WABA
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 O botão "Template WABA" envia o template <code className="bg-muted px-1 rounded">hello_world</code> para testar templates aprovados.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template Status Check Card */}
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
                  <Button
                    onClick={handleCheckTemplateStatus}
                    disabled={isCheckingTemplates}
                    className="gap-2"
                  >
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
                    <DialogDescription>
                      Lista de templates registrados na sua conta Meta Business
                    </DialogDescription>
                  </DialogHeader>
                  
                  {templateStatusData && (
                    <div className="space-y-4">
                      {!templateStatusData.configured ? (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            O secret <code className="bg-muted px-1 rounded">META_WHATSAPP_BUSINESS_ACCOUNT_ID</code> não está configurado.
                            Adicione-o no Supabase Secrets para verificar seus templates.
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
                              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{templateStatusData.approved || 0}</p>
                              <p className="text-xs text-muted-foreground">Aprovados</p>
                            </div>
                            <div className="rounded-lg border bg-yellow-500/10 border-yellow-500/20 p-3 text-center">
                              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{templateStatusData.pending || 0}</p>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTemplate(null)}
                                className="gap-2"
                              >
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
                                          <Badge variant="outline" className="text-xs">{template.category}</Badge>
                                          <Badge variant="outline" className="text-xs">{template.language}</Badge>
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
                                      <TableCell className="font-mono text-sm">
                                        {template.name}
                                      </TableCell>
                                      <TableCell>
                                        {getStatusBadge(template.status)}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {template.category}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {template.language}
                                      </TableCell>
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
                💡 Certifique-se de que o secret <code className="bg-muted px-1 rounded">META_WHATSAPP_BUSINESS_ACCOUNT_ID</code> está configurado.
              </p>
            </CardContent>
          </Card>

          {/* Configuration Secrets Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Credenciais Configuradas
              </CardTitle>
              <CardDescription>
                Secrets necessários para a integração com a Meta Cloud API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`rounded-lg border p-4 transition-colors ${testResult === "success" ? "border-green-500/50 bg-green-500/5" : testResult === "error" ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : testResult === "error" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <code className="text-sm font-mono">META_WHATSAPP_PHONE_ID</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ID do número de telefone configurado no Meta Business
                  </p>
                  {testResult === "success" && connectionInfo?.phoneNumber && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      ✓ {connectionInfo.phoneNumber}
                    </p>
                  )}
                </div>
                <div className={`rounded-lg border p-4 transition-colors ${testResult === "success" ? "border-green-500/50 bg-green-500/5" : testResult === "error" ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : testResult === "error" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <code className="text-sm font-mono">META_WHATSAPP_ACCESS_TOKEN</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token de acesso permanente gerado no Meta Business Manager
                  </p>
                  {testResult === "success" && connectionInfo?.businessName && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      ✓ {connectionInfo.businessName}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
