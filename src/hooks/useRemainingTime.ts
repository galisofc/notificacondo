import { useMemo } from "react";
import { startOfDay, differenceInDays, differenceInHours, parseISO, isPast } from "date-fns";

export interface RemainingTimeResult {
  /** Full days remaining (using startOfDay comparison) */
  daysRemaining: number;
  /** Actual hours remaining from now */
  hoursRemaining: number;
  /** Whether the deadline has passed */
  isExpired: boolean;
  /** Whether there are 2 or fewer days remaining */
  isUrgent: boolean;
  /** Whether there are 0 full days but still hours remaining */
  isLastDay: boolean;
  /** Formatted display string (e.g., "5d restantes" or "12h restantes") */
  displayText: string;
  /** Short display (e.g., "5d" or "12h") */
  shortText: string;
  /** Status for styling purposes */
  status: "normal" | "urgent" | "critical" | "expired";
}

interface UseRemainingTimeOptions {
  /** Custom singular label for days (default: "dia") */
  dayLabel?: string;
  /** Custom plural label for days (default: "dias") */
  daysLabel?: string;
  /** Custom singular label for hours (default: "hora") */
  hourLabel?: string;
  /** Custom plural label for hours (default: "horas") */
  hoursLabel?: string;
  /** Custom suffix (default: "restante/restantes") */
  suffix?: string;
  /** Threshold for urgent status (default: 2 days) */
  urgentThreshold?: number;
}

/**
 * Hook to calculate remaining time until a deadline date.
 * Provides consistent calculation across the entire application.
 * 
 * @param endDate - The deadline date (Date object, ISO string, or null)
 * @param options - Optional configuration for labels and thresholds
 * @returns RemainingTimeResult with all calculated values and display strings
 * 
 * @example
 * // Basic usage with ISO string
 * const { daysRemaining, displayText, isExpired } = useRemainingTime(subscription.trial_ends_at);
 * 
 * @example
 * // Usage with Date object
 * const { displayText, status } = useRemainingTime(deadlineDate);
 * 
 * @example
 * // Custom labels
 * const { displayText } = useRemainingTime(endDate, { 
 *   dayLabel: "d", 
 *   hoursLabel: "h",
 *   suffix: "" 
 * });
 */
export function useRemainingTime(
  endDate: Date | string | null | undefined,
  options: UseRemainingTimeOptions = {}
): RemainingTimeResult {
  const {
    dayLabel = "dia",
    daysLabel = "dias",
    hourLabel = "hora",
    hoursLabel = "horas",
    suffix = "restante",
    urgentThreshold = 2,
  } = options;

  return useMemo(() => {
    // Default result for null/undefined dates
    if (!endDate) {
      return {
        daysRemaining: 0,
        hoursRemaining: 0,
        isExpired: true,
        isUrgent: false,
        isLastDay: false,
        displayText: "Expirado",
        shortText: "0d",
        status: "expired" as const,
      };
    }

    // Parse the end date
    const parsedEndDate = typeof endDate === "string" ? parseISO(endDate) : endDate;
    
    // Calculate using startOfDay for consistent day counting
    const now = startOfDay(new Date());
    const endDateStart = startOfDay(parsedEndDate);
    
    // Calculate remaining time
    const daysRemaining = differenceInDays(endDateStart, now);
    const hoursRemaining = differenceInHours(parsedEndDate, new Date());
    
    // Determine states
    const isExpired = isPast(parsedEndDate);
    const isLastDay = daysRemaining <= 0 && hoursRemaining > 0;
    const isUrgent = daysRemaining <= urgentThreshold && daysRemaining > 0;
    
    // Determine status for styling
    let status: "normal" | "urgent" | "critical" | "expired";
    if (isExpired) {
      status = "expired";
    } else if (isLastDay || daysRemaining <= 1) {
      status = "critical";
    } else if (isUrgent) {
      status = "urgent";
    } else {
      status = "normal";
    }

    // Generate display text
    let displayText: string;
    let shortText: string;
    
    if (isExpired) {
      displayText = "Expirado";
      shortText = "0d";
    } else if (isLastDay) {
      const hourText = hoursRemaining === 1 ? hourLabel : hoursLabel;
      const suffixText = hoursRemaining === 1 ? suffix : `${suffix}s`;
      displayText = `${hoursRemaining}${hourLabel === "h" ? "h" : ` ${hourText}`} ${suffixText}`.trim();
      shortText = `${hoursRemaining}h`;
    } else {
      const safeDays = Math.max(0, daysRemaining);
      const dayText = safeDays === 1 ? dayLabel : daysLabel;
      const suffixText = safeDays === 1 ? suffix : `${suffix}s`;
      displayText = `${safeDays}${dayLabel === "d" ? "d" : ` ${dayText}`} ${suffixText}`.trim();
      shortText = `${safeDays}d`;
    }

    return {
      daysRemaining: Math.max(0, daysRemaining),
      hoursRemaining: Math.max(0, hoursRemaining),
      isExpired,
      isUrgent,
      isLastDay,
      displayText,
      shortText,
      status,
    };
  }, [endDate, dayLabel, daysLabel, hourLabel, hoursLabel, suffix, urgentThreshold]);
}

