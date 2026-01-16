import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PickupCodeDisplayProps {
  code: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PickupCodeDisplay({ code, className, size = "lg" }: PickupCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: "text-lg tracking-wider",
    md: "text-2xl tracking-widest",
    lg: "text-4xl md:text-5xl tracking-[0.3em]",
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl p-6 md:p-8">
        <span className={cn("font-mono font-bold text-primary", sizeClasses[size])}>
          {code}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="gap-2"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copiar código
          </>
        )}
      </Button>
    </div>
  );
}
