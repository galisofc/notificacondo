import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Save, TestTube, CheckCircle, XCircle, Loader2, AlertCircle, Eye, EyeOff, Send, Phone, Settings, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppTemplates } from "./WhatsAppTemplates";

const SUPABASE_URL = "https://iyeljkdrypcxvljebqtn.supabase.co";
import { z } from "zod";

interface WhatsAppConfigData {
  id?: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url: string;
}

interface ValidationErrors {
  api_url?: string;
  api_key?: string;
  instance_id?: string;
  app_url?: string;
}

// Validation schemas per provider
const zproUrlSchema = z.string()
  .min(1, "URL da API é obrigatória")
  .url("URL inválida")
  .max(500, "URL deve ter no máximo 500 caracteres")
  .refine(
    (url) => url.includes("/v2/api/external/") || url.includes("/api/"),
    "URL deve conter o endpoint da API Z-PRO"
  );

const zproBearerTokenSchema = z.string()
  .min(1, "Bearer Token é obrigatório")
  .max(1000, "Token deve ter no máximo 1000 caracteres")
  .refine(
    (token) => token.startsWith("eyJ") || token.length > 20,
    "Token parece inválido"
  );

const instanceIdSchema = z.string()
  .min(1, "ID da Instância é obrigatório")
  .max(100, "ID deve ter no máximo 100 caracteres");

const apiUrlSchema = z.string()
  .min(1, "URL da API é obrigatória")
  .url("URL inválida. Use o formato: https://api.exemplo.com")
  .max(500, "URL deve ter no máximo 500 caracteres");

const apiKeySchema = z.string()
  .min(1, "Chave da API é obrigatória")
  .max(500, "Chave deve ter no máximo 500 caracteres");

