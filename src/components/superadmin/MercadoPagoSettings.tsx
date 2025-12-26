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
        setFormData({
          access_token: "***************",
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
        access_token_encrypted: data.access_token !== "***************" 
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
                <Label htmlFor="access_token">Access Token *</Label>
                <Input
                  id="access_token"
                  type="password"
                  value={formData.access_token}
                  onChange={(e) =>
                    setFormData({ ...formData, access_token: e.target.value })
                  }
                  placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Token de acesso do Mercado Pago. Obtenha em{" "}
                  <a
                    href="https://www.mercadopago.com.br/developers/panel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Painel de Desenvolvedores
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {/* Public Key */}
              <div className="space-y-2">
                <Label htmlFor="public_key">Public Key</Label>
                <Input
                  id="public_key"
                  value={formData.public_key}
                  onChange={(e) =>
                    setFormData({ ...formData, public_key: e.target.value })
                  }
                  placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Chave pública para checkout transparente (opcional)
                </p>
              </div>

              {/* Webhook Secret */}
              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Webhook Secret</Label>
                <Input
                  id="webhook_secret"
                  type="password"
                  value={formData.webhook_secret}
                  onChange={(e) =>
                    setFormData({ ...formData, webhook_secret: e.target.value })
                  }
                  placeholder="Secret para validação de webhooks"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para validar notificações do Mercado Pago (opcional)
                </p>
              </div>

              {/* Notification URL */}
              <div className="space-y-2">
                <Label htmlFor="notification_url">URL de Notificação</Label>
                <Input
                  id="notification_url"
                  value={formData.notification_url}
                  onChange={(e) =>
                    setFormData({ ...formData, notification_url: e.target.value })
                  }
                  placeholder="https://seu-dominio.com"
                />
                <p className="text-xs text-muted-foreground">
                  URL base para redirecionamentos e webhooks
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

      {/* Webhook Info Card */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook</CardTitle>
          <CardDescription>
            Configure esta URL no painel do Mercado Pago
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm">
            {window.location.origin}/functions/v1/mercadopago-webhook
          </div>
          <p className="text-xs text-muted-foreground mt-2">
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
