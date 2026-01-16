import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
}

interface WizardStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepIndicator({ steps, currentStep, onStepClick }: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 md:gap-4">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => step.id < currentStep && onStepClick?.(step.id)}
              disabled={step.id > currentStep}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                step.id === currentStep && "bg-primary text-primary-foreground",
                step.id < currentStep && "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30",
                step.id > currentStep && "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  step.id === currentStep && "bg-primary-foreground text-primary",
                  step.id < currentStep && "bg-primary text-primary-foreground",
                  step.id > currentStep && "bg-muted-foreground/30 text-muted-foreground"
                )}
              >
                {step.id < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  step.id
                )}
              </span>
              <span className="hidden sm:inline text-sm font-medium">{step.name}</span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4 md:w-8 mx-1",
                  step.id < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
