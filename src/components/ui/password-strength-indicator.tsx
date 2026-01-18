import { cn } from "@/lib/utils";
import { usePasswordStrength, type PasswordStrengthResult } from "@/hooks/usePasswordStrength";

interface PasswordStrengthIndicatorProps {
  password: string;
  showSuggestions?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({ 
  password, 
  showSuggestions = true,
  className 
}: PasswordStrengthIndicatorProps) {
  const { strength, score, label, color, suggestions } = usePasswordStrength(password);

  if (strength === "empty") {
    return null;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Strength bars */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                level <= score ? color : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className={cn(
          "text-[10px] sm:text-xs font-medium min-w-[45px] text-right",
          strength === "weak" && "text-destructive",
          strength === "fair" && "text-amber-500",
          strength === "good" && "text-emerald-400",
          strength === "strong" && "text-emerald-500"
        )}>
          {label}
        </span>
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && score < 3 && (
        <ul className="text-[10px] sm:text-xs text-muted-foreground space-y-0.5">
          {suggestions.slice(0, 2).map((suggestion, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-muted-foreground">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Export hook result type for external use
export type { PasswordStrengthResult };
