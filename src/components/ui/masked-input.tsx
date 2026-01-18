import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MaskType = "phone" | "cpf" | "cnpj" | "cep";

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
}

// Format phone: (00) 00000-0000 or (00) 0000-0000
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Format CPF: 000.000.000-00
const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Format CNPJ: 00.000.000/0000-00
const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// Format CEP: 00000-000
const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  
  if (digits.length === 0) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatters: Record<MaskType, (value: string) => string> = {
  phone: formatPhone,
  cpf: formatCPF,
  cnpj: formatCNPJ,
  cep: formatCEP,
};

const placeholders: Record<MaskType, string> = {
  phone: "(00) 00000-0000",
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  cep: "00000-000",
};

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, className, placeholder, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formatted = formatters[mask](rawValue);
      onChange(formatted);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={mask === "phone" ? "tel" : "numeric"}
        value={value}
        onChange={handleChange}
        placeholder={placeholder || placeholders[mask]}
        className={cn(className)}
        {...props}
      />
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput, formatPhone, formatCPF, formatCNPJ, formatCEP };
export type { MaskType };
