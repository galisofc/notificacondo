import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF } from "@/lib/utils";

export type CpfStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface UseCpfValidationOptions {
  debounceMs?: number;
  minLength?: number;
  table?: "profiles" | "residents";
  excludeUserId?: string;
}

interface UseCpfValidationReturn {
  cpfStatus: CpfStatus;
  setCpfStatus: React.Dispatch<React.SetStateAction<CpfStatus>>;
  validateCpf: (cpf: string) => void;
  resetStatus: () => void;
  isValidating: boolean;
}

export function useCpfValidation(options: UseCpfValidationOptions = {}): UseCpfValidationReturn {
  const {
    debounceMs = 500,
    minLength = 11,
    table = "profiles",
    excludeUserId,
  } = options;

  const [cpfStatus, setCpfStatus] = useState<CpfStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkCpfAvailability = useCallback(async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");

    // CPF incompleto
    if (cleanCpf.length < minLength) {
      setCpfStatus("idle");
      return;
    }

    // Validar formato do CPF
    if (!isValidCPF(cleanCpf)) {
      setCpfStatus("invalid");
      return;
    }

    setCpfStatus("checking");

    try {
      let query = supabase
        .from(table)
        .select("id, user_id")
        .eq("cpf", cleanCpf);

      const { data: existingRecords, error } = await query;

      if (error) {
        console.error("Error checking CPF:", error);
        setCpfStatus("idle");
        return;
      }

      // Filtrar registros excluindo o usuário atual (para edição)
      const filteredRecords = excludeUserId 
        ? existingRecords?.filter(record => record.user_id !== excludeUserId)
        : existingRecords;

      if (filteredRecords && filteredRecords.length > 0) {
        setCpfStatus("taken");
      } else {
        setCpfStatus("available");
      }
    } catch (error) {
      console.error("Error checking CPF:", error);
      setCpfStatus("idle");
    }
  }, [minLength, table, excludeUserId]);

  const validateCpf = useCallback((cpf: string) => {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const cleanCpf = cpf.replace(/\D/g, "");

    // Se CPF estiver incompleto, resetar status
    if (cleanCpf.length < minLength) {
      setCpfStatus("idle");
      return;
    }

    // Validar formato imediatamente para feedback rápido
    if (!isValidCPF(cleanCpf)) {
      setCpfStatus("invalid");
      return;
    }

    // Agendar verificação no banco com debounce
    timeoutRef.current = setTimeout(() => {
      checkCpfAvailability(cpf);
    }, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debounceMs, minLength, checkCpfAvailability]);

  const resetStatus = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCpfStatus("idle");
  }, []);

  return {
    cpfStatus,
    setCpfStatus,
    validateCpf,
    resetStatus,
    isValidating: cpfStatus === "checking",
  };
}
