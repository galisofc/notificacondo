import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConnectionStatus = "checking" | "connected" | "disconnected" | "not_configured";

interface ConnectionStatusProps {
  onConfigure: () => void;
}

export function ConnectionStatus({ onConfigure }: ConnectionStatusProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { time: formatTime } = useDateFormatter();

  const { data: config, isLoading } = useQuery({
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

  const testConnection = async () => {
    if (!config?.id) {
      setStatus("not_configured");
      return;
    }

    setIsRefreshing(true);
    setStatus("checking");

    try {
      const { data, error } = await supabase.functions.invoke("test-whatsapp-connection", {
        body: {
          provider: config.provider,
          api_url: config.api_url,
          api_key: config.api_key,
          instance_id: config.instance_id,
        },
      });

      if (error) throw error;

      setStatus((data as any)?.success ? "connected" : "disconnected");
      setLastChecked(new Date());
    } catch (error) {
      setStatus("disconnected");
      setLastChecked(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (config?.id) {
        testConnection();
      } else {
        setStatus("not_configured");
      }
    }
  }, [isLoading, config?.id]);

  const handleRefresh = async () => {
    await testConnection();
    toast({
      title: "Status atualizado",
      description: status === "connected" 
        ? "Conexão verificada com sucesso." 
        : "Falha na conexão com WhatsApp.",
      variant: status === "connected" ? "default" : "destructive",
    });
  };

  const getStatusConfig = () => {
    switch (status) {
      case "checking":
        return {
          icon: Loader2,
          iconClass: "animate-spin text-blue-500",
          bgClass: "bg-blue-500/10",
          borderClass: "border-blue-500/20",
          badge: <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Verificando</Badge>,
          title: "Verificando Conexão",
          description: "Testando conexão com a API...",
        };
      case "connected":
        return {
          icon: CheckCircle2,
          iconClass: "text-green-500",
          bgClass: "bg-green-500/10",
          borderClass: "border-green-500/20",
          badge: (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Conectado
            </Badge>
          ),
          title: "WhatsApp Conectado",
          description: `Provedor: ${config?.provider?.toUpperCase() || "Z-PRO"}`,
        };
      case "disconnected":
        return {
          icon: XCircle,
          iconClass: "text-red-500",
          bgClass: "bg-red-500/10",
          borderClass: "border-red-500/20",
          badge: <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Desconectado</Badge>,
          title: "Falha na Conexão",
          description: "Verifique as credenciais de acesso",
        };
      default:
        return {
          icon: AlertCircle,
          iconClass: "text-amber-500",
          bgClass: "bg-amber-500/10",
          borderClass: "border-amber-500/20",
          badge: <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Não Configurado</Badge>,
          title: "WhatsApp não Configurado",
          description: "Configure as credenciais para começar",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const Icon = statusConfig.icon;

  return (
    <Card className={`${statusConfig.borderClass} ${statusConfig.bgClass}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`p-2 sm:p-3 rounded-xl ${statusConfig.bgClass} shrink-0`}>
              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${statusConfig.iconClass}`} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm sm:text-base">{statusConfig.title}</h3>
                {statusConfig.badge}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {statusConfig.description}
                {lastChecked && (
                  <span className="hidden sm:inline ml-2 text-xs">
                    • Última verificação: {formatTime(lastChecked)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={onConfigure} className="gap-2 h-9 text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden xs:inline">Configurar</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
