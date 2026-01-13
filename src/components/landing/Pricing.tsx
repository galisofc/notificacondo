import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader2, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();
  const { data: plans, isLoading } = useQuery({
    queryKey: ['landing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const formatPrice = (price: number) => {
    if (price === 0) return "Consulte";
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getFeatures = (plan: typeof plans extends (infer T)[] ? T : never) => {
    const features: string[] = [];
    
    if (plan.notifications_limit === -1) {
      features.push("Notificações ilimitadas");
    } else if (plan.notifications_limit > 0) {
      features.push(`${plan.notifications_limit} notificações/mês`);
    }
    
    if (plan.warnings_limit === -1) {
      features.push("Advertências ilimitadas");
    } else if (plan.warnings_limit > 0) {
      features.push(`${plan.warnings_limit} advertências/mês`);
    }
    
    if (plan.fines_limit === -1) {
      features.push("Multas ilimitadas");
    } else if (plan.fines_limit > 0) {
      features.push(`${plan.fines_limit} multas/mês`);
    }
    
    // Add description as additional feature if exists
    if (plan.description) {
      features.push(plan.description);
    }
    
    return features;
  };

  const isPopular = (slug: string) => slug === 'profissional';

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Planos</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Escolha o plano ideal para{" "}
            <span className="text-gradient">seu condomínio</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            <span className="text-primary font-semibold">7 dias grátis para testar!</span> Todos os planos incluem integração WhatsApp, registro de ciência e conformidade LGPD.
            Cancele quando quiser.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className={`grid md:grid-cols-2 ${plans && plans.length >= 4 ? 'lg:grid-cols-4' : plans && plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 max-w-7xl mx-auto`}>
            {plans?.map((plan) => (
              <div 
                key={plan.id}
                className={`relative p-6 rounded-2xl bg-gradient-card border transition-all duration-300 hover:shadow-glow ${
                  isPopular(plan.slug) 
                    ? 'border-primary/50 shadow-glow' 
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                {isPopular(plan.slug) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Mais Popular
                  </div>
                )}

                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)` }}
                >
                  <span className="font-display text-lg font-bold text-white">
                    {plan.name[0]}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-foreground mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan.description || `Plano ${plan.name}`}
                </p>

                <div className="mb-6">
                  {plan.price === 0 ? (
                    <span className="font-display text-3xl font-bold text-foreground">
                      Consulte
                    </span>
                  ) : (
                    <>
                      <span className="text-muted-foreground text-sm">R$</span>
                      <span className="font-display text-4xl font-bold text-foreground">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </>
                  )}
                </div>

                {/* WhatsApp Integration Badge */}
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Integração WhatsApp</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {getFeatures(plan).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={isPopular(plan.slug) ? "hero" : "outline"} 
                  className="w-full"
                  onClick={() => {
                    if (plan.price === 0) {
                      window.open('mailto:contato@notificacondo.com.br?subject=Interesse no plano Enterprise', '_blank');
                    } else {
                      navigate(`/auth?plano=${plan.slug}`);
                    }
                  }}
                >
                  {plan.price === 0 ? "Fale Conosco" : "Começar Agora"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Payment Methods */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground mb-4">Pagamento seguro via</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="px-4 py-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              Mercado Pago
            </div>
            <div className="px-4 py-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              PIX
            </div>
            <div className="px-4 py-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              Cartão de Crédito
            </div>
            <div className="px-4 py-2 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              Boleto
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
