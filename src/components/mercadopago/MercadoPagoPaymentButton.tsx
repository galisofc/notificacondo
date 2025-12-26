import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";

interface MercadoPagoPaymentButtonProps {
  invoiceId: string;
  payerEmail: string;
  amount: number;
  buttonText?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function MercadoPagoPaymentButton({
  invoiceId,
  payerEmail,
  amount,
  buttonText = "Pagar",
  variant = "outline",
  size = "sm",
}: MercadoPagoPaymentButtonProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-create-payment",
        {
          body: {
            invoice_id: invoiceId,
            payer_email: payerEmail,
            back_url: window.location.origin + "/sindico/invoices",
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.init_point) {
        setCheckoutUrl(data.init_point);
        setShowDialog(true);
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível gerar o link de pagamento.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Error creating payment:", error);
      toast({
        title: "Erro ao gerar pagamento",
        description:
          error.message ||
          "Não foi possível gerar o link de pagamento. Verifique se o Mercado Pago está configurado.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePayment = () => {
    createPaymentMutation.mutate();
  };

  const handleOpenCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      setShowDialog(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleCreatePayment}
        disabled={createPaymentMutation.isPending}
      >
        {createPaymentMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-1" />
            {buttonText}
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamento via Mercado Pago</DialogTitle>
            <DialogDescription>
              Clique no botão abaixo para completar o pagamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Valor a pagar:</span>
                <span className="text-lg font-bold">{formatCurrency(amount)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para o checkout seguro do Mercado Pago.
                Após concluir o pagamento, você será redirecionado de volta para a plataforma.
              </p>
            </div>
            <Button onClick={handleOpenCheckout} className="w-full" size="lg">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ir para o Checkout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
