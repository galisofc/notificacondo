import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Monitor, Bell, Shield, FileText, MessageSquare, BarChart3 } from "lucide-react";

// Import screenshots
import dashboardImg from "@/assets/screenshots/dashboard.png";
import occurrencesImg from "@/assets/screenshots/occurrences.png";
import whatsappImg from "@/assets/screenshots/whatsapp.png";
import defenseImg from "@/assets/screenshots/defense.png";
import finesImg from "@/assets/screenshots/fines.png";
import reportsImg from "@/assets/screenshots/reports.png";

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
    image: dashboardImg,
    features: ["Resumo de ocorrências", "Notificações pendentes", "Multas em aberto", "Gráficos de desempenho"],
  },
  {
    id: 2,
    title: "Registro de Ocorrências",
    description: "Registre advertências, notificações e multas com todos os detalhes necessários e base legal.",
    icon: FileText,
    image: occurrencesImg,
    features: ["Tipo de infração", "Base legal automática", "Upload de evidências", "Histórico do morador"],
  },
  {
    id: 3,
    title: "Notificação via WhatsApp",
    description: "Envio automático de notificações com registro de ciência e comprovante de entrega.",
    icon: MessageSquare,
    image: whatsappImg,
    features: ["Integração WhatsApp", "Registro de ciência", "Comprovante automático", "Link seguro"],
  },
  {
    id: 4,
    title: "Defesa do Morador",
    description: "Portal exclusivo para o morador apresentar sua defesa com upload de documentos.",
    icon: Shield,
    image: defenseImg,
    features: ["Prazo automático", "Upload de anexos", "Protocolo de envio", "Notificação ao síndico"],
  },
  {
    id: 5,
    title: "Gestão de Multas",
    description: "Controle completo de multas aplicadas, pagamentos e status de cada processo.",
    icon: Bell,
    image: finesImg,
    features: ["Status em tempo real", "Valor progressivo", "Histórico de pagamentos", "Relatórios"],
  },
  {
    id: 6,
    title: "Relatórios e Análises",
    description: "Relatórios detalhados para prestação de contas e análise de conformidade.",
    icon: BarChart3,
    image: reportsImg,
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
      <DialogContent className="max-w-5xl p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Como funciona o NotificaCondo
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          {/* Main Screenshot Area */}
          <div className="relative rounded-2xl overflow-hidden bg-secondary/30 border border-border/50 mb-6">
            {/* Navigation Arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-lg"
              onClick={goToPrevious}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background shadow-lg"
              onClick={goToNext}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>

            {/* Screenshot Image */}
            <img
              src={currentScreen.image}
              alt={currentScreen.title}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Screen Info */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
              <Icon className="w-4 h-4" />
              {currentScreen.title}
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto mb-4">
              {currentScreen.description}
            </p>
            
            {/* Features List */}
            <div className="flex flex-wrap justify-center gap-2">
              {currentScreen.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-full bg-secondary text-sm font-medium border border-border/50"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex justify-center gap-2 mb-4">
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

          {/* Counter */}
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
