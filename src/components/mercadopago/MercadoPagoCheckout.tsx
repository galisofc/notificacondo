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

interface MercadoPagoCheckoutProps {
  condominiumId: string;
  planSlug: string;
  payerEmail: string;
  buttonText?: string;
  variant?: "default" | "outline" | "ghost";
}

export function MercadoPagoCheckout({
  condominiumId,
  planSlug,
  payerEmail,
  buttonText = "Assinar com Mercado Pago",
  variant = "default",
}: MercadoPagoCheckoutProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const createSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "mercadopago-create-subscription",
        {
          body: {
            condominium_id: condominiumId,
            plan_slug: planSlug,
            payer_email: payerEmail,
            back_url: window.location.origin + "/sindico/subscriptions",
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
      console.error("Error creating subscription:", error);
      toast({
        title: "Erro ao criar assinatura",
        description:
          error.message ||
          "Não foi possível criar a assinatura. Verifique se o Mercado Pago está configurado.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubscription = () => {
    createSubscriptionMutation.mutate();
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
        onClick={handleCreateSubscription}
        disabled={createSubscriptionMutation.isPending}
      >
        {createSubscriptionMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {buttonText}
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura Mercado Pago</DialogTitle>
            <DialogDescription>
              Clique no botão abaixo para completar o pagamento no Mercado Pago
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                Você será redirecionado para o checkout seguro do Mercado Pago.
                Após concluir o pagamento, você será redirecionado de volta para
                a plataforma.
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
