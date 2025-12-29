import { useState, useEffect } from "react";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Loader2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = "https://iyeljkdrypcxvljebqtn.supabase.co";

type ConnectionStatus = "checking" | "connected" | "disconnected" | "not_configured";

export function WhatsAppStatusCard() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { time: formatTime } = useDateFormatter();

  // Fetch WhatsApp config
  const { data: whatsappConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["whatsapp-config-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("is_active, provider, api_url, id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Test connection when config is loaded
  const testConnection = async () => {
    if (!whatsappConfig?.id) {
      setConnectionStatus("not_configured");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus("checking");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error("No session found");
        setConnectionStatus("disconnected");
        setIsTestingConnection(false);
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/test-whatsapp-connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("disconnected");
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error("Connection test failed:", error);
      setConnectionStatus("disconnected");
      setLastChecked(new Date());
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Auto-test connection on mount and when config changes
  useEffect(() => {
    if (!isLoadingConfig) {
      if (whatsappConfig?.id) {
        testConnection();
      } else {
        setConnectionStatus("not_configured");
      }
    }
  }, [isLoadingConfig, whatsappConfig?.id]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (whatsappConfig?.id) {
        testConnection();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [whatsappConfig?.id]);

  const handleRefresh = async () => {
    await testConnection();
    toast({
      title: "Status atualizado",
      description: connectionStatus === "connected" 
        ? "Conexão com WhatsApp verificada com sucesso." 
        : "Falha ao conectar com a API do WhatsApp.",
      variant: connectionStatus === "connected" ? "default" : "destructive",
    });
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "checking":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando
          </Badge>
        );
      case "connected":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Conectado
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Desconectado
          </Badge>
        );
      case "not_configured":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Não configurado
          </Badge>
        );
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "checking":
        return (
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        );
      case "connected":
        return (
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        );
      case "disconnected":
        return (
          <div className="p-2 rounded-lg bg-red-500/10">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
        );
      case "not_configured":
        return (
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
        );
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "checking":
        return "Verificando conexão com a API...";
      case "connected":
        return "Integração configurada e funcionando";
      case "disconnected":
        return "Falha na conexão - verifique as credenciais";
      case "not_configured":
        return "Configure as credenciais de acesso à API de WhatsApp";
    }
  };

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Configurações de WhatsApp
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isTestingConnection}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${isTestingConnection ? "animate-spin" : ""}`} />
            </Button>
            {getStatusBadge()}
          </div>
        </div>
        <CardDescription>
          Gerencie as configurações de integração com WhatsApp
          {lastChecked && (
            <span className="text-xs ml-2">
              (última verificação: {formatTime(lastChecked)})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-4 rounded-lg border ${
          connectionStatus === "connected" 
            ? "bg-green-500/5 border-green-500/20" 
            : connectionStatus === "disconnected"
            ? "bg-red-500/5 border-red-500/20"
            : "bg-muted/30 border-border/50"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <p className="font-medium text-foreground">
                  {whatsappConfig?.provider?.toUpperCase() || "Integração Z-API / Z-PRO"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getStatusText()}
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/superadmin/whatsapp">
                {whatsappConfig?.id ? "Gerenciar" : "Configurar"}
              </Link>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-notify">Notificação Automática</Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificação automaticamente ao registrar ocorrência
              </p>
            </div>
            <Switch id="auto-notify" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
