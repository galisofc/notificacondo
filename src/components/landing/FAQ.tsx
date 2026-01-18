import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, Package, PartyPopper, HelpCircle } from "lucide-react";
import { useTrialDays } from "@/hooks/useTrialDays";

const faqCategories = [
  {
    id: "multas",
    title: "Gestão de Multas",
    icon: AlertTriangle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    questions: [
      {
        question: "Como funciona o registro de ocorrências?",
        answer: "O síndico registra a ocorrência no sistema com todos os detalhes, evidências e fundamentação legal. O sistema gera automaticamente uma notificação formal e envia via WhatsApp para o morador, registrando a prova de ciência com data, hora e confirmação de leitura."
      },
      {
        question: "O morador pode se defender de uma notificação?",
        answer: "Sim! O sistema garante o contraditório e ampla defesa. Após receber a notificação, o morador tem um prazo configurável para apresentar sua defesa por escrito, anexando documentos e evidências. Tudo fica registrado no sistema."
      },
      {
        question: "As notificações têm validade jurídica?",
        answer: "Sim. O sistema registra a prova de ciência irrefutável através do WhatsApp, incluindo confirmação de entrega, leitura e resposta. Isso gera um dossiê jurídico completo que pode ser exportado em PDF para uso em processos."
      },
      {
        question: "Posso personalizar os modelos de notificação?",
        answer: "Sim! Cada condomínio pode personalizar seus templates de mensagem, incluindo as referências aos artigos da convenção, regimento interno e Código Civil aplicáveis."
      }
    ]
  },
  {
    id: "encomendas",
    title: "Controle de Encomendas",
    icon: Package,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    questions: [
      {
        question: "Como funciona o registro de encomendas?",
        answer: "O porteiro registra a encomenda tirando uma foto do pacote e selecionando o apartamento destinatário. O sistema gera automaticamente um código de retirada único e notifica o morador instantaneamente via WhatsApp."
      },
      {
        question: "Como o morador retira a encomenda?",
        answer: "O morador recebe o código de retirada no WhatsApp. Ao chegar na portaria, informa o código ao porteiro que confirma a retirada no sistema. Todo o processo fica registrado com data, hora e responsável."
      },
      {
        question: "E se o morador não retirar a encomenda?",
        answer: "O sistema envia lembretes automáticos após períodos configuráveis. Se a encomenda não for retirada dentro do prazo estabelecido, ela é marcada como expirada e o síndico é notificado."
      },
      {
        question: "Posso ver o histórico de entregas?",
        answer: "Sim! O sistema mantém um histórico completo de todas as encomendas recebidas e retiradas, com filtros por período, status, bloco e apartamento. Perfeito para auditorias e resolução de conflitos."
      }
    ]
  },
  {
    id: "salao",
    title: "Salão de Festas",
    icon: PartyPopper,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    questions: [
      {
        question: "Como faço para reservar o salão de festas?",
        answer: "O morador acessa o sistema e visualiza o calendário de disponibilidade. Seleciona a data desejada, informa o número de convidados e observações. A reserva fica pendente até aprovação do síndico, se configurado assim."
      },
      {
        question: "O sistema envia lembretes sobre a reserva?",
        answer: "Sim! O morador recebe lembretes automáticos via WhatsApp antes do evento, incluindo as regras do salão, horários de entrada/saída e outras informações importantes configuradas pelo síndico."
      },
      {
        question: "Como funciona o checklist de vistoria?",
        answer: "Antes e depois do uso, o responsável preenche um checklist digital verificando itens como limpeza, equipamentos, móveis e estrutura. Fotos podem ser anexadas. Isso garante transparência e facilita a identificação de danos."
      },
      {
        question: "Posso configurar regras específicas do meu salão?",
        answer: "Sim! O síndico pode configurar horários permitidos, capacidade máxima de convidados, taxa de locação, antecedência mínima para reserva, regras de uso e itens do checklist de vistoria."
      }
    ]
  }
];

const FAQ = () => {
  const { trialDays } = useTrialDays();

  const generalFAQ = [
    {
      question: "Preciso instalar algum aplicativo?",
      answer: "Não! O NotificaCondo é 100% web e funciona em qualquer dispositivo com navegador. Os moradores recebem as notificações diretamente no WhatsApp, sem precisar instalar nada."
    },
    {
      question: "O sistema está em conformidade com a LGPD?",
      answer: "Sim! Todos os dados são tratados de acordo com a Lei Geral de Proteção de Dados. Oferecemos criptografia, controle de acesso, logs de auditoria e ferramentas para atender solicitações de titulares."
    },
    {
      question: "Como funciona o período de teste?",
      answer: `Oferecemos ${trialDays} dias grátis para você testar todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito para iniciar o teste. Ao final, você decide se quer continuar.`
    },
    {
      question: "Posso migrar meus dados de outro sistema?",
      answer: "Sim! Nossa equipe pode auxiliar na importação de dados de moradores, apartamentos e histórico de ocorrências. Entre em contato para avaliarmos seu caso específico."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <HelpCircle className="w-4 h-4" />
            Perguntas Frequentes
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Tire suas <span className="text-gradient">dúvidas</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Encontre respostas para as perguntas mais comuns sobre cada módulo do sistema.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-12">
          {/* FAQ by Module */}
          {faqCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${category.bgColor} flex items-center justify-center`}>
                  <category.icon className={`w-5 h-5 ${category.color}`} />
                </div>
                <h3 className="font-display text-xl font-bold">{category.title}</h3>
              </div>
              
              <Accordion type="single" collapsible className="space-y-2">
                {category.questions.map((item, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`${category.id}-${index}`}
                    className="bg-background border border-border/50 rounded-xl px-6 data-[state=open]:border-primary/30 transition-colors"
                  >
                    <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* General FAQ */}
          <div className="space-y-4 pt-8 border-t border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold">Perguntas Gerais</h3>
            </div>
            
            <Accordion type="single" collapsible className="space-y-2">
              {generalFAQ.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`general-${index}`}
                  className="bg-background border border-border/50 rounded-xl px-6 data-[state=open]:border-primary/30 transition-colors"
                >
                  <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
