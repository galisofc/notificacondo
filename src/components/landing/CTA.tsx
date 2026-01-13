import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">Comece em menos de 5 minutos</span>
          </div>

          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold mb-6">
            Mais do que notificar,{" "}
            <span className="text-gradient">o NotificaCondo comprova.</span>
          </h2>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Junte-se a mais de 500 condomínios que já eliminaram o problema do 
            "não fui avisado" com prova jurídica automatizada.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" className="group" asChild>
              <Link to="/auth">
                Teste Grátis por 7 Dias
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="glass" size="xl" asChild>
              <Link to="/contato">Agendar Demonstração</Link>
            </Button>
          </div>

          {/* Trust Badge */}
          <div className="mt-12 flex items-center justify-center gap-3 text-muted-foreground">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm">
              Seus dados protegidos conforme LGPD • Sem cartão de crédito
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
