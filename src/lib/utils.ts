import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates a Brazilian CPF number
 * @param cpf - CPF string (with or without formatting)
 * @returns true if valid, false otherwise
 */
export function isValidCPF(cpf: string): boolean {
  // Remove non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, "");

  // Must have 11 digits
  if (cleanCPF.length !== 11) return false;

  // Check for known invalid CPFs (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
}

/**
 * Validates a Brazilian CNPJ number
 * @param cnpj - CNPJ string (with or without formatting)
 * @returns true if valid, false otherwise
 */
export function isValidCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  const cleanCNPJ = cnpj.replace(/\D/g, "");

  // Must have 14 digits
  if (cleanCNPJ.length !== 14) return false;

  // Check for known invalid CNPJs (all same digits)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  // Validate first check digit
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validate second check digit
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Formats a CNPJ number with mask
 * @param cnpj - CNPJ string (with or without formatting)
 * @returns formatted CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  if (cleanCNPJ.length !== 14) return cnpj;
  return cleanCNPJ.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formats a phone number with mask
 * @param phone - Phone string (with or without formatting)
 * @returns formatted phone ((00) 00000-0000 or (00) 0000-0000)
 */
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  } else if (cleanPhone.length === 10) {
    return cleanPhone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return phone;
}

/**
 * Formats a CEP with mask
 * @param cep - CEP string (with or without formatting)
 * @returns formatted CEP (00000-000)
 */
export function formatCEP(cep: string): string {
  const cleanCEP = cep.replace(/\D/g, "");
  if (cleanCEP.length !== 8) return cep;
  return cleanCEP.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}
