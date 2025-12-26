import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, CheckCircle2, XCircle, QrCode, FileText, Copy } from "lucide-react";

interface MercadoPagoTransparentCheckoutProps {
  invoiceId: string;
  payerEmail: string;
  amount: number;
  buttonText?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  onPaymentSuccess?: () => void;
  onPaymentError?: (error: string) => void;
}

type PaymentStatus = "idle" | "loading" | "success" | "error" | "pending_pix" | "pending_boleto";

interface PaymentResult {
  success: boolean;
  payment_id?: number;
  status?: string;
  status_detail?: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  error?: string;
}

export function MercadoPagoTransparentCheckout({
  invoiceId,
  payerEmail,
  amount,
  buttonText = "Pagar",
  variant = "outline",
  size = "sm",
  onPaymentSuccess,
  onPaymentError,
}: MercadoPagoTransparentCheckoutProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  // Fetch MercadoPago config (via backend function to avoid RLS issues)
  const { data: mpConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["mercadopago-public-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "get-mercadopago-public-config",
        { body: {} }
      );

      if (error) {
        console.error("Error fetching MercadoPago config:", error);
        return null;
      }

      return (data?.config as
        | { public_key: string | null; is_sandbox: boolean; is_active: boolean }
        | null) ?? null;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Initialize MercadoPago SDK when dialog opens and config is available
  useEffect(() => {
    if (showDialog && mpConfig?.public_key && !sdkInitialized) {
      try {
        initMercadoPago(mpConfig.public_key, {
          locale: "pt-BR",
        });
        setSdkInitialized(true);
        console.log("MercadoPago SDK initialized");
      } catch (error) {
        console.error("Error initializing MercadoPago SDK:", error);
      }
    }
  }, [showDialog, mpConfig?.public_key, sdkInitialized]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!showDialog) {
      setPaymentStatus("idle");
      setPaymentResult(null);
      if (typeof window !== "undefined" && (window as any).paymentBrickController) {
        try {
          (window as any).paymentBrickController.unmount();
        } catch (e) {
          console.log("Error unmounting payment brick:", e);
        }
      }
    }
  }, [showDialog]);

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (formData: any) => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-process-payment",
        {
          body: {
            invoice_id: invoiceId,
            amount: amount,
            form_data: formData,
          },
        }
      );

      if (error) throw error;
      return data as PaymentResult;
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      
      if (data.status === "approved") {
        setPaymentStatus("success");
        toast({
          title: "Pagamento aprovado!",
          description: "Seu pagamento foi processado com sucesso.",
        });
        onPaymentSuccess?.();
      } else if (data.status === "pending" && data.qr_code) {
        // PIX pending
        setPaymentStatus("pending_pix");
        toast({
          title: "PIX gerado!",
          description: "Escaneie o QR Code ou copie o código para pagar.",
        });
      } else if (data.status === "pending" && data.ticket_url) {
        // Boleto pending
        setPaymentStatus("pending_boleto");
        toast({
          title: "Boleto gerado!",
          description: "Clique no botão para visualizar o boleto.",
        });
      } else if (data.status === "pending" || data.status === "in_process") {
        setPaymentStatus("success");
        toast({
          title: "Pagamento em análise",
          description: "Seu pagamento está sendo processado e será confirmado em breve.",
        });
        onPaymentSuccess?.();
      } else {
        setPaymentStatus("error");
        toast({
          title: "Pagamento não aprovado",
          description: data.status_detail || "Por favor, tente novamente.",
          variant: "destructive",
        });
        onPaymentError?.(data.status_detail || "Pagamento não aprovado");
      }
    },
    onError: (error: any) => {
      console.error("Error processing payment:", error);
      setPaymentStatus("error");
      const errorMessage = error.message || "Erro ao processar pagamento";
      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
      });
      onPaymentError?.(errorMessage);
    },
  });

  const handlePaymentSubmit = useCallback(
    async (formData: any) => {
      console.log("Payment form submitted:", formData);
      setPaymentStatus("loading");
      processPaymentMutation.mutate(formData);
    },
    [processPaymentMutation]
  );

  const handleError = useCallback((error: any) => {
    console.error("Payment brick error:", error);
  }, []);

  const handleOpenDialog = () => {
    if (!mpConfig) {
      toast({
        title: "Mercado Pago não configurado",
        description: "O Mercado Pago ainda não foi configurado pelo administrador. Entre em contato com o suporte.",
        variant: "destructive",
      });
      return;
    }
    if (!mpConfig.public_key) {
      toast({
        title: "Chave pública não configurada",
        description: "A chave pública do Mercado Pago não está configurada. Entre em contato com o suporte.",
        variant: "destructive",
      });
      return;
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSdkInitialized(false);
  };

  const handleCopyPixCode = async () => {
    if (paymentResult?.qr_code) {
      await navigator.clipboard.writeText(paymentResult.qr_code);
      toast({
        title: "Código PIX copiado!",
        description: "Cole no seu app de banco para pagar.",
      });
    }
  };

  const handleOpenBoleto = () => {
    if (paymentResult?.ticket_url) {
      window.open(paymentResult.ticket_url, "_blank");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenDialog}
        disabled={isLoadingConfig}
      >
        <CreditCard className="h-4 w-4 mr-1" />
        {buttonText}
      </Button>

      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pagamento
            </DialogTitle>
            <DialogDescription>
              Escolha a forma de pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount Display */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor a pagar:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(amount)}</span>
              </div>
            </div>

            {/* Payment Status - Success */}
            {paymentStatus === "success" && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-emerald-600">Pagamento realizado com sucesso!</p>
                <Button className="mt-4" onClick={handleCloseDialog}>
                  Fechar
                </Button>
              </div>
            )}

            {/* Payment Status - PIX Pending */}
            {paymentStatus === "pending_pix" && paymentResult && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center space-y-4">
                <QrCode className="h-8 w-8 text-primary mx-auto" />
                <p className="font-medium">Pague com PIX</p>
                
                {paymentResult.qr_code_base64 && (
                  <div className="flex justify-center">
                    <img 
                      src={`data:image/png;base64,${paymentResult.qr_code_base64}`} 
                      alt="QR Code PIX" 
                      className="w-48 h-48 border rounded-lg"
                    />
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code acima ou copie o código PIX
                </p>
                
                <Button onClick={handleCopyPixCode} variant="outline" className="w-full">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar código PIX
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Após o pagamento, a confirmação pode levar alguns minutos.
                </p>
                
                <Button variant="ghost" onClick={handleCloseDialog}>
                  Fechar
                </Button>
              </div>
            )}

            {/* Payment Status - Boleto Pending */}
            {paymentStatus === "pending_boleto" && paymentResult && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center space-y-4">
                <FileText className="h-8 w-8 text-primary mx-auto" />
                <p className="font-medium">Boleto gerado!</p>
                
                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para visualizar e pagar o boleto.
                </p>
                
                <Button onClick={handleOpenBoleto} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Visualizar Boleto
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  O boleto pode levar até 3 dias úteis para ser compensado.
                </p>
                
                <Button variant="ghost" onClick={handleCloseDialog}>
                  Fechar
                </Button>
              </div>
            )}

            {/* Payment Status - Error */}
            {paymentStatus === "error" && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                <p className="font-medium text-destructive">Erro ao processar pagamento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Por favor, verifique os dados e tente novamente.
                </p>
                <Button 
                  className="mt-4" 
                  variant="outline" 
                  onClick={() => setPaymentStatus("idle")}
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Payment Status - Loading */}
            {paymentStatus === "loading" && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Processando pagamento...</p>
              </div>
            )}

            {/* Payment Brick */}
            {paymentStatus === "idle" && sdkInitialized && (
              <div className="min-h-[450px]">
                <Payment
                  initialization={{
                    amount: amount,
                    payer: {
                      email: payerEmail,
                    },
                  }}
                  customization={{
                    paymentMethods: {
                      creditCard: "all",
                      debitCard: "all",
                      bankTransfer: "all",
                      ticket: "all",
                      maxInstallments: 1,
                    },
                    visual: {
                      style: {
                        theme: "default",
                      },
                    },
                  }}
                  onSubmit={handlePaymentSubmit}
                  onError={handleError}
                />
              </div>
            )}

            {/* Loading SDK */}
            {paymentStatus === "idle" && !sdkInitialized && showDialog && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Carregando formas de pagamento...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
