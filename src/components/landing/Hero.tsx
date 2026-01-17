import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, CheckCircle, Play, Package, PartyPopper, Scale } from "lucide-react";
import ScreenshotsModal from "./ScreenshotsModal";

const Hero = () => {
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-border/50 mb-8 animate-fade-up">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Gestão Condominial Completa • LGPD • WhatsApp</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Seu condomínio{" "}
            <span className="text-gradient">100% organizado</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Ocorrências com validade jurídica, encomendas com notificação instantânea 
            e salão de festas com checklist automatizado — tudo integrado.
          </p>

          {/* Module Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 animate-fade-up" style={{ animationDelay: '0.25s' }}>
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

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <a href="#pricing">
              <Button 
                variant="hero" 
                size="xl" 
                className="group"
              >
                Começar Grátis por 7 dias
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Button variant="glass" size="xl" onClick={() => setScreenshotsOpen(true)}>
              <Play className="w-5 h-5" />
              Ver Demonstração
            </Button>
          </div>

          <ScreenshotsModal open={screenshotsOpen} onOpenChange={setScreenshotsOpen} />

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span>7 dias grátis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span>WhatsApp integrado</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-up" style={{ animationDelay: '0.5s' }}>
          {[
            { value: "500+", label: "Condomínios" },
            { value: "50k+", label: "Notificações enviadas" },
            { value: "10k+", label: "Encomendas gerenciadas" },
            { value: "100%", label: "Conformidade legal" },
          ].map((stat, index) => (
            <div key={index} className="text-center p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
              <div className="font-display text-3xl md:text-4xl font-bold text-gradient mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
