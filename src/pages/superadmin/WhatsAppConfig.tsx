import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { ConnectionStatus } from "@/components/superadmin/whatsapp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Loader2, 
  Eye, 
  EyeOff, 
  Send, 
  TestTube, 
  CheckCircle, 
  XCircle,
  Phone,
  Settings,
  Link,
  Key,
  ArrowLeft
} from "lucide-react";
import { z } from "zod";

interface WhatsAppConfigData {
  id?: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url: string;
  use_waba_templates: boolean;
}

// Validation schemas
const zproUrlSchema = z
  .string()
  .min(1, "URL da API é obrigatória")
  .url("URL inválida")
  .max(500, "URL deve ter no máximo 500 caracteres");

const zproBearerTokenSchema = z
  .string()
  .min(1, "Bearer Token é obrigatório")
  .max(1000, "Token deve ter no máximo 1000 caracteres");

const instanceIdSchema = z
  .string()
  .max(100, "ID deve ter no máximo 100 caracteres")
  .optional();

export default function WhatsAppConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [config, setConfig] = useState<WhatsAppConfigData>({
    provider: "zpro",
    api_url: "",
    api_key: "",
    instance_id: "",
    is_active: true,
    app_url: "https://notificacondo.com.br",
    use_waba_templates: false,
  });

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingConfig) {
      const provider = existingConfig.provider;
      const rawInstanceId = existingConfig.instance_id;
      const instanceId = provider === "zpro" && rawInstanceId === "zpro-embedded" ? "" : rawInstanceId;

      setConfig({
        id: existingConfig.id,
        provider,
        api_url: existingConfig.api_url,
        api_key: existingConfig.api_key,
        instance_id: instanceId,
        is_active: existingConfig.is_active,
        app_url: (existingConfig as any).app_url || "https://notificacondo.com.br",
        use_waba_templates: (existingConfig as any).use_waba_templates || false,
      });
    }
  }, [existingConfig]);

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    const urlResult = zproUrlSchema.safeParse(config.api_url);
    if (!urlResult.success) {
      newErrors.api_url = urlResult.error.errors[0].message;
    }

    const tokenResult = zproBearerTokenSchema.safeParse(config.api_key);
    if (!tokenResult.success) {
      newErrors.api_key = tokenResult.error.errors[0].message;
    }

    if (config.provider !== "zpro" && config.instance_id) {
      const instanceResult = instanceIdSchema.safeParse(config.instance_id);
      if (!instanceResult.success) {
        newErrors.instance_id = instanceResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateConfig()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os campos destacados antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const instanceId = config.instance_id.trim();

      if (config.id) {
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            provider: config.provider,
            api_url: config.api_url.trim(),
            api_key: config.api_key.trim(),
            instance_id: instanceId,
            is_active: config.is_active,
            app_url: config.app_url.trim(),
            use_waba_templates: config.use_waba_templates,
          } as any)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("whatsapp_config")
          .insert({
            provider: config.provider,
            api_url: config.api_url.trim(),
            api_key: config.api_key.trim(),
            instance_id: instanceId,
            is_active: true,
            app_url: config.app_url.trim(),
            use_waba_templates: config.use_waba_templates,
          } as any)
          .select()
          .single();

        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }

      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      toast({ title: "Configurações salvas com sucesso!" });
      navigate("/superadmin/whatsapp");
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateConfig()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp-connection", {
        body: {
          provider: config.provider,
          api_url: config.api_url.trim(),
          api_key: config.api_key.trim(),
          instance_id: config.instance_id.trim(),
        },
      });

      if (error) throw error;

      if ((data as any)?.success) {
        setTestResult("success");
        toast({ title: "Conexão bem-sucedida!" });
      } else {
        setTestResult("error");
        const errorCode = (data as any)?.errorCode;
        const errorMessage = (data as any)?.error || "Verifique as configurações.";
        
        toast({
          title: errorCode === "SESSION_DISCONNECTED" ? "Sessão desconectada" : "Falha na conexão",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      setTestResult("error");
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar à API.",
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
        toast({ title: "Mensagem enviada! Verifique seu WhatsApp." });
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
              Configure as credenciais de acesso à API de WhatsApp
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection Status Card */}
            <ConnectionStatus />

            <div className="grid gap-6 lg:grid-cols-2">
            {/* Main Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Credenciais da API</CardTitle>
                <CardDescription>Configure as informações de acesso ao provedor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Provedor</Label>
                  <Select
                    value={config.provider}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, provider: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zpro">Z-PRO (WhatsApp API)</SelectItem>
                      <SelectItem value="zapi">Z-API</SelectItem>
                      <SelectItem value="evolution">Evolution API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* API URL */}
                <div className="space-y-2">
                  <Label htmlFor="api_url" className="flex items-center gap-2 text-sm">
                    <Link className="h-4 w-4" />
                    URL da API
                  </Label>
                  <Input
                    id="api_url"
                    value={config.api_url}
                    onChange={(e) => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
                    placeholder="https://api.z-api.io/..."
                    className={errors.api_url ? "border-destructive" : ""}
                  />
                  {errors.api_url && (
                    <p className="text-xs text-destructive">{errors.api_url}</p>
                  )}
                </div>

                {/* API Key / Token */}
                <div className="space-y-2">
                  <Label htmlFor="api_key" className="flex items-center gap-2 text-sm">
                    <Key className="h-4 w-4" />
                    {config.provider === "zpro" ? "Bearer Token" : "Chave da API"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="api_key"
                      type={showToken ? "text" : "password"}
                      value={config.api_key}
                      onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder="Sua chave de acesso..."
                      className={`pr-10 ${errors.api_key ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.api_key && (
                    <p className="text-xs text-destructive">{errors.api_key}</p>
                  )}
                </div>

                {/* Instance ID - Only for non-Z-PRO providers */}
                {config.provider !== "zpro" && (
                  <div className="space-y-2">
                    <Label htmlFor="instance_id" className="text-sm">ID da Instância</Label>
                    <Input
                      id="instance_id"
                      value={config.instance_id}
                      onChange={(e) => setConfig(prev => ({ ...prev, instance_id: e.target.value }))}
                      placeholder="Identificador da instância"
                      className={errors.instance_id ? "border-destructive" : ""}
                    />
                    {errors.instance_id && (
                      <p className="text-xs text-destructive">{errors.instance_id}</p>
                    )}
                  </div>
                )}

                {/* App URL */}
                <div className="space-y-2">
                  <Label htmlFor="app_url" className="text-sm">URL do Aplicativo</Label>
                  <Input
                    id="app_url"
                    value={config.app_url}
                    onChange={(e) => setConfig(prev => ({ ...prev, app_url: e.target.value }))}
                    placeholder="https://seuapp.com.br"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL base usada nos links das mensagens
                  </p>
                </div>

                <Separator />

                {/* Status Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-sm">Integração Ativa</Label>
                    <p className="text-xs text-muted-foreground">
                      Ativar ou desativar o envio de mensagens
                    </p>
                  </div>
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* WABA Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Configurações WABA</CardTitle>
                <CardDescription>Opções para API oficial do WhatsApp Business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* WABA Templates Toggle */}
                {config.provider === "zpro" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Label className="text-sm">Usar Templates WABA</Label>
                        <p className="text-xs text-muted-foreground">
                          Ativar envio via API oficial com templates aprovados na Meta
                        </p>
                      </div>
                      <Switch
                        checked={config.use_waba_templates}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, use_waba_templates: checked }))}
                      />
                    </div>
                    {config.use_waba_templates && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          ⚠️ Certifique-se de que os templates WABA estão configurados na aba "Templates" de cada mensagem e aprovados no Meta Business Manager.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Test Connection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-sm">Testar Conexão</h3>
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
                  </div>
                  <Button
                    variant="outline"
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
                </div>

                <Separator />

                {/* Send Test Message */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm">Enviar Mensagem de Teste</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="5511999999999"
                        className="pl-10"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSendTest}
                        disabled={isSendingTest || !testPhone}
                        className="flex-1 gap-2"
                      >
                        {isSendingTest ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Enviar Texto
                      </Button>
                      <Button
                        onClick={handleSendTemplateTest}
                        disabled={isSendingTemplateTest || !testPhone}
                        variant="secondary"
                        className="flex-1 gap-2"
                      >
                        {isSendingTemplateTest ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        Template WABA
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (sem espaços ou traços)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 O botão "Template WABA" envia o template <code className="bg-muted px-1 rounded">hello_world</code> para testar a API oficial.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Save Button - Full Width */}
            <div className="lg:col-span-2">
              <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2" size="lg">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Configurações
              </Button>
            </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
