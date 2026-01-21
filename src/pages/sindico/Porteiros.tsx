import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmailValidation } from "@/hooks/useEmailValidation";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { ValidatedInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DoorOpen, Plus, Trash2, Building2, Mail, Phone, Search, UserPlus, MessageCircle, Copy, Check, Key, AlertCircle, UserX, RefreshCw, Loader2, Pencil, ArrowLeft, ShieldCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Condominium {
  id: string;
  name: string;
}

interface Porter {
  id: string;
  user_id: string;
  condominium_id: string;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  condominium: {
    name: string;
  } | null;
}

export default function Porteiros() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [porters, setPorters] = useState<Porter[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // New porter form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogStep, setDialogStep] = useState<"form" | "confirm">("form");
  const [newPorter, setNewPorter] = useState({
    full_name: "",
    email: "",
    phone: "",
    condominium_id: "",
  });
  
  // Success dialog state (shows password if WhatsApp failed)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    full_name: string;
    email: string;
    password?: string;
    whatsapp_sent: boolean;
    is_new_user: boolean;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Edit porter state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingPorter, setEditingPorter] = useState<Porter | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [orphanDialogOpen, setOrphanDialogOpen] = useState(false);
  const [orphanUsers, setOrphanUsers] = useState<Array<{
    id: string;
    email: string | null;
    created_at: string;
    has_profile: boolean;
    has_role: boolean;
    has_condominium: boolean;
  }>>([]);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [isDeletingOrphans, setIsDeletingOrphans] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  
  // Resend credentials state
  const [resendingCredentials, setResendingCredentials] = useState<string | null>(null);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendResult, setResendResult] = useState<{
    success: boolean;
    password?: string;
    message: string;
  } | null>(null);

  // Use email validation hook with porter-specific options
  const { 
    emailStatus, 
    validateEmail, 
    resetStatus: resetEmailStatus,
    setEmailStatus 
  } = useEmailValidation({
    conflictRoles: ["sindico", "super_admin"],
    condominiumId: newPorter.condominium_id,
  });

  // Use phone validation hook
  const {
    phoneStatus,
    validatePhone,
    resetStatus: resetPhoneStatus
  } = usePhoneValidation();

  // Handle email change with validation
  const handleEmailChange = useCallback((value: string) => {
    setNewPorter(prev => ({ ...prev, email: value }));
    validateEmail(value);
  }, [validateEmail]);

  // Handle phone change with validation
  const handlePhoneChange = useCallback((value: string) => {
    setNewPorter(prev => ({ ...prev, phone: value }));
    validatePhone(value);
  }, [validatePhone]);

  // Re-check email when condominium changes
  useEffect(() => {
    if (newPorter.email.trim().length >= 5 && newPorter.condominium_id) {
      validateEmail(newPorter.email);
    }
  }, [newPorter.condominium_id, validateEmail]);

  // Reset status when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      resetEmailStatus();
      resetPhoneStatus();
    }
  }, [isDialogOpen, resetEmailStatus, resetPhoneStatus]);

  // Fetch síndico's condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");

      if (error) {
        console.error("Error fetching condominiums:", error);
        return;
      }

      setCondominiums(data || []);
    };

    fetchCondominiums();
  }, [user]);

  // Fetch porters
  useEffect(() => {
    const fetchPorters = async () => {
      if (!user || condominiums.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const condoIds = condominiums.map((c) => c.id);

      // First, get all users with 'porteiro' role
      const { data: porterRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "porteiro");

      const porterUserIds = porterRoles?.map((r) => r.user_id) || [];

      if (porterUserIds.length === 0) {
        setPorters([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_condominiums")
        .select(`
          id,
          user_id,
          condominium_id,
          created_at,
          condominium:condominiums(name)
        `)
        .in("condominium_id", condoIds)
        .in("user_id", porterUserIds);

      if (error) {
        console.error("Error fetching porters:", error);
        setLoading(false);
        return;
      }

      // Fetch profiles for each user
      const userIds = data?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const portersWithProfiles = (data || []).map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        condominium: p.condominium as { name: string } | null,
      }));

      setPorters(portersWithProfiles);
      setLoading(false);
    };

    fetchPorters();
  }, [user, condominiums]);

  const filteredPorters = porters.filter((porter) => {
    const matchesCondominium =
      selectedCondominium === "all" || porter.condominium_id === selectedCondominium;
    const matchesSearch =
      !searchTerm ||
      porter.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      porter.profile?.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCondominium && matchesSearch;
  });

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const handleGoToConfirmStep = async () => {
    if (!newPorter.full_name || !newPorter.email || !newPorter.condominium_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, e-mail e condomínio",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingEmail(true);
    try {
      const emailLower = newPorter.email.toLowerCase().trim();
      
      // Check if email already exists
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("email", emailLower)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking email:", profileError);
        throw profileError;
      }

      if (existingProfile) {
        // Check if user is sindico or super_admin
        const { data: existingRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", existingProfile.user_id);

        const roles = (existingRoles || []).map((r) => r.role);

        if (roles.includes("sindico") || roles.includes("super_admin")) {
          toast({
            title: "E-mail não permitido",
            description: "Este e-mail pertence a um síndico ou administrador e não pode ser cadastrado como porteiro",
            variant: "destructive",
          });
          return;
        }

        // Check if already linked to this condominium
        const { data: existingLink } = await supabase
          .from("user_condominiums")
          .select("id")
          .eq("user_id", existingProfile.user_id)
          .eq("condominium_id", newPorter.condominium_id)
          .maybeSingle();

        if (existingLink) {
          toast({
            title: "E-mail já cadastrado",
            description: "Este e-mail já está vinculado a um porteiro neste condomínio",
            variant: "destructive",
          });
          return;
        }
      }

      setDialogStep("confirm");
    } catch (error: any) {
      console.error("Error validating email:", error);
      toast({
        title: "Erro ao validar e-mail",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleAddPorter = async () => {
    setIsSubmitting(true);

    try {
      // Call edge function to create porter
      const { data, error } = await supabase.functions.invoke("create-porteiro", {
        body: {
          full_name: newPorter.full_name,
          email: newPorter.email,
          phone: newPorter.phone || null,
          condominium_id: newPorter.condominium_id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Show success feedback
      if (data.is_new_user && !data.whatsapp_sent && data.password) {
        // WhatsApp failed, show password dialog
        setSuccessData({
          full_name: newPorter.full_name,
          email: newPorter.email,
          password: data.password,
          whatsapp_sent: false,
          is_new_user: true,
        });
        setSuccessDialogOpen(true);
      } else if (data.is_new_user && data.whatsapp_sent) {
        // WhatsApp sent successfully
        toast({
          title: "Porteiro cadastrado! ✅",
          description: (
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span>Credenciais enviadas via WhatsApp</span>
            </div>
          ),
        });
      } else {
        // Existing user linked
        toast({
          title: "Porteiro vinculado!",
          description: "O usuário já existente foi vinculado ao condomínio",
        });
      }

      // Reset form and close dialog
      setNewPorter({ full_name: "", email: "", phone: "", condominium_id: "" });
      setDialogStep("form");
      setIsDialogOpen(false);

      // Refetch porters
      const condoIds = condominiums.map((c) => c.id);
      const { data: portersData } = await supabase
        .from("user_condominiums")
        .select(`
          id,
          user_id,
          condominium_id,
          created_at,
          condominium:condominiums(name)
        `)
        .in("condominium_id", condoIds);

      const userIds = portersData?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const portersWithProfiles = (portersData || []).map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        condominium: p.condominium as { name: string } | null,
      }));

      setPorters(portersWithProfiles);
    } catch (error: any) {
      console.error("Error adding porter:", error);
      toast({
        title: "Erro ao adicionar porteiro",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (successData?.password) {
      await navigator.clipboard.writeText(successData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleOpenEditDialog = (porter: Porter) => {
    setEditingPorter(porter);
    setEditForm({
      full_name: porter.profile?.full_name || "",
      email: porter.profile?.email || "",
      phone: porter.profile?.phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdatePorter = async () => {
    if (!editingPorter || !editForm.full_name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do porteiro",
        variant: "destructive",
      });
      return;
    }

    if (!editForm.email.trim() || !editForm.email.includes("@")) {
      toast({
        title: "E-mail inválido",
        description: "Informe um e-mail válido",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Use edge function to update porter (needed for email change in Auth)
      const { data, error } = await supabase.functions.invoke("update-porteiro", {
        body: {
          porter_user_id: editingPorter.user_id,
          full_name: editForm.full_name.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim() || null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update local state
      setPorters((prev) =>
        prev.map((p) =>
          p.id === editingPorter.id
            ? {
                ...p,
                profile: p.profile
                  ? {
                      ...p.profile,
                      full_name: editForm.full_name.trim(),
                      email: editForm.email.trim().toLowerCase(),
                      phone: editForm.phone.trim() || null,
                    }
                  : null,
              }
            : p
        )
      );

      toast({
        title: "Porteiro atualizado",
        description: "Os dados foram salvos com sucesso",
      });

      setIsEditDialogOpen(false);
      setEditingPorter(null);
    } catch (error: any) {
      console.error("Error updating porter:", error);
      toast({
        title: "Erro ao atualizar porteiro",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLoadOrphanUsers = async () => {
    setIsLoadingOrphans(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-users", {
        body: { action: "list" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOrphanUsers(data.orphan_users || []);
      setSelectedOrphans(new Set());
      setOrphanDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading orphan users:", error);
      toast({
        title: "Erro ao carregar usuários órfãos",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOrphans(false);
    }
  };

  const handleDeleteOrphans = async () => {
    if (selectedOrphans.size === 0) {
      toast({
        title: "Nenhum usuário selecionado",
        description: "Selecione pelo menos um usuário para remover",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingOrphans(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-users", {
        body: { 
          action: "delete",
          user_ids: Array.from(selectedOrphans),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const deletedCount = data.deleted?.length || 0;
      const errorCount = data.errors?.length || 0;

      // Remove deleted users from the list
      setOrphanUsers(prev => prev.filter(u => !data.deleted?.includes(u.id)));
      setSelectedOrphans(new Set());

      toast({
        title: "Limpeza concluída",
        description: `${deletedCount} usuário(s) removido(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ""}`,
      });

      if (orphanUsers.length - deletedCount === 0) {
        setOrphanDialogOpen(false);
      }
    } catch (error: any) {
      console.error("Error deleting orphan users:", error);
      toast({
        title: "Erro ao remover usuários órfãos",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsDeletingOrphans(false);
    }
  };

  const toggleOrphanSelection = (userId: string) => {
    setSelectedOrphans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleAllOrphans = () => {
    if (selectedOrphans.size === orphanUsers.length) {
      setSelectedOrphans(new Set());
    } else {
      setSelectedOrphans(new Set(orphanUsers.map(u => u.id)));
    }
  };

  const handleRemovePorter = async (porterId: string, porterUserId: string, porterName: string) => {
    try {
      // Call edge function to completely delete the porter
      const { data, error } = await supabase.functions.invoke("delete-porteiro", {
        body: {
          user_condominium_id: porterId,
          porter_user_id: porterUserId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setPorters((prev) => prev.filter((p) => p.id !== porterId));

      toast({
        title: data?.user_deleted ? "Porteiro excluído" : "Porteiro removido",
        description: data?.user_deleted 
          ? `${porterName} foi excluído completamente do sistema`
          : `${porterName} foi removido do condomínio`,
      });
    } catch (error: any) {
      console.error("Error removing porter:", error);
      toast({
        title: "Erro ao remover porteiro",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const handleResendCredentials = async (porter: Porter) => {
    if (!porter.profile?.phone) {
      toast({
        title: "Telefone não cadastrado",
        description: "O porteiro não possui telefone. Edite o cadastro para adicionar um telefone.",
        variant: "destructive",
      });
      return;
    }

    setResendingCredentials(porter.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-porter-credentials", {
        body: {
          porter_user_id: porter.user_id,
          condominium_id: porter.condominium_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.whatsapp_sent) {
        toast({
          title: "Credenciais enviadas!",
          description: "As novas credenciais foram enviadas por WhatsApp",
        });
      } else {
        // WhatsApp failed, show password dialog
        setResendResult({
          success: true,
          password: data?.password,
          message: data?.message || "Senha resetada. Anote a nova senha.",
        });
        setResendDialogOpen(true);
      }
    } catch (error: any) {
      console.error("Error resending credentials:", error);
      toast({
        title: "Erro ao reenviar credenciais",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setResendingCredentials(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <DoorOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Gestão de Porteiros
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie os porteiros dos seus condomínios
            </p>
          </div>

          <div className="flex flex-col xs:flex-row gap-2">
            <Button 
              variant="outline" 
              className="gap-2 h-9 sm:h-10 text-xs sm:text-sm" 
              onClick={handleLoadOrphanUsers}
              disabled={isLoadingOrphans}
            >
              {isLoadingOrphans ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserX className="w-4 h-4" />
              )}
              <span className="hidden xs:inline">Limpar Órfãos</span>
              <span className="xs:hidden">Órfãos</span>
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setDialogStep("form");
                setNewPorter({ full_name: "", email: "", phone: "", condominium_id: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 h-9 sm:h-10 text-xs sm:text-sm">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden xs:inline">Adicionar Porteiro</span>
                  <span className="xs:hidden">Adicionar</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
                {dialogStep === "form" ? (
                  <>
                    <DialogHeader className="space-y-1 sm:space-y-2">
                      <DialogTitle className="text-base sm:text-lg">Adicionar Novo Porteiro</DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm">
                        O porteiro receberá um e-mail para acessar o sistema
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="condominium" className="text-xs sm:text-sm">Condomínio *</Label>
                        <Select
                          value={newPorter.condominium_id}
                          onValueChange={(value) =>
                            setNewPorter((prev) => ({ ...prev, condominium_id: value }))
                          }
                        >
                          <SelectTrigger className="h-9 sm:h-10 text-sm">
                            <SelectValue placeholder="Selecione o condomínio" />
                          </SelectTrigger>
                          <SelectContent>
                            {condominiums.map((condo) => (
                              <SelectItem key={condo.id} value={condo.id}>
                                {condo.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="full_name" className="text-xs sm:text-sm">Nome Completo *</Label>
                        <Input
                          id="full_name"
                          placeholder="Nome do porteiro"
                          value={newPorter.full_name}
                          onChange={(e) =>
                            setNewPorter((prev) => ({ ...prev, full_name: e.target.value }))
                          }
                          className="h-9 sm:h-10 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="email" className="text-xs sm:text-sm">E-mail *</Label>
                        <ValidatedInput
                          id="email"
                          type="email"
                          placeholder="porteiro@email.com"
                          value={newPorter.email}
                          onChange={handleEmailChange}
                          status={emailStatus}
                          messages={{
                            available: "E-mail disponível para cadastro.",
                            taken: "Este e-mail já está vinculado a um porteiro neste condomínio.",
                            conflict: "Este e-mail pertence a um síndico ou administrador.",
                            invalid: "Formato de e-mail inválido.",
                          }}
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="phone" className="text-xs sm:text-sm">Telefone</Label>
                        <ValidatedInput
                          id="phone"
                          mask="phone"
                          value={newPorter.phone}
                          onChange={handlePhoneChange}
                          status={phoneStatus}
                          messages={{
                            valid: "",
                            invalid: "Telefone inválido. Use DDD + número.",
                            incomplete: "Digite o telefone completo com DDD.",
                          }}
                          showSuccessMessage={false}
                        />
                      </div>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleGoToConfirmStep} disabled={isCheckingEmail || emailStatus === "taken" || emailStatus === "conflict" || emailStatus === "invalid" || emailStatus === "checking"} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
                        {isCheckingEmail ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Validando...
                          </>
                        ) : (
                          "Continuar"
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader className="space-y-1 sm:space-y-2">
                      <DialogTitle className="text-base sm:text-lg">Confirmar Cadastro</DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm">
                        Revise os dados antes de confirmar
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-3 sm:py-4 space-y-3 sm:space-y-4">
                      <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-primary/10 p-1.5 sm:p-2 rounded-full">
                            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Tipo de Acesso</p>
                            <p className="text-sm sm:text-base font-semibold text-primary">Porteiro</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-secondary p-1.5 sm:p-2 rounded-full">
                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Condomínio Vinculado</p>
                            <p className="text-sm sm:text-base font-medium truncate">
                              {condominiums.find(c => c.id === newPorter.condominium_id)?.name || "-"}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid gap-1.5 sm:gap-2">
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Nome</p>
                            <p className="text-sm sm:text-base font-medium">{newPorter.full_name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">E-mail</p>
                            <p className="text-sm sm:text-base font-medium break-all">{newPorter.email}</p>
                          </div>
                          {newPorter.phone && (
                            <div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Telefone</p>
                              <p className="text-sm sm:text-base font-medium">{newPorter.phone}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Alert className="py-2 sm:py-3">
                        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <AlertTitle className="text-xs sm:text-sm">Notificação</AlertTitle>
                        <AlertDescription className="text-[10px] sm:text-xs">
                          {newPorter.phone
                            ? "As credenciais de acesso serão enviadas via WhatsApp."
                            : "As credenciais serão exibidas após o cadastro para você informar manualmente."}
                        </AlertDescription>
                      </Alert>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDialogStep("form")}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto h-9 sm:h-10 text-sm gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                      </Button>
                      <Button onClick={handleAddPorter} disabled={isSubmitting} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
                        {isSubmitting ? "Cadastrando..." : "Confirmar"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-full sm:w-[250px] h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Filtrar por condomínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os condomínios</SelectItem>
                  {condominiums.map((condo) => (
                    <SelectItem key={condo.id} value={condo.id}>
                      {condo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Porters List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Porteiros Cadastrados</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {filteredPorters.length} porteiro(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPorters.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <DoorOpen className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium mb-2">Nenhum porteiro encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {porters.length === 0
                    ? "Adicione porteiros para gerenciar as encomendas"
                    : "Tente ajustar os filtros de busca"}
                </p>
                {porters.length === 0 && (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2 h-9 sm:h-10 text-sm">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeiro Porteiro
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {filteredPorters.map((porter) => (
                    <div key={porter.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {porter.profile?.full_name || "Nome não informado"}
                          </p>
                          <Badge variant="secondary" className="gap-1 mt-1 text-[10px]">
                            <Building2 className="w-2.5 h-2.5" />
                            {porter.condominium?.name || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleResendCredentials(porter)}
                                  disabled={resendingCredentials === porter.id}
                                >
                                  {resendingCredentials === porter.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reenviar credenciais</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEditDialog(porter)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm p-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base">Remover porteiro?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">
                                  O porteiro perderá acesso ao sistema. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto h-9 text-sm mt-0">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemovePorter(porter.id, porter.user_id, porter.profile?.full_name || "Porteiro")}
                                  className="w-full sm:w-auto h-9 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{porter.profile?.email || "-"}</span>
                        </div>
                        {porter.profile?.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span>{porter.profile.phone}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground pt-1">
                          Cadastrado em {format(new Date(porter.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Condomínio</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPorters.map((porter) => (
                        <TableRow key={porter.id}>
                          <TableCell>
                            <div className="font-medium">
                              {porter.profile?.full_name || "Nome não informado"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                {porter.profile?.email || "-"}
                              </div>
                              {porter.profile?.phone && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Phone className="w-3.5 h-3.5" />
                                  {porter.profile.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="gap-1">
                              <Building2 className="w-3 h-3" />
                              {porter.condominium?.name || "N/A"}
                            </Badge>
                          </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(porter.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleResendCredentials(porter)}
                                    disabled={resendingCredentials === porter.id || !porter.profile?.phone}
                                  >
                                    {resendingCredentials === porter.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {porter.profile?.phone 
                                    ? "Reenviar credenciais por WhatsApp" 
                                    : "Adicione um telefone para enviar credenciais"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleOpenEditDialog(porter)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover porteiro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {porter.profile?.full_name} será removido do condomínio{" "}
                                    {porter.condominium?.name}. Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleRemovePorter(
                                        porter.id,
                                        porter.user_id,
                                        porter.profile?.full_name || "Porteiro"
                                      )
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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
      </div>

      {/* Resend Credentials Result Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Key className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Novas Credenciais
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {resendResult?.message}
            </DialogDescription>
          </DialogHeader>

          {resendResult?.password && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
              <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 py-2 sm:py-3">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
                <AlertTitle className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">Atenção</AlertTitle>
                <AlertDescription className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300">
                  Não foi possível enviar as credenciais via WhatsApp. Anote a senha abaixo!
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Nova Senha</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-base sm:text-lg font-mono font-bold text-primary bg-primary/10 px-2 sm:px-3 py-1 rounded">
                      {resendResult.password}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(resendResult.password!);
                        toast({
                          title: "Copiado!",
                          description: "Senha copiada para a área de transferência",
                        });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResendDialogOpen(false)} className="w-full sm:w-auto h-9 sm:h-10 text-sm">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Password */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Key className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Porteiro Cadastrado
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              O WhatsApp não foi enviado. Anote as credenciais abaixo para informar ao porteiro.
            </DialogDescription>
          </DialogHeader>

          {successData && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
              <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 py-2 sm:py-3">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
                <AlertTitle className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">Atenção</AlertTitle>
                <AlertDescription className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300">
                  {successData.password 
                    ? "Não foi possível enviar as credenciais via WhatsApp. Anote a senha abaixo!"
                    : "O porteiro foi vinculado ao condomínio."}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-muted">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-[10px] sm:text-xs">E-mail</p>
                    <p className="font-medium text-sm sm:text-base truncate">{successData.email}</p>
                  </div>
                </div>

                {successData.password && (
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                      <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-muted-foreground text-[10px] sm:text-xs">Senha</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-base sm:text-lg font-mono font-bold text-primary bg-primary/10 px-2 sm:px-3 py-1 rounded">
                          {successData.password}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyPassword}
                          className="gap-1 h-7 sm:h-8 text-xs"
                        >
                          {passwordCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span className="hidden xs:inline">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="hidden xs:inline">Copiar</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={() => {
                setSuccessDialogOpen(false);
                setSuccessData(null);
                setPasswordCopied(false);
              }}
              className="w-full sm:w-auto h-9 sm:h-10 text-sm"
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orphan Users Cleanup Dialog */}
      <Dialog open={orphanDialogOpen} onOpenChange={setOrphanDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              Usuários Órfãos
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Usuários que existem na autenticação mas não possuem perfil ou papel definido no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 sm:py-4">
            {orphanUsers.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Check className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-green-500 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium mb-2">Nenhum usuário órfão encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  O sistema está limpo!
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {orphanUsers.length} usuário(s) órfão(s)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllOrphans}
                    className="h-7 sm:h-8 text-xs sm:text-sm"
                  >
                    {selectedOrphans.size === orphanUsers.length ? "Desmarcar" : "Selecionar"} todos
                  </Button>
                </div>

                <div className="border rounded-lg divide-y">
                  {orphanUsers.map((orphan) => (
                    <div
                      key={orphan.id}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedOrphans.has(orphan.id) ? "bg-muted" : ""
                      }`}
                      onClick={() => toggleOrphanSelection(orphan.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrphans.has(orphan.id)}
                        onChange={() => toggleOrphanSelection(orphan.id)}
                        className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-xs sm:text-sm truncate">
                            {orphan.email || "E-mail não definido"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                          <span className="hidden xs:inline">ID: {orphan.id.slice(0, 8)}...</span>
                          <span>{format(new Date(orphan.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0">
                        {!orphan.has_profile && (
                          <Badge variant="secondary" className="text-[9px] sm:text-xs px-1 sm:px-2">Sem perfil</Badge>
                        )}
                        {!orphan.has_role && (
                          <Badge variant="secondary" className="text-[9px] sm:text-xs px-1 sm:px-2">Sem papel</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => handleLoadOrphanUsers()}
              disabled={isLoadingOrphans || isDeletingOrphans}
              className="w-full sm:w-auto h-9 sm:h-10 text-sm"
            >
              {isLoadingOrphans ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Atualizar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrphans}
              disabled={selectedOrphans.size === 0 || isDeletingOrphans}
              className="w-full sm:w-auto h-9 sm:h-10 text-sm"
            >
              {isDeletingOrphans ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover ({selectedOrphans.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Porter Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Editar Porteiro
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Atualize os dados do porteiro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit_full_name" className="text-xs sm:text-sm">Nome completo *</Label>
              <Input
                id="edit_full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nome do porteiro"
                className="h-9 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit_phone" className="text-xs sm:text-sm">Telefone</Label>
              <MaskedInput
                id="edit_phone"
                mask="phone"
                value={editForm.phone}
                onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value }))}
                className="h-9 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit_email" className="text-xs sm:text-sm">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="h-9 sm:h-10 text-sm pl-9 sm:pl-10"
                />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                O e-mail é usado para login no sistema
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
              Cancelar
            </Button>
            <Button onClick={handleUpdatePorter} disabled={isUpdating} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
