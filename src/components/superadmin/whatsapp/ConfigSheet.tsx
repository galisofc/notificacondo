import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  Image
} from "lucide-react";
import { z } from "zod";

interface ConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function ConfigSheet({ open, onOpenChange }: ConfigSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingImageTest, setIsSendingImageTest] = useState(false);
  const [isSendingImageTestCustom, setIsSendingImageTestCustom] = useState(false);
  const [isSendingImageTestBoth, setIsSendingImageTestBoth] = useState(false);
  const [bothTestResult, setBothTestResult] = useState<{ winner: "token" | "custom" | null; results: { token?: { success: boolean; error?: string }; custom?: { success: boolean; error?: string } } } | null>(null);
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

      // Legacy: older versions stored a placeholder for Z-PRO.
      // Force user to explicitly fill the correct External Key.
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

    // Instance ID validation - optional for Z-PRO (uses api_key as fallback)
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
      onOpenChange(false);
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

  const handleSendImageTest = async (mode: "token" | "custom") => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite um número de telefone para enviar o teste de imagem.",
        variant: "destructive",
      });
      return;
    }

    if (mode === "token") {
      setIsSendingImageTest(true);
    } else {
      setIsSendingImageTestCustom(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-image-test", {
        body: { phone: testPhone, external_key_mode: mode },
      });

      if (error) throw error;

      const modeLabel = mode === "token" ? "externalKey=token" : "externalKey=custom";

      if (data.success) {
        toast({ title: `✅ Sucesso (${modeLabel})`, description: "Imagem enviada! Verifique seu WhatsApp." });
      } else {
        const debugSuffix = data?.debug?.status
          ? ` (HTTP ${data.debug.status}${data.debug.endpoint ? ` • ${data.debug.endpoint}` : ""})`
          : "";

        toast({
          title: `❌ Falhou (${modeLabel})`,
          description: `${data.error || "Falha ao enviar"}${debugSuffix}`,
          variant: "destructive",
        });
        console.error("Image test debug:", data.debug);
      }
    } catch (error) {
      toast({
        title: "Erro ao enviar imagem",
        description: "Não foi possível enviar a imagem de teste.",
        variant: "destructive",
      });
    } finally {
      setIsSendingImageTest(false);
      setIsSendingImageTestCustom(false);
    }
  };

  const handleSendImageTestBoth = async () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite um número de telefone para enviar o teste de imagem.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingImageTestBoth(true);
    setBothTestResult(null);

    const testMode = async (mode: "token" | "custom"): Promise<{ mode: "token" | "custom"; success: boolean; error?: string; time: number }> => {
      const start = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp-image-test", {
          body: { phone: testPhone, external_key_mode: mode },
        });
        if (error) throw error;
        return { mode, success: data.success, error: data.error, time: Date.now() - start };
      } catch (err: any) {
        return { mode, success: false, error: err.message, time: Date.now() - start };
      }
    };

    try {
      // Run both tests in parallel
      const [tokenResult, customResult] = await Promise.all([
        testMode("token"),
        testMode("custom"),
      ]);

      const results = {
        token: { success: tokenResult.success, error: tokenResult.error },
        custom: { success: customResult.success, error: customResult.error },
      };

      // Determine winner: first successful response
      let winner: "token" | "custom" | null = null;
      if (tokenResult.success && customResult.success) {
        winner = tokenResult.time <= customResult.time ? "token" : "custom";
      } else if (tokenResult.success) {
        winner = "token";
      } else if (customResult.success) {
        winner = "custom";
      }

      setBothTestResult({ winner, results });

      if (winner) {
        toast({
          title: `🏆 Vencedor: ${winner === "token" ? "externalKey=token" : "externalKey=custom"}`,
          description: `Use o modo "${winner}" para envio de imagens.`,
        });
      } else {
        toast({
          title: "❌ Ambos falharam",
          description: "Nenhum modo funcionou. Verifique as configurações.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao testar",
        description: "Não foi possível executar os testes.",
        variant: "destructive",
      });
    } finally {
      setIsSendingImageTestBoth(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            Configuração WhatsApp
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            Configure as credenciais de acesso à API de WhatsApp
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
            {/* Provider Selection */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Provedor</Label>
              <Select
                value={config.provider}
                onValueChange={(value) => setConfig(prev => ({ ...prev, provider: value }))}
              >
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zpro">Z-PRO (WhatsApp API)</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* API URL */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="api_url" className="flex items-center gap-2 text-xs sm:text-sm">
                <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                URL da API
              </Label>
              <Input
                id="api_url"
                value={config.api_url}
                onChange={(e) => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
                placeholder="https://api.z-api.io/..."
                className={`h-9 sm:h-10 text-sm ${errors.api_url ? "border-red-500" : ""}`}
              />
              {errors.api_url && (
                <p className="text-[10px] sm:text-xs text-red-500">{errors.api_url}</p>
              )}
            </div>

            {/* API Key / Token */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="api_key" className="flex items-center gap-2 text-xs sm:text-sm">
                <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {config.provider === "zpro" ? "Bearer Token" : "Chave da API"}
              </Label>
              <div className="relative">
                <Input
                  id="api_key"
                  type={showToken ? "text" : "password"}
                  value={config.api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="Sua chave de acesso..."
                  className={`h-9 sm:h-10 text-sm pr-10 ${errors.api_key ? "border-red-500" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-9 sm:w-10"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </Button>
              </div>
              {errors.api_key && (
                <p className="text-[10px] sm:text-xs text-red-500">{errors.api_key}</p>
              )}
            </div>

            {/* Instance ID - Only for non-Z-PRO providers */}
            {config.provider !== "zpro" && (
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="instance_id" className="text-xs sm:text-sm">ID da Instância</Label>
                <Input
                  id="instance_id"
                  value={config.instance_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, instance_id: e.target.value }))}
                  placeholder="Identificador da instância"
                  className={`h-9 sm:h-10 text-sm ${errors.instance_id ? "border-red-500" : ""}`}
                />
                {errors.instance_id && (
                  <p className="text-[10px] sm:text-xs text-red-500">{errors.instance_id}</p>
                )}
              </div>
            )}

            {/* App URL */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="app_url" className="text-xs sm:text-sm">URL do Aplicativo</Label>
              <Input
                id="app_url"
                value={config.app_url}
                onChange={(e) => setConfig(prev => ({ ...prev, app_url: e.target.value }))}
                placeholder="https://seuapp.com.br"
                className="h-9 sm:h-10 text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                URL base usada nos links das mensagens
              </p>
            </div>

            <Separator />

            {/* WABA Templates Toggle */}
            {config.provider === "zpro" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs sm:text-sm">Usar Templates WABA</Label>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
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
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-sm sm:text-base">Testar Conexão</h3>
                {testResult === "success" && (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 text-[10px] sm:text-xs">
                    <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Conectado
                  </Badge>
                )}
                {testResult === "error" && (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1 text-[10px] sm:text-xs">
                    <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Falha
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
                className="w-full gap-2 h-9 sm:h-10 text-sm"
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <TestTube className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                Testar Conexão
              </Button>
            </div>

            <Separator />

            {/* Send Test Message */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-medium text-sm sm:text-base">Enviar Mensagem de Teste</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="pl-9 h-9 sm:h-10 text-sm"
                  />
                </div>
                <Button
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testPhone}
                  className="shrink-0 gap-2 h-9 sm:h-10 text-sm"
                >
                  {isSendingTest ? (
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  Enviar Texto
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Formato: código do país + DDD + número (sem espaços ou traços)
              </p>
            </div>

            <Separator />

            {/* Status Toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Integração Ativa</Label>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Ativar ou desativar o envio de mensagens
                </p>
              </div>
              <Switch
                checked={config.is_active}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2 h-9 sm:h-10 text-sm">
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
