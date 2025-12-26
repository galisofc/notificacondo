import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Types for MercadoPago Card Payment Brick
interface ICardPaymentBrickPayer {
  email?: string;
  identification?: {
    type?: string;
    number?: string;
  };
}

interface ICardPaymentFormData {
  token: string;
  issuer_id: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: ICardPaymentBrickPayer;
}
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, CheckCircle2, XCircle } from "lucide-react";

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

type PaymentStatus = "idle" | "loading" | "success" | "error";

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
      // Reset state when dialog closes
      setPaymentStatus("idle");
      // Unmount brick controller if it exists
      if (typeof window !== "undefined" && (window as any).cardPaymentBrickController) {
        try {
          (window as any).cardPaymentBrickController.unmount();
        } catch (e) {
          console.log("Error unmounting card payment brick:", e);
        }
      }
    }
  }, [showDialog]);

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: {
      token: string;
      payment_method_id: string;
      installments: number;
      issuer_id: string;
      payer_email: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-process-payment",
        {
          body: {
            invoice_id: invoiceId,
            token: paymentData.token,
            payment_method_id: paymentData.payment_method_id,
            installments: paymentData.installments,
            issuer_id: paymentData.issuer_id,
            payer_email: paymentData.payer_email,
            amount: amount,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.status === "approved") {
        setPaymentStatus("success");
        toast({
          title: "Pagamento aprovado!",
          description: "Seu pagamento foi processado com sucesso.",
        });
        onPaymentSuccess?.();
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
    async (formData: ICardPaymentFormData) => {
      console.log("Card payment form submitted:", formData);
      setPaymentStatus("loading");

      processPaymentMutation.mutate({
        token: formData.token,
        payment_method_id: formData.payment_method_id,
        installments: formData.installments,
        issuer_id: formData.issuer_id?.toString() || "",
        payer_email: formData.payer?.email || payerEmail,
      });
    },
    [processPaymentMutation, payerEmail]
  );

  const handleError = useCallback((error: any) => {
    console.error("Card payment error:", error);
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
              Pagamento via Cartão
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do cartão para realizar o pagamento
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

            {/* Payment Status */}
            {paymentStatus === "success" && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-emerald-600">Pagamento realizado com sucesso!</p>
                <Button className="mt-4" onClick={handleCloseDialog}>
                  Fechar
                </Button>
              </div>
            )}

            {paymentStatus === "error" && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                <p className="font-medium text-destructive">Erro ao processar pagamento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Por favor, verifique os dados e tente novamente.
                </p>
              </div>
            )}

            {paymentStatus === "loading" && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Processando pagamento...</p>
              </div>
            )}

            {/* Card Payment Brick */}
            {paymentStatus === "idle" && sdkInitialized && (
              <div className="min-h-[400px]">
                <CardPayment
                  initialization={{
                    amount: amount,
                    payer: {
                      email: payerEmail,
                    },
                  }}
                  customization={{
                    paymentMethods: {
                      maxInstallments: 1,
                      minInstallments: 1,
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
                <p className="text-muted-foreground">Carregando formulário de pagamento...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
