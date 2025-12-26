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
import { MessageCircle, Save, TestTube, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppConfigData {
  id?: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
}

export function WhatsAppConfig() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

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

  const handleSave = async () => {
    if (!config.api_url || !config.api_key || !config.instance_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha URL da API, Chave da API e ID da Instância.",
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
            api_url: config.api_url,
            api_key: config.api_key,
            instance_id: config.instance_id,
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
            api_url: config.api_url,
            api_key: config.api_key,
            instance_id: config.instance_id,
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
    if (!config.api_url || !config.api_key || !config.instance_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de testar.",
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
        case "zapi":
          testUrl = `${config.api_url}/instances/${config.instance_id}/token/${config.api_key}/status`;
          break;
        case "evolution":
          testUrl = `${config.api_url}/instance/connectionState/${config.instance_id}`;
          headers["apikey"] = config.api_key;
          break;
        case "wppconnect":
          testUrl = `${config.api_url}/api/${config.instance_id}/status`;
          headers["Authorization"] = `Bearer ${config.api_key}`;
          break;
        default:
          testUrl = `${config.api_url}/status`;
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
                onValueChange={(value) => setConfig({ ...config, provider: value })}
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
              <Label htmlFor="instanceId">ID da Instância</Label>
              <Input
                id="instanceId"
                placeholder="Ex: instance_123"
                value={config.instance_id}
                onChange={(e) => setConfig({ ...config, instance_id: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL da API</Label>
            <Input
              id="apiUrl"
              placeholder="https://api.provedor.com"
              value={config.api_url}
              onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Chave da API (Token)</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="••••••••••••••••"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            />
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
