import { useMemo } from "react";

export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-4
  label: string;
  color: string;
  suggestions: string[];
}

interface PasswordCriteria {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function usePasswordStrength(password: string): PasswordStrengthResult {
  return useMemo(() => {
    if (!password || password.length === 0) {
      return {
        strength: "empty",
        score: 0,
        label: "",
        color: "bg-muted",
        suggestions: [],
      };
    }

    const criteria: PasswordCriteria = {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password),
    };

    // Calculate score based on criteria met
    let score = 0;
    if (password.length >= 6) score += 1;
    if (criteria.minLength) score += 1;
    if (criteria.hasLowercase && criteria.hasUppercase) score += 1;
    if (criteria.hasNumber) score += 1;
    if (criteria.hasSpecial) score += 1;

    // Cap score at 4
    score = Math.min(score, 4);

    // Build suggestions
    const suggestions: string[] = [];
    if (!criteria.minLength) {
      suggestions.push("Use pelo menos 8 caracteres");
    }
    if (!criteria.hasLowercase || !criteria.hasUppercase) {
      suggestions.push("Combine letras maiúsculas e minúsculas");
    }
    if (!criteria.hasNumber) {
      suggestions.push("Adicione números");
    }
    if (!criteria.hasSpecial) {
      suggestions.push("Inclua caracteres especiais (!@#$%...)");
    }

    // Determine strength level
    let strength: PasswordStrength;
    let label: string;
    let color: string;

    if (score <= 1) {
      strength = "weak";
      label = "Fraca";
      color = "bg-destructive";
    } else if (score === 2) {
      strength = "fair";
      label = "Regular";
      color = "bg-amber-500";
    } else if (score === 3) {
      strength = "good";
      label = "Boa";
      color = "bg-emerald-400";
    } else {
      strength = "strong";
      label = "Forte";
      color = "bg-emerald-500";
    }

    return {
      strength,
      score,
      label,
      color,
      suggestions,
    };
  }, [password]);
}
