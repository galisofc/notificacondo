import { useState } from "react";
import { formatPhone, formatCPF, MaskedInput } from "@/components/ui/masked-input";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPast, format, parseISO, startOfDay } from "date-fns";
import { calculateRemainingTime } from "@/hooks/useRemainingTime";
import { useDateFormatter } from "@/hooks/useFormattedDate";

import DashboardLayout from "@/components/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Bell,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  Save,
  Loader2,
  CheckCircle2,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Search,
  Info,
  Sparkles,
  Package,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SubscriptionHistory } from "@/components/superadmin/SubscriptionHistory";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isValidCPF, addBusinessDays } from "@/lib/utils";
import { XOctagon } from "lucide-react";

type PlanType = "start" | "essencial" | "profissional" | "enterprise";

const PLAN_LIMITS: Record<PlanType, { notifications: number; warnings: number; fines: number; packages: number }> = {
  start: { notifications: 10, warnings: 10, fines: 0, packages: 20 },
  essencial: { notifications: 50, warnings: 50, fines: 25, packages: 100 },
  profissional: { notifications: 200, warnings: 200, fines: 100, packages: 500 },
  enterprise: { notifications: 999999, warnings: 999999, fines: 999999, packages: -1 },
};

const PLAN_INFO: Record<PlanType, { name: string; color: string }> = {
  start: { name: "Start", color: "bg-gray-500" },
  essencial: { name: "Essencial", color: "bg-blue-500" },
  profissional: { name: "Profissional", color: "bg-violet-500" },
  enterprise: { name: "Enterprise", color: "bg-amber-500" },
};

