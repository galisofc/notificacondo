export const PACKAGE_STATUS = {
  PENDENTE: 'pendente',
  RETIRADA: 'retirada',
} as const;

export type PackageStatus = typeof PACKAGE_STATUS[keyof typeof PACKAGE_STATUS];

export const STATUS_LABELS: Record<PackageStatus, string> = {
  pendente: 'Pendente',
  retirada: 'Retirada',
};

export const STATUS_COLORS: Record<PackageStatus, { bg: string; text: string; border: string }> = {
  pendente: { 
    bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800'
  },
  retirada: { 
    bg: 'bg-green-100 dark:bg-green-900/30', 
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800'
  },
};

export function generatePickupCode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
