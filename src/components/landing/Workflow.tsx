import { ArrowDown, CheckCircle } from "lucide-react";

const steps = [
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

const Workflow = () => {
  return (
    <section id="fluxo" className="py-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Fluxo Jurídico</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            Do registro à multa:{" "}
            <span className="text-gradient">processo legal completo</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Cada etapa garante contraditório, ampla defesa e prova de ciência 
            conforme exigido pela legislação brasileira.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex gap-6 mb-8">
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow relative z-10">
                    <span className="font-display text-xl font-bold text-primary-foreground">
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
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-16 w-px h-8 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Final Result */}
        <div className="max-w-2xl mx-auto mt-8 p-6 rounded-2xl bg-primary/10 border border-primary/30 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <CheckCircle className="w-6 h-6 text-primary" />
            <span className="font-display text-lg font-semibold text-foreground">Dossiê Jurídico Completo</span>
          </div>
          <p className="text-muted-foreground">
            Ocorrência + Notificação + Ciência + Defesa + Decisão + Multa = 
            <span className="text-foreground font-semibold"> Prova jurídica irrefutável</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Workflow;