export default function SubscriptionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { date: formatDate, dateTime: formatDateTime, custom: formatCustom } = useDateFormatter();

  const [isEditing, setIsEditing] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false);
  const [isAddDaysDialogOpen, setIsAddDaysDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isExtendTrialDialogOpen, setIsExtendTrialDialogOpen] = useState(false);
  const [isActivateTrialDialogOpen, setIsActivateTrialDialogOpen] = useState(false);
  const [isEndTrialDialogOpen, setIsEndTrialDialogOpen] = useState(false);
  const [trialExtensionDays, setTrialExtensionDays] = useState<number>(7);
  const [trialActivationDays, setTrialActivationDays] = useState<number>(14);
  const [trialExtensionJustification, setTrialExtensionJustification] = useState("");
  const [trialActivationJustification, setTrialActivationJustification] = useState("");
  const [extraDays, setExtraDays] = useState<number>(0);
  const [extraDaysJustification, setExtraDaysJustification] = useState("");
  const [endTrialDiscount, setEndTrialDiscount] = useState<number>(0);
  const [endTrialDiscountType, setEndTrialDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [transferCpf, setTransferCpf] = useState("");
  const [foundSindico, setFoundSindico] = useState<{
    user_id: string;
    full_name: string;
    email: string;
    cpf: string;
  } | null>(null);
  const [isSearchingSindico, setIsSearchingSindico] = useState(false);
  const [transferNotes, setTransferNotes] = useState("");
  const [editedData, setEditedData] = useState<{
    plan: PlanType;
    active: boolean;
    notifications_limit: number;
    warnings_limit: number;
    fines_limit: number;
    package_notifications_limit: number;
    is_lifetime: boolean;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["subscription-details", id],
    queryFn: async () => {
      if (!id) throw new Error("ID não fornecido");

      // Fetch subscription
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (subError) throw subError;

      // Fetch condominium
      const { data: condominium, error: condoError } = await supabase
        .from("condominiums")
        .select("id, name, address, city, state, owner_id")
        .eq("id", subscription.condominium_id)
        .single();

      if (condoError) throw condoError;

      // Fetch owner profile
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", condominium.owner_id)
        .single();

      // Fetch invoices for this condominium
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("condominium_id", condominium.id)
        .order("due_date", { ascending: false })
        .limit(10);

      // Calculate real usage from occurrences with status 'notificado' or 'arquivada'
      // within the current period
      const periodStart = subscription.current_period_start;
      const periodEnd = subscription.current_period_end;

      // Fetch occurrences with relevant statuses
      let occurrencesQuery = supabase
        .from("occurrences")
        .select("type, status")
        .eq("condominium_id", condominium.id)
        .in("status", ["notificado", "arquivada", "advertido", "multado"]);

      // Filter by period if dates exist
      if (periodStart) {
        occurrencesQuery = occurrencesQuery.gte("created_at", periodStart);
      }
      if (periodEnd) {
        occurrencesQuery = occurrencesQuery.lte("created_at", periodEnd);
      }

      const { data: occurrences } = await occurrencesQuery;

      // Count by type
      const realUsage = {
        notifications: 0,
        warnings: 0,
        fines: 0,
      };

      if (occurrences) {
        occurrences.forEach((occ) => {
          if (occ.type === "notificacao") {
            realUsage.notifications++;
          } else if (occ.type === "advertencia") {
            realUsage.warnings++;
          } else if (occ.type === "multa") {
            realUsage.fines++;
          }
        });
      }

      return {
        subscription,
        condominium,
        owner: ownerProfile,
        invoices: invoices || [],
        realUsage,
      };
    },
    enabled: !!id,
  });

  // Fetch plans for pricing info
  const { data: plans } = useQuery({
    queryKey: ["active-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updateData: typeof editedData) => {
      if (!id || !updateData) throw new Error("Dados inválidos");

      // When setting as lifetime, also disable trial and clear trial dates
      const updatePayload: Record<string, any> = {
        plan: updateData.plan,
        active: updateData.active,
        notifications_limit: updateData.notifications_limit,
        warnings_limit: updateData.warnings_limit,
        fines_limit: updateData.fines_limit,
        package_notifications_limit: updateData.package_notifications_limit,
        is_lifetime: updateData.is_lifetime,
      };

      // If marking as lifetime, ensure trial is disabled
      if (updateData.is_lifetime) {
        updatePayload.is_trial = false;
        updatePayload.trial_ends_at = null;
      }

      const { error } = await supabase
        .from("subscriptions")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      setIsEditing(false);
      toast({
        title: "Assinatura atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetUsageMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID não fornecido");

      const { error } = await supabase
        .from("subscriptions")
        .update({
          notifications_used: 0,
          warnings_used: 0,
          fines_used: 0,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      toast({
        title: "Uso reiniciado",
        description: "O período de uso foi reiniciado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reiniciar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updatePeriodMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      if (!id) throw new Error("ID não fornecido");

      const { error } = await supabase
        .from("subscriptions")
        .update({
          current_period_start: new Date(startDate).toISOString(),
          current_period_end: new Date(endDate).toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      setIsPeriodDialogOpen(false);
      toast({
        title: "Período atualizado",
        description: "O período da assinatura foi alterado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar período",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const addExtraDaysMutation = useMutation({
    mutationFn: async ({ days, justification }: { days: number; justification: string }) => {
      if (!id || !data?.subscription) throw new Error("Dados não encontrados");

      const currentEndDate = data.subscription.current_period_end 
        ? new Date(data.subscription.current_period_end)
        : new Date();
      
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + days);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          current_period_end: newEndDate.toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Registrar no audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("audit_logs")
        .insert({
          table_name: "subscriptions",
          action: "ADD_EXTRA_DAYS",
          record_id: id,
          new_data: {
            action: "add_extra_days",
            days_added: days,
            previous_end_date: currentEndDate.toISOString(),
            new_end_date: newEndDate.toISOString(),
            condominium_id: data.subscription.condominium_id,
            condominium_name: data.condominium?.name || "N/A",
            justification: justification.trim() || "Sem justificativa informada",
          },
          user_id: user?.id || null,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      setIsAddDaysDialogOpen(false);
      setExtraDays(0);
      setExtraDaysJustification("");
      toast({
        title: "Dias adicionados",
        description: `${extraDays} dia(s) foram adicionados à assinatura sem cobrança extra.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar dias",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const extendTrialMutation = useMutation({
    mutationFn: async ({ days, justification }: { days: number; justification: string }) => {
      if (!id || !data?.subscription) throw new Error("Dados não encontrados");

      const currentTrialEnd = data.subscription.trial_ends_at 
        ? new Date(data.subscription.trial_ends_at)
        : new Date();
      
      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          trial_ends_at: newTrialEnd.toISOString(),
          is_trial: true,
        })
        .eq("id", id);

      if (error) throw error;

      // Registrar no audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("audit_logs")
        .insert({
          table_name: "subscriptions",
          action: "EXTEND_TRIAL",
          record_id: id,
          new_data: {
            action: "extend_trial",
            days_added: days,
            previous_trial_end: currentTrialEnd.toISOString(),
            new_trial_end: newTrialEnd.toISOString(),
            condominium_id: data.subscription.condominium_id,
            condominium_name: data.condominium?.name || "N/A",
            justification: justification.trim() || "Sem justificativa informada",
          },
          user_id: user?.id || null,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      setIsExtendTrialDialogOpen(false);
      setTrialExtensionDays(7);
      setTrialExtensionJustification("");
      toast({
        title: "Trial estendido",
        description: `O período de trial foi estendido com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao estender trial",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const activateTrialMutation = useMutation({
    mutationFn: async ({ days, justification }: { days: number; justification: string }) => {
      if (!id || !data?.subscription) throw new Error("Dados não encontrados");

      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          trial_ends_at: newTrialEnd.toISOString(),
          is_trial: true,
        })
        .eq("id", id);

      if (error) throw error;

      // Registrar no audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("audit_logs")
        .insert({
          table_name: "subscriptions",
          action: "ACTIVATE_TRIAL",
          record_id: id,
          new_data: {
            action: "activate_trial",
            trial_days: days,
            trial_end: newTrialEnd.toISOString(),
            condominium_id: data.subscription.condominium_id,
            condominium_name: data.condominium?.name || "N/A",
            justification: justification.trim() || "Sem justificativa informada",
          },
          user_id: user?.id || null,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      setIsActivateTrialDialogOpen(false);
      setTrialActivationDays(14);
      setTrialActivationJustification("");
      toast({
        title: "Trial ativado",
        description: `O período de trial foi ativado com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar trial",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const endTrialMutation = useMutation({
    mutationFn: async ({ discount, discountType }: { discount: number; discountType: "percentage" | "fixed" }) => {
      if (!id || !data?.subscription || !data?.condominium) throw new Error("Dados não encontrados");

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);
      
      // Calculate due date: 3 business days from now
      const dueDate = addBusinessDays(now, 3);

      // Get plan price
      const { data: planData } = await supabase
        .from("plans")
        .select("price, name")
        .eq("slug", data.subscription.plan)
        .single();

      const planPrice = planData?.price || 0;
      
      // Calculate final amount with discount
      let finalAmount = planPrice;
      let discountAmount = 0;
      if (discount > 0) {
        if (discountType === "percentage") {
          discountAmount = (planPrice * discount) / 100;
        } else {
          discountAmount = discount;
        }
        finalAmount = Math.max(0, planPrice - discountAmount);
      }

      // Update subscription to end trial
      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          is_trial: false,
          trial_ends_at: null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", id);

      if (subError) throw subError;

      // Generate invoice with 3 business days due date (only if plan has price > 0)
      if (planPrice > 0) {
        const discountDescription = discount > 0 
          ? ` (Desconto: ${discountType === "percentage" ? `${discount}%` : `R$ ${discount.toFixed(2)}`})`
          : "";
        
        const { error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            subscription_id: id,
            condominium_id: data.condominium.id,
            amount: finalAmount,
            status: "pending",
            due_date: dueDate.toISOString().split("T")[0],
            period_start: now.toISOString().split("T")[0],
            period_end: periodEnd.toISOString().split("T")[0],
            description: `Primeira mensalidade - Plano ${planData?.name || data.subscription.plan}${discountDescription}`,
          });

        if (invoiceError) throw invoiceError;
      }

      // Registrar no audit log
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("audit_logs")
        .insert({
          table_name: "subscriptions",
          action: "END_TRIAL",
          record_id: id,
          new_data: {
            action: "end_trial",
            ended_by: "super_admin",
            plan: data.subscription.plan,
            original_amount: planPrice,
            discount_amount: discountAmount,
            discount_type: discountType,
            discount_value: discount,
            invoice_amount: finalAmount,
            invoice_due_date: dueDate.toISOString(),
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
            condominium_id: data.subscription.condominium_id,
            condominium_name: data.condominium?.name || "N/A",
          },
          user_id: user?.id || null,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-invoices"] });
      setIsEndTrialDialogOpen(false);
      setEndTrialDiscount(0);
      setEndTrialDiscountType("percentage");
      toast({
        title: "Trial encerrado",
        description: "O trial foi encerrado e a fatura foi gerada com vencimento em 3 dias úteis.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao encerrar trial",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const transferCondominiumMutation = useMutation({
    mutationFn: async ({ newOwnerId, notes }: { newOwnerId: string; notes: string }) => {
      if (!data?.condominium?.id) throw new Error("Condomínio não encontrado");
      
      const currentOwnerId = data.condominium.owner_id;

      // Get current owner name for notification
      const { data: currentOwnerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentOwnerId)
        .single();

      // Get current user ID for the transferred_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update condominium owner
      const { error: updateError } = await supabase
        .from("condominiums")
        .update({ owner_id: newOwnerId })
        .eq("id", data.condominium.id);

      if (updateError) throw updateError;

      // Record the transfer in history with notes
      const { error: transferError } = await supabase
        .from("condominium_transfers")
        .insert({
          condominium_id: data.condominium.id,
          from_owner_id: currentOwnerId,
          to_owner_id: newOwnerId,
          transferred_by: user.id,
          notes: notes.trim() || null,
        });

      if (transferError) {
        console.error("Error recording transfer:", transferError);
      }

      // Send WhatsApp notification to new and old owners
      try {
        await supabase.functions.invoke("notify-transfer", {
          body: {
            condominium_id: data.condominium.id,
            condominium_name: data.condominium.name,
            new_owner_id: newOwnerId,
            old_owner_id: currentOwnerId,
            old_owner_name: currentOwnerProfile?.full_name || "Síndico anterior",
            notes: notes.trim() || undefined,
          },
        });
        console.log("Transfer notifications sent successfully");
      } catch (notifyError) {
        console.error("Error sending transfer notifications:", notifyError);
        // Don't throw - the transfer was successful, just notification failed
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      setIsTransferDialogOpen(false);
      setTransferCpf("");
      setFoundSindico(null);
      setTransferNotes("");
      toast({
        title: "Condomínio transferido",
        description: "O condomínio foi transferido para o novo síndico com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao transferir",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSearchSindico = async () => {
    const cleanCpf = transferCpf.replace(/\D/g, "");
    
    if (!cleanCpf || cleanCpf.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Digite um CPF válido com 11 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidCPF(cleanCpf)) {
      toast({
        title: "CPF inválido",
        description: "O CPF informado não é válido.",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingSindico(true);
    setFoundSindico(null);

    try {
      // Find profile by CPF
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, cpf")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast({
          title: "Síndico não encontrado",
          description: "Nenhum síndico cadastrado com este CPF.",
          variant: "destructive",
        });
        return;
      }

      // Check if user is a sindico
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id)
        .eq("role", "sindico")
        .maybeSingle();

      if (roleError) throw roleError;

      if (!roleData) {
        toast({
          title: "Usuário não é síndico",
          description: "O CPF informado pertence a um usuário que não é síndico.",
          variant: "destructive",
        });
        return;
      }

      // Check if it's the same owner
      if (profile.user_id === data?.condominium?.owner_id) {
        toast({
          title: "Mesmo proprietário",
          description: "Este síndico já é o responsável pelo condomínio.",
          variant: "destructive",
        });
        return;
      }

      setFoundSindico({
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        cpf: profile.cpf || cleanCpf,
      });
    } catch (error: any) {
      toast({
        title: "Erro na busca",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingSindico(false);
    }
  };

  const handleConfirmTransfer = () => {
    if (foundSindico) {
      transferCondominiumMutation.mutate({ 
        newOwnerId: foundSindico.user_id, 
        notes: transferNotes 
      });
    }
  };

  const handleOpenTransferDialog = () => {
    setTransferCpf("");
    setFoundSindico(null);
    setTransferNotes("");
    setIsTransferDialogOpen(true);
  };

  const handleOpenPeriodDialog = () => {
    if (data?.subscription) {
      const startDate = data.subscription.current_period_start 
        ? format(new Date(data.subscription.current_period_start), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      const endDate = data.subscription.current_period_end
        ? format(new Date(data.subscription.current_period_end), "yyyy-MM-dd")
        : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      
      setPeriodStartDate(startDate);
      setPeriodEndDate(endDate);
      setIsPeriodDialogOpen(true);
    }
  };

  const handleSavePeriod = () => {
    if (!periodStartDate || !periodEndDate) {
      toast({
        title: "Datas inválidas",
        description: "Preencha as datas de início e fim do período.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(periodEndDate) <= new Date(periodStartDate)) {
      toast({
        title: "Período inválido",
        description: "A data de fim deve ser posterior à data de início.",
        variant: "destructive",
      });
      return;
    }

    updatePeriodMutation.mutate({
      startDate: periodStartDate,
      endDate: periodEndDate,
    });
  };

  const handleStartEditing = () => {
    if (data?.subscription) {
      setEditedData({
        plan: data.subscription.plan as PlanType,
        active: data.subscription.active,
        notifications_limit: data.subscription.notifications_limit,
        warnings_limit: data.subscription.warnings_limit,
        fines_limit: data.subscription.fines_limit,
        package_notifications_limit: data.subscription.package_notifications_limit,
        is_lifetime: data.subscription.is_lifetime || false,
      });
      setIsEditing(true);
    }
  };

  const handlePlanChange = (plan: PlanType) => {
    if (editedData) {
      const limits = PLAN_LIMITS[plan];
      setEditedData({
        ...editedData,
        plan,
        notifications_limit: limits.notifications,
        warnings_limit: limits.warnings,
        fines_limit: limits.fines,
        package_notifications_limit: limits.packages,
      });
    }
  };

  const handleSave = () => {
    if (editedData) {
      updateMutation.mutate(editedData);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 70) return "text-amber-500";
    return "text-emerald-500";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-48 lg:col-span-2" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar detalhes da assinatura</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { subscription, condominium, owner, invoices = [], realUsage = { notifications: 0, warnings: 0, fines: 0 } } = data;
  const planInfo = PLAN_INFO[subscription.plan as PlanType];

  const getInvoiceStatusBadge = (status: string, dueDate: string) => {
    // Usa startOfDay para comparar apenas as datas, ignorando horário
    const today = startOfDay(new Date());
    const dueDateParsed = startOfDay(parseISO(dueDate));
    const isOverdue = dueDateParsed < today && status === "pending";
    
    if (status === "paid") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Pago
        </Badge>
      );
    }
    if (isOverdue) {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="w-3 h-3 mr-1" />
          Vencido
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Detalhes da Assinatura | Super Admin</title>
      </Helmet>

      <div className="space-y-4 sm:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[
          { label: "Assinantes", href: "/superadmin/subscriptions" },
          { label: condominium?.name || "Detalhes" }
        ]} />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg sm:text-2xl font-bold text-foreground truncate">
                {condominium.name}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {condominium.address && `${condominium.address}, `}
                {condominium.city} - {condominium.state}
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-11 sm:ml-0">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none text-sm h-9">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1 sm:flex-none text-sm h-9">
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </>
            ) : (
              <Button onClick={handleStartEditing} className="flex-1 sm:flex-none text-sm h-9">Editar</Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Plan Card */}
          <Card className="lg:col-span-2 bg-gradient-card border-border/50">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Plano de Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
              {isEditing && editedData ? (
                <div className="space-y-4">
                  {/* Lifetime Toggle */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <Label className="text-base font-semibold">Plano Vitalício</Label>
                          <p className="text-sm text-muted-foreground">
                            Sem expiração, sem cobranças e sem limitações
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={editedData.is_lifetime}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditedData({
                              ...editedData,
                              is_lifetime: true,
                              plan: "enterprise",
                              active: true,
                              notifications_limit: 999999,
                              warnings_limit: 999999,
                              fines_limit: 999999,
                            });
                          } else {
                            setEditedData({ ...editedData, is_lifetime: false });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Plano</Label>
                      <Select
                        value={editedData.plan}
                        onValueChange={(v) => handlePlanChange(v as PlanType)}
                        disabled={editedData.is_lifetime}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PLAN_INFO).map(([key, info]) => (
                            <SelectItem key={key} value={key}>
                              {info.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex items-center gap-3 pt-2">
                        <Switch
                          checked={editedData.active}
                          onCheckedChange={(checked) =>
                            setEditedData({ ...editedData, active: checked })
                          }
                          disabled={editedData.is_lifetime}
                        />
                        <span className="text-sm text-muted-foreground">
                          {editedData.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Limite de Notificações</Label>
                      <Input
                        type="number"
                        value={editedData.notifications_limit === -1 ? "" : editedData.notifications_limit}
                        placeholder={editedData.notifications_limit === -1 ? "Ilimitado" : ""}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            notifications_limit: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={editedData.is_lifetime || editedData.notifications_limit === -1}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="unlimited_notifications"
                          checked={editedData.notifications_limit === -1}
                          onCheckedChange={(checked) =>
                            setEditedData({ ...editedData, notifications_limit: checked ? -1 : 0 })
                          }
                          disabled={editedData.is_lifetime}
                        />
                        <Label htmlFor="unlimited_notifications" className="text-xs font-normal cursor-pointer">Ilimitado</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Advertências</Label>
                      <Input
                        type="number"
                        value={editedData.warnings_limit === -1 ? "" : editedData.warnings_limit}
                        placeholder={editedData.warnings_limit === -1 ? "Ilimitado" : ""}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            warnings_limit: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={editedData.is_lifetime || editedData.warnings_limit === -1}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="unlimited_warnings"
                          checked={editedData.warnings_limit === -1}
                          onCheckedChange={(checked) =>
                            setEditedData({ ...editedData, warnings_limit: checked ? -1 : 0 })
                          }
                          disabled={editedData.is_lifetime}
                        />
                        <Label htmlFor="unlimited_warnings" className="text-xs font-normal cursor-pointer">Ilimitado</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Multas</Label>
                      <Input
                        type="number"
                        value={editedData.fines_limit === -1 ? "" : editedData.fines_limit}
                        placeholder={editedData.fines_limit === -1 ? "Ilimitado" : ""}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            fines_limit: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={editedData.is_lifetime || editedData.fines_limit === -1}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="unlimited_fines"
                          checked={editedData.fines_limit === -1}
                          onCheckedChange={(checked) =>
                            setEditedData({ ...editedData, fines_limit: checked ? -1 : 0 })
                          }
                          disabled={editedData.is_lifetime}
                        />
                        <Label htmlFor="unlimited_fines" className="text-xs font-normal cursor-pointer">Ilimitado</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Encomendas</Label>
                      <Input
                        type="number"
                        value={editedData.package_notifications_limit === -1 ? "" : editedData.package_notifications_limit}
                        placeholder={editedData.package_notifications_limit === -1 ? "Ilimitado" : ""}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            package_notifications_limit: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={editedData.is_lifetime || editedData.package_notifications_limit === -1}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="unlimited_packages"
                          checked={editedData.package_notifications_limit === -1}
                          onCheckedChange={(checked) =>
                            setEditedData({ ...editedData, package_notifications_limit: checked ? -1 : 0 })
                          }
                          disabled={editedData.is_lifetime}
                        />
                        <Label htmlFor="unlimited_packages" className="text-xs font-normal cursor-pointer">Ilimitado</Label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-6">
                  <div
                    className={`w-16 h-16 rounded-2xl ${subscription.is_lifetime ? "bg-gradient-to-br from-amber-500 to-yellow-400" : planInfo.color} flex items-center justify-center shrink-0`}
                  >
                    {subscription.is_lifetime ? (
                      <Sparkles className="w-8 h-8 text-black" />
                    ) : (
                      <CreditCard className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        {planInfo.name}
                      </h3>
                      {subscription.is_lifetime && (
                        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold border-0">
                          <Sparkles className="w-3 h-3 mr-1" />
                          VITALÍCIO
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          subscription.active
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {subscription.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Trial Status Section */}
              {subscription.is_trial && (
                <>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {(() => {
                        const trialEndsAt = subscription.trial_ends_at;
                        if (!trialEndsAt) return null;
                        
                        const trialInfo = calculateRemainingTime(trialEndsAt);
                        const endDate = parseISO(trialEndsAt);
                        
                        return (
                          <>
                            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                              trialInfo.isExpired 
                                ? "bg-destructive/10" 
                                : trialInfo.isUrgent 
                                  ? "bg-orange-500/10" 
                                  : "bg-amber-500/10"
                            }`}>
                              <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                trialInfo.isExpired 
                                  ? "text-destructive" 
                                  : trialInfo.isUrgent 
                                    ? "text-orange-500 animate-pulse" 
                                    : "text-amber-500"
                              }`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <span className="font-medium text-sm sm:text-base">Trial</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] sm:text-xs ${
                                    trialInfo.isExpired 
                                      ? "bg-destructive/10 text-destructive border-destructive/20" 
                                      : trialInfo.isUrgent 
                                        ? "bg-orange-500/10 text-orange-600 border-orange-500/20 animate-pulse" 
                                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  }`}
                                >
                                  {trialInfo.displayText}
                                </Badge>
                              </div>
                              <p className="text-[10px] sm:text-sm text-muted-foreground truncate">
                                {trialInfo.isExpired ? "Expirou:" : "Expira:"} {formatDateTime(endDate.toISOString())}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 ml-7 sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsExtendTrialDialogOpen(true)}
                        className="flex-1 sm:flex-none border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-xs sm:text-sm h-8 sm:h-9"
                      >
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Estender
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEndTrialDialogOpen(true)}
                        className="flex-1 sm:flex-none border-destructive/30 text-destructive hover:bg-destructive/10 text-xs sm:text-sm h-8 sm:h-9"
                      >
                        <XOctagon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Encerrar
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Activate Trial Section - when not in trial */}
              {!subscription.is_trial && (
                <>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted flex-shrink-0">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="font-medium text-sm sm:text-base">Período de Trial</span>
                        <p className="text-[10px] sm:text-sm text-muted-foreground">
                          Não está em período de trial
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsActivateTrialDialogOpen(true)}
                      className="w-full sm:w-auto border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-xs sm:text-sm h-8 sm:h-9"
                    >
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Ativar Trial
                    </Button>
                  </div>
                </>
              )}

              {(subscription.current_period_end || (subscription.is_trial && subscription.trial_ends_at)) && (
                <>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">
                        Período: {" "}
                        {subscription.current_period_start 
                          ? formatDate(subscription.current_period_start)
                          : "—"} - {subscription.current_period_end
                          ? formatDate(subscription.current_period_end)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddDaysDialogOpen(true)}
                        className="text-xs sm:text-sm h-7 sm:h-9 px-2 sm:px-3 whitespace-nowrap"
                      >
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden xs:inline">+ Dias</span>
                        <span className="xs:hidden">+</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenPeriodDialog}
                        className="text-xs sm:text-sm h-7 sm:h-9 px-2 sm:px-3 whitespace-nowrap"
                      >
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Alterar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsResetDialogOpen(true)}
                        disabled={resetUsageMutation.isPending}
                        className="text-xs sm:text-sm h-7 sm:h-9 px-2 sm:px-3 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden xs:inline">Reiniciar</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Owner Card */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <User className="w-4 h-4 text-primary" />
                  Síndico Responsável
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTransferDialog}
                  className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                >
                  <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Transferir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Nome</p>
                <p className="font-medium text-sm sm:text-base truncate">{owner?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-sm sm:text-base truncate">{owner?.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium text-sm sm:text-base">{owner?.phone ? formatPhone(owner.phone) : "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Dialog */}
          <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  Transferir Condomínio
                </DialogTitle>
                <DialogDescription>
                  Transfira a propriedade do condomínio para outro síndico informando o CPF.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="transfer-cpf">CPF do Novo Síndico</Label>
                  <div className="flex gap-2">
                    <MaskedInput
                      id="transfer-cpf"
                      mask="cpf"
                      value={transferCpf}
                      onChange={setTransferCpf}
                      placeholder="000.000.000-00"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSearchSindico}
                      disabled={isSearchingSindico || !transferCpf}
                      variant="secondary"
                    >
                      {isSearchingSindico ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {foundSindico && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                    <p className="text-sm font-medium text-primary">Síndico encontrado:</p>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Nome:</span>{" "}
                        <span className="font-medium">{foundSindico.full_name}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">{foundSindico.email}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">CPF:</span>{" "}
                        <span className="font-medium font-mono">{formatCPF(foundSindico.cpf)}</span>
                      </p>
                    </div>
                  </div>
                )}

                {foundSindico && (
                  <div className="space-y-2">
                    <Label htmlFor="transfer-notes">Observações (opcional)</Label>
                    <Textarea
                      id="transfer-notes"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="Motivo da transferência, notas adicionais..."
                      rows={3}
                    />
                  </div>
                )}

                {foundSindico && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-600 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      Esta ação irá transferir a propriedade do condomínio{" "}
                      <strong>{condominium.name}</strong> para o síndico selecionado.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTransferDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmTransfer}
                  disabled={!foundSindico || transferCondominiumMutation.isPending}
                >
                  {transferCondominiumMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                  )}
                  Confirmar Transferência
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Usage Stats */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Uso do Período Atual</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Acompanhe o consumo de recursos neste período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <TooltipProvider>
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* Notifications */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      <span className="font-medium text-sm sm:text-base">Notificações</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>Conta ocorrências do tipo "Notificação" com status: notificado, arquivada, advertido ou multado</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium ${getUsageColor(
                        getUsagePercentage(realUsage.notifications, subscription.notifications_limit)
                      )}`}
                    >
                      {realUsage.notifications} / {subscription.notifications_limit}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercentage(realUsage.notifications, subscription.notifications_limit)}
                    className="h-1.5 sm:h-2"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {Math.max(0, subscription.notifications_limit - realUsage.notifications)} restantes
                  </p>
                </div>

                {/* Warnings */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                      <span className="font-medium text-sm sm:text-base">Advertências</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>Conta ocorrências do tipo "Advertência" com status: notificado, arquivada, advertido ou multado</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium ${getUsageColor(
                        getUsagePercentage(realUsage.warnings, subscription.warnings_limit)
                      )}`}
                    >
                      {realUsage.warnings} / {subscription.warnings_limit}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercentage(realUsage.warnings, subscription.warnings_limit)}
                    className="h-1.5 sm:h-2"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {Math.max(0, subscription.warnings_limit - realUsage.warnings)} restantes
                  </p>
                </div>

                {/* Fines */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                      <span className="font-medium text-sm sm:text-base">Multas</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>Conta ocorrências do tipo "Multa" com status: notificado, arquivada, advertido ou multado</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium ${getUsageColor(
                        getUsagePercentage(realUsage.fines, subscription.fines_limit)
                      )}`}
                    >
                      {realUsage.fines} / {subscription.fines_limit}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercentage(realUsage.fines, subscription.fines_limit)}
                    className="h-1.5 sm:h-2"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {Math.max(0, subscription.fines_limit - realUsage.fines)} restantes
                  </p>
                </div>

                {/* Package Notifications */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
                      <span className="font-medium text-sm sm:text-base">Encomendas</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>Notificações de encomendas enviadas via WhatsApp. Acima do limite: R$ 0,10 por envio extra (aplica-se a todos os módulos).</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-medium ${
                        subscription.package_notifications_limit === -1 
                          ? "text-emerald-500" 
                          : getUsageColor(
                              getUsagePercentage(
                                subscription.package_notifications_used || 0, 
                                subscription.package_notifications_limit || 50
                              )
                            )
                      }`}
                    >
                      {subscription.package_notifications_limit === -1 
                        ? `${subscription.package_notifications_used || 0} / ∞`
                        : `${subscription.package_notifications_used || 0} / ${subscription.package_notifications_limit || 50}`
                      }
                    </span>
                  </div>
                  <Progress
                    value={
                      subscription.package_notifications_limit === -1 
                        ? 0 
                        : getUsagePercentage(
                            subscription.package_notifications_used || 0, 
                            subscription.package_notifications_limit || 50
                          )
                    }
                    className="h-1.5 sm:h-2"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {subscription.package_notifications_limit === -1 
                        ? "Ilimitado"
                        : `${Math.max(0, (subscription.package_notifications_limit || 50) - (subscription.package_notifications_used || 0))} restantes`
                      }
                    </p>
                    {(subscription.package_notifications_extra || 0) > 0 && (
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20">
                        +{subscription.package_notifications_extra} extras
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Faturas
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Histórico das últimas faturas
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/superadmin/invoices")}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                Ver Todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {invoices.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-sm">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatCustom(invoice.period_start, "dd/MM/yy")} - {formatCustom(invoice.period_end, "dd/MM/yy")}
                        </span>
                        {getInvoiceStatusBadge(invoice.status, invoice.due_date)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{formatCurrency(invoice.amount)}</span>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Venc: {formatDate(invoice.due_date)}</p>
                          {invoice.paid_at && <p>Pago: {formatDate(invoice.paid_at)}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice: any) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {formatCustom(invoice.period_start, "dd/MM/yy")}
                            {" - "}
                            {formatCustom(invoice.period_end, "dd/MM/yy")}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.due_date)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(invoice.amount)}
                          </TableCell>
                          <TableCell>
                            {getInvoiceStatusBadge(invoice.status, invoice.due_date)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invoice.paid_at 
                              ? formatDate(invoice.paid_at)
                              : "—"
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Subscription History */}
        <SubscriptionHistory 
          subscriptionId={subscription.id} 
          condominiumId={condominium.id} 
        />

        {/* Metadata */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Informações da Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">ID da Assinatura</p>
                <p className="font-mono text-[10px] sm:text-xs truncate">{subscription.id}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Criado em</p>
                <p className="font-medium text-sm sm:text-base">
                  {formatDateTime(subscription.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Última atualização</p>
                <p className="font-medium text-sm sm:text-base">
                  {formatDateTime(subscription.updated_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Edit Dialog */}
      <Dialog open={isPeriodDialogOpen} onOpenChange={setIsPeriodDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Período da Assinatura</DialogTitle>
            <DialogDescription>
              Defina as datas de início e fim do período de faturamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Data de Início</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Data de Fim</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPeriodDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePeriod}
              disabled={updatePeriodMutation.isPending}
            >
              {updatePeriodMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Days Dialog */}
      <Dialog open={isAddDaysDialogOpen} onOpenChange={setIsAddDaysDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Dias Extras</DialogTitle>
            <DialogDescription>
              Adicione dias extras à assinatura sem cobrança adicional. O período será estendido automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extra-days">Quantidade de dias a adicionar</Label>
              <Input
                id="extra-days"
                type="number"
                min="1"
                max="365"
                value={extraDays || ""}
                onChange={(e) => setExtraDays(parseInt(e.target.value) || 0)}
                placeholder="Ex: 7, 15, 30..."
              />
            </div>
            {extraDays > 0 && data?.subscription?.current_period_end && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Novo fim do período:</span>{" "}
                  {formatDate(
                    new Date(new Date(data.subscription.current_period_end).getTime() + extraDays * 24 * 60 * 60 * 1000).toISOString()
                  )}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {[7, 15, 30].map((days) => (
                <Button
                  key={days}
                  variant="outline"
                  size="sm"
                  onClick={() => setExtraDays(days)}
                  className={extraDays === days ? "border-primary" : ""}
                >
                  +{days} dias
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-days-justification">Justificativa</Label>
              <Textarea
                id="extra-days-justification"
                value={extraDaysJustification}
                onChange={(e) => setExtraDaysJustification(e.target.value)}
                placeholder="Informe o motivo para adicionar dias extras (ex: compensação por problema técnico, cortesia comercial...)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDaysDialogOpen(false);
                setExtraDays(0);
                setExtraDaysJustification("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => addExtraDaysMutation.mutate({ days: extraDays, justification: extraDaysJustification })}
              disabled={addExtraDaysMutation.isPending || extraDays < 1 || !extraDaysJustification.trim()}
            >
              {addExtraDaysMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Adicionar {extraDays} dia{extraDays !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Usage Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Reinicialização
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reiniciar os contadores de uso desta assinatura?
              Esta ação irá zerar todos os contadores (notificações, advertências e multas).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsResetDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetUsageMutation.mutate();
                setIsResetDialogOpen(false);
              }}
              disabled={resetUsageMutation.isPending}
            >
              {resetUsageMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Reiniciar Contadores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={isExtendTrialDialogOpen} onOpenChange={setIsExtendTrialDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Estender Período de Trial
            </DialogTitle>
            <DialogDescription>
              Adicione dias extras ao período de trial desta assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trial-days">Quantidade de dias a adicionar</Label>
              <Input
                id="trial-days"
                type="number"
                min="1"
                max="90"
                value={trialExtensionDays || ""}
                onChange={(e) => setTrialExtensionDays(parseInt(e.target.value) || 0)}
                placeholder="Ex: 7, 14, 30..."
              />
            </div>
            
            {trialExtensionDays > 0 && data?.subscription?.trial_ends_at && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <span className="font-medium">Nova data de expiração:</span>{" "}
                  {formatDateTime(
                    new Date(new Date(data.subscription.trial_ends_at).getTime() + trialExtensionDays * 24 * 60 * 60 * 1000).toISOString()
                  )}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => (
                <Button
                  key={days}
                  variant="outline"
                  size="sm"
                  onClick={() => setTrialExtensionDays(days)}
                  className={trialExtensionDays === days ? "border-amber-500 bg-amber-500/10" : ""}
                >
                  +{days} dias
                </Button>
              ))}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="trial-justification">Justificativa</Label>
              <Textarea
                id="trial-justification"
                value={trialExtensionJustification}
                onChange={(e) => setTrialExtensionJustification(e.target.value)}
                placeholder="Informe o motivo para estender o trial (ex: cliente em avaliação, problema técnico, cortesia comercial...)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExtendTrialDialogOpen(false);
                setTrialExtensionDays(7);
                setTrialExtensionJustification("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => extendTrialMutation.mutate({ days: trialExtensionDays, justification: trialExtensionJustification })}
              disabled={extendTrialMutation.isPending || trialExtensionDays < 1 || !trialExtensionJustification.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {extendTrialMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Estender {trialExtensionDays} dia{trialExtensionDays !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Trial Dialog */}
      <Dialog open={isActivateTrialDialogOpen} onOpenChange={setIsActivateTrialDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Ativar Período de Trial
            </DialogTitle>
            <DialogDescription>
              Ative um novo período de trial para esta assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trial-activation-days">Duração do trial (dias)</Label>
              <Input
                id="trial-activation-days"
                type="number"
                min="1"
                max="90"
                value={trialActivationDays || ""}
                onChange={(e) => setTrialActivationDays(parseInt(e.target.value) || 0)}
                placeholder="Ex: 7, 14, 30..."
              />
            </div>
            
            {trialActivationDays > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <span className="font-medium">Trial expira em:</span>{" "}
                  {formatDateTime(
                    new Date(Date.now() + trialActivationDays * 24 * 60 * 60 * 1000).toISOString()
                  )}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => (
                <Button
                  key={days}
                  variant="outline"
                  size="sm"
                  onClick={() => setTrialActivationDays(days)}
                  className={trialActivationDays === days ? "border-amber-500 bg-amber-500/10" : ""}
                >
                  {days} dias
                </Button>
              ))}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="trial-activation-justification">Justificativa</Label>
              <Textarea
                id="trial-activation-justification"
                value={trialActivationJustification}
                onChange={(e) => setTrialActivationJustification(e.target.value)}
                placeholder="Informe o motivo para ativar o trial (ex: cliente em renegociação, nova avaliação, cortesia comercial...)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsActivateTrialDialogOpen(false);
                setTrialActivationDays(14);
                setTrialActivationJustification("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => activateTrialMutation.mutate({ days: trialActivationDays, justification: trialActivationJustification })}
              disabled={activateTrialMutation.isPending || trialActivationDays < 1 || !trialActivationJustification.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {activateTrialMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Ativar Trial de {trialActivationDays} dia{trialActivationDays !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Trial Dialog */}
      <Dialog open={isEndTrialDialogOpen} onOpenChange={(open) => {
        setIsEndTrialDialogOpen(open);
        if (!open) {
          setEndTrialDiscount(0);
          setEndTrialDiscountType("percentage");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XOctagon className="w-5 h-5 text-destructive" />
              Encerrar Período de Trial
            </DialogTitle>
            <DialogDescription>
              Esta ação irá encerrar o trial e iniciar a cobrança regular.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-2">
                O que acontecerá:
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                <li>O período de trial será encerrado imediatamente</li>
                <li>Será gerada uma fatura com vencimento em 3 dias úteis</li>
                <li>O período regular de 30 dias será iniciado</li>
              </ul>
            </div>
            
            {/* Discount Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Desconto na primeira fatura (opcional)</Label>
              <div className="flex gap-2">
                <Select
                  value={endTrialDiscountType}
                  onValueChange={(value: "percentage" | "fixed") => setEndTrialDiscountType(value)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  max={endTrialDiscountType === "percentage" ? 100 : undefined}
                  value={endTrialDiscount}
                  onChange={(e) => setEndTrialDiscount(Number(e.target.value))}
                  placeholder={endTrialDiscountType === "percentage" ? "0%" : "R$ 0,00"}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEndTrialDiscountType("percentage"); setEndTrialDiscount(10); }}
                  className={endTrialDiscountType === "percentage" && endTrialDiscount === 10 ? "border-primary" : ""}
                >
                  10%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEndTrialDiscountType("percentage"); setEndTrialDiscount(20); }}
                  className={endTrialDiscountType === "percentage" && endTrialDiscount === 20 ? "border-primary" : ""}
                >
                  20%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEndTrialDiscountType("percentage"); setEndTrialDiscount(50); }}
                  className={endTrialDiscountType === "percentage" && endTrialDiscount === 50 ? "border-primary" : ""}
                >
                  50%
                </Button>
              </div>
            </div>

            {data?.subscription && (() => {
              const currentPlan = plans?.find(p => p.slug === data.subscription.plan);
              const planPrice = currentPlan?.price || 0;
              let finalAmount = planPrice;
              if (endTrialDiscount > 0) {
                if (endTrialDiscountType === "percentage") {
                  finalAmount = planPrice - (planPrice * endTrialDiscount / 100);
                } else {
                  finalAmount = planPrice - endTrialDiscount;
                }
                finalAmount = Math.max(0, finalAmount);
              }
              
              return (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plano atual:</span>
                    <span className="font-medium">{PLAN_INFO[data.subscription.plan as PlanType]?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor original:</span>
                    <span className="font-medium">R$ {planPrice.toFixed(2)}</span>
                  </div>
                  {endTrialDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Desconto:</span>
                      <span className="font-medium">
                        -{endTrialDiscountType === "percentage" ? `${endTrialDiscount}%` : `R$ ${endTrialDiscount.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Valor final da fatura:</span>
                    <span className={endTrialDiscount > 0 ? "text-green-600 dark:text-green-400" : ""}>
                      R$ {finalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento da fatura:</span>
                    <span className="font-medium">
                      {formatDate(addBusinessDays(new Date(), 3).toISOString())}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Esta ação não pode ser desfeita. O síndico será responsável pelo pagamento da fatura gerada.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEndTrialDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => endTrialMutation.mutate({ discount: endTrialDiscount, discountType: endTrialDiscountType })}
              disabled={endTrialMutation.isPending}
            >
              {endTrialMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XOctagon className="w-4 h-4 mr-2" />
              )}
              Confirmar Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
