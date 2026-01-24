import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Plug,
} from "lucide-react";

interface IntegrationStatus {
  name: string;
  icon: React.ElementType;
  status: "connected" | "disconnected" | "warning";
  message: string;
  url: string;
  color: string;
  bgColor: string;
}

export function IntegrationsStatus() {
  const navigate = useNavigate();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: async () => {
      // Buscar status do WhatsApp
      const { data: whatsappConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Buscar status do Mercado Pago
      const { data: mercadopagoConfig } = await supabase
        .from("mercadopago_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const results: IntegrationStatus[] = [];

      // WhatsApp Status
      if (whatsappConfig) {
        const hasApiKey = !!whatsappConfig.api_key;
        const hasApiUrl = !!whatsappConfig.api_url;
        const isConfigured = hasApiKey && hasApiUrl;

        results.push({
          name: "WhatsApp",
          icon: MessageCircle,
          status: isConfigured ? "connected" : "warning",
          message: isConfigured 
            ? `Conectado via ${whatsappConfig.provider?.toUpperCase() || "API"}`
            : "Configuração incompleta",
          url: "/superadmin/whatsapp",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        });
      } else {
        results.push({
          name: "WhatsApp",
          icon: MessageCircle,
          status: "disconnected",
          message: "Não configurado",
          url: "/superadmin/whatsapp",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        });
      }

      // Mercado Pago Status
      if (mercadopagoConfig) {
        const hasAccessToken = !!mercadopagoConfig.access_token_encrypted;
        const hasPublicKey = !!mercadopagoConfig.public_key;
        const isConfigured = hasAccessToken && hasPublicKey;

        results.push({
          name: "Mercado Pago",
          icon: CreditCard,
          status: isConfigured ? "connected" : "warning",
          message: isConfigured
            ? mercadopagoConfig.is_sandbox ? "Modo Sandbox" : "Modo Produção"
            : "Configuração incompleta",
          url: "/superadmin/settings",
          color: "text-sky-500",
          bgColor: "bg-sky-500/10",
        });
      } else {
        results.push({
          name: "Mercado Pago",
          icon: CreditCard,
          status: "disconnected",
          message: "Não configurado",
          url: "/superadmin/settings",
          color: "text-sky-500",
          bgColor: "bg-sky-500/10",
        });
      }

      return results;
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });

  const getStatusIcon = (status: IntegrationStatus["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "disconnected":
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: IntegrationStatus["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">
            Conectado
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800">
            Atenção
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="destructive" className="bg-destructive/10">
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <Card className="bg-card border-border shadow-card">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plug className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-base md:text-lg font-semibold text-foreground">
              Status das Integrações
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Conexões com serviços externos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : integrations && integrations.length > 0 ? (
            integrations.map((integration, index) => {
              const IconComponent = integration.icon;
              return (
                <div
                  key={index}
                  onClick={() => navigate(integration.url)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-lg ${integration.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-5 h-5 ${integration.color}`} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {integration.name}
                      </span>
                      {getStatusIcon(integration.status)}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {integration.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(integration.status)}
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhuma integração encontrada
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Última verificação: agora</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/superadmin/settings")}
            >
              Gerenciar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
