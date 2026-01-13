import { Shield, Lock, CheckCircle, Award, Building2 } from "lucide-react";

const securitySeals = [
  {
    icon: Shield,
    title: "LGPD Compliant",
    description: "100% em conformidade",
  },
  {
    icon: Lock,
    title: "SSL Seguro",
    description: "Criptografia 256-bit",
  },
  {
    icon: CheckCircle,
    title: "Código Civil",
    description: "Arts. 1.331 a 1.358",
  },
  {
    icon: Award,
    title: "ISO 27001",
    description: "Segurança da informação",
  },
];

const partnerCondominiums = [
  { name: "Residencial Vista Verde", city: "São Paulo" },
  { name: "Edifício Aurora", city: "Rio de Janeiro" },
  { name: "Condomínio Solar", city: "Belo Horizonte" },
  { name: "Torres do Parque", city: "Curitiba" },
  { name: "Monte Azul", city: "Porto Alegre" },
  { name: "Edifício Central", city: "Brasília" },
  { name: "Jardins Premium", city: "Salvador" },
  { name: "Alto da Serra", city: "Recife" },
];

const TrustBadges = () => {
  return (
    <section className="py-16 relative overflow-hidden border-y border-border/30">
      <div className="absolute inset-0 bg-gradient-to-r from-secondary/30 via-transparent to-secondary/30" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Security Seals */}
        <div className="text-center mb-12">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Segurança e Conformidade</span>
          <h3 className="font-display text-2xl md:text-3xl font-bold mt-2">
            Sua gestão protegida por{" "}
            <span className="text-gradient">padrões internacionais</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-16">
          {securitySeals.map((seal, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-glow group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <seal.icon className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground text-sm text-center">{seal.title}</h4>
              <p className="text-xs text-muted-foreground text-center mt-1">{seal.description}</p>
            </div>
          ))}
        </div>

        {/* Partner Condominiums */}
        <div className="text-center mb-8">
          <p className="text-muted-foreground text-sm">
            Confiado por mais de <span className="text-primary font-semibold">500 condomínios</span> em todo o Brasil
          </p>
        </div>

        {/* Scrolling logos */}
        <div className="relative overflow-hidden">
          <div className="flex animate-scroll gap-8">
            {[...partnerCondominiums, ...partnerCondominiums].map((condo, index) => (
              <div
                key={index}
                className="flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-xl bg-card/50 border border-border/30 hover:border-primary/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground whitespace-nowrap">{condo.name}</p>
                  <p className="text-xs text-muted-foreground">{condo.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Trust Elements */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Dados armazenados no Brasil</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Backup automático diário</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Suporte 100% em português</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Uptime 99.9%</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
