import React, { useState } from "react";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MaskedInput, MaskType } from "@/components/ui/masked-input";
import { cn } from "@/lib/utils";

export type ValidationStatus = 
  | "idle" 
  | "checking" 
  | "valid" 
  | "available" 
  | "invalid" 
  | "taken" 
  | "conflict" 
  | "incomplete";

interface StatusConfig {
  borderClass: string;
  icon: React.ReactNode | null;
  message?: string;
}

interface ValidatedInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  status?: ValidationStatus;
  placeholder?: string;
  type?: "text" | "email" | "password";
  mask?: MaskType;
  disabled?: boolean;
  className?: string;
  messages?: {
    taken?: string;
    available?: string;
    valid?: string;
    invalid?: string;
    conflict?: string;
    incomplete?: string;
  };
  showSuccessMessage?: boolean;
  /** For password fields - enables show/hide toggle */
  showPasswordToggle?: boolean;
}

const defaultMessages = {
  taken: "Já cadastrado no sistema.",
  available: "Disponível para cadastro.",
  valid: "Válido.",
  invalid: "Formato inválido.",
  conflict: "Pertence a outro tipo de usuário.",
  incomplete: "Complete o campo.",
};

function getStatusConfig(status: ValidationStatus, messages: typeof defaultMessages): StatusConfig {
  const iconSize = "h-3.5 w-3.5 sm:h-4 sm:w-4";
  
  switch (status) {
    case "checking":
      return {
        borderClass: "",
        icon: <Loader2 className={cn(iconSize, "animate-spin text-muted-foreground")} />,
      };
    case "available":
    case "valid":
      return {
        borderClass: "border-emerald-500 focus-visible:ring-emerald-500/20",
        icon: <CheckCircle className={cn(iconSize, "text-emerald-500")} />,
        message: status === "available" ? messages.available : messages.valid,
      };
    case "taken":
      return {
        borderClass: "border-destructive focus-visible:ring-destructive/20",
        icon: <XCircle className={cn(iconSize, "text-destructive")} />,
        message: messages.taken,
      };
    case "conflict":
      return {
        borderClass: "border-destructive focus-visible:ring-destructive/20",
        icon: <XCircle className={cn(iconSize, "text-destructive")} />,
        message: messages.conflict,
      };
    case "invalid":
      return {
        borderClass: "border-amber-500 focus-visible:ring-amber-500/20",
        icon: <AlertTriangle className={cn(iconSize, "text-amber-500")} />,
        message: messages.invalid,
      };
    case "incomplete":
      return {
        borderClass: "",
        icon: null,
        message: messages.incomplete,
      };
    default:
      return {
        borderClass: "",
        icon: null,
      };
  }
}

export function ValidatedInput({
  id,
  value,
  onChange,
  status = "idle",
  placeholder,
  type = "text",
  mask,
  disabled,
  className,
  messages = {},
  showSuccessMessage = true,
  showPasswordToggle = false,
}: ValidatedInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const mergedMessages = { ...defaultMessages, ...messages };
  const config = getStatusConfig(status, mergedMessages);
  
  const isPasswordField = type === "password";
  const hasStatusIcon = config.icon !== null;
  const hasPasswordToggle = isPasswordField && showPasswordToggle;
  const hasRightElement = hasStatusIcon || hasPasswordToggle;
  
  // Calculate right padding based on elements
  const rightPadding = hasStatusIcon && hasPasswordToggle ? "pr-16" : hasRightElement ? "pr-10" : "";
  
  const inputClassName = cn(
    "h-9 sm:h-10 text-sm",
    rightPadding,
    config.borderClass,
    className
  );

  const showMessage = config.message && (
    status === "taken" || 
    status === "conflict" || 
    status === "invalid" || 
    (status === "incomplete" && value.replace(/\D/g, "").length > 0) ||
    (showSuccessMessage && (status === "available" || status === "valid"))
  );

  const messageClass = cn(
    "text-[10px] sm:text-xs",
    (status === "taken" || status === "conflict") && "text-destructive",
    (status === "available" || status === "valid") && "text-emerald-500",
    status === "invalid" && "text-amber-500",
    status === "incomplete" && "text-muted-foreground"
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    const newValue = typeof e === "string" ? e : e.target.value;
    onChange(newValue);
  };

  // Determine actual input type for password fields
  const actualType = isPasswordField ? (showPassword ? "text" : "password") : type;

  return (
    <div className="space-y-1">
      <div className="relative">
        {mask ? (
          <MaskedInput
            id={id}
            mask={mask}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={inputClassName}
          />
        ) : (
          <Input
            id={id}
            type={actualType}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={inputClassName}
          />
        )}
        
        {hasRightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {hasPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
            {config.icon}
          </div>
        )}
      </div>
      
      {showMessage && (
        <p className={messageClass}>
          {config.message}
        </p>
      )}
    </div>
  );
}
