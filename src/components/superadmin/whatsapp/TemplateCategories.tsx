import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Scale, 
  Calendar, 
  CreditCard, 
  Clock, 
  ArrowRightLeft,
  Package,
  type LucideIcon 
} from "lucide-react";

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  slugs: string[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "occurrences",
    name: "Ocorrências",
    description: "Notificações, advertências e multas",
    icon: Bell,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    slugs: ["notification_occurrence", "notify_sindico_defense"],
  },
  {
    id: "decisions",
    name: "Decisões",
    description: "Arquivamentos, advertências e multas aplicadas",
    icon: Scale,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    slugs: ["decision_archived", "decision_warning", "decision_fine"],
  },
  {
    id: "party_hall",
    name: "Salão de Festas",
    description: "Lembretes e cancelamentos de reservas",
    icon: Calendar,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    slugs: ["party_hall_reminder", "party_hall_cancelled"],
  },
  {
    id: "billing",
    name: "Faturamento",
    description: "Faturas e confirmação de pagamentos",
    icon: CreditCard,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    slugs: ["payment_confirmed", "invoice_generated"],
  },
  {
    id: "trial",
    name: "Período de Teste",
    description: "Boas-vindas e avisos de expiração",
    icon: Clock,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    slugs: ["trial_welcome", "trial_ending", "trial_expired"],
  },
  {
    id: "transfer",
    name: "Transferências",
    description: "Transferência de gestão de condomínio",
    icon: ArrowRightLeft,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    slugs: ["condominium_transfer", "condominium_transfer_old_owner"],
  },
  {
    id: "packages",
    name: "Encomendas",
    description: "Notificação de chegada de encomendas",
    icon: Package,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    slugs: ["package_arrival"],
  },
];

export const TEMPLATE_COLORS: Record<string, string> = {
  notification_occurrence: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  decision_archived: "bg-green-500/10 text-green-500 border-green-500/20",
  decision_warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  decision_fine: "bg-red-500/10 text-red-500 border-red-500/20",
  notify_sindico_defense: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  trial_ending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  trial_expired: "bg-red-500/10 text-red-500 border-red-500/20",
  trial_welcome: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  condominium_transfer: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  condominium_transfer_old_owner: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  payment_confirmed: "bg-green-500/10 text-green-500 border-green-500/20",
  invoice_generated: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  party_hall_reminder: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  party_hall_cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  package_arrival: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

// Example values for preview
export const VARIABLE_EXAMPLES: Record<string, string> = {
  nome: "João Silva",
  condominio: "Residencial Primavera",
  tipo: "Advertência",
  titulo: "Barulho após horário permitido",
  link: "https://app.exemplo.com/xyz123",
  justificativa: "Após análise, consideramos procedente a reclamação.",
  nome_morador: "Maria Santos",
  dias_restantes: "3 dias",
  data_expiracao: "15/01/2026",
  link_planos: "https://app.exemplo.com/planos",
  link_dashboard: "https://app.exemplo.com/dashboard",
  nome_novo_sindico: "Carlos Oliveira",
  nome_antigo_sindico: "Pedro Costa",
  data_transferencia: "10/01/2026",
  observacoes: "• Transferência solicitada pelo síndico anterior",
  descricao_fatura: "Mensalidade Janeiro/2026",
  metodo_pagamento: "PIX",
  valor: "R$ 149,90",
  data_pagamento: "10/01/2026",
  numero_fatura: "FAT-2026-001",
  periodo: "01/01/2026 a 31/01/2026",
  data_vencimento: "15/01/2026",
  espaco: "Salão de Festas",
  data: "15/01/2026",
  horario_inicio: "14:00",
  horario_fim: "22:00",
  checklist: "*Cozinha:*\n  • Fogão\n  • Geladeira\n  • Microondas\n*Salão:*\n  • Mesas\n  • Cadeiras\n  • Ar condicionado",
  bloco: "A",
  apartamento: "101",
  codigo: "PKG-A1B2C3",
  tipo_encomenda: "Correios",
  codigo_rastreio: "BR123456789BR",
};

export function getCategoryForSlug(slug: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find(cat => cat.slugs.includes(slug));
}