export function WhatsAppConfig() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  const [config, setConfig] = useState<WhatsAppConfigData>({
    provider: "zpro",
    api_url: "",
    api_key: "",
    instance_id: "",
    is_active: true,
    app_url: "https://notificacondo.com.br",
  });

  // Load existing config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Clear errors when provider changes
  useEffect(() => {
    setErrors({});
  }, [config.provider]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading WhatsApp config:", error);
        return;
      }

      if (data) {
        setConfig({
          id: data.id,
          provider: data.provider,
          api_url: data.api_url,
          api_key: data.api_key,
          instance_id: data.instance_id,
          is_active: data.is_active,
          app_url: (data as any).app_url || "https://notificacondo.com.br",
        });
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfig = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (config.provider === "zpro") {
      // Z-PRO uses full URL and Bearer Token
      const urlResult = zproUrlSchema.safeParse(config.api_url);
      if (!urlResult.success) {
        newErrors.api_url = urlResult.error.errors[0].message;
      }

      const tokenResult = zproBearerTokenSchema.safeParse(config.api_key);
      if (!tokenResult.success) {
        newErrors.api_key = tokenResult.error.errors[0].message;
      }
      // instance_id not required for Z-PRO (it's in the URL)
    } else {
      // Other providers
      const urlResult = apiUrlSchema.safeParse(config.api_url);
      if (!urlResult.success) {
        newErrors.api_url = urlResult.error.errors[0].message;
      }

      const keyResult = apiKeySchema.safeParse(config.api_key);
      if (!keyResult.success) {
        newErrors.api_key = keyResult.error.errors[0].message;
      }

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
      // For Z-PRO, store a placeholder for instance_id since it's in the URL
      const instanceId = config.provider === "zpro" ? "zpro-embedded" : config.instance_id.trim();

      if (config.id) {
        // Update existing config
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            provider: config.provider,
            api_url: config.api_url.trim(),
            api_key: config.api_key.trim(),
            instance_id: instanceId,
            is_active: config.is_active,
            app_url: config.app_url.trim(),
          } as any)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { data, error } = await supabase
          .from("whatsapp_config")
          .insert({
            provider: config.provider,
            api_url: config.api_url.trim(),
            api_key: config.api_key.trim(),
            instance_id: instanceId,
            is_active: true,
            app_url: config.app_url.trim(),
          } as any)
          .select()
          .single();

        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Failed to save config:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateConfig()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os campos destacados antes de testar.",
        variant: "destructive",
      });
      return;
    }

    // First save the config before testing
    if (!config.id) {
      toast({
        title: "Salve primeiro",
        description: "Salve as configurações antes de testar a conexão.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Use the edge function to test the connection (avoids CORS issues)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/test-whatsapp-connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("Test result:", data);

      if (data.success) {
        setTestResult("success");
        toast({
          title: "Conexão bem-sucedida",
          description: data.message || "A conexão com a API do WhatsApp foi estabelecida.",
        });
      } else {
        setTestResult("error");
        toast({
          title: "Falha na conexão",
          description: data.error || "Não foi possível conectar à API. Verifique as configurações.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Test failed:", error);
      setTestResult("error");
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar à API. Verifique as configurações.",
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

    if (!config.id) {
      toast({
        title: "Salve primeiro",
        description: "Salve as configurações antes de enviar um teste.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: testPhone,
        }),
      });

      const data = await response.json();
      console.log("Send test result:", data);

      if (data.success) {
        toast({
          title: "Mensagem enviada!",
          description: "Verifique seu WhatsApp para confirmar o recebimento.",
        });
        setTestPhone("");
      } else {
        toast({
          title: "Erro ao enviar",
          description: data.error || "Não foi possível enviar a mensagem de teste.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Send test failed:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const isZpro = config.provider === "zpro";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="config" className="space-y-6">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="config" className="gap-2">
          <Settings className="w-4 h-4" />
          Configuração
        </TabsTrigger>
        <TabsTrigger value="templates" className="gap-2">
          <FileText className="w-4 h-4" />
          Templates
        </TabsTrigger>
      </TabsList>

      <TabsContent value="config" className="space-y-6">
        {/* Status Card */}
        <Card className={config.id ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.id ? (
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {config.id ? "Integração Configurada" : "Integração Não Configurada"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {config.id 
                      ? `Provedor: ${config.provider?.toUpperCase()} • Status: ${config.is_active ? "Ativo" : "Inativo"}`
                      : "Configure as credenciais abaixo para ativar o envio de notificações"}
                  </p>
                </div>
              </div>
              {config.id && (
                <Badge 
                  variant="outline" 
                  className={config.is_active 
                    ? "bg-green-500/10 text-green-500 border-green-500/20 gap-1" 
                    : "bg-muted text-muted-foreground border-border gap-1"
                  }
                >
                  <div className={`w-2 h-2 rounded-full ${config.is_active ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                  {config.is_active ? "Online" : "Offline"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <MessageCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Configurações do WhatsApp</CardTitle>
                <CardDescription>
                  Configure a integração com provedores de WhatsApp para envio de notificações
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor</Label>
              <Select
                value={config.provider}
                onValueChange={(value) => setConfig({ 
                  ...config, 
                  provider: value, 
                  instance_id: "",
                  api_url: "",
                  api_key: "" 
                })}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zpro">Z-PRO</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="wppconnect">WPPConnect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUrl" className="flex items-center gap-1">
                {isZpro ? "URL da API (completa)" : "URL da API"}
                {errors.api_url && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </Label>
              <Input
                id="apiUrl"
                placeholder={isZpro 
                  ? "https://api.atenderchat.com.br/v2/api/external/sua-sessao-id" 
                  : "https://api.provedor.com"}
                value={config.api_url}
                onChange={(e) => {
                  setConfig({ ...config, api_url: e.target.value });
                  if (errors.api_url) {
                    setErrors((prev) => ({ ...prev, api_url: undefined }));
                  }
                }}
                className={errors.api_url ? "border-destructive" : ""}
              />
              {isZpro && !errors.api_url && (
                <p className="text-xs text-muted-foreground">
                  Cole a URL completa fornecida pelo Z-PRO (inclui o ID da sessão)
                </p>
              )}
              {errors.api_url && (
                <p className="text-xs text-destructive">{errors.api_url}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-1">
                {isZpro ? "Bearer Token" : "Chave da API (Token)"}
                {errors.api_key && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showToken ? "text" : "password"}
                  placeholder={isZpro ? "eyJhbGciOiJIUzI1NiIs..." : "••••••••••••••••"}
                  value={config.api_key}
                  onChange={(e) => {
                    setConfig({ ...config, api_key: e.target.value });
                    if (errors.api_key) {
                      setErrors((prev) => ({ ...prev, api_key: undefined }));
                    }
                  }}
                  className={`pr-10 ${errors.api_key ? "border-destructive" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {isZpro && !errors.api_key && (
                <p className="text-xs text-muted-foreground">
                  Token JWT fornecido pelo Z-PRO para autenticação
                </p>
              )}
              {errors.api_key && (
                <p className="text-xs text-destructive">{errors.api_key}</p>
              )}
            </div>

            {/* Instance ID field - only for non-ZPRO providers */}
            {!isZpro && (
              <div className="space-y-2">
                <Label htmlFor="instanceId" className="flex items-center gap-1">
                  ID da Instância
                  {errors.instance_id && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </Label>
                <Input
                  id="instanceId"
                  placeholder="Ex: instance_123"
                  value={config.instance_id}
                  onChange={(e) => {
                    setConfig({ ...config, instance_id: e.target.value });
                    if (errors.instance_id) {
                      setErrors((prev) => ({ ...prev, instance_id: undefined }));
                    }
                  }}
                  className={errors.instance_id ? "border-destructive" : ""}
                />
                {errors.instance_id && (
                  <p className="text-xs text-destructive">{errors.instance_id}</p>
                )}
              </div>
            )}

            {/* URL do Sistema - para gerar links de acesso do morador */}
            <div className="space-y-2">
              <Label htmlFor="appUrl" className="flex items-center gap-1">
                URL do Sistema (para links do morador)
                {errors.app_url && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </Label>
              <Input
                id="appUrl"
                placeholder="https://notificacondo.com.br"
                value={config.app_url}
                onChange={(e) => {
                  setConfig({ ...config, app_url: e.target.value });
                  if (errors.app_url) {
                    setErrors((prev) => ({ ...prev, app_url: undefined }));
                  }
                }}
                className={errors.app_url ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                URL base usada nos links enviados aos moradores via WhatsApp
              </p>
              {errors.app_url && (
                <p className="text-xs text-destructive">{errors.app_url}</p>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? "Salvando..." : "Salvar Configurações"}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                {isTesting ? "Testando..." : "Testar Conexão"}
              </Button>
              {testResult && (
                <Badge
                  variant="outline"
                  className={
                    testResult === "success"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }
                >
                  {testResult === "success" ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Falha
                    </>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Message */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Enviar Mensagem de Teste</CardTitle>
                <CardDescription>
                  Teste a integração enviando uma mensagem para seu WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="testPhone">Número de Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="testPhone"
                    placeholder="5511999999999"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o número com código do país (55) e DDD, sem espaços ou caracteres especiais
                </p>
              </div>
            </div>
            <Button 
              onClick={handleSendTest} 
              disabled={isSendingTest || !config.id}
              className="w-full sm:w-auto"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isSendingTest ? "Enviando..." : "Enviar Teste"}
            </Button>
            {!config.id && (
              <p className="text-xs text-amber-600">
                Salve as configurações antes de enviar um teste.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Webhook Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Webhook de Status</CardTitle>
            <CardDescription>
              Configure este webhook no seu provedor para receber atualizações de status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-muted px-4 py-2 rounded-lg text-sm break-all">
                https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/whatsapp-webhook
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    "https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/whatsapp-webhook"
                  );
                  toast({ title: "URL copiada!" });
                }}
              >
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="templates">
        <WhatsAppTemplates />
      </TabsContent>
    </Tabs>
  );
}
