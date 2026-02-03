import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  X, 
  Sparkles, 
  Loader2, 
  MessageCircle, 
  Clock, 
  Flame, 
  Scale, 
  Package, 
  PartyPopper,
  Shield,
  Zap,
  Users,
  FileText,
  Bell,
  ArrowLeft,
  ArrowRight,
  Crown,
  Star
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const tableVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6, 
      ease: "easeOut"
    }
  }
};

// Feature comparison data
const featureCategories = [
  {
    name: "Módulo de Ocorrências",
    icon: Scale,
    features: [
      { name: "Registro de ocorrências", description: "Cadastre todas as ocorrências do condomínio", all: true },
      { name: "Notificações automáticas via WhatsApp", description: "Envio automático para moradores", all: true },
      { name: "Sistema de defesa online", description: "Moradores podem enviar defesas pelo sistema", all: true },
      { name: "Prova jurídica automática", description: "Comprovante de entrega com validade legal", all: true },
      { name: "Análise de defesa por IA", description: "Sugestões inteligentes para decisões", plans: ["profissional", "enterprise"] },
      { name: "Relatórios avançados", description: "Dashboards e métricas detalhadas", plans: ["profissional", "enterprise"] },
    ]
  },
  {
    name: "Módulo de Encomendas",
    icon: Package,
    features: [
      { name: "Registro de encomendas", description: "Cadastro rápido com foto", all: true },
      { name: "Notificação de chegada", description: "Morador é avisado automaticamente", all: true },
      { name: "Código de retirada", description: "Sistema seguro de confirmação", all: true },
      { name: "Histórico completo", description: "Rastreamento de todas as encomendas", all: true },
      { name: "Múltiplos porteiros", description: "Cadastre porteiros ilimitados", plans: ["essencial", "profissional", "enterprise"] },
    ]
  },
  {
    name: "Módulo Salão de Festas",
    icon: PartyPopper,
    features: [
      { name: "Agenda de reservas", description: "Calendário visual de reservas", all: true },
      { name: "Checklist de entrada/saída", description: "Verificação de itens do salão", all: true },
      { name: "Notificações de lembrete", description: "Avisos automáticos das reservas", all: true },
      { name: "Regras personalizadas", description: "Configure regras do seu condomínio", all: true },
      { name: "Múltiplos espaços", description: "Gerencie vários espaços de festas", plans: ["profissional", "enterprise"] },
    ]
  },
  {
    name: "Recursos Gerais",
    icon: Zap,
    features: [
      { name: "Integração WhatsApp", description: "Mensagens automáticas via WhatsApp", all: true },
      { name: "Conformidade LGPD", description: "Dados protegidos conforme a lei", all: true },
      { name: "Suporte por email", description: "Atendimento via email", all: true },
      { name: "Suporte prioritário", description: "Atendimento preferencial", plans: ["profissional", "enterprise"] },
      { name: "API de integração", description: "Conecte com outros sistemas", plans: ["enterprise"] },
      { name: "White-label", description: "Sua marca no sistema", plans: ["enterprise"] },
    ]
  }
];

