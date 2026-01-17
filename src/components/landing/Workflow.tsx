import { ArrowDown, CheckCircle, Scale, Package, PartyPopper } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const occurrenceSteps = [
  {
    number: "01",
    title: "Registro da Ocorrência",
    description: "Síndico registra infração com data, hora, local, descrição e upload de provas.",
    details: ["Condomínio/BLOCO/APTO", "Tipo de infração", "Fotos e vídeos"]
  },
  {
    number: "02",
    title: "Classificação Jurídica",
    description: "Definição do tipo: advertência, notificação ou multa com base legal obrigatória.",
    details: ["Base legal vinculada", "Convenção/Regimento", "Art. 1.336 e 1.337 CC"]
  },
  {
    number: "03",
    title: "Notificação Prévia",
    description: "Envio automático via WhatsApp com link seguro e registro de ciência.",
    details: ["API ZPRO", "Link único e seguro", "Botão 'Estou ciente'"]
  },
  {
    number: "04",
    title: "Defesa do Morador",
    description: "Prazo para justificativa e upload de documentos. Contraditório garantido.",
    details: ["Campo de texto", "Upload de arquivos", "Controle de prazo"]
  },
  {
    number: "05",
    title: "Análise e Decisão",
    description: "Síndico analisa defesa e decide: arquivar, advertir ou aplicar multa.",
    details: ["Decisão fundamentada", "Log imutável", "Auditoria completa"]
  },
  {
    number: "06",
    title: "Aplicação da Multa",
    description: "Valor conforme legislação, notificação da multa e lançamento financeiro.",
    details: ["Até 5x taxa condominial", "Vencimento definido", "Exportação PIX/Boleto"]
  }
];

const packageSteps = [
  {
    number: "01",
    title: "Chegada da Encomenda",
    description: "Porteiro recebe a encomenda e inicia o processo de registro no sistema.",
    details: ["Identificação do entregador", "Tipo de encomenda", "Código de rastreio"]
  },
  {
    number: "02",
    title: "Registro Fotográfico",
    description: "Captura obrigatória da foto da encomenda com câmera do dispositivo.",
    details: ["Foto frontal", "Estado da embalagem", "Registro visual"]
  },
  {
    number: "03",
    title: "Seleção do Destinatário",
    description: "Identificação do bloco e apartamento de destino da encomenda.",
    details: ["Bloco/Torre", "Apartamento", "Morador responsável"]
  },
  {
    number: "04",
    title: "Código de Retirada",
    description: "Geração automática de código único de 6 dígitos para retirada segura.",
    details: ["Código único", "Validade configurável", "Segurança"]
  },
  {
    number: "05",
    title: "Notificação WhatsApp",
    description: "Envio automático de notificação ao morador com foto e código de retirada.",
    details: ["Foto da encomenda", "Código de retirada", "Instruções"]
  },
  {
    number: "06",
    title: "Confirmação de Retirada",
    description: "Morador apresenta código, porteiro confirma e registra a entrega.",
    details: ["Validação do código", "Registro do recebedor", "Histórico completo"]
  }
];

const partyHallSteps = [
  {
    number: "01",
    title: "Solicitação de Reserva",
    description: "Morador acessa o sistema e seleciona a data desejada para o evento.",
    details: ["Calendário visual", "Datas disponíveis", "Verificação de conflitos"]
  },
  {
    number: "02",
    title: "Preenchimento dos Dados",
    description: "Informações sobre o evento: quantidade de convidados e observações.",
    details: ["Número de convidados", "Tipo de evento", "Observações"]
  },
  {
    number: "03",
    title: "Confirmação da Reserva",
    description: "Síndico aprova ou recusa a solicitação de reserva do salão.",
    details: ["Análise do pedido", "Regras do condomínio", "Aprovação/Recusa"]
  },
  {
    number: "04",
    title: "Lembrete Automático",
    description: "Notificação WhatsApp enviada 24h antes do evento com instruções.",
    details: ["Lembrete 24h antes", "Horários", "Regras de uso"]
  },
  {
    number: "05",
    title: "Checklist de Entrada",
    description: "Porteiro/Síndico registra estado do salão antes da entrega das chaves.",
    details: ["Fotos do estado", "Itens verificados", "Assinatura digital"]
  },
  {
    number: "06",
    title: "Checklist de Saída",
    description: "Verificação do estado após o uso e registro de eventuais danos.",
    details: ["Comparação antes/depois", "Registro de danos", "Termo de responsabilidade"]
  }
];

