import { useMemo } from "react";
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateTimeLong,
  formatCustom,
  formatMonthYear,
  nowInSaoPaulo,
  toSaoPauloTime,
} from "@/lib/dateUtils";

/**
 * Hook para formatação de datas no padrão brasileiro (Brasília)
 * 
 * @example
 * const { date, time, dateTime, monthYear } = useFormattedDate(occurrence.created_at);
 * // date: "25/12/2024"
 * // time: "14:30"
 * // dateTime: "25/12/2024 14:30"
 * // monthYear: "dezembro de 2024"
 */
export function useFormattedDate(date: Date | string | null | undefined) {
  return useMemo(() => {
    if (!date) {
      return {
        date: "-",
        time: "-",
        dateTime: "-",
        dateTimeLong: "-",
        monthYear: "-",
        custom: (format: string) => "-",
        raw: null,
      };
    }

    return {
      /** Formato: dd/MM/yyyy (ex: 25/12/2024) */
      date: formatDate(date),
      /** Formato: HH:mm (ex: 14:30) */
      time: formatTime(date),
      /** Formato: dd/MM/yyyy HH:mm (ex: 25/12/2024 14:30) */
      dateTime: formatDateTime(date),
      /** Formato: dd 'de' MMMM 'de' yyyy 'às' HH:mm (ex: 25 de dezembro de 2024 às 14:30) */
      dateTimeLong: formatDateTimeLong(date),
      /** Formato: MMMM 'de' yyyy (ex: dezembro de 2024) */
      monthYear: formatMonthYear(date),
      /** Formato customizado usando date-fns format string */
      custom: (format: string) => formatCustom(date, format),
      /** Data convertida para o timezone de São Paulo */
      raw: toSaoPauloTime(date),
    };
  }, [date]);
}

/**
 * Hook para obter a data/hora atual no timezone de Brasília
 * 
 * @example
 * const now = useNowInSaoPaulo();
 * // Retorna a data atual no fuso de Brasília
 */
export function useNowInSaoPaulo() {
  return useMemo(() => nowInSaoPaulo(), []);
}

/**
 * Hook para formatação de múltiplas datas
 * 
 * @example
 * const formatter = useDateFormatter();
 * formatter.date(occurrence.created_at); // "25/12/2024"
 * formatter.dateTime(occurrence.updated_at); // "25/12/2024 14:30"
 */
export function useDateFormatter() {
  return useMemo(
    () => ({
      date: formatDate,
      time: formatTime,
      dateTime: formatDateTime,
      dateTimeLong: formatDateTimeLong,
      monthYear: formatMonthYear,
      custom: formatCustom,
      toSaoPaulo: toSaoPauloTime,
      now: nowInSaoPaulo,
    }),
    []
  );
}

export default useFormattedDate;
