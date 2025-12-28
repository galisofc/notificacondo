import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  DollarSign,
  ExternalLink,
  Zap,
  XCircle,
  RefreshCw,
  Activity,
  Server,
  Webhook,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MercadoPagoConfig {
  id: string;
  access_token_encrypted: string;
  public_key: string | null;
  webhook_secret: string | null;
  is_sandbox: boolean;
  is_active: boolean;
  notification_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectionTestResult {
  success: boolean;
  overall_status: "healthy" | "unhealthy" | "partial";
  tests: {
    config: { status: string; message: string };
    api: { status: string; message: string };
    webhook: { status: string; message: string; url?: string };
  };
  config_info?: {
    is_sandbox: boolean;
    has_public_key: boolean;
    has_webhook_secret: boolean;
    has_notification_url: boolean;
  };
  duration_ms: number;
  tested_at: string;
  error?: string;
  message?: string;
}

export function MercadoPagoSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    access_token: "",
    public_key: "",
    webhook_secret: "",
    is_sandbox: true,
    is_active: false,
    notification_url: "",
  });
  const [webhookTestStatus, setWebhookTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [webhookTestMessage, setWebhookTestMessage] = useState("");
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ["mercadopago-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mercadopago_config")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        setHasExistingToken(!!data.access_token_encrypted);
        setFormData({
          access_token: "",
          public_key: data.public_key || "",
          webhook_secret: data.webhook_secret || "",
          is_sandbox: data.is_sandbox,
          is_active: data.is_active,
          notification_url: data.notification_url || "",
        });
      }
      return data as MercadoPagoConfig | null;
    },
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        access_token_encrypted: data.access_token 
          ? data.access_token 
          : config?.access_token_encrypted,
        public_key: data.public_key || null,
        webhook_secret: data.webhook_secret || null,
        is_sandbox: data.is_sandbox,
        is_active: data.is_active,
        notification_url: data.notification_url || null,
      };

      if (config?.id) {
        const { error } = await supabase
          .from("mercadopago_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mercadopago_config")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercadopago-config"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações do Mercado Pago foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveConfigMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Configuração do Mercado Pago
          </CardTitle>
          <CardDescription>
            Configure as credenciais de acesso ao Mercado Pago para processar pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    config?.is_active
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {config?.is_active ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Ativo
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Inativo
                    </>
                  )}
                </Badge>
                {config?.is_sandbox && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Modo Sandbox
                  </Badge>
                )}
              </div>

              {/* Access Token */}
              <div className="space-y-2">
                <Label htmlFor="access_token" className="flex items-center gap-2">
                  Access Token *
                  {hasExistingToken && !formData.access_token && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Configurado
                    </Badge>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="access_token"
                    type={showAccessToken ? "text" : "password"}
                    value={formData.access_token}
                    onChange={(e) =>
                      setFormData({ ...formData, access_token: e.target.value })
                    }
                    placeholder={hasExistingToken ? "Digite para substituir o token atual" : "APP_USR-xxxxxxxxxxxxxxxxxxxx"}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                    tabIndex={-1}
                  >
                    {showAccessToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasExistingToken && !formData.access_token 
                    ? "Token já configurado. Deixe em branco para manter o atual ou digite um novo para substituir."
                    : <>Token de acesso do Mercado Pago. Obtenha em{" "}
                      <a
                        href="https://www.mercadopago.com.br/developers/panel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Painel de Desenvolvedores
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  }
                </p>
              </div>

              {/* Public Key */}
              <div className="space-y-2">
                <Label htmlFor="public_key">Public Key</Label>
                <div className="relative">
                  <Input
                    id="public_key"
                    type={showPublicKey ? "text" : "password"}
                    value={formData.public_key}
                    onChange={(e) =>
                      setFormData({ ...formData, public_key: e.target.value })
                    }
                    placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxx"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPublicKey(!showPublicKey)}
                    tabIndex={-1}
                  >
                    {showPublicKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chave pública para checkout transparente (opcional)
                </p>
              </div>

              {/* Switches */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_sandbox">Modo Sandbox</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar credenciais de teste do Mercado Pago
                    </p>
                  </div>
                  <Switch
                    id="is_sandbox"
                    checked={formData.is_sandbox}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_sandbox: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_active">Ativar Integração</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar processamento de pagamentos via Mercado Pago
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saveConfigMutation.isPending || !formData.access_token}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Test Card */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-primary" />
            Diagnóstico de Conexão
          </CardTitle>
          <CardDescription>
            Teste completo da integração com Mercado Pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Executar teste completo</p>
              <p className="text-xs text-muted-foreground">
                Verifica configuração, API e webhook
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isTestingConnection}
              onClick={async () => {
                setIsTestingConnection(true);
                setConnectionTestResult(null);

                try {
                  const { data, error } = await supabase.functions.invoke(
                    "mercadopago-test-connection"
                  );

                  if (error) throw error;
                  setConnectionTestResult(data);

                  toast({
                    title:
                      data.overall_status === "healthy"
                        ? "Conexão saudável"
                        : data.overall_status === "partial"
                        ? "Conexão parcial"
                        : "Problemas detectados",
                    description:
                      data.overall_status === "healthy"
                        ? "Todos os testes passaram com sucesso!"
                        : "Verifique os detalhes abaixo",
                    variant:
                      data.overall_status === "healthy" ? "default" : "destructive",
                  });
                } catch (error: any) {
                  toast({
                    title: "Erro no teste",
                    description: error.message,
                    variant: "destructive",
                  });
                  setConnectionTestResult({
                    success: false,
                    overall_status: "unhealthy",
                    tests: {
                      config: { status: "error", message: "Falha ao executar teste" },
                      api: { status: "skipped", message: "Teste pulado" },
                      webhook: { status: "skipped", message: "Teste pulado" },
                    },
                    duration_ms: 0,
                    tested_at: new Date().toISOString(),
                    error: error.message,
                  });
                } finally {
                  setIsTestingConnection(false);
                }
              }}
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>
          </div>

          {connectionTestResult && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              {/* Overall Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Status Geral</span>
                <Badge
                  variant="outline"
                  className={
                    connectionTestResult.overall_status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : connectionTestResult.overall_status === "partial"
                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }
                >
                  {connectionTestResult.overall_status === "healthy" && (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Saudável
                    </>
                  )}
                  {connectionTestResult.overall_status === "partial" && (
                    <>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Parcial
                    </>
                  )}
                  {connectionTestResult.overall_status === "unhealthy" && (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Com Problemas
                    </>
                  )}
                </Badge>
              </div>

              {/* Individual Tests */}
              <div className="space-y-2">
                {/* Config Test */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                  <Settings className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Configuração</span>
                      {connectionTestResult.tests.config.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : connectionTestResult.tests.config.status === "error" ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {connectionTestResult.tests.config.message}
                    </p>
                  </div>
                </div>

                {/* API Test */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                  <Server className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">API Mercado Pago</span>
                      {connectionTestResult.tests.api.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : connectionTestResult.tests.api.status === "error" ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : connectionTestResult.tests.api.status === "skipped" ? (
                        <span className="text-xs text-muted-foreground">Pulado</span>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {connectionTestResult.tests.api.message}
                    </p>
                  </div>
                </div>

                {/* Webhook Test */}
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                  <Webhook className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Webhook Endpoint</span>
                      {connectionTestResult.tests.webhook.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : connectionTestResult.tests.webhook.status === "error" ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : connectionTestResult.tests.webhook.status === "skipped" ? (
                        <span className="text-xs text-muted-foreground">Pulado</span>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {connectionTestResult.tests.webhook.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Config Info */}
              {connectionTestResult.config_info && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs">
                    {connectionTestResult.config_info.is_sandbox ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                        Sandbox
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Produção
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Public Key: {connectionTestResult.config_info.has_public_key ? "✓" : "✗"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Webhook Secret: {connectionTestResult.config_info.has_webhook_secret ? "✓" : "✗"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    URL Notificação: {connectionTestResult.config_info.has_notification_url ? "✓" : "✗"}
                  </div>
                </div>
              )}

              {/* Test metadata */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  Testado em: {new Date(connectionTestResult.tested_at).toLocaleString("pt-BR")}
                </span>
                <span>{connectionTestResult.duration_ms}ms</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Info Card */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook</CardTitle>
          <CardDescription>
            Configure esta URL no painel do Mercado Pago para receber notificações de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL para configurar no Mercado Pago:</Label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm break-all">
                https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/mercadopago-webhook
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText("https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/mercadopago-webhook");
                  toast({
                    title: "URL copiada",
                    description: "A URL do webhook foi copiada para a área de transferência.",
                  });
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <strong>Importante:</strong> No painel do Mercado Pago, selecione os eventos: <code className="bg-muted px-1 rounded">payment</code> e <code className="bg-muted px-1 rounded">subscription_preapproval</code>
            </p>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Configure esta URL em:{" "}
            <a
              href="https://www.mercadopago.com.br/developers/panel/notifications/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Webhooks do Mercado Pago
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          
          {/* Webhook Test Section */}
          <div className="pt-4 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Testar Conexão</Label>
                <p className="text-xs text-muted-foreground">
                  Envia uma requisição de teste para verificar se o endpoint está acessível
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={webhookTestStatus === "testing"}
                onClick={async () => {
                  setWebhookTestStatus("testing");
                  setWebhookTestMessage("");
                  
                  try {
                    const startTime = Date.now();
                    const response = await fetch(
                      "https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/mercadopago-webhook",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          type: "test",
                          data: { id: "test_" + Date.now() },
                          action: "test.connection",
                        }),
                      }
                    );
                    
                    const duration = Date.now() - startTime;
                    const responseData = await response.json();
                    
                    if (response.ok && responseData.received) {
                      setWebhookTestStatus("success");
                      setWebhookTestMessage(`Conexão OK! Resposta em ${duration}ms`);
                      toast({
                        title: "Webhook funcionando",
                        description: `O endpoint respondeu corretamente em ${duration}ms.`,
                      });
                    } else {
                      setWebhookTestStatus("error");
                      setWebhookTestMessage(`Erro: ${response.status} - ${JSON.stringify(responseData)}`);
                      toast({
                        title: "Erro no webhook",
                        description: "O endpoint retornou um erro.",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    setWebhookTestStatus("error");
                    setWebhookTestMessage(`Falha na conexão: ${error.message}`);
                    toast({
                      title: "Falha na conexão",
                      description: "Não foi possível alcançar o endpoint do webhook.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                {webhookTestStatus === "testing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Testar Webhook
                  </>
                )}
              </Button>
            </div>
            
            {webhookTestStatus === "success" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{webhookTestMessage}</span>
              </div>
            )}
            
            {webhookTestStatus === "error" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">{webhookTestMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documentation Card */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Documentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="https://www.mercadopago.com.br/developers/pt/docs/subscriptions/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="text-sm">Assinaturas no Mercado Pago</span>
          </a>
          <a
            href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="text-sm">Webhooks e Notificações</span>
          </a>
          <a
            href="https://www.mercadopago.com.br/developers/pt/docs/sdks-library/server-side/nodejs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="text-sm">SDK Node.js</span>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
