import { Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockApartmentDisplayProps {
  blockName?: string | null;
  apartmentNumber?: string | null;
  variant?: "default" | "compact" | "label" | "inline";
  showIcons?: boolean;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

const BlockApartmentDisplay = ({
  blockName,
  apartmentNumber,
  variant = "default",
  showIcons = false,
  className,
  labelClassName,
  valueClassName,
}: BlockApartmentDisplayProps) => {
  const hasBlock = blockName && blockName.trim() !== "";
  const hasApartment = apartmentNumber && apartmentNumber.trim() !== "";

  if (!hasBlock && !hasApartment) {
    return <span className="text-muted-foreground">-</span>;
  }

  const formatValue = () => {
    if (hasBlock && hasApartment) {
      return `${blockName} - APTO ${apartmentNumber}`;
    }
    if (hasBlock) {
      return blockName;
    }
    if (hasApartment) {
      return `APTO ${apartmentNumber}`;
    }
    return "-";
  };

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {showIcons && <Building2 className="w-3 h-3 text-muted-foreground" />}
        <span className={valueClassName}>{formatValue()}</span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {showIcons && (
          <div className="flex items-center gap-1">
            <Building2 className="w-4 h-4 text-primary" />
            {hasApartment && <Home className="w-4 h-4 text-primary" />}
          </div>
        )}
        <span className={cn("font-medium text-foreground", valueClassName)}>
          {formatValue()}
        </span>
      </div>
    );
  }

  if (variant === "label") {
    return (
      <div className={cn("space-y-1", className)}>
        <p className={cn("text-sm text-muted-foreground", labelClassName)}>
          BLOCO / APTO
        </p>
        <p className={cn("font-medium text-foreground", valueClassName)}>
          {formatValue()}
        </p>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcons && <Building2 className="w-4 h-4 text-primary flex-shrink-0" />}
      <div className="flex flex-col">
        {hasBlock && (
          <span className={cn("text-sm font-medium", valueClassName)}>
            {blockName}
          </span>
        )}
        {hasApartment && (
          <span className="text-xs text-muted-foreground">
            APTO {apartmentNumber}
          </span>
        )}
      </div>
    </div>
  );
};

export default BlockApartmentDisplay;