const Plans = () => {
  const navigate = useNavigate();
  const { trialDays } = useTrialDays();
  
  // Countdown timer
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
    queryKey: ['plans-page'],
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

  const hasFeature = (feature: typeof featureCategories[0]['features'][0], planSlug: string) => {
    if (feature.all) return true;
    return feature.plans?.includes(planSlug);
  };

  return (
    <>
      <Helmet>
        <title>Planos e Preços | NotificaCondo</title>
        <meta 
          name="description" 
          content={`Compare os planos do NotificaCondo e escolha o melhor para seu condomínio. Trial grátis de ${trialDays} dias, sem cartão de crédito.`}
        />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          {/* Hero Section */}
          <section className="container mx-auto px-4 mb-16">
            <Button 
              variant="ghost" 
              className="mb-6"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Home
            </Button>
            
            {/* Urgency Banner */}
            <div className="flex items-center justify-center gap-3 mb-8 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border border-orange-500/20 max-w-xl mx-auto">
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
            
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-4 h-4 mr-1.5" />
                {trialDays} dias grátis para testar
              </Badge>
              <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">
                Escolha o plano ideal para{" "}
                <span className="text-gradient">seu condomínio</span>
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl mb-8">
                Comece grátis e faça upgrade quando precisar. Sem compromisso, cancele quando quiser.
              </p>
              
              {/* Modules Badge */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
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
          </section>

          {/* Plans Grid */}
          <section className="container mx-auto px-4 mb-20">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <motion.div 
                className={`grid md:grid-cols-2 ${plans && plans.length >= 4 ? 'lg:grid-cols-4' : plans && plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 max-w-7xl mx-auto`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {plans?.map((plan, index) => {
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
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Notif. Encomendas</span>
                              <span className="font-medium">
                                {(plan as any).package_notifications_limit === -1 ? 'Ilimitadas' : `${(plan as any).package_notifications_limit || 50}/mês`}
                              </span>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                              <Check className="w-4 h-4 text-primary" />
                              <span className="text-xs text-primary font-medium">4 módulos inclusos</span>
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
          </section>

          {/* Feature Comparison */}
          <section className="container mx-auto px-4 mb-20">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Compare todos os recursos
              </h2>
              <p className="text-muted-foreground text-lg">
                Veja em detalhes o que cada plano oferece
              </p>
            </motion.div>

            <Tabs defaultValue="all" className="max-w-6xl mx-auto">
              <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full mb-8">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
                <TabsTrigger value="encomendas">Encomendas</TabsTrigger>
                <TabsTrigger value="salao">Salão</TabsTrigger>
                <TabsTrigger value="geral">Geral</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-8">
                {featureCategories.map((category, index) => (
                  <FeatureCategoryTable key={category.name} category={category} plans={plans || []} hasFeature={hasFeature} index={index} />
                ))}
              </TabsContent>

              <TabsContent value="ocorrencias">
                <FeatureCategoryTable category={featureCategories[0]} plans={plans || []} hasFeature={hasFeature} index={0} />
              </TabsContent>

              <TabsContent value="encomendas">
                <FeatureCategoryTable category={featureCategories[1]} plans={plans || []} hasFeature={hasFeature} index={0} />
              </TabsContent>

              <TabsContent value="salao">
                <FeatureCategoryTable category={featureCategories[2]} plans={plans || []} hasFeature={hasFeature} index={0} />
              </TabsContent>

              <TabsContent value="geral">
                <FeatureCategoryTable category={featureCategories[3]} plans={plans || []} hasFeature={hasFeature} index={0} />
              </TabsContent>
            </Tabs>
          </section>

          {/* FAQ Section */}
          <section className="container mx-auto px-4 mb-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-display text-3xl font-bold text-center mb-8">
                Perguntas frequentes
              </h2>
              
              <div className="space-y-4">
                <Card className="p-6">
                  <h3 className="font-semibold mb-2">Como funciona o trial de {trialDays} dias?</h3>
                  <p className="text-muted-foreground text-sm">
                    Você pode usar todas as funcionalidades do plano escolhido por {trialDays} dias grátis, sem precisar cadastrar cartão de crédito. Após esse período, você pode escolher continuar com o plano ou cancelar.
                  </p>
                </Card>
                
                <Card className="p-6">
                  <h3 className="font-semibold mb-2">Posso mudar de plano depois?</h3>
                  <p className="text-muted-foreground text-sm">
                    Sim! Você pode fazer upgrade ou downgrade a qualquer momento. Em caso de upgrade, a diferença é calculada proporcionalmente ao período restante.
                  </p>
                </Card>
                
                <Card className="p-6">
                  <h3 className="font-semibold mb-2">O que acontece se eu ultrapassar os limites?</h3>
                  <p className="text-muted-foreground text-sm">
                    Quando você atinge o limite do seu plano, você recebe um aviso e pode fazer upgrade para continuar utilizando. Não há cobranças extras automáticas.
                  </p>
                </Card>
                
                <Card className="p-6">
                  <h3 className="font-semibold mb-2">Quais formas de pagamento são aceitas?</h3>
                  <p className="text-muted-foreground text-sm">
                    Aceitamos PIX, cartão de crédito e boleto bancário através do Mercado Pago.
                  </p>
                </Card>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-8 md:p-12 text-center bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/20">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Pronto para modernizar seu condomínio?
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                Comece hoje mesmo com {trialDays} dias grátis. Sem cartão de crédito, sem compromisso.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="hero" size="lg" onClick={() => navigate('/auth')}>
                  Começar gratuitamente
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate('/contato')}>
                  Falar com vendas
                </Button>
              </div>
            </Card>
          </section>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

// Feature Category Table Component
interface FeatureCategoryTableProps {
  category: typeof featureCategories[0];
  plans: Array<{ slug: string; name: string }>;
  hasFeature: (feature: typeof featureCategories[0]['features'][0], planSlug: string) => boolean;
  index?: number;
}

const FeatureCategoryTable = ({ category, plans, hasFeature, index = 0 }: FeatureCategoryTableProps) => {
  const CategoryIcon = category.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <motion.div 
              className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <CategoryIcon className="w-5 h-5 text-primary" />
            </motion.div>
            <CardTitle className="text-xl">{category.name}</CardTitle>
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Recurso</th>
                  {plans.map((plan) => (
                    <th key={plan.slug} className="text-center py-3 px-4 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.features.map((feature, idx) => (
                  <motion.tr 
                    key={idx} 
                    className="border-b last:border-0"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-sm">{feature.name}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </td>
                    {plans.map((plan, planIdx) => (
                      <td key={plan.slug} className="text-center py-3 px-4">
                        <motion.div
                          initial={{ scale: 0 }}
                          whileInView={{ scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            delay: idx * 0.05 + planIdx * 0.02 
                          }}
                        >
                          {hasFeature(feature, plan.slug) ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-muted-foreground/30 mx-auto" />
                          )}
                        </motion.div>
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default Plans;
