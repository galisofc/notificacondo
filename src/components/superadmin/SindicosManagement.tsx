import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEmailValidation } from "@/hooks/useEmailValidation";
import { useCpfValidation } from "@/hooks/useCpfValidation";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput, formatPhone, formatCPF } from "@/components/ui/masked-input";
import { isValidCPF, cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Mail, Building2, Plus, Loader2, Eye, EyeOff, User, Phone, Calendar, CreditCard, CheckCircle, XCircle, Pencil, Save, X, Trash2, AlertTriangle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";

interface SindicoWithProfile {
  id: string;
  user_id: string;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
    cpf: string | null;
  } | null;
  condominiums: {
    id: string;
    name: string;
    subscription: {
      id: string;
      plan: string;
      active: boolean;
    } | null;
  }[];
  condominiums_count: number;
}

export function SindicosManagement() {
  const { date: formatDate } = useDateFormatter();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSindico, setSelectedSindico] = useState<SindicoWithProfile | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sindicoToDelete, setSindicoToDelete] = useState<SindicoWithProfile | null>(null);
  const [deletePreviewData, setDeletePreviewData] = useState<{
    condominiums: number;
    blocks: number;
    apartments: number;
    residents: number;
    occurrences: number;
    isLoading: boolean;
  } | null>(null);
  const [editProfileData, setEditProfileData] = useState({
    full_name: "",
    phone: "",
    cpf: "",
  });
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    cpf: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  // Use email validation hook
  const { 
    emailStatus, 
    validateEmail, 
    resetStatus: resetEmailStatus 
  } = useEmailValidation();

  // Use CPF validation hook
  const {
    cpfStatus,
    validateCpf,
    resetStatus: resetCpfStatus
  } = useCpfValidation();

  // Use phone validation hook
  const {
    phoneStatus,
    validatePhone,
    resetStatus: resetPhoneStatus
  } = usePhoneValidation();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Handle email change with validation
  const handleEmailChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, email: value }));
    validateEmail(value);
  }, [validateEmail]);

  // Handle CPF change with validation
  const handleCpfChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, cpf: value }));
    validateCpf(value);
  }, [validateCpf]);

  // Handle phone change with validation
  const handlePhoneChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, phone: value }));
    validatePhone(value);
  }, [validatePhone]);

  // Resetar status quando o dialog fecha
  useEffect(() => {
    if (!isCreateDialogOpen) {
      resetCpfStatus();
      resetEmailStatus();
      resetPhoneStatus();
    }
  }, [isCreateDialogOpen, resetEmailStatus, resetCpfStatus, resetPhoneStatus]);


  const { data: sindicos, isLoading } = useQuery({
    queryKey: ["superadmin-sindicos"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, created_at")
        .eq("role", "sindico");

      if (rolesError) throw rolesError;

      const sindicosWithDetails = await Promise.all(
        (roles || []).map(async (role) => {
          // Get profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, phone, cpf")
            .eq("user_id", role.user_id)
            .single();

          // Get condominiums with their subscriptions
          const { data: condos } = await supabase
            .from("condominiums")
            .select("id, name")
            .eq("owner_id", role.user_id);

          const condominiumsWithSubs = await Promise.all(
            (condos || []).map(async (condo) => {
              const { data: subscription } = await supabase
                .from("subscriptions")
                .select("id, plan, active")
                .eq("condominium_id", condo.id)
                .single();
              return { ...condo, subscription };
            })
          );

          return {
            ...role,
            profile,
            condominiums: condominiumsWithSubs,
            condominiums_count: condominiumsWithSubs.length,
          } as SindicoWithProfile;
        })
      );

      return sindicosWithDetails;
    },
  });

  const createSindicoMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke("create-sindico", {
        body: data,
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao criar síndico");

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setIsCreateDialogOpen(false);
      setFormData({ full_name: "", email: "", password: "", phone: "", cpf: "" });
      toast({
        title: "Síndico criado!",
        description: "O novo síndico foi cadastrado com sucesso.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Tente novamente.";
      const isCpfError = errorMessage.toLowerCase().includes("cpf");
      const isEmailError = errorMessage.toLowerCase().includes("email") || errorMessage.toLowerCase().includes("already been registered");
      
      let title = "Erro ao criar síndico";
      let description = errorMessage;
      
      if (isCpfError) {
        title = "CPF já cadastrado";
        description = "Este CPF já está associado a outro usuário no sistema. Verifique se o síndico já possui cadastro ou utilize um CPF diferente.";
      } else if (isEmailError) {
        title = "E-mail já cadastrado";
        description = "Este e-mail já está associado a uma conta no sistema. Verifique se o usuário já possui cadastro.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ condominiumId, active }: { condominiumId: string; active: boolean }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ active })
        .eq("condominium_id", condominiumId);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      toast({
        title: active ? "Assinatura ativada" : "Assinatura desativada",
        description: `A assinatura do condomínio foi ${active ? "ativada" : "desativada"} com sucesso.`,
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { full_name: string; phone: string; cpf: string } }) => {
      const cleanCpf = data.cpf.replace(/\D/g, "");
      
      // Check if CPF is being changed and if it already exists
      if (cleanCpf) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, user_id")
          .eq("cpf", cleanCpf)
          .maybeSingle();
        
        if (existingProfile && existingProfile.user_id !== userId) {
          throw new Error("CPF já cadastrado para outro usuário.");
        }
      }
      
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          cpf: cleanCpf || null,
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      setIsEditingProfile(false);
      toast({
        title: "Perfil atualizado",
        description: "As informações do síndico foram atualizadas com sucesso.",
      });
      // Update selected sindico locally
      if (selectedSindico) {
        setSelectedSindico({
          ...selectedSindico,
          profile: {
            ...selectedSindico.profile!,
            full_name: editProfileData.full_name,
            phone: editProfileData.phone,
            cpf: editProfileData.cpf.replace(/\D/g, ""),
          },
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteSindicoMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: result, error } = await supabase.functions.invoke("delete-sindico", {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao excluir síndico");

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setIsDeleteDialogOpen(false);
      setIsViewDialogOpen(false);
      setSindicoToDelete(null);
      toast({
        title: "Síndico excluído",
        description: "O síndico foi removido do sistema com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const filteredSindicos = sindicos?.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, ""); // Remove non-digits for CPF/phone search
    
    // Search by name or email (text search)
    const matchesText = 
      s.profile?.full_name?.toLowerCase().includes(query) ||
      s.profile?.email?.toLowerCase().includes(query);
    
    // Search by CPF - compare digits only (normalize both sides)
    const cpfDigits = s.profile?.cpf?.replace(/\D/g, "") || "";
    const matchesCpf = queryDigits.length > 0 && cpfDigits.includes(queryDigits);
    
    // Search by phone - compare digits only (normalize both sides)
    const phoneDigits = s.profile?.phone?.replace(/\D/g, "") || "";
    const matchesPhone = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
    
    return matchesText || matchesCpf || matchesPhone;
  });

  const getPlanBadge = (plan: string) => {
    const planColors: Record<string, string> = {
      start: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      essencial: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      profissional: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      enterprise: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return planColors[plan] || planColors.start;
  };

  const handleViewSindico = (sindico: SindicoWithProfile) => {
    setSelectedSindico(sindico);
    setIsViewDialogOpen(true);
    setIsEditingProfile(false);
  };

  const handleStartEditProfile = () => {
    if (selectedSindico?.profile) {
      setEditProfileData({
        full_name: selectedSindico.profile.full_name || "",
        phone: selectedSindico.profile.phone ? formatPhone(selectedSindico.profile.phone) : "",
        cpf: selectedSindico.profile.cpf ? formatCPF(selectedSindico.profile.cpf) : "",
      });
      setIsEditingProfile(true);
    }
  };

  const handleSaveProfile = () => {
    if (selectedSindico && editProfileData.full_name) {
      updateProfileMutation.mutate({
        userId: selectedSindico.user_id,
        data: editProfileData,
      });
    }
  };

  const handleDeleteClick = async (sindico: SindicoWithProfile) => {
    setSindicoToDelete(sindico);
    setDeletePreviewData({ condominiums: 0, blocks: 0, apartments: 0, residents: 0, occurrences: 0, isLoading: true });
    setIsDeleteDialogOpen(true);

    try {
      // Fetch condominiums owned by this sindico
      const { data: condominiums } = await supabase
        .from("condominiums")
        .select("id")
        .eq("owner_id", sindico.user_id);

      const condoIds = condominiums?.map(c => c.id) || [];
      let blocksCount = 0;
      let apartmentsCount = 0;
      let residentsCount = 0;
      let occurrencesCount = 0;

      if (condoIds.length > 0) {
        // Count blocks
        const { count: blocks } = await supabase
          .from("blocks")
          .select("*", { count: "exact", head: true })
          .in("condominium_id", condoIds);
        blocksCount = blocks || 0;

        // Get block IDs
        const { data: blocksData } = await supabase
          .from("blocks")
          .select("id")
          .in("condominium_id", condoIds);
        const blockIds = blocksData?.map(b => b.id) || [];

        if (blockIds.length > 0) {
          // Count apartments
          const { count: apartments } = await supabase
            .from("apartments")
            .select("*", { count: "exact", head: true })
            .in("block_id", blockIds);
          apartmentsCount = apartments || 0;

          // Get apartment IDs
          const { data: apartmentsData } = await supabase
            .from("apartments")
            .select("id")
            .in("block_id", blockIds);
          const apartmentIds = apartmentsData?.map(a => a.id) || [];

          if (apartmentIds.length > 0) {
            // Count residents
            const { count: residents } = await supabase
              .from("residents")
              .select("*", { count: "exact", head: true })
              .in("apartment_id", apartmentIds);
            residentsCount = residents || 0;
          }
        }

        // Count occurrences
        const { count: occurrences } = await supabase
          .from("occurrences")
          .select("*", { count: "exact", head: true })
          .in("condominium_id", condoIds);
        occurrencesCount = occurrences || 0;
      }

      setDeletePreviewData({
        condominiums: condoIds.length,
        blocks: blocksCount,
        apartments: apartmentsCount,
        residents: residentsCount,
        occurrences: occurrencesCount,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching delete preview:", error);
      setDeletePreviewData({
        condominiums: sindico.condominiums_count || 0,
        blocks: 0,
        apartments: 0,
        residents: 0,
        occurrences: 0,
        isLoading: false,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (sindicoToDelete) {
      deleteSindicoMutation.mutate(sindicoToDelete.user_id);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.password || !formData.cpf) {
      toast({
        title: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }
    if (!isValidCPF(formData.cpf)) {
      toast({
        title: "CPF inválido",
        description: "Verifique o número do CPF informado.",
        variant: "destructive",
      });
      return;
    }
    createSindicoMutation.mutate(formData);
  };

  const { containerRef, PullIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
    },
    isEnabled: isMobile,
  });

  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg md:text-xl">Gestão de Síndicos</CardTitle>
            <CardDescription className="text-sm">
              Gerencie os síndicos cadastrados na plataforma
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Síndico
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader className="space-y-1.5 sm:space-y-2 pb-2 sm:pb-4">
                  <DialogTitle className="text-base sm:text-lg">Criar Novo Síndico</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Cadastre um novo síndico na plataforma. O plano será definido ao criar um condomínio.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="full_name" className="text-xs sm:text-sm">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      placeholder="João da Silva"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="email" className="text-xs sm:text-sm">Email *</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="joao@email.com"
                        value={formData.email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={cn(
                          "h-9 sm:h-10 text-sm pr-10",
                          emailStatus === "taken" ? "border-destructive" :
                          emailStatus === "available" ? "border-emerald-500" :
                          emailStatus === "invalid" ? "border-amber-500" : ""
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailStatus === "checking" && (
                          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
                        )}
                        {emailStatus === "available" && (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                        )}
                        {emailStatus === "taken" && (
                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                        )}
                        {emailStatus === "invalid" && (
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                    {emailStatus === "taken" && (
                      <p className="text-[10px] sm:text-xs text-destructive">
                        Este e-mail já está cadastrado no sistema.
                      </p>
                    )}
                    {emailStatus === "available" && (
                      <p className="text-[10px] sm:text-xs text-emerald-500">
                        E-mail disponível para cadastro.
                      </p>
                    )}
                    {emailStatus === "invalid" && (
                      <p className="text-[10px] sm:text-xs text-amber-500">
                        Formato de e-mail inválido.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="password" className="text-xs sm:text-sm">Senha *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="h-9 sm:h-10 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={formData.password} />
                  </div>
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="cpf" className="text-xs sm:text-sm">CPF *</Label>
                    <div className="relative">
                      <MaskedInput
                        id="cpf"
                        mask="cpf"
                        value={formData.cpf}
                        onChange={handleCpfChange}
                        className={cn(
                          "h-9 sm:h-10 text-sm pr-10",
                          cpfStatus === "taken" ? "border-destructive" :
                          cpfStatus === "available" ? "border-emerald-500" :
                          cpfStatus === "invalid" ? "border-amber-500" : ""
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cpfStatus === "checking" && (
                          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
                        )}
                        {cpfStatus === "available" && (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                        )}
                        {cpfStatus === "taken" && (
                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                        )}
                        {cpfStatus === "invalid" && (
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                    {cpfStatus === "taken" && (
                      <p className="text-[10px] sm:text-xs text-destructive">
                        Este CPF já está cadastrado no sistema.
                      </p>
                    )}
                    {cpfStatus === "available" && (
                      <p className="text-[10px] sm:text-xs text-emerald-500">
                        CPF disponível para cadastro.
                      </p>
                    )}
                    {cpfStatus === "invalid" && (
                      <p className="text-[10px] sm:text-xs text-amber-500">
                        CPF inválido. Verifique os dígitos.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="phone" className="text-xs sm:text-sm">Telefone</Label>
                    <div className="relative">
                      <MaskedInput
                        id="phone"
                        mask="phone"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className={cn(
                          "h-9 sm:h-10 text-sm pr-10",
                          phoneStatus === "invalid" ? "border-amber-500" :
                          phoneStatus === "valid" ? "border-emerald-500" : ""
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {phoneStatus === "valid" && (
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                        )}
                        {phoneStatus === "invalid" && (
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                    {phoneStatus === "invalid" && (
                      <p className="text-[10px] sm:text-xs text-amber-500">
                        Telefone inválido. Use DDD + número.
                      </p>
                    )}
                    {phoneStatus === "incomplete" && formData.phone.replace(/\D/g, "").length > 0 && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Digite o telefone completo com DDD.
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-2 sm:mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createSindicoMutation.isPending}
                    className="w-full sm:w-auto h-9 sm:h-10 text-sm mt-0"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createSindicoMutation.isPending || cpfStatus === "taken" || cpfStatus === "invalid" || cpfStatus === "checking" || emailStatus === "taken" || emailStatus === "invalid" || emailStatus === "checking"} 
                    className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                  >
                    {createSindicoMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Síndico"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent ref={containerRef} className="p-4 md:p-6 pt-0 md:pt-0 overflow-auto">
        <PullIndicator />
        <div className="mb-4 md:mb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar: nome, email, CPF (só números) ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-1">
            Para CPF/telefone, digite apenas os números (ex: 12345678900)
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredSindicos?.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <p className="text-sm md:text-base text-muted-foreground">Nenhum síndico encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSindicos?.map((sindico) => {
                const allActive = sindico.condominiums.length > 0 && sindico.condominiums.every((c) => c.subscription?.active);
                const someActive = sindico.condominiums.some((c) => c.subscription?.active);
                
                return (
                  <Card 
                    key={sindico.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleViewSindico(sindico)}
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Header: Avatar + Name + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-primary">
                              {sindico.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-foreground truncate">
                              {sindico.profile?.full_name || "—"}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {sindico.profile?.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewSindico(sindico);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Enviar email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          <span className="font-mono truncate">
                            {sindico.profile?.cpf ? formatCPF(sindico.profile.cpf) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {sindico.profile?.phone ? formatPhone(sindico.profile.phone) : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Condominiums */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Condomínios</span>
                          <Badge variant="outline" className="text-xs">
                            {sindico.condominiums_count}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {sindico.condominiums.length > 0 ? (
                            <>
                              {sindico.condominiums.slice(0, 2).map((c) => (
                                <Badge 
                                  key={c.id} 
                                  variant="outline" 
                                  className="bg-secondary/50 text-foreground border-border text-xs"
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {c.name.length > 18 ? c.name.substring(0, 18) + "..." : c.name}
                                </Badge>
                              ))}
                              {sindico.condominiums.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{sindico.condominiums.length - 2}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem condomínios cadastrados</span>
                          )}
                        </div>
                      </div>

                      {/* Footer: Status + Date */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        {sindico.condominiums.length > 0 ? (
                          allActive ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Todos Ativos
                            </Badge>
                          ) : someActive ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                            >
                              Parcial
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-destructive/10 text-destructive border-destructive/20 text-xs"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Inativos
                            </Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(sindico.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
        )}

        {/* View Sindico Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Detalhes do Síndico
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Informações completas e condomínios gerenciados
              </DialogDescription>
            </DialogHeader>
            
            {selectedSindico && (
              <div className="space-y-4 sm:space-y-6">
                {/* Sindico Info */}
                <div className="space-y-3 sm:space-y-4">
                  {isEditingProfile ? (
                    // Edit Mode
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm sm:text-base">Editar Informações</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingProfile(false)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:gap-4">
                        <div className="grid gap-1.5 sm:gap-2">
                          <Label htmlFor="edit_full_name" className="text-xs sm:text-sm">Nome Completo</Label>
                          <Input
                            id="edit_full_name"
                            value={editProfileData.full_name}
                            onChange={(e) =>
                              setEditProfileData({ ...editProfileData, full_name: e.target.value })
                            }
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                          <Label className="text-xs sm:text-sm">Email</Label>
                          <Input
                            value={selectedSindico.profile?.email || ""}
                            disabled
                            className="bg-muted h-9 sm:h-10 text-sm"
                          />
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            O email não pode ser alterado
                          </p>
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                          <Label htmlFor="edit_cpf" className="text-xs sm:text-sm">CPF</Label>
                          <MaskedInput
                            id="edit_cpf"
                            mask="cpf"
                            value={editProfileData.cpf}
                            onChange={(value) =>
                              setEditProfileData({ ...editProfileData, cpf: value })
                            }
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        <div className="grid gap-1.5 sm:gap-2">
                          <Label htmlFor="edit_phone" className="text-xs sm:text-sm">Telefone</Label>
                          <MaskedInput
                            id="edit_phone"
                            mask="phone"
                            value={editProfileData.phone}
                            onChange={(value) =>
                              setEditProfileData({ ...editProfileData, phone: value })
                            }
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingProfile(false)}
                          className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending || !editProfileData.full_name}
                          className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                        >
                          {updateProfileMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      {/* Mobile: Stacked layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold truncate">{selectedSindico.profile?.full_name || "—"}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedSindico.profile?.email}</p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleStartEditProfile}
                          className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                        >
                          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                          Editar
                        </Button>
                      </div>
                      
                      {/* Info Grid - Single column on mobile, 2 cols on desktop */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">CPF</p>
                            <p className="text-sm sm:text-base font-medium truncate">{selectedSindico.profile?.cpf ? formatCPF(selectedSindico.profile.cpf) : "Não informado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Telefone</p>
                            <p className="text-sm sm:text-base font-medium truncate">{selectedSindico.profile?.phone ? formatPhone(selectedSindico.profile.phone) : "Não informado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 sm:gap-3 sm:col-span-2">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Cadastrado em</p>
                            <p className="text-sm sm:text-base font-medium">
                              {formatDate(selectedSindico.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Condominiums */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                      Condomínios ({selectedSindico.condominiums_count})
                    </h4>
                  </div>
                  
                  {selectedSindico.condominiums.length === 0 ? (
                    <div className="text-center py-4 sm:py-6 rounded-lg bg-secondary/30">
                      <Building2 className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-xs sm:text-sm text-muted-foreground">Nenhum condomínio cadastrado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedSindico.condominiums.map((condo) => (
                        <div 
                          key={condo.id} 
                          className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setIsViewDialogOpen(false);
                            if (condo.subscription?.id) {
                              navigate(`/superadmin/subscriptions/${condo.subscription.id}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm sm:text-base font-medium truncate">{condo.name}</p>
                              <Badge 
                                variant="outline" 
                                className={`${getPlanBadge(condo.subscription?.plan || "start")} text-[10px] sm:text-xs mt-0.5 sm:mt-1`}
                              >
                                <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                {condo.subscription?.plan?.toUpperCase() || "START"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {condo.subscription?.active ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                <span className="hidden xs:inline">Ativo</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                <span className="hidden xs:inline">Inativo</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 sm:pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsViewDialogOpen(false)} 
                className="w-full sm:w-auto h-9 sm:h-10 text-sm"
              >
                Fechar
              </Button>
              {selectedSindico && (
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteClick(selectedSindico)}
                  className="w-full sm:w-auto h-9 sm:h-10 text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Síndico
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeletePreviewData(null);
          }
        }}>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg p-4 sm:p-6">
            <AlertDialogHeader className="space-y-2 sm:space-y-3">
              <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span>Atenção: Exclusão Permanente</span>
              </AlertDialogTitle>
              <div className="space-y-3 sm:space-y-4 text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Tem certeza que deseja excluir o síndico{" "}
                  <span className="font-semibold text-foreground">{sindicoToDelete?.profile?.full_name}</span>?
                </p>

                {/* Data Preview */}
                {deletePreviewData?.isLoading ? (
                  <div className="flex items-center gap-2 p-3 sm:p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Calculando dados a serem removidos...</span>
                  </div>
                ) : deletePreviewData && (deletePreviewData.condominiums > 0 || deletePreviewData.residents > 0) ? (
                  <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm font-medium text-destructive">
                      Os seguintes dados serão removidos:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>{deletePreviewData.condominiums}</strong> cond.</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>{deletePreviewData.blocks}</strong> bloco(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>{deletePreviewData.apartments}</strong> apto(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>{deletePreviewData.residents}</strong> morador(es)</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 col-span-2">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>{deletePreviewData.occurrences}</strong> ocorrência(s)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Este síndico não possui condomínios vinculados.
                    </p>
                  </div>
                )}

                <div className="p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Esta ação é irreversível!
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    Todos os dados listados acima serão permanentemente removidos do sistema.
                  </p>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 mt-2 sm:mt-4">
              <AlertDialogCancel 
                disabled={deleteSindicoMutation.isPending}
                className="w-full sm:w-auto h-9 sm:h-10 text-sm mt-0"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteSindicoMutation.isPending || deletePreviewData?.isLoading}
                className="w-full sm:w-auto h-9 sm:h-10 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteSindicoMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirmar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
