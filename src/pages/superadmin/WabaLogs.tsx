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
  MessageSquare,
  RefreshCw,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WabaLogRow {
  id: string;
  created_at: string;
  function_name: string;
  package_id: string | null;
  resident_id: string | null;
  phone: string | null;
  template_name: string | null;
  template_language: string | null;
  request_payload: Record<string, unknown> | null;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  message_id: string | null;
  error_message: string | null;
  debug_info: Record<string, unknown> | null;
}

export default function WabaLogs() {
  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["waba-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as WabaLogRow[];
    },
    refetchInterval: 15000,
  });

  const successCount = logs?.filter(l => l.success).length || 0;
  const failCount = logs?.filter(l => !l.success).length || 0;

  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs WABA | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[
          { label: "Logs", href: "/superadmin/logs" },
          { label: "WABA (WhatsApp Business)" }
        ]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">Logs WABA</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Histórico de notificações via WhatsApp Business API
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Enviados com sucesso</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{failCount}</div>
                  <div className="text-xs text-muted-foreground">Falhas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Últimos 100 envios WABA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {logs?.map((log) => (
                    <div 
                      key={log.id} 
                      className={`border rounded-lg p-3 ${
                        log.success 
                          ? 'border-green-500/20 bg-green-500/5' 
                          : 'border-destructive/20 bg-destructive/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {log.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {log.template_name || "Template desconhecido"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {log.phone} • {formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                                locale: ptBR
                              })}
                            </div>
                            {!log.success && log.error_message && (
                              <div className="text-xs text-destructive mt-1 line-clamp-2">
                                {log.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {log.response_status && (
                            <Badge variant={log.response_status < 400 ? "outline" : "destructive"} className="text-xs">
                              HTTP {log.response_status}
                            </Badge>
                          )}
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  {log.success ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-destructive" />
                                  )}
                                  Detalhes do Envio WABA
                                </DialogTitle>
                              </DialogHeader>
                              
                              <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
                                <TabsList className="w-full">
                                  <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
                                  <TabsTrigger value="payload" className="flex-1">Payload</TabsTrigger>
                                  <TabsTrigger value="response" className="flex-1">Resposta</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="info" className="flex-1 overflow-auto mt-4 space-y-3">
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Template:</span>
                                      <div className="font-medium">{log.template_name}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Idioma:</span>
                                      <div className="font-medium">{log.template_language}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Telefone:</span>
                                      <div className="font-medium">{log.phone}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Status HTTP:</span>
                                      <div className="font-medium">{log.response_status || "N/A"}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Message ID:</span>
                                      <div className="font-medium font-mono text-xs">{log.message_id || "N/A"}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Função:</span>
                                      <div className="font-medium">{log.function_name}</div>
                                    </div>
                                  </div>
                                  
                                  {log.error_message && (
                                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                                      <div className="text-xs font-medium text-destructive mb-1">Mensagem de Erro:</div>
                                      <pre className="text-xs text-destructive whitespace-pre-wrap break-all font-mono">
                                        {log.error_message}
                                      </pre>
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="payload" className="flex-1 overflow-auto mt-4">
                                  <div className="bg-muted rounded-md p-3">
                                    <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                                      {log.request_payload 
                                        ? JSON.stringify(log.request_payload, null, 2)
                                        : "Nenhum payload disponível"}
                                    </pre>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="response" className="flex-1 overflow-auto mt-4 space-y-3">
                                  {log.response_body && (
                                    <div className="bg-muted rounded-md p-3">
                                      <div className="text-xs font-medium text-muted-foreground mb-1">Corpo da Resposta:</div>
                                      <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                                        {log.response_body}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {log.debug_info && (
                                    <div className="bg-muted rounded-md p-3">
                                      <div className="text-xs font-medium text-muted-foreground mb-1">Debug Info:</div>
                                      <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                                        {JSON.stringify(log.debug_info, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {!log.response_body && !log.debug_info && (
                                    <div className="text-center py-8 text-muted-foreground">
                                      Nenhuma resposta disponível
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
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
