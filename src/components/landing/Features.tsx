import { 
  Bell, 
  FileText, 
  Scale, 
  Shield, 
  MessageSquare, 
  BarChart3,
  Lock,
  Building2
} from "lucide-react";

const features = [
  {
    icon: Bell,
    title: "Notificações Automáticas",
    description: "Envio via WhatsApp (ZPRO) com link seguro e registro de IP, data, hora e dispositivo."
  },
  {
    icon: Scale,
    title: "Contraditório e Ampla Defesa",
    description: "Prazo para defesa do morador com upload de documentos e análise fundamentada."
  },
  {
    icon: Shield,
    title: "Prova de Ciência",
    description: "Botão 'Estou ciente' com registro técnico completo. Ciência não implica concordância."
  },
  {
    icon: FileText,
    title: "Dossiê Jurídico",
    description: "Ocorrência, notificação, defesa, decisão e multa em documento único e exportável."
  },
  {
    icon: Building2,
    title: "Hierarquia Condominial",
    description: "Condomínios, blocos, apartamentos e moradores organizados de forma estruturada."
  },
  {
    icon: MessageSquare,
    title: "Base Legal Obrigatória",
    description: "Convenção, regimento interno e artigos 1.336 e 1.337 do Código Civil vinculados."
  },
  {
    icon: Lock,
    title: "LGPD Compliant",
    description: "Tratamento de dados conforme Lei nº 13.709/2018 com logs imutáveis."
  },
  {
    icon: BarChart3,
    title: "Relatórios e Métricas",
    description: "Dashboard com visão geral de ocorrências, multas e histórico por unidade."
  }
];

const Features = () => {
  return (
    <section id="funcionalidades" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Funcionalidades</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Tudo que você precisa para{" "}
            <span className="text-gradient">notificar com segurança</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Sistema completo para gestão de advertências, notificações e multas 
            com validade jurídica e conformidade legal.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-glow"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
