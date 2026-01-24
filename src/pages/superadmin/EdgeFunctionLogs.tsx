import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function EdgeFunctionLogs() {
  const [selectedFunction, setSelectedFunction] = useState<string>("all");

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["edge-function-logs", selectedFunction],
    queryFn: async () => {
      let query = supabase
        .from("edge_function_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);

      if (selectedFunction !== "all") {
        query = query.eq("function_name", selectedFunction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: functionNames } = useQuery({
    queryKey: ["edge-function-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edge_function_logs")
        .select("function_name")
        .order("function_name");
      
      if (error) throw error;
      
      const unique = [...new Set(data?.map(d => d.function_name))];
      return unique;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "running":
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Sucesso</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "running":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Executando</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Concluído</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Agendado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const translateTriggerType = (type: string | null) => {
    if (!type) return null;
    switch (type) {
      case "cron":
        return "agendamento";
      case "manual":
        return "manual";
      case "scheduled":
        return "agendado";
      case "webhook":
        return "webhook";
      case "api":
        return "api";
      default:
        return type;
    }
  };

  const translateFunctionName = (name: string) => {
    const translations: Record<string, string> = {
      "notify-party-hall-reminders": "Lembretes Salão de Festas",
      "start-party-hall-usage": "Iniciar Uso Salão de Festas",
      "finish-party-hall-usage": "Finalizar Uso Salão de Festas",
      "notify-trial-ending": "Notificar Fim do Trial",
      "generate-invoices": "Gerar Faturas",
      "cleanup-old-packages": "Limpar Encomendas Antigas",
      "cleanup-orphan-package-photos": "Limpar Fotos Órfãs",
      "cleanup-orphan-users": "Limpar Usuários Órfãos",
      "notify-package-arrival": "Notificar Chegada Encomenda",
      "notify-resident-decision": "Notificar Decisão Morador",
      "notify-sindico-defense": "Notificar Defesa Síndico",
      "notify-transfer": "Notificar Transferência",
      "send-party-hall-notification": "Enviar Notif. Salão Festas",
      "send-password-recovery": "Enviar Recuperação Senha",
      "send-whatsapp-notification": "Enviar Notif. WhatsApp",
      "send-whatsapp-test": "Teste WhatsApp",
      "send-whatsapp-image-test": "Teste Imagem WhatsApp",
      "send-whatsapp-template-test": "Teste Template WhatsApp",
      "test-whatsapp-connection": "Testar Conexão WhatsApp",
      "create-porteiro": "Criar Porteiro",
      "create-sindico": "Criar Síndico",
      "create-super-admin": "Criar Super Admin",
      "delete-porteiro": "Excluir Porteiro",
      "delete-sindico": "Excluir Síndico",
      "update-porteiro": "Atualizar Porteiro",
      "resend-porter-credentials": "Reenviar Credenciais Porteiro",
      "validate-access-token": "Validar Token Acesso",
      "check-rls-policies": "Verificar Políticas RLS",
      "mercadopago-webhook": "Webhook MercadoPago",
      "mercadopago-create-payment": "Criar Pagamento MP",
      "mercadopago-create-pix": "Criar PIX MP",
      "mercadopago-create-subscription": "Criar Assinatura MP",
      "mercadopago-cancel-subscription": "Cancelar Assinatura MP",
      "mercadopago-process-payment": "Processar Pagamento MP",
      "mercadopago-test-connection": "Testar Conexão MP",
      "get-mercadopago-public-config": "Config Pública MP",
      "whatsapp-webhook": "Webhook WhatsApp",
      "sync-notification-status": "Sincronizar Status Notif.",
    };
    return translations[name] || name;
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs de Funções de Backend | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[
          { label: "Logs", href: "/superadmin/logs" },
          { label: "Funções de Backend" }
        ]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">Logs de Funções de Backend</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Histórico de execução das funções do sistema
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedFunction} onValueChange={setSelectedFunction}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {functionNames?.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Últimas 100 execuções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {logs?.map((log) => (
                    <Collapsible key={log.id}>
                      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              {getStatusIcon(log.status)}
                              <div className="text-left">
                                <div className="font-medium text-sm">
                                  {translateFunctionName(log.function_name)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatDistanceToNow(new Date(log.started_at), {
                                    addSuffix: true,
                                    locale: ptBR
                                  })}
                                  {log.duration_ms && (
                                    <span className="ml-2">• {log.duration_ms}ms</span>
                                  )}
                                  {log.trigger_type && (
                                    <span className="ml-2">• {translateTriggerType(log.trigger_type)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(log.status)}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="mt-3 pt-3 border-t space-y-3">
                            {log.error_message && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                                <div className="text-xs font-medium text-destructive mb-1">Mensagem de Erro:</div>
                                <pre className="text-xs text-destructive whitespace-pre-wrap break-all font-mono">
                                  {log.error_message}
                                </pre>
                              </div>
                            )}
                            
                            {log.result && (
                              <div className="bg-muted rounded-md p-3">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Resultado:</div>
                                <pre className="text-xs whitespace-pre-wrap break-all font-mono max-h-40 overflow-auto">
                                  {typeof log.result === 'string' 
                                    ? log.result 
                                    : JSON.stringify(log.result, null, 2)}
                                </pre>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div>
                                <span className="font-medium">Início:</span>{" "}
                                {new Date(log.started_at).toLocaleString("pt-BR")}
                              </div>
                              {log.ended_at && (
                                <div>
                                  <span className="font-medium">Fim:</span>{" "}
                                  {new Date(log.ended_at).toLocaleString("pt-BR")}
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
