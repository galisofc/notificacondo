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
  Clock
} from "lucide-react";
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
    qualityRating?: string;
  } | null>(null);

  // Webhook status
  const [webhookStatus, setWebhookStatus] = useState<"checking" | "active" | "inactive" | "unknown">("checking");
  const [lastWebhookAt, setLastWebhookAt] = useState<string | null>(null);
  const [webhookCount24h, setWebhookCount24h] = useState<number>(0);
  const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);

  // Persist lastTestedAt to localStorage
  useEffect(() => {
    if (lastTestedAt) {
      localStorage.setItem("whatsapp_last_tested_at", lastTestedAt.toISOString());
    }
  }, [lastTestedAt]);

  // Check webhook status
  const checkWebhookStatus = async () => {
    setIsCheckingWebhook(true);
    try {
      const now = new Date();
      const last72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [lastLog, countResult] = await Promise.all([
        supabase
          .from("webhook_raw_logs")
          .select("id, created_at")
          .eq("source", "meta")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("webhook_raw_logs")
          .select("id", { count: "exact", head: true })
          .eq("source", "meta")
          .gte("created_at", last24h),
      ]);

      if (lastLog.error) throw lastLog.error;
      if (countResult.error) throw countResult.error;

      const eventsIn24h = countResult.count ?? 0;
      setWebhookCount24h(eventsIn24h);

      if (lastLog.data && lastLog.data.length > 0) {
        const lastDate = lastLog.data[0].created_at;
        const isActive = lastDate >= last72h;

        setLastWebhookAt(lastDate);
        setWebhookStatus(isActive ? "active" : "inactive");

        toast({
          title: isActive ? "Webhook ativo" : "Webhook sem eventos recentes",
          description: `Último evento: ${new Date(lastDate).toLocaleString("pt-BR")} • Eventos nas últimas 24h: ${eventsIn24h}`,
        });
      } else {
        setLastWebhookAt(null);
        setWebhookStatus("unknown");
        toast({
          title: "Nenhum webhook encontrado",
          description: "Ainda não há eventos recebidos da Meta neste ambiente.",
        });
      }
    } catch (error) {
      setWebhookStatus("unknown");
      toast({
        title: "Erro ao verificar webhook",
        description: error instanceof Error ? error.message : "Não foi possível consultar os eventos recebidos.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingWebhook(false);
    }
  };

  useEffect(() => { checkWebhookStatus(); }, []);


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
            phoneNumber: data.phone_info?.display_phone_number,
            businessName: data.phone_info?.verified_name,
            qualityRating: data.phone_info?.quality_rating,
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
          phoneNumber: data.phone_info?.display_phone_number,
          businessName: data.phone_info?.verified_name,
          qualityRating: data.phone_info?.quality_rating,
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

        {/* Connection Status - Full Width Hero Card */}
        <Card className={`transition-all ${testResult === "success" ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent" : testResult === "error" ? "border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent" : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"}`}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${testResult === "success" ? "bg-green-500/10" : testResult === "error" ? "bg-destructive/10" : "bg-primary/10"}`}>
                  <Zap className={`h-5 w-5 ${testResult === "success" ? "text-green-500" : testResult === "error" ? "text-destructive" : "text-primary"}`} />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    Meta WhatsApp Cloud API
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
                    {isTesting && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando...
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Integração oficial com a API do WhatsApp Business
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={handleTest}
                disabled={isTesting}
                variant={testResult === "success" ? "outline" : "default"}
                className="gap-2 shrink-0"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Testar Conexão
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Info */}
            {connectionInfo && testResult === "success" && (
              <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Empresa</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {connectionInfo.businessName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Número</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {connectionInfo.phoneNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Qualidade</p>
                    <Badge 
                      className={`text-xs ${
                        connectionInfo.qualityRating === "GREEN" 
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" 
                          : connectionInfo.qualityRating === "YELLOW"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                          : connectionInfo.qualityRating === "RED"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {connectionInfo.qualityRating || "—"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Versão da API</p>
                    <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                      v25.0
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {testResult === "error" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Falha na conexão. Verifique se as credenciais estão corretas no Supabase Secrets.
                </AlertDescription>
              </Alert>
            )}

            {/* Credentials Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-lg border p-4 transition-colors ${testResult === "success" ? "border-green-500/30 bg-green-500/5" : testResult === "error" ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : testResult === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  )}
                  <code className="text-xs font-mono font-medium">META_WHATSAPP_PHONE_ID</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  ID do número de telefone no Meta Business
                </p>
              </div>
              <div className={`rounded-lg border p-4 transition-colors ${testResult === "success" ? "border-green-500/30 bg-green-500/5" : testResult === "error" ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : testResult === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  )}
                  <code className="text-xs font-mono font-medium">META_WHATSAPP_ACCESS_TOKEN</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token de acesso permanente
                </p>
              </div>
            </div>

            {/* Last tested + Link */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t">
              {lastTestedAt ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Último teste: {lastTestedAt.toLocaleString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ) : (
                <div />
              )}
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

        {/* Webhook Status Card */}
        <Card className={`transition-all ${webhookStatus === "active" ? "border-green-500/30" : webhookStatus === "inactive" ? "border-yellow-500/30" : ""}`}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${webhookStatus === "active" ? "bg-green-500/10" : webhookStatus === "inactive" ? "bg-yellow-500/10" : "bg-muted/30"}`}>
                  <Zap className={`h-5 w-5 ${webhookStatus === "active" ? "text-green-600" : webhookStatus === "inactive" ? "text-yellow-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    Webhook
                    {webhookStatus === "active" && (
                      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1 text-xs">
                        <CheckCircle className="h-3 w-3" />
                        Ativo
                      </Badge>
                    )}
                    {webhookStatus === "inactive" && (
                      <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        Inativo (+72h)
                      </Badge>
                    )}
                    {webhookStatus === "unknown" && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        Sem dados
                      </Badge>
                    )}
                    {webhookStatus === "checking" && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando...
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Status real baseado nos webhooks recebidos da Meta
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                onClick={checkWebhookStatus}
                disabled={isCheckingWebhook}
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
              >
                {isCheckingWebhook ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Verificar agora
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            {webhookStatus !== "checking" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Último webhook</p>
                  <p className="text-sm font-medium">
                    {lastWebhookAt
                      ? new Date(lastWebhookAt).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "Nenhum recebido"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Eventos (24h)</p>
                  <p className="text-sm font-medium">{webhookCount24h}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className={`text-sm font-medium ${webhookStatus === "active" ? "text-green-600 dark:text-green-400" : webhookStatus === "inactive" ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                    {webhookStatus === "active" ? "Recebendo eventos" : webhookStatus === "inactive" ? "Sem eventos recentes" : "Nenhum dado"}
                  </p>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="text-xs break-all flex-1">
                    {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'iyeljkdrypcxvljebqtn'}.supabase.co/functions/v1/whatsapp-webhook`}
                  </code>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Eventos Assinados</Label>
                <div className="flex flex-wrap gap-1.5">
                  {["messages", "message_status", "message_template_status_update"].map((evt) => (
                    <Badge key={evt} variant="outline" className="text-[10px] font-mono">
                      {evt}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Token de Verificação</Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="text-xs font-mono text-muted-foreground">META_WEBHOOK_VERIFY_TOKEN</code>
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="h-2.5 w-2.5 mr-1" />
                    Configurado
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Configure a URL acima no painel de Webhooks do Meta App Dashboard
              </p>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Abrir Meta App Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Test Messages Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Enviar Mensagem de Teste</CardTitle>
                <CardDescription>
                  Valide a integração enviando mensagens de teste
                </CardDescription>
              </div>
            </div>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={handleSendTest}
                disabled={isSendingTest || !testPhone}
                className="gap-2"
              >
                {isSendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Mensagem de Texto
              </Button>
              <Button
                onClick={handleSendTemplateTest}
                disabled={isSendingTemplateTest || !testPhone}
                variant="outline"
                className="gap-2"
              >
                {isSendingTemplateTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Template hello_world
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Use "Mensagem de Texto" para testar envios diretos ou "Template hello_world" para validar templates aprovados pelo Meta.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
