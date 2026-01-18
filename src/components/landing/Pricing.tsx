import { Button } from "@/components/ui/button";
import { 
  Check, 
  Sparkles, 
  Loader2, 
  MessageCircle, 
  Clock, 
  Flame, 
  Scale, 
  Package, 
  PartyPopper,
  ArrowRight,
  Star,
  Zap,
  Crown,
  Shield
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTrialDays } from "@/hooks/useTrialDays";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

const Pricing = () => {
  const navigate = useNavigate();
  const { trialDays } = useTrialDays();
  
  // Countdown timer - ends at midnight
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const diff = endOfDay.getTime() - now.getTime();
      
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
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

  const isPopular = (slug: string) => slug === 'profissional';

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'start': return Star;
      case 'essencial': return Zap;
      case 'profissional': return Crown;
      case 'enterprise': return Shield;
      default: return Star;
    }
  };

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Urgency Banner */}
        <div className="flex items-center justify-center gap-3 mb-12 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border border-orange-500/20 max-w-xl mx-auto animate-pulse">
          <Flame className="w-5 h-5 text-orange-500" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Oferta expira em:</span>
            <div className="flex items-center gap-1 font-mono">
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-sm font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-orange-500 font-bold">:</span>
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-sm font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-orange-500 font-bold">:</span>
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-sm font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
            </div>
          </div>
          <Clock className="w-4 h-4 text-orange-500" />
        </div>

        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Planos</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Escolha o plano ideal para{" "}
            <span className="text-gradient">seu condomínio</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            <span className="text-primary font-semibold">{trialDays} dias grátis para testar!</span> Cancele quando quiser.
          </p>
        </div>

        {/* Modules Included Badge */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <p className="text-sm font-medium text-muted-foreground">Todos os planos incluem os 3 módulos:</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
              <Scale className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Ocorrências & Multas</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Encomendas</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30">
              <PartyPopper className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Salão de Festas</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <motion.div 
            className={`grid md:grid-cols-2 ${plans && plans.length >= 4 ? 'lg:grid-cols-4' : plans && plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 max-w-7xl mx-auto`}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {plans?.map((plan) => {
              const PlanIcon = getPlanIcon(plan.slug);
              return (
                <motion.div
                  key={plan.id}
                  variants={cardVariants}
                  whileHover={{ 
                    y: -8, 
                    transition: { type: "spring", stiffness: 300, damping: 20 } 
                  }}
                >
                  <Card 
                    className={`relative h-full transition-all duration-300 hover:shadow-lg ${
                      isPopular(plan.slug) 
                        ? 'border-primary/50 shadow-glow ring-2 ring-primary/20' 
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    {isPopular(plan.slug) && (
                      <motion.div 
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1"
                        initial={{ scale: 0, y: -10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                      >
                        <Sparkles className="w-3 h-3" />
                        Mais Popular
                      </motion.div>
                    )}

                    <CardHeader className="text-center pb-4">
                      <motion.div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)` }}
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <PlanIcon className="w-7 h-7 text-white" />
                      </motion.div>

                      <CardTitle className="font-display text-2xl mb-2">
                        {plan.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {plan.description || `Plano ${plan.name}`}
                      </p>
                    </CardHeader>

                    <CardContent>
                      <div className="text-center mb-6">
                        {plan.price === 0 ? (
                          <span className="font-display text-3xl font-bold text-foreground">
                            Consulte
                          </span>
                        ) : (
                          <div>
                            <span className="text-muted-foreground text-sm">R$</span>
                            <span className="font-display text-4xl font-bold text-foreground">
                              {formatPrice(plan.price)}
                            </span>
                            <span className="text-muted-foreground text-sm">/mês</span>
                          </div>
                        )}
                      </div>

                      {/* Limits */}
                      <div className="space-y-2 mb-6 p-4 rounded-lg bg-secondary/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Notificações</span>
                          <span className="font-medium">
                            {plan.notifications_limit === -1 ? 'Ilimitadas' : `${plan.notifications_limit}/mês`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Advertências</span>
                          <span className="font-medium">
                            {plan.warnings_limit === -1 ? 'Ilimitadas' : `${plan.warnings_limit}/mês`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Multas</span>
                          <span className="font-medium">
                            {plan.fines_limit === -1 ? 'Ilimitadas' : plan.fines_limit === 0 ? '—' : `${plan.fines_limit}/mês`}
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                          <Check className="w-4 h-4 text-primary" />
                          <span className="text-xs text-primary font-medium">3 módulos inclusos</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                          <MessageCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Integração WhatsApp</span>
                        </div>
                      </div>

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
                        {plan.price === 0 ? "Fale Conosco" : `Começar ${trialDays} dias grátis`}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
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
