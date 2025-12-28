import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { isValidCPF } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Mail, Building2, Plus, Loader2, Eye, User, Phone, Calendar, CreditCard, CheckCircle, XCircle, Pencil, Save, X, Trash2, AlertTriangle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

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
  const [cpfStatus, setCpfStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [cpfCheckTimeout, setCpfCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Função para verificar CPF em tempo real
  const checkCpfAvailability = useCallback(async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    
    // CPF incompleto
    if (cleanCpf.length < 11) {
      setCpfStatus("idle");
      return;
    }

    // Validar formato do CPF
    if (!isValidCPF(cleanCpf)) {
      setCpfStatus("invalid");
      return;
    }

    setCpfStatus("checking");

    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (existingProfile) {
        setCpfStatus("taken");
      } else {
        setCpfStatus("available");
      }
    } catch (error) {
      console.error("Error checking CPF:", error);
      setCpfStatus("idle");
    }
  }, []);

  // Debounce para verificação do CPF
  const handleCpfChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, cpf: value }));
    
    // Limpar timeout anterior
    if (cpfCheckTimeout) {
      clearTimeout(cpfCheckTimeout);
    }

    const cleanCpf = value.replace(/\D/g, "");
    
    // Se CPF estiver incompleto, resetar status
    if (cleanCpf.length < 11) {
      setCpfStatus("idle");
      return;
    }

    // Agendar verificação com debounce de 500ms
    const timeout = setTimeout(() => {
      checkCpfAvailability(value);
    }, 500);

    setCpfCheckTimeout(timeout);
  }, [cpfCheckTimeout, checkCpfAvailability]);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (cpfCheckTimeout) {
        clearTimeout(cpfCheckTimeout);
      }
    };
  }, [cpfCheckTimeout]);

  // Resetar status do CPF quando o dialog fecha
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setCpfStatus("idle");
    }
  }, [isCreateDialogOpen]);

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
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Criar Novo Síndico</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo síndico na plataforma. O plano será definido ao criar um condomínio.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      placeholder="João da Silva"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="joao@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <div className="relative">
                      <MaskedInput
                        id="cpf"
                        mask="cpf"
                        value={formData.cpf}
                        onChange={handleCpfChange}
                        className={
                          cpfStatus === "taken" ? "border-destructive pr-10" :
                          cpfStatus === "available" ? "border-emerald-500 pr-10" :
                          cpfStatus === "invalid" ? "border-amber-500 pr-10" :
                          "pr-10"
                        }
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {cpfStatus === "checking" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {cpfStatus === "available" && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                        {cpfStatus === "taken" && (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {cpfStatus === "invalid" && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                    {cpfStatus === "taken" && (
                      <p className="text-xs text-destructive">
                        Este CPF já está cadastrado no sistema.
                      </p>
                    )}
                    {cpfStatus === "available" && (
                      <p className="text-xs text-emerald-500">
                        CPF disponível para cadastro.
                      </p>
                    )}
                    {cpfStatus === "invalid" && (
                      <p className="text-xs text-amber-500">
                        CPF inválido. Verifique os dígitos.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <MaskedInput
                      id="phone"
                      mask="phone"
                      value={formData.phone}
                      onChange={(value) => setFormData({ ...formData, phone: value })}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createSindicoMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createSindicoMutation.isPending || cpfStatus === "taken" || cpfStatus === "invalid" || cpfStatus === "checking"} className="w-full sm:w-auto">
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
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
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
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {filteredSindicos?.map((sindico) => (
                <div key={sindico.id} className="p-4 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{sindico.profile?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{sindico.profile?.email}</p>
                        {sindico.profile?.cpf && (
                          <p className="text-xs text-muted-foreground font-mono">CPF: {formatCPF(sindico.profile.cpf)}</p>
                        )}
                        {sindico.profile?.phone && (
                          <p className="text-xs text-muted-foreground">Tel: {formatPhone(sindico.profile.phone)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewSindico(sindico)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
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
                  <div className="flex flex-wrap gap-2 mb-3">
                    {sindico.condominiums.length > 0 ? (
                      sindico.condominiums.slice(0, 2).map((c) => (
                        <Badge key={c.id} variant="outline" className="bg-secondary text-foreground border-border">
                          <Building2 className="h-3 w-3 mr-1" />
                          {c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Sem condomínios</span>
                    )}
                    {sindico.condominiums.length > 2 && (
                      <Badge variant="outline">+{sindico.condominiums.length - 2}</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {sindico.condominiums_count} condomínio{sindico.condominiums_count !== 1 ? "s" : ""}
                    </div>
                    <span>{format(new Date(sindico.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Síndico</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Condomínios</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Status Assinaturas</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSindicos?.map((sindico) => (
                      <TableRow key={sindico.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sindico.profile?.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{sindico.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-mono">
                            {sindico.profile?.cpf ? formatCPF(sindico.profile.cpf) : "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {sindico.profile?.phone ? formatPhone(sindico.profile.phone) : "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {sindico.condominiums.length > 0 ? (
                              sindico.condominiums.slice(0, 2).map((c) => (
                                <Badge key={c.id} variant="outline" className="bg-secondary text-foreground border-border">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {c.name.length > 20 ? c.name.substring(0, 20) + "..." : c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">Sem condomínios</span>
                            )}
                            {sindico.condominiums.length > 2 && (
                              <Badge variant="outline">+{sindico.condominiums.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{sindico.condominiums_count}</span>
                        </TableCell>
                        <TableCell>
                          {sindico.condominiums.length > 0 ? (
                            sindico.condominiums.every((c) => c.subscription?.active) ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              >
                                Todos Ativos
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                              >
                                Parcial
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {format(new Date(sindico.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleViewSindico(sindico)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        {/* View Sindico Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Detalhes do Síndico
              </DialogTitle>
              <DialogDescription>
                Informações completas e condomínios gerenciados
              </DialogDescription>
            </DialogHeader>
            
            {selectedSindico && (
              <div className="space-y-6">
                {/* Sindico Info */}
                <div className="space-y-4">
                  {isEditingProfile ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Editar Informações</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingProfile(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="edit_full_name">Nome Completo</Label>
                          <Input
                            id="edit_full_name"
                            value={editProfileData.full_name}
                            onChange={(e) =>
                              setEditProfileData({ ...editProfileData, full_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Email</Label>
                          <Input
                            value={selectedSindico.profile?.email || ""}
                            disabled
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground">
                            O email não pode ser alterado
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit_cpf">CPF</Label>
                          <MaskedInput
                            id="edit_cpf"
                            mask="cpf"
                            value={editProfileData.cpf}
                            onChange={(value) =>
                              setEditProfileData({ ...editProfileData, cpf: value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="edit_phone">Telefone</Label>
                          <MaskedInput
                            id="edit_phone"
                            mask="phone"
                            value={editProfileData.phone}
                            onChange={(value) =>
                              setEditProfileData({ ...editProfileData, phone: value })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingProfile(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending || !editProfileData.full_name}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{selectedSindico.profile?.full_name || "—"}</h3>
                            <p className="text-muted-foreground">{selectedSindico.profile?.email}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleStartEditProfile}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">CPF</p>
                            <p className="font-medium">{selectedSindico.profile?.cpf ? formatCPF(selectedSindico.profile.cpf) : "Não informado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Telefone</p>
                            <p className="font-medium">{selectedSindico.profile?.phone ? formatPhone(selectedSindico.profile.phone) : "Não informado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Cadastrado em</p>
                            <p className="font-medium">
                              {format(new Date(selectedSindico.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Condominiums */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Condomínios Gerenciados ({selectedSindico.condominiums_count})
                    </h4>
                  </div>
                  
                  {selectedSindico.condominiums.length === 0 ? (
                    <div className="text-center py-6 rounded-lg bg-secondary/30">
                      <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Nenhum condomínio cadastrado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedSindico.condominiums.map((condo) => (
                        <div 
                          key={condo.id} 
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setIsViewDialogOpen(false);
                            if (condo.subscription?.id) {
                              navigate(`/superadmin/subscriptions/${condo.subscription.id}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{condo.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={getPlanBadge(condo.subscription?.plan || "start")}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  {condo.subscription?.plan?.toUpperCase() || "START"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {condo.subscription?.active ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inativo
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
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {selectedSindico && (
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteClick(selectedSindico)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Síndico
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full sm:w-auto">
                Fechar
              </Button>
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
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Atenção: Exclusão Permanente
              </AlertDialogTitle>
              <div className="space-y-4 text-left">
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja excluir o síndico{" "}
                  <span className="font-semibold text-foreground">{sindicoToDelete?.profile?.full_name}</span>?
                </p>

                {/* Data Preview */}
                {deletePreviewData?.isLoading ? (
                  <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Calculando dados a serem removidos...</span>
                  </div>
                ) : deletePreviewData && (deletePreviewData.condominiums > 0 || deletePreviewData.residents > 0) ? (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
                    <p className="text-sm font-medium text-destructive">
                      Os seguintes dados serão removidos permanentemente:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{deletePreviewData.condominiums}</strong> condomínio(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{deletePreviewData.blocks}</strong> bloco(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{deletePreviewData.apartments}</strong> apartamento(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{deletePreviewData.residents}</strong> morador(es)</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{deletePreviewData.occurrences}</strong> ocorrência(s)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Este síndico não possui condomínios vinculados.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Esta ação é irreversível!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os dados listados acima serão permanentemente removidos do sistema.
                  </p>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel disabled={deleteSindicoMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteSindicoMutation.isPending || deletePreviewData?.isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteSindicoMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirmar Exclusão
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
