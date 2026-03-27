import { Check, Send, CheckCircle2, Eye, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DELIVERY_STEPS = [
  { key: "accepted", label: "Aceita", icon: Check, tsKey: "accepted_at" },
  { key: "sent", label: "Enviada", icon: Send, tsKey: "sent_at" },
  { key: "delivered", label: "Entregue", icon: CheckCircle2, tsKey: "delivered_at" },
  { key: "read", label: "Lida", icon: Eye, tsKey: "read_at" },
] as const;

export interface DeliveryTimestamps {
  accepted_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

interface DeliveryStatusTrackerProps {
  status: string | null;
  className?: string;
  timestamps?: DeliveryTimestamps;
}

function formatStepTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  return {
    date: format(d, "dd/MM", { locale: ptBR }),
    time: format(d, "HH:mm", { locale: ptBR }),
  };
}

export function DeliveryStatusTracker({ status, className, timestamps }: DeliveryStatusTrackerProps) {
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
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-center gap-0", className)}>
        {DELIVERY_STEPS.map((step, i) => {
          const isActive = stepIndex >= i;
          const isGreen = isActive && (step.key === "delivered" || step.key === "read");
          const isBlue = isActive && !isGreen;
          const Icon = step.icon;
          const ts = timestamps?.[step.tsKey];
          const formatted = isActive && ts ? formatStepTimestamp(ts) : null;

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
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-0.5 cursor-default">
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
                </TooltipTrigger>
                {formatted && (
                  <TooltipContent side="top" className="text-xs">
                    {formatted.date} às {formatted.time}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
