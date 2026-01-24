import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Plug,
} from "lucide-react";

type ConnectionStatus = "connected" | "warning" | "disconnected" | "checking";

interface IntegrationStatus {
  id: string;
  name: string;
  icon: typeof MessageSquare;
  status: ConnectionStatus;
  message: string;
  url: string;
  lastChecked?: Date;
}

export default function IntegrationsStatusCard() {
  const navigate = useNavigate();
  const [whatsappStatus, setWhatsappStatus] = useState<ConnectionStatus>("checking");
  const [whatsappMessage, setWhatsappMessage] = useState("Verificando...");
  const [mercadoPagoStatus, setMercadoPagoStatus] = useState<ConnectionStatus>("checking");
  const [mercadoPagoMessage, setMercadoPagoMessage] = useState("Verificando...");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query WhatsApp config
  const { data: whatsappConfig, isLoading: whatsappLoading } = useQuery({
    queryKey: ["whatsapp-config-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Query MercadoPago config
  const { data: mercadoPagoConfig, isLoading: mercadoPagoLoading } = useQuery({
    queryKey: ["mercadopago-config-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mercadopago_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Test WhatsApp connection
  const testWhatsAppConnection = async () => {
    if (!whatsappConfig) {
      setWhatsappStatus("disconnected");
      setWhatsappMessage("Não configurado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp-connection", {
        body: {
          apiUrl: whatsappConfig.api_url,
          apiKey: whatsappConfig.api_key,
          instanceId: whatsappConfig.instance_id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setWhatsappStatus("connected");
        setWhatsappMessage("Conectado");
      } else if (data?.code === "SESSION_DISCONNECTED") {
        setWhatsappStatus("warning");
        setWhatsappMessage("Sessão desconectada");
      } else {
        setWhatsappStatus("disconnected");
        setWhatsappMessage(data?.message || "Erro de conexão");
      }
    } catch {
      setWhatsappStatus("disconnected");
      setWhatsappMessage("Falha ao testar");
    }
  };

  // Test MercadoPago connection
  const testMercadoPagoConnection = async () => {
    if (!mercadoPagoConfig) {
      setMercadoPagoStatus("disconnected");
      setMercadoPagoMessage("Não configurado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-test-connection");

      if (error) throw error;

      if (data?.health === "healthy") {
        setMercadoPagoStatus("connected");
        setMercadoPagoMessage("Conectado");
      } else if (data?.health === "partial") {
        setMercadoPagoStatus("warning");
        setMercadoPagoMessage("Parcialmente conectado");
      } else {
        setMercadoPagoStatus("disconnected");
        setMercadoPagoMessage(data?.message || "Erro de conexão");
      }
    } catch {
      setMercadoPagoStatus("disconnected");
      setMercadoPagoMessage("Falha ao testar");
    }
  };

  // Initial connection tests
  useEffect(() => {
    if (!whatsappLoading) {
      testWhatsAppConnection();
    }
  }, [whatsappConfig, whatsappLoading]);

  useEffect(() => {
    if (!mercadoPagoLoading) {
      testMercadoPagoConnection();
    }
  }, [mercadoPagoConfig, mercadoPagoLoading]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setWhatsappStatus("checking");
    setMercadoPagoStatus("checking");
    setWhatsappMessage("Verificando...");
    setMercadoPagoMessage("Verificando...");

    await Promise.all([testWhatsAppConnection(), testMercadoPagoConnection()]);
    setIsRefreshing(false);
  };

  const integrations: IntegrationStatus[] = [
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: MessageSquare,
      status: whatsappStatus,
      message: whatsappMessage,
      url: "/superadmin/whatsapp/config",
    },
    {
      id: "mercadopago",
      name: "Mercado Pago",
      icon: Wallet,
      status: mercadoPagoStatus,
      message: mercadoPagoMessage,
      url: "/superadmin/settings",
    },
  ];

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Conectado
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
            <AlertTriangle className="w-3 h-3" />
            Aviso
          </Badge>
        );
      case "disconnected":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
            <XCircle className="w-3 h-3" />
            Desconectado
          </Badge>
        );
      case "checking":
        return (
          <Badge className="bg-muted text-muted-foreground gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Verificando
          </Badge>
        );
    }
  };

  const isLoading = whatsappLoading || mercadoPagoLoading;

  return (
    <Card className="bg-card border-border shadow-card">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Plug className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-display text-base md:text-lg font-semibold text-foreground">
                Status das Integrações
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Conectividade com serviços externos
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            integrations.map((integration) => {
              const IconComponent = integration.icon;
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors cursor-pointer group"
                  onClick={() => navigate(integration.url)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        integration.status === "connected"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : integration.status === "warning"
                          ? "bg-amber-500/10 text-amber-600"
                          : integration.status === "disconnected"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(integration.status)}
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
