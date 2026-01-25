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
  } | null>(null);

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
            phoneNumber: data.phone_info?.display_phone_number,
            businessName: data.phone_info?.verified_name,
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
                <div className="grid gap-4 sm:grid-cols-2">
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