interface WorkflowModule {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  steps: typeof occurrenceSteps;
  finalTitle: string;
  finalDescription: string;
}

const modules: WorkflowModule[] = [
  {
    id: "ocorrencias",
    title: "Ocorrências",
    icon: <Scale className="w-4 h-4" />,
    color: "amber",
    steps: occurrenceSteps,
    finalTitle: "Dossiê Jurídico Completo",
    finalDescription: "Ocorrência + Notificação + Ciência + Defesa + Decisão + Multa = Prova jurídica irrefutável"
  },
  {
    id: "encomendas",
    title: "Encomendas",
    icon: <Package className="w-4 h-4" />,
    color: "blue",
    steps: packageSteps,
    finalTitle: "Rastreabilidade Total",
    finalDescription: "Registro + Foto + Notificação + Código + Retirada = Controle completo de entregas"
  },
  {
    id: "salao",
    title: "Salão de Festas",
    icon: <PartyPopper className="w-4 h-4" />,
    color: "purple",
    steps: partyHallSteps,
    finalTitle: "Gestão Transparente",
    finalDescription: "Reserva + Aprovação + Lembrete + Checklist = Organização e responsabilidade"
  }
];

const getColorClasses = (color: string) => {
  switch (color) {
    case "amber":
      return {
        gradient: "bg-gradient-to-br from-amber-500 to-amber-600",
        glow: "shadow-amber-500/25",
        badge: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
        final: "bg-amber-500/10 border-amber-500/30"
      };
    case "blue":
      return {
        gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
        glow: "shadow-blue-500/25",
        badge: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
        final: "bg-blue-500/10 border-blue-500/30"
      };
    case "purple":
      return {
        gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
        glow: "shadow-purple-500/25",
        badge: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
        final: "bg-purple-500/10 border-purple-500/30"
      };
    default:
      return {
        gradient: "bg-gradient-primary",
        glow: "shadow-glow",
        badge: "bg-primary/10 border-primary/30 text-primary",
        final: "bg-primary/10 border-primary/30"
      };
  }
};

const Workflow = () => {
  return (
    <section id="fluxo" className="py-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Fluxos de Trabalho</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Processos{" "}
            <span className="text-gradient">organizados e automatizados</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Cada módulo possui um fluxo otimizado para garantir eficiência, 
            rastreabilidade e conformidade legal.
          </p>
        </div>

        <Tabs defaultValue="ocorrencias" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-12 h-auto p-1">
            {modules.map((module) => {
              const colors = getColorClasses(module.color);
              return (
                <TabsTrigger
                  key={module.id}
                  value={module.id}
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <span className={`p-1.5 rounded-lg ${colors.badge} border`}>
                    {module.icon}
                  </span>
                  <span className="hidden sm:inline font-medium">{module.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {modules.map((module) => {
            const colors = getColorClasses(module.color);
            return (
              <TabsContent key={module.id} value={module.id} className="mt-0">
                <div className="max-w-4xl mx-auto">
                  {module.steps.map((step, index) => (
                    <div key={index} className="relative">
                      <div className="flex gap-6 mb-8">
                        {/* Step Number */}
                        <div className="flex-shrink-0">
                          <div className={`w-16 h-16 rounded-2xl ${colors.gradient} flex items-center justify-center shadow-lg ${colors.glow} relative z-10`}>
                            <span className="font-display text-xl font-bold text-white">
                              {step.number}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-8">
                          <div className="p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all">
                            <h3 className="font-display text-xl font-semibold mb-2 text-foreground">
                              {step.title}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              {step.description}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {step.details.map((detail, i) => (
                                <span 
                                  key={i}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/80 text-xs text-muted-foreground"
                                >
                                  <CheckCircle className="w-3 h-3 text-primary" />
                                  {detail}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Connector Line */}
                      {index < module.steps.length - 1 && (
                        <div className="absolute left-8 top-16 w-px h-8 bg-border" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Final Result */}
                <div className={`max-w-2xl mx-auto mt-8 p-6 rounded-2xl ${colors.final} border text-center`}>
                  <div className="inline-flex items-center gap-2 mb-3">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    <span className="font-display text-lg font-semibold text-foreground">{module.finalTitle}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {module.finalDescription.split(" = ")[0]} ={" "}
                    <span className="text-foreground font-semibold">{module.finalDescription.split(" = ")[1]}</span>
                  </p>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </section>
  );
};

export default Workflow;
