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
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Save, TestTube, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface WhatsAppConfigData {
  id?: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
}

interface ValidationErrors {
  api_url?: string;
  api_key?: string;
  instance_id?: string;
}

// Validation schemas per provider
const zproSessionSchema = z.string()
  .min(1, "Sessão é obrigatória")
  .max(50, "Sessão deve ter no máximo 50 caracteres")
  .regex(/^[a-zA-Z0-9_-]+$/, "Sessão deve conter apenas letras, números, hífen e underscore");

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
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const [config, setConfig] = useState<WhatsAppConfigData>({
    provider: "zpro",
    api_url: "",
    api_key: "",
    instance_id: "",
    is_active: true,
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

    // Validate API URL
    const urlResult = apiUrlSchema.safeParse(config.api_url);
    if (!urlResult.success) {
      newErrors.api_url = urlResult.error.errors[0].message;
    }

    // Validate API Key
    const keyResult = apiKeySchema.safeParse(config.api_key);
    if (!keyResult.success) {
      newErrors.api_key = keyResult.error.errors[0].message;
    }

    // Validate Instance ID / Session based on provider
    if (config.provider === "zpro") {
      const sessionResult = zproSessionSchema.safeParse(config.instance_id);
      if (!sessionResult.success) {
        newErrors.instance_id = sessionResult.error.errors[0].message;
      }
    } else {
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
      if (config.id) {
        // Update existing config
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            provider: config.provider,
            api_url: config.api_url.trim(),
            api_key: config.api_key.trim(),
            instance_id: config.instance_id.trim(),
            is_active: config.is_active,
          })
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
            instance_id: config.instance_id.trim(),
            is_active: true,
          })
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

    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Test the connection by calling a simple endpoint based on provider
      let testUrl = "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      switch (config.provider) {
        case "zpro":
          testUrl = `${config.api_url.trim()}/instances/${encodeURIComponent(config.instance_id.trim())}/token/${encodeURIComponent(config.api_key.trim())}/status`;
          break;
        case "zapi":
          testUrl = `${config.api_url.trim()}/instances/${encodeURIComponent(config.instance_id.trim())}/token/${encodeURIComponent(config.api_key.trim())}/status`;
          break;
        case "evolution":
          testUrl = `${config.api_url.trim()}/instance/connectionState/${encodeURIComponent(config.instance_id.trim())}`;
          headers["apikey"] = config.api_key.trim();
          break;
        case "wppconnect":
          testUrl = `${config.api_url.trim()}/api/${encodeURIComponent(config.instance_id.trim())}/status`;
          headers["Authorization"] = `Bearer ${config.api_key.trim()}`;
          break;
        default:
          testUrl = `${config.api_url.trim()}/status`;
      }

      const response = await fetch(testUrl, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        setTestResult("success");
        toast({
          title: "Conexão bem-sucedida",
          description: "A conexão com a API do WhatsApp foi estabelecida.",
        });
      } else {
        setTestResult("error");
        toast({
          title: "Falha na conexão",
          description: "Não foi possível conectar à API. Verifique as configurações.",
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

  const getSessionLabel = () => {
    if (config.provider === "zpro") {
      return "Nome da Sessão";
    }
    return "ID da Instância";
  };

  const getSessionPlaceholder = () => {
    if (config.provider === "zpro") {
      return "Ex: minha-sessao (sem espaços ou caracteres especiais)";
    }
    return "Ex: instance_123";
  };

  const getSessionHint = () => {
    if (config.provider === "zpro") {
      return "Use apenas letras, números, hífen (-) e underscore (_)";
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor</Label>
              <Select
                value={config.provider}
                onValueChange={(value) => setConfig({ ...config, provider: value, instance_id: "" })}
              >
                <SelectTrigger>
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
              <Label htmlFor="instanceId" className="flex items-center gap-1">
                {getSessionLabel()}
                {errors.instance_id && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </Label>
              <Input
                id="instanceId"
                placeholder={getSessionPlaceholder()}
                value={config.instance_id}
                onChange={(e) => {
                  setConfig({ ...config, instance_id: e.target.value });
                  if (errors.instance_id) {
                    setErrors((prev) => ({ ...prev, instance_id: undefined }));
                  }
                }}
                className={errors.instance_id ? "border-destructive" : ""}
              />
              {getSessionHint() && !errors.instance_id && (
                <p className="text-xs text-muted-foreground">{getSessionHint()}</p>
              )}
              {errors.instance_id && (
                <p className="text-xs text-destructive">{errors.instance_id}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiUrl" className="flex items-center gap-1">
              URL da API
              {errors.api_url && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
            </Label>
            <Input
              id="apiUrl"
              placeholder="https://api.provedor.com"
              value={config.api_url}
              onChange={(e) => {
                setConfig({ ...config, api_url: e.target.value });
                if (errors.api_url) {
                  setErrors((prev) => ({ ...prev, api_url: undefined }));
                }
              }}
              className={errors.api_url ? "border-destructive" : ""}
            />
            {errors.api_url && (
              <p className="text-xs text-destructive">{errors.api_url}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1">
              Chave da API (Token)
              {errors.api_key && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="••••••••••••••••"
              value={config.api_key}
              onChange={(e) => {
                setConfig({ ...config, api_key: e.target.value });
                if (errors.api_key) {
                  setErrors((prev) => ({ ...prev, api_key: undefined }));
                }
              }}
              className={errors.api_key ? "border-destructive" : ""}
            />
            {errors.api_key && (
              <p className="text-xs text-destructive">{errors.api_key}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
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
    </div>
  );
}
