import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Check, 
  X, 
  Building2, 
  Clock, 
  Package as PackageIcon,
  AlertCircle,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "@/hooks/usePackages";
import { PackageStatusBadge } from "./PackageStatusBadge";
import { PackageCardImage } from "./PackageCardImage";
import { getSignedPackagePhotoUrl } from "@/lib/packageStorage";
import { cn } from "@/lib/utils";

interface PackageDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package_: Package | null;
  /** When false, the pickup code will not be rendered (useful for concierge views). */
  showPickupCode?: boolean;
}

type NotificationStatus = "idle" | "sending" | "success" | "error";

interface NotificationResult {
  notifications_sent: number;
  notifications_failed: number;
  message: string;
}

interface NotificationLog {
  id: string;
  created_at: string;
  success: boolean;
  error_message: string | null;
  template_name: string | null;
  debug_info: { sent_by_name?: string } | null;
}

export function PackageDetailsDialog({
  open,
  onOpenChange,
  package_,
  showPickupCode = true,
}: PackageDetailsDialogProps) {
  const { toast } = useToast();
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("idle");
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Generate signed URL when package changes
  useEffect(() => {
    if (open && package_?.photo_url) {
      setIsLoadingPhoto(true);
      setSignedPhotoUrl(null);
      getSignedPackagePhotoUrl(package_.photo_url)
        .then((url) => setSignedPhotoUrl(url))
        .catch(() => setSignedPhotoUrl(null))
        .finally(() => setIsLoadingPhoto(false));
    } else {
      setSignedPhotoUrl(null);
      setIsLoadingPhoto(false);
    }
  }, [open, package_?.photo_url]);

  // Fetch notification history from whatsapp_notification_logs
  const fetchNotificationLogs = async () => {
    if (!package_?.id) return;
    setIsLoadingLogs(true);
    try {
      const { data } = await supabase
        .from("whatsapp_notification_logs")
        .select("id, created_at, success, error_message, template_name, debug_info")
        .eq("package_id", package_.id)
        .order("created_at", { ascending: false });
      setNotificationLogs((data || []) as NotificationLog[]);
    } catch (err) {
      console.error("Error fetching notification logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (open && package_?.id) {
      fetchNotificationLogs();
    } else {
      setNotificationLogs([]);
    }
  }, [open, package_?.id]);

  const handleResendNotification = async () => {
    if (!package_) return;

    setNotificationStatus("sending");
    setNotificationResult(null);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("notify-package-arrival", {
        body: {
          package_id: package_.id,
          apartment_id: package_.apartment_id,
          pickup_code: package_.pickup_code,
          photo_url: package_.photo_url,
        },
      });

      if (error) {
        setNotificationStatus("error");
        setErrorMessage(error.message || "Erro ao enviar notificação");
        return;
      }

      setNotificationResult(data);

      if (data.notifications_sent > 0) {
        setNotificationStatus("success");
      } else {
        setNotificationStatus("error");
        setErrorMessage(data.message || "Nenhum morador notificado");
      }

      // Refresh logs after send
      await fetchNotificationLogs();
    } catch (err: any) {
      setNotificationStatus("error");
      setErrorMessage(err.message || "Erro inesperado");
    }
  };

  const handleClose = () => {
    setNotificationStatus("idle");
    setNotificationResult(null);
    setErrorMessage("");
    onOpenChange(false);
  };

  if (!package_) return null;

  const formattedDate = format(new Date(package_.received_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="w-5 h-5 text-primary" />
            Detalhes da Encomenda
          </DialogTitle>
          <DialogDescription>
            Visualize os detalhes e reenvie notificações se necessário
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-1">
          <div className="space-y-4">
            {/* Package Photo & Info */}
            <div className="flex gap-4">
              <div className="w-28 h-28 rounded-lg overflow-hidden bg-muted shrink-0">
                {isLoadingPhoto ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : signedPhotoUrl ? (
                  <PackageCardImage
                    src={signedPhotoUrl}
                    alt="Encomenda"
                    className="w-full h-full rounded-lg"
                    compact
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <PackageIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {showPickupCode && (
                    <span className="font-mono font-bold text-xl text-primary tracking-wider">
                      {package_.pickup_code}
                    </span>
                  )}
                  <PackageStatusBadge status={package_.status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {package_.block?.name} - Apto {package_.apartment?.number}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{formattedDate}</span>
                </div>
                {package_.condominium?.name && (
                  <p className="text-xs text-muted-foreground">
                    {package_.condominium.name}
                  </p>
                )}
              </div>
            </div>

            {package_.description && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{package_.description}</p>
              </div>
            )}

            {/* Pickup info */}
            {package_.status === "retirada" && (
              <>
                <Separator />
                <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium">Encomenda Retirada</p>
                  </div>
                  {package_.picked_up_by_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>Retirada por: <strong>{package_.picked_up_by_name}</strong></span>
                    </div>
                  )}
                  {package_.picked_up_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {format(new Date(package_.picked_up_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Notification Section */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Notificação WhatsApp
                {notificationLogs.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {notificationLogs.length} {notificationLogs.length === 1 ? "envio" : "envios"}
                  </Badge>
                )}
              </h4>

              {/* Action button */}
              {package_.status === "pendente" && (
                <Button
                  onClick={handleResendNotification}
                  disabled={notificationStatus === "sending"}
                  variant={notificationStatus === "error" ? "default" : "outline"}
                  className={cn(
                    "w-full gap-2",
                    notificationStatus === "success" && "border-primary/50 text-primary"
                  )}
                >
                  {notificationStatus === "sending" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : notificationStatus === "success" ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reenviar Notificação
                    </>
                  ) : notificationStatus === "error" ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Tentar Novamente
                    </>
                  ) : notificationLogs.length > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reenviar Notificação via WhatsApp
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Notificação via WhatsApp
                    </>
                  )}
                </Button>
              )}

              {/* Notification history cards */}
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Carregando histórico...</span>
                </div>
              ) : notificationLogs.length > 0 ? (
                <div className="space-y-2">
                  {notificationLogs.map((log, index) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border text-sm",
                        log.success
                          ? "bg-[hsl(142,76%,97%)] border-[hsl(142,76%,80%)] dark:bg-[hsl(142,30%,12%)] dark:border-[hsl(142,30%,25%)]"
                          : "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-[hsl(142,72%,29%)] dark:text-[hsl(142,60%,50%)]" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-medium text-xs", log.success ? "text-[hsl(142,72%,25%)] dark:text-[hsl(142,60%,55%)]" : "")}>
                            {log.success ? "Enviada com sucesso" : "Falha no envio"}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            #{notificationLogs.length - index}º envio
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {log.debug_info?.sent_by_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 shrink-0" />
                            Enviado por: <span className="font-medium">{log.debug_info.sent_by_name}</span>
                          </p>
                        )}
                        {!log.success && log.error_message && (
                          <p className="text-xs text-destructive mt-1 truncate">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !package_.notification_sent ? (
                <div className="p-3 bg-muted/50 rounded-lg border border-dashed text-center">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Nenhuma notificação enviada ainda</p>
                </div>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
