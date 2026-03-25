import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Monitor, Bell, Shield, FileText, MessageSquare, BarChart3, Package, DoorOpen, Wrench, CalendarCheck } from "lucide-react";

interface ScreenshotsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const screenshots = [
  {
    id: 1,
    title: "Dashboard do Síndico",
    description: "Visão geral completa do condomínio com métricas em tempo real, notificações pendentes e ações rápidas.",
    icon: Monitor,
    color: "from-primary/20 to-accent/20",
    features: ["Resumo de ocorrências", "Notificações pendentes", "Multas em aberto", "Gráficos de desempenho"],
  },
  {
    id: 2,
    title: "Registro de Ocorrências",
    description: "Registre advertências, notificações e multas com todos os detalhes necessários e base legal.",
    icon: FileText,
    color: "from-orange-500/20 to-red-500/20",
    features: ["Tipo de infração", "Base legal automática", "Upload de evidências", "Histórico do morador"],
  },
  {
    id: 3,
    title: "Notificação via WhatsApp WABA",
    description: "Envio automático via API oficial da Meta com templates aprovados e registro de ciência.",
    icon: MessageSquare,
    color: "from-green-500/20 to-emerald-500/20",
    features: ["API oficial Meta", "Templates aprovados", "Registro de ciência", "Link seguro"],
  },
  {
    id: 4,
    title: "Defesa do Morador",
    description: "Portal exclusivo para o morador apresentar sua defesa com upload de documentos.",
    icon: Shield,
    color: "from-blue-500/20 to-indigo-500/20",
    features: ["Prazo automático", "Upload de anexos", "Protocolo de envio", "Notificação ao síndico"],
  },
  {
    id: 5,
    title: "Gestão de Encomendas",
    description: "Controle completo desde a chegada até a retirada com foto, código e notificação.",
    icon: Package,
    color: "from-blue-500/20 to-cyan-500/20",
    features: ["Foto obrigatória", "Código de retirada", "Notificação instantânea", "Histórico completo"],
  },
  {
    id: 6,
    title: "Salão de Festas",
    description: "Agendamento online com checklist de entrada e saída automatizado.",
    icon: CalendarCheck,
    color: "from-purple-500/20 to-pink-500/20",
    features: ["Calendário visual", "Checklist entrada/saída", "Lembretes WhatsApp", "Regras configuráveis"],
  },
  {
    id: 7,
    title: "Portaria Inteligente",
    description: "Passagem de plantão, livro de recados, banners e ocorrências da portaria.",
    icon: DoorOpen,
    color: "from-emerald-500/20 to-green-500/20",
    features: ["Passagem de plantão", "Livro de recados", "Banners informativos", "Ocorrências portaria"],
  },
  {
    id: 8,
    title: "Manutenção e Zeladores",
    description: "Gestão de manutenções preventivas e corretivas com atribuição a zeladores.",
    icon: Wrench,
    color: "from-orange-500/20 to-amber-500/20",
    features: ["Categorias customizáveis", "Atribuição zeladores", "Manutenção preventiva", "Histórico completo"],
  },
  {
    id: 9,
    title: "Relatórios e Análises",
    description: "Relatórios detalhados para prestação de contas e análise de conformidade.",
    icon: BarChart3,
    color: "from-cyan-500/20 to-teal-500/20",
    features: ["Exportar PDF", "Gráficos interativos", "Filtros avançados", "Conformidade LGPD"],
  },
];

const ScreenshotsModal = ({ open, onOpenChange }: ScreenshotsModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  };

  const currentScreen = screenshots[currentIndex];
  const Icon = currentScreen.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Como funciona o NotificaCondo
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          <div className={`relative rounded-2xl bg-gradient-to-br ${currentScreen.color} p-8 mb-6 min-h-[300px] flex flex-col items-center justify-center border border-border/50`}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
              onClick={goToPrevious}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
              onClick={goToNext}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-background/80 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-border/50">
                <Icon className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{currentScreen.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {currentScreen.description}
              </p>
              
              <div className="flex flex-wrap justify-center gap-2">
                {currentScreen.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-background/80 text-sm font-medium border border-border/50"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            {screenshots.map((screen, idx) => {
              const ScreenIcon = screen.icon;
              return (
                <button
                  key={screen.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    idx === currentIndex
                      ? "bg-primary text-primary-foreground scale-110"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                  }`}
                >
                  <ScreenIcon className="w-5 h-5" />
                </button>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {currentIndex + 1} de {screenshots.length} telas
          </p>
        </div>
        
        <div className="p-4 bg-secondary/30 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Teste todas as funcionalidades gratuitamente por 7 dias
          </p>
          <Button variant="default" size="sm" asChild>
            <a href="#pricing">Começar Agora</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScreenshotsModal;
