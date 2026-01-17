import { 
  Bell, 
  FileText, 
  Scale, 
  Shield, 
  MessageSquare, 
  BarChart3,
  Lock,
  Building2,
  Package,
  PartyPopper,
  Camera,
  CalendarCheck,
  UserCheck,
  Clock,
  QrCode,
  Smartphone
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const moduloOcorrencias = [
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
    icon: MessageSquare,
    title: "Base Legal Obrigatória",
    description: "Convenção, regimento interno e artigos 1.336 e 1.337 do Código Civil vinculados."
  },
  {
    icon: BarChart3,
    title: "Relatórios e Métricas",
    description: "Dashboard com visão geral de ocorrências, multas e histórico por unidade."
  }
];

const moduloEncomendas = [
  {
    icon: Camera,
    title: "Registro com Foto",
    description: "Porteiro registra encomenda com foto obrigatória para comprovação visual."
  },
  {
    icon: QrCode,
    title: "Código de Retirada",
    description: "Código numérico único de 6 dígitos para validação segura da retirada."
  },
  {
    icon: Smartphone,
    title: "Notificação Instantânea",
    description: "Morador recebe WhatsApp automático com foto e código assim que a encomenda chega."
  },
  {
    icon: UserCheck,
    title: "Registro de Quem Retirou",
    description: "Nome de quem retirou, porteiro que entregou, data e hora registrados automaticamente."
  },
  {
    icon: Package,
    title: "Histórico Completo",
    description: "Todas as encomendas com status, fotos e comprovantes de retirada."
  },
  {
    icon: Clock,
    title: "Controle de Pendências",
    description: "Dashboard com encomendas pendentes, retiradas e expiradas por bloco/apartamento."
  }
];

const moduloSalaoFestas = [
  {
    icon: CalendarCheck,
    title: "Agendamento Online",
    description: "Morador reserva o salão de festas diretamente pelo app com calendário visual."
  },
  {
    icon: Bell,
    title: "Lembretes Automáticos",
    description: "WhatsApp 24h antes com checklist de entrada e regras do salão."
  },
  {
    icon: PartyPopper,
    title: "Checklist de Entrada",
    description: "Vistoria com fotos antes do evento para registro do estado inicial."
  },
  {
    icon: Shield,
    title: "Checklist de Saída",
    description: "Vistoria após o evento com comparativo e registro de danos, se houver."
  },
  {
    icon: FileText,
    title: "Termo de Responsabilidade",
    description: "Assinatura digital do morador com aceite das regras e condições."
  },
  {
    icon: BarChart3,
    title: "Relatório de Uso",
    description: "Histórico de reservas, ocorrências e frequência de uso por unidade."
  }
];

const moduloGeral = [
  {
    icon: Building2,
    title: "Hierarquia Condominial",
    description: "Condomínios, blocos, apartamentos e moradores organizados de forma estruturada."
  },
  {
    icon: Lock,
    title: "LGPD Compliant",
    description: "Tratamento de dados conforme Lei nº 13.709/2018 com logs imutáveis."
  },
  {
    icon: Smartphone,
    title: "100% Mobile",
    description: "Interface responsiva otimizada para uso em smartphones e tablets."
  },
  {
    icon: UserCheck,
    title: "Multi-perfil",
    description: "Síndico, porteiro e morador com acessos específicos e permissões diferenciadas."
  }
];

const FeatureCard = ({ feature, index }: { feature: typeof moduloOcorrencias[0], index: number }) => (
  <div 
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
);

const Features = () => {
  return (
    <section id="funcionalidades" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Funcionalidades</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Gestão completa do seu{" "}
            <span className="text-gradient">condomínio</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Três módulos integrados para resolver os principais desafios da administração condominial: 
            ocorrências, encomendas e salão de festas.
          </p>
        </div>

        <Tabs defaultValue="ocorrencias" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-12 h-auto">
            <TabsTrigger value="ocorrencias" className="flex flex-col gap-1 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Scale className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Ocorrências</span>
            </TabsTrigger>
            <TabsTrigger value="encomendas" className="flex flex-col gap-1 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Package className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Encomendas</span>
            </TabsTrigger>
            <TabsTrigger value="salao" className="flex flex-col gap-1 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <PartyPopper className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Salão de Festas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ocorrencias" className="mt-0">
            <div className="text-center mb-8">
              <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                Notificações, Advertências e Multas
              </h3>
              <p className="text-muted-foreground">
                Sistema completo com validade jurídica, contraditório e ampla defesa garantidos.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {moduloOcorrencias.map((feature, index) => (
                <FeatureCard key={index} feature={feature} index={index} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="encomendas" className="mt-0">
            <div className="text-center mb-8">
              <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                Gestão de Encomendas
              </h3>
              <p className="text-muted-foreground">
                Controle total desde a chegada até a retirada, com notificação instantânea ao morador.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {moduloEncomendas.map((feature, index) => (
                <FeatureCard key={index} feature={feature} index={index} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="salao" className="mt-0">
            <div className="text-center mb-8">
              <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                Reserva de Salão de Festas
              </h3>
              <p className="text-muted-foreground">
                Agendamento, lembretes, checklist e vistoria — tudo automatizado e documentado.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {moduloSalaoFestas.map((feature, index) => (
                <FeatureCard key={index} feature={feature} index={index} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Recursos Gerais */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">
              Recursos em Todos os Módulos
            </h3>
            <p className="text-muted-foreground">
              Funcionalidades que permeiam toda a plataforma.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {moduloGeral.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
