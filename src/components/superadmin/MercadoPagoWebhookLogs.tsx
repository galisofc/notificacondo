import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  RefreshCw,
  Webhook,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  received_at: string;
  event_type: string;
  event_action: string | null;
  data_id: string | null;
  payload: any;
  signature_valid: boolean | null;
  processing_status: string;
  processing_result: any;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  processing_duration_ms: number | null;
  created_at: string;
}

export function MercadoPagoWebhookLogs() {
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mercadopago-webhook-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mercadopago_webhook_logs")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as WebhookLog[];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Processado
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Processando
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      payment: "bg-primary/10 text-primary border-primary/20",
      subscription_preapproval: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      subscription_authorized_payment: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      test: "bg-muted text-muted-foreground",
      parse_error: "bg-destructive/10 text-destructive border-destructive/20",
    };

    return (
      <Badge className={colors[eventType] || "bg-muted text-muted-foreground"}>
        {eventType}
      </Badge>
    );
  };

  const handleViewDetails = (log: WebhookLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Logs de Webhook</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Histórico de notificações recebidas do Mercado Pago
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum log de webhook encontrado</p>
            <p className="text-sm mt-1">As notificações do Mercado Pago aparecerão aqui</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.received_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {getEventTypeBadge(log.event_type)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.data_id ? log.data_id.substring(0, 12) + "..." : "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.processing_status)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.processing_duration_ms ? `${log.processing_duration_ms}ms` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-primary" />
                Detalhes do Webhook
              </DialogTitle>
              <DialogDescription>
                {selectedLog && format(new Date(selectedLog.received_at), "PPpp", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>

            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Evento</label>
                      <div className="mt-1">{getEventTypeBadge(selectedLog.event_type)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      <div className="mt-1">{getStatusBadge(selectedLog.processing_status)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Data ID</label>
                      <p className="font-mono text-sm">{selectedLog.data_id || "-"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Tempo de Processamento</label>
                      <p className="text-sm">{selectedLog.processing_duration_ms ? `${selectedLog.processing_duration_ms}ms` : "-"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Assinatura Válida</label>
                      <p className="text-sm">
                        {selectedLog.signature_valid === null ? "Não validada" : 
                         selectedLog.signature_valid ? "✅ Sim" : "❌ Não"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">IP</label>
                      <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {selectedLog.error_message && (
                    <div>
                      <label className="text-xs text-muted-foreground">Mensagem de Erro</label>
                      <div className="mt-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                        {selectedLog.error_message}
                      </div>
                    </div>
                  )}

                  {/* Payload */}
                  <div>
                    <label className="text-xs text-muted-foreground">Payload Recebido</label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </div>

                  {/* Processing Result */}
                  {selectedLog.processing_result && (
                    <div>
                      <label className="text-xs text-muted-foreground">Resultado do Processamento</label>
                      <pre className="mt-1 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.processing_result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* User Agent */}
                  {selectedLog.user_agent && (
                    <div>
                      <label className="text-xs text-muted-foreground">User Agent</label>
                      <p className="mt-1 text-xs text-muted-foreground break-all">{selectedLog.user_agent}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
