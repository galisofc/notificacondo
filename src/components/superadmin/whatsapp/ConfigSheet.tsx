import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Loader2, Send, TestTube, CheckCircle, XCircle,
  Phone, Settings, Link, Key
} from "lucide-react";
import { z } from "zod";

interface ConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WhatsAppConfigData {
  id?: string;
  app_url: string;
  is_active: boolean;
}

export function ConfigSheet({ open, onOpenChange }: ConfigSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testPhone, setTestPhone] = useState("");

  const [config, setConfig] = useState<WhatsAppConfigData>({
    is_active: true,
    app_url: "https://notificacondo.com.br",
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
      setConfig({
        id: existingConfig.id,
        is_active: existingConfig.is_active,
        app_url: (existingConfig as any).app_url || "https://notificacondo.com.br",
      });
    }
  }, [existingConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            is_active: config.is_active,
            app_url: config.app_url.trim(),
            provider: "meta_waba",
            api_url: "https://graph.facebook.com",
            api_key: "managed-via-secrets",
            instance_id: "meta-cloud-api",
            use_official_api: true,
            use_waba_templates: true,
          } as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("whatsapp_config")
          .insert({
            provider: "meta_waba",
            api_url: "https://graph.facebook.com",
            api_key: "managed-via-secrets",
            instance_id: "meta-cloud-api",
            is_active: true,
            app_url: config.app_url.trim(),
            use_official_api: true,
            use_waba_templates: true,
          } as any)
          .select()
          .single();
        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      toast({ title: "Configurações salvas com sucesso!" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp-connection");
      if (error) throw error;
      if ((data as any)?.success) {
        setTestResult("success");
        toast({ title: "Conexão com Meta Cloud API bem-sucedida!" });
      } else {
        setTestResult("error");
        toast({ title: "Falha na conexão", description: (data as any)?.error, variant: "destructive" });
      }
    } catch {
      setTestResult("error");
      toast({ title: "Falha na conexão", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) {
      toast({ title: "Número obrigatório", variant: "destructive" });
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
        toast({ title: "Erro ao enviar", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendTemplateTest = async () => {
    if (!testPhone) {
      toast({ title: "Número obrigatório", variant: "destructive" });
      return;
    }
    setIsSendingTemplateTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-template-test", {
        body: { phone: testPhone, templateName: "hello_world", language: "en_US" },
      });
      if (error) throw error;
      if (data.success) {
        toast({ title: "✅ Template enviado!", description: "O template hello_world foi enviado." });
        setTestPhone("");
      } else {
        toast({ title: "❌ Erro ao enviar template", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro ao enviar template", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingTemplateTest(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            Configuração WhatsApp (Meta WABA)
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            Integração via API oficial da Meta (WhatsApp Business API)
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
            {/* Provider Info */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                  Meta Cloud API
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                As credenciais (Phone ID e Access Token) são gerenciadas via Secrets do backend. 
                Configure-as nas variáveis META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN.
              </p>
            </div>

            {/* App URL */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="app_url" className="flex items-center gap-2 text-xs sm:text-sm">
                <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                URL do Aplicativo
              </Label>
              <Input
                id="app_url"
                value={config.app_url}
                onChange={(e) => setConfig(prev => ({ ...prev, app_url: e.target.value }))}
                placeholder="https://seuapp.com.br"
                className="h-9 sm:h-10 text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                URL base usada nos links das mensagens (magic links, etc.)
              </p>
            </div>

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
                Testar Conexão Meta API
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
                  Texto
                </Button>
                <Button
                  onClick={handleSendTemplateTest}
                  disabled={isSendingTemplateTest || !testPhone}
                  variant="secondary"
                  className="shrink-0 gap-2 h-9 sm:h-10 text-sm"
                >
                  {isSendingTemplateTest ? (
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  Template WABA
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Formato: código do país + DDD + número (ex: 5511999999999)
              </p>
            </div>

            <Separator />

            {/* Status Toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Integração Ativa</Label>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Ativar ou desativar o envio de mensagens via WhatsApp
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
