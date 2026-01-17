import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles,
  Home,
  UserPlus,
  Bell,
  FileText,
  Shield
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface SindicoOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  condominiumId?: string;
}

const steps = [
  {
    id: "welcome",
    title: "Bem-vindo ao NotificaCondo! 🎉",
    icon: Sparkles,
  },
  {
    id: "blocks",
    title: "Configure seu Condomínio",
    icon: Building2,
  },
  {
    id: "residents",
    title: "Cadastre os Moradores",
    icon: Users,
  },
];

export function SindicoOnboardingModal({ 
  open, 
  onOpenChange, 
  userId,
  condominiumId 
}: SindicoOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      toast({
        title: "Onboarding concluído!",
        description: "Você está pronto para usar o NotificaCondo.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o progresso.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleGoToBlocks = () => {
    onOpenChange(false);
    if (condominiumId) {
      navigate(`/condominiums/${condominiumId}`);
    } else {
      navigate('/condominiums');
    }
  };

  const handleGoToResidents = () => {
    onOpenChange(false);
    if (condominiumId) {
      navigate(`/condominiums/${condominiumId}`);
    } else {
      navigate('/condominiums');
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Bem-vindo ao NotificaCondo!
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Estamos muito felizes em tê-lo conosco. Vamos configurar seu condomínio em poucos passos.
              </p>
            </div>

            <div className="grid gap-4 mt-8">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Notificações Inteligentes</h4>
                  <p className="text-sm text-muted-foreground">
                    Envie notificações, advertências e multas diretamente pelo WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Gestão de Ocorrências</h4>
                  <p className="text-sm text-muted-foreground">
                    Registre ocorrências, acompanhe defesas e tome decisões com respaldo legal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Conformidade LGPD</h4>
                  <p className="text-sm text-muted-foreground">
                    Registro de ciência e histórico completo para segurança jurídica.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "blocks":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Configure seu Condomínio
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Adicione os blocos e apartamentos do seu condomínio para começar a gerenciar os moradores.
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Como funciona:
              </h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                  <span>Acesse a página do seu condomínio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                  <span>Clique em "Adicionar Bloco" para criar os blocos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                  <span>Para cada bloco, adicione os apartamentos</span>
                </li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleGoToBlocks}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Ir para Configuração de Blocos
            </Button>
          </div>
        );

      case "residents":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Cadastre os Moradores
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Adicione os moradores de cada apartamento para poder enviar notificações e gerenciar ocorrências.
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Como adicionar moradores:
              </h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                  <span>Acesse um apartamento na página do condomínio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                  <span>Clique em "Adicionar Morador"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                  <span>Preencha nome, email e telefone (WhatsApp)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">4</span>
                  <span>Você também pode importar moradores via CSV</span>
                </li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleGoToResidents}
            >
              <Users className="h-4 w-4 mr-2" />
              Ir para Cadastro de Moradores
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* Progress Header */}
        <div className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={`flex items-center ${index < steps.length - 1 ? 'after:content-[""] after:w-8 after:h-0.5 after:mx-2' : ''} ${
                    index <= currentStep 
                      ? 'after:bg-primary' 
                      : 'after:bg-muted-foreground/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : index === currentStep 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {index < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                </div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} de {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isCompleting}
          >
            Pular tutorial
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isCompleting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <>Finalizando...</>
                ) : (
                  <>
                    Concluir
                    <Check className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}