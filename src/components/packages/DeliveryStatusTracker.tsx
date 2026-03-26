import { Check, Send, CheckCircle2, Eye, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const DELIVERY_STEPS = [
  { key: "accepted", label: "Aceita", icon: Check },
  { key: "sent", label: "Enviada", icon: Send },
  { key: "delivered", label: "Entregue", icon: CheckCircle2 },
  { key: "read", label: "Lida", icon: Eye },
] as const;

interface DeliveryStatusTrackerProps {
  status: string | null;
  className?: string;
}

export function DeliveryStatusTracker({ status, className }: DeliveryStatusTrackerProps) {
  const isFailed = status === "failed";
  const stepIndex = DELIVERY_STEPS.findIndex((s) => s.key === status);

  if (isFailed) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <XCircle className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-medium text-destructive">Falha na entrega</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {DELIVERY_STEPS.map((step, i) => {
        const isActive = stepIndex >= i;
        const isGreen = isActive && (step.key === "delivered" || step.key === "read");
        const isBlue = isActive && !isGreen;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "w-4 h-0.5 mx-0.5",
                  isActive ? (isGreen ? "bg-emerald-500" : "bg-blue-500") : "bg-muted-foreground/20"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  isGreen && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  isBlue && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                  !isActive && "bg-muted text-muted-foreground/40"
                )}
              >
                <Icon className="w-3 h-3" />
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
