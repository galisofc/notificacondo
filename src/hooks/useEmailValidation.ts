import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "conflict";

interface UseEmailValidationOptions {
  /**
   * Debounce delay in milliseconds
   * @default 500
   */
  debounceMs?: number;
  /**
   * Minimum email length to trigger validation
   * @default 5
   */
  minLength?: number;
  /**
   * Check if email belongs to specific roles (e.g., sindico, super_admin)
   * If email belongs to these roles, status will be "conflict"
   */
  conflictRoles?: string[];
  /**
   * Check if email is already linked to a specific condominium
   * If linked, status will be "taken"
   */
  condominiumId?: string;
  /**
   * Table to check for existing email
   * @default "profiles"
   */
  table?: "profiles";
}

interface UseEmailValidationReturn {
  emailStatus: EmailStatus;
  setEmailStatus: (status: EmailStatus) => void;
  validateEmail: (email: string) => void;
  resetStatus: () => void;
  isValidating: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useEmailValidation(options: UseEmailValidationOptions = {}): UseEmailValidationReturn {
  const {
    debounceMs = 500,
    minLength = 5,
    conflictRoles = [],
    condominiumId,
    table = "profiles",
  } = options;

  // Memoize conflictRoles to prevent unnecessary re-renders
  const conflictRolesKey = conflictRoles.join(",");

  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const isValidEmailFormat = (email: string): boolean => {
    return EMAIL_REGEX.test(email);
  };

  const checkEmailAvailability = useCallback(async (email: string, condoId?: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!isValidEmailFormat(trimmedEmail)) {
      setEmailStatus("invalid");
      return;
    }

    setEmailStatus("checking");

    try {
      const { data: existingProfile, error } = await supabase
        .from(table)
        .select("id, user_id")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (error) {
        console.error("Error checking email:", error);
        setEmailStatus("idle");
        return;
      }

      if (existingProfile) {
        // Check if user has conflicting roles
        if (conflictRoles.length > 0) {
          const { data: existingRoles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", existingProfile.user_id);

          const roles = (existingRoles || []).map((r) => r.role as string);
          const hasConflictingRole = conflictRoles.some((role) => roles.includes(role));

          if (hasConflictingRole) {
            setEmailStatus("conflict");
            return;
          }
        }

        // Check if already linked to the specified condominium
        if (condoId) {
          const { data: existingLink } = await supabase
            .from("user_condominiums")
            .select("id")
            .eq("user_id", existingProfile.user_id)
            .eq("condominium_id", condoId)
            .maybeSingle();

          if (existingLink) {
            setEmailStatus("taken");
            return;
          }
        }

        // For simple checks without condominium context, email is taken
        if (!condoId && conflictRoles.length === 0) {
          setEmailStatus("taken");
          return;
        }

        // User exists but can be linked (no conflict, not already linked)
        setEmailStatus("available");
      } else {
        setEmailStatus("available");
      }
    } catch (error) {
      console.error("Error checking email:", error);
      setEmailStatus("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, conflictRolesKey, condominiumId]);

  const validateEmail = useCallback((email: string) => {
    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const trimmedEmail = email.trim();

    // If email is too short, reset status
    if (trimmedEmail.length < minLength) {
      setEmailStatus("idle");
      return;
    }

    // Schedule validation with debounce
    const newTimeoutId = setTimeout(() => {
      checkEmailAvailability(email, condominiumId);
    }, debounceMs);

    setTimeoutId(newTimeoutId);
  }, [timeoutId, minLength, debounceMs, checkEmailAvailability, condominiumId]);

  const resetStatus = useCallback(() => {
    setEmailStatus("idle");
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }, [timeoutId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return {
    emailStatus,
    setEmailStatus,
    validateEmail,
    resetStatus,
    isValidating: emailStatus === "checking",
  };
}
