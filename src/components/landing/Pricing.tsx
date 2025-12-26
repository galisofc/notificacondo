import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Start",
    price: "49,90",
    description: "Ideal para condomínios pequenos",
    color: "from-emerald-500 to-emerald-600",
    features: [
      "10 notificações/mês",
      "10 advertências/mês",
      "Integração ZPRO",
      "Registro de ciência",
      "1 condomínio"
    ],
    popular: false
  },
  {
    name: "Essencial",
    price: "99,90",
    description: "Para condomínios em crescimento",
    color: "from-blue-500 to-blue-600",
    features: [
      "30 notificações/mês",
      "30 advertências/mês",
      "15 multas/mês",
      "Defesa do morador",
      "Relatórios PDF",
      "2 condomínios"
    ],
    popular: false
  },
  {
    name: "Profissional",
    price: "199,90",
    description: "Gestão completa e profissional",
    color: "from-violet-500 to-purple-600",
    features: [
      "Notificações ilimitadas",
      "Advertências ilimitadas",
      "50 multas/mês",
      "Dossiê jurídico completo",
      "Suporte prioritário",
      "5 condomínios"
    ],
    popular: true
  },
  {
    name: "Enterprise",
    price: "Consulte",
    description: "Soluções personalizadas",
    color: "from-orange-500 to-red-500",
    features: [
      "Tudo ilimitado",
      "Multi-condomínios",
      "API dedicada",
      "SLA garantido",
      "Onboarding assistido",
      "Suporte 24/7"
    ],
    popular: false
  }
];

const Pricing = () => {
  return (
    <section id="planos" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Planos</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Escolha o plano ideal para{" "}
            <span className="text-gradient">seu condomínio</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Todos os planos incluem integração ZPRO, registro de ciência e conformidade LGPD.
            Cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative p-6 rounded-2xl bg-gradient-card border transition-all duration-300 hover:shadow-glow ${
                plan.popular 
                  ? 'border-primary/50 shadow-glow' 
                  : 'border-border/50 hover:border-primary/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Mais Popular
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                <span className="font-display text-lg font-bold text-white">
                  {plan.name[0]}
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-foreground mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {plan.description}
              </p>

              <div className="mb-6">
                {plan.price === "Consulte" ? (
                  <span className="font-display text-3xl font-bold text-foreground">
                    Consulte
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground text-sm">R$</span>
                    <span className="font-display text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.popular ? "hero" : "outline"} 
                className="w-full"
              >
                {plan.price === "Consulte" ? "Fale Conosco" : "Começar Agora"}
              </Button>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground mb-4">Pagamento seguro via</p>
          <div className="flex items-center justify-center gap-6">
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
