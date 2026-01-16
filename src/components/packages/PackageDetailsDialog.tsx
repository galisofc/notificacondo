import { useState } from "react";
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
  RefreshCw
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "@/hooks/usePackages";
import { PackageStatusBadge } from "./PackageStatusBadge";
import { cn } from "@/lib/utils";

interface PackageDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package_: Package | null;
}

type NotificationStatus = "idle" | "sending" | "success" | "error";

interface NotificationResult {
  notifications_sent: number;
  notifications_failed: number;
  message: string;
}

export function PackageDetailsDialog({
  open,
  onOpenChange,
  package_,
}: PackageDetailsDialogProps) {
  const { toast } = useToast();
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("idle");
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

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
        console.error("Error sending notification:", error);
        setNotificationStatus("error");
        setErrorMessage(error.message || "Erro ao enviar notificação");
        toast({
          title: "Erro ao enviar notificação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setNotificationResult(data);

      if (data.notifications_sent > 0) {
        setNotificationStatus("success");
        toast({
          title: "Notificação enviada!",
          description: `${data.notifications_sent} morador(es) notificado(s) via WhatsApp`,
        });
      } else {
        setNotificationStatus("error");
        setErrorMessage(data.message || "Nenhum morador notificado");
        toast({
          title: "Aviso",
          description: data.message || "Nenhum morador notificado",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Notification error:", err);
      setNotificationStatus("error");
      setErrorMessage(err.message || "Erro inesperado");
      toast({
        title: "Erro",
        description: "Falha ao enviar notificação",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    // Reset state when closing
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="w-5 h-5 text-primary" />
            Detalhes da Encomenda
          </DialogTitle>
          <DialogDescription>
            Visualize os detalhes e reenvie notificações se necessário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Package Photo & Info */}
          <div className="flex gap-4">
            <div className="w-28 h-28 rounded-lg overflow-hidden bg-muted shrink-0">
              <img
                src={package_.photo_url}
                alt="Encomenda"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xl text-primary tracking-wider">
                  {package_.pickup_code}
                </span>
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

          <Separator />

          {/* Notification Section */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Notificação WhatsApp
            </h4>

            {/* Status feedback */}
            {notificationStatus === "success" && notificationResult && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Notificação enviada com sucesso!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {notificationResult.notifications_sent} morador(es) notificado(s)
                  </p>
                </div>
              </div>
            )}

            {notificationStatus === "error" && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Falha ao enviar notificação
                  </p>
                  <p className="text-xs text-destructive/80">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Action button */}
            {package_.status === "pendente" && (
              <Button
                onClick={handleResendNotification}
                disabled={notificationStatus === "sending"}
                variant={notificationStatus === "error" ? "default" : "outline"}
                className={cn(
                  "w-full gap-2",
                  notificationStatus === "success" && "border-green-500 text-green-600 hover:text-green-700"
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
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Notificação via WhatsApp
                  </>
                )}
              </Button>
            )}

            {package_.status !== "pendente" && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Esta encomenda já foi retirada. Notificações não são enviadas para encomendas retiradas.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
