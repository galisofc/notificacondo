import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

// Configurações centralizadas de data/hora
export const DATE_TIME_CONFIG = {
  timezone: "America/Sao_Paulo",
  dateFormat: "dd/MM/yyyy",
  timeFormat: "HH:mm",
  dateTimeFormat: "dd/MM/yyyy HH:mm",
  dateTimeLongFormat: "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
  locale: ptBR,
} as const;

/**
 * Converte uma data para o timezone de Brasília
 */
export function toSaoPauloTime(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(dateObj, DATE_TIME_CONFIG.timezone);
}

/**
 * Formata uma data no padrão brasileiro (dd/MM/yyyy)
 */
export function formatDate(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateFormat, {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

/**
 * Formata a hora no padrão 24h (HH:mm)
 */
export function formatTime(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.timeFormat, {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

/**
 * Formata data e hora no padrão brasileiro (dd/MM/yyyy HH:mm)
 */
export function formatDateTime(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateTimeFormat, {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

/**
 * Formata data e hora no formato longo (dd de MMMM de yyyy às HH:mm)
 */
export function formatDateTimeLong(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, DATE_TIME_CONFIG.dateTimeLongFormat, {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

/**
 * Formata com um padrão customizado mantendo o timezone de Brasília
 */
export function formatCustom(date: Date | string, formatStr: string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, formatStr, {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}

/**
 * Retorna a data/hora atual no timezone de Brasília
 */
export function nowInSaoPaulo(): Date {
  return toSaoPauloTime(new Date());
}

/**
 * Formata apenas o mês e ano (MMMM 'de' yyyy)
 */
export function formatMonthYear(date: Date | string): string {
  try {
    const zonedDate = toSaoPauloTime(date);
    return format(zonedDate, "MMMM 'de' yyyy", {
      locale: DATE_TIME_CONFIG.locale,
    });
  } catch {
    return typeof date === "string" ? date : "";
  }
}
