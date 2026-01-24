import { useState } from "react";
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
  ExternalLink
} from "lucide-react";

export default function WhatsAppConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [connectionInfo, setConnectionInfo] = useState<{
    phoneNumber?: string;
    businessName?: string;
  } | null>(null);

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
        setConnectionInfo({
          phoneNumber: data.phoneNumber,
          businessName: data.businessName,
        });
        toast({ title: "✅ Conexão bem-sucedida com a Meta Cloud API!" });
      } else {
        setTestResult("error");
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
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <code className="text-sm font-mono">META_WHATSAPP_PHONE_ID</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ID do número de telefone configurado no Meta Business
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <code className="text-sm font-mono">META_WHATSAPP_ACCESS_TOKEN</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token de acesso permanente gerado no Meta Business Manager
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