/**
 * Utility function for non-hook contexts (edge functions, callbacks, etc.)
 * Same logic as useRemainingTime but without React hooks.
 */
export function calculateRemainingTime(
  endDate: Date | string | null | undefined,
  options: UseRemainingTimeOptions = {}
): RemainingTimeResult {
  const {
    dayLabel = "dia",
    daysLabel = "dias",
    hourLabel = "hora",
    hoursLabel = "horas",
    suffix = "restante",
    urgentThreshold = 2,
  } = options;

  if (!endDate) {
    return {
      daysRemaining: 0,
      hoursRemaining: 0,
      isExpired: true,
      isUrgent: false,
      isLastDay: false,
      displayText: "Expirado",
      shortText: "0d",
      status: "expired",
    };
  }

  const parsedEndDate = typeof endDate === "string" ? parseISO(endDate) : endDate;
  const now = startOfDay(new Date());
  const endDateStart = startOfDay(parsedEndDate);
  
  const daysRemaining = differenceInDays(endDateStart, now);
  const hoursRemaining = differenceInHours(parsedEndDate, new Date());
  
  const isExpired = isPast(parsedEndDate);
  const isLastDay = daysRemaining <= 0 && hoursRemaining > 0;
  const isUrgent = daysRemaining <= urgentThreshold && daysRemaining > 0;
  
  let status: "normal" | "urgent" | "critical" | "expired";
  if (isExpired) {
    status = "expired";
  } else if (isLastDay || daysRemaining <= 1) {
    status = "critical";
  } else if (isUrgent) {
    status = "urgent";
  } else {
    status = "normal";
  }

  let displayText: string;
  let shortText: string;
  
  if (isExpired) {
    displayText = "Expirado";
    shortText = "0d";
  } else if (isLastDay) {
    const hourText = hoursRemaining === 1 ? hourLabel : hoursLabel;
    const suffixText = hoursRemaining === 1 ? suffix : `${suffix}s`;
    displayText = `${hoursRemaining}${hourLabel === "h" ? "h" : ` ${hourText}`} ${suffixText}`.trim();
    shortText = `${hoursRemaining}h`;
  } else {
    const safeDays = Math.max(0, daysRemaining);
    const dayText = safeDays === 1 ? dayLabel : daysLabel;
    const suffixText = safeDays === 1 ? suffix : `${suffix}s`;
    displayText = `${safeDays}${dayLabel === "d" ? "d" : ` ${dayText}`} ${suffixText}`.trim();
    shortText = `${safeDays}d`;
  }

  return {
    daysRemaining: Math.max(0, daysRemaining),
    hoursRemaining: Math.max(0, hoursRemaining),
    isExpired,
    isUrgent,
    isLastDay,
    displayText,
    shortText,
    status,
  };
}
