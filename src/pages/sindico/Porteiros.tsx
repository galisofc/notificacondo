import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DoorOpen, Plus, Trash2, Building2, Mail, Phone, Search, UserPlus, MessageCircle, Copy, Check, Key, AlertCircle, UserX, RefreshCw, Loader2, Pencil, ArrowLeft, ShieldCheck } from "lucide-react";
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

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
        })
        .eq("user_id", editingPorter.user_id);

      if (error) throw error;

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DoorOpen className="w-6 h-6 text-primary" />
              Gestão de Porteiros
            </h1>
            <p className="text-muted-foreground">
              Gerencie os porteiros dos seus condomínios
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleLoadOrphanUsers}
              disabled={isLoadingOrphans}
            >
              {isLoadingOrphans ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserX className="w-4 h-4" />
              )}
              Limpar Órfãos
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setDialogStep("form");
                setNewPorter({ full_name: "", email: "", phone: "", condominium_id: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Adicionar Porteiro
                </Button>
              </DialogTrigger>
              <DialogContent>
                {dialogStep === "form" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Adicionar Novo Porteiro</DialogTitle>
                      <DialogDescription>
                        O porteiro receberá um e-mail para acessar o sistema
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="condominium">Condomínio *</Label>
                        <Select
                          value={newPorter.condominium_id}
                          onValueChange={(value) =>
                            setNewPorter((prev) => ({ ...prev, condominium_id: value }))
                          }
                        >
                          <SelectTrigger>
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

                      <div className="space-y-2">
                        <Label htmlFor="full_name">Nome Completo *</Label>
                        <Input
                          id="full_name"
                          placeholder="Nome do porteiro"
                          value={newPorter.full_name}
                          onChange={(e) =>
                            setNewPorter((prev) => ({ ...prev, full_name: e.target.value }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="porteiro@email.com"
                          value={newPorter.email}
                          onChange={(e) =>
                            setNewPorter((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <MaskedInput
                          id="phone"
                          mask="phone"
                          value={newPorter.phone}
                          onChange={(value) =>
                            setNewPorter((prev) => ({ ...prev, phone: value }))
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleGoToConfirmStep} disabled={isCheckingEmail}>
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
                    <DialogHeader>
                      <DialogTitle>Confirmar Cadastro</DialogTitle>
                      <DialogDescription>
                        Revise os dados antes de confirmar
                      </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-full">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Tipo de Acesso</p>
                            <p className="font-semibold text-primary">Porteiro</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-3">
                          <div className="bg-secondary p-2 rounded-full">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Condomínio Vinculado</p>
                            <p className="font-medium">
                              {condominiums.find(c => c.id === newPorter.condominium_id)?.name || "-"}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Nome</p>
                            <p className="font-medium">{newPorter.full_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">E-mail</p>
                            <p className="font-medium">{newPorter.email}</p>
                          </div>
                          {newPorter.phone && (
                            <div>
                              <p className="text-xs text-muted-foreground">Telefone</p>
                              <p className="font-medium">{newPorter.phone}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Alert>
                        <MessageCircle className="h-4 w-4" />
                        <AlertTitle>Notificação</AlertTitle>
                        <AlertDescription>
                          {newPorter.phone
                            ? "As credenciais de acesso serão enviadas via WhatsApp."
                            : "As credenciais serão exibidas após o cadastro para você informar manualmente."}
                        </AlertDescription>
                      </Alert>
                    </div>

                    <DialogFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDialogStep("form")}
                        disabled={isSubmitting}
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                      </Button>
                      <Button onClick={handleAddPorter} disabled={isSubmitting}>
                        {isSubmitting ? "Cadastrando..." : "Confirmar Cadastro"}
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
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-full sm:w-[250px]">
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
          <CardHeader>
            <CardTitle>Porteiros Cadastrados</CardTitle>
            <CardDescription>
              {filteredPorters.length} porteiro(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPorters.length === 0 ? (
              <div className="text-center py-12">
                <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum porteiro encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  {porters.length === 0
                    ? "Adicione porteiros para gerenciar as encomendas"
                    : "Tente ajustar os filtros de busca"}
                </p>
                {porters.length === 0 && (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeiro Porteiro
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog with Password */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Porteiro Cadastrado
            </DialogTitle>
            <DialogDescription>
              O WhatsApp não foi enviado. Anote as credenciais abaixo para informar ao porteiro.
            </DialogDescription>
          </DialogHeader>

          {successData && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Atenção</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  {successData.password 
                    ? "Não foi possível enviar as credenciais via WhatsApp. Anote a senha abaixo!"
                    : "O porteiro foi vinculado ao condomínio."}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{successData.email}</p>
                  </div>
                </div>

                {successData.password && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-muted-foreground">Senha</p>
                      <div className="flex items-center gap-2">
                        <code className="text-lg font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded">
                          {successData.password}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyPassword}
                          className="gap-1"
                        >
                          {passwordCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
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
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orphan Users Cleanup Dialog */}
      <Dialog open={orphanDialogOpen} onOpenChange={setOrphanDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              Usuários Órfãos
            </DialogTitle>
            <DialogDescription>
              Usuários que existem na autenticação mas não possuem perfil ou papel definido no sistema.
              Estes usuários podem causar conflitos ao adicionar novos porteiros.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {orphanUsers.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum usuário órfão encontrado</h3>
                <p className="text-muted-foreground">
                  O sistema está limpo!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {orphanUsers.length} usuário(s) órfão(s) encontrado(s)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllOrphans}
                  >
                    {selectedOrphans.size === orphanUsers.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>

                <div className="border rounded-lg divide-y">
                  {orphanUsers.map((orphan) => (
                    <div
                      key={orphan.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedOrphans.has(orphan.id) ? "bg-muted" : ""
                      }`}
                      onClick={() => toggleOrphanSelection(orphan.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrphans.has(orphan.id)}
                        onChange={() => toggleOrphanSelection(orphan.id)}
                        className="h-4 w-4 rounded border-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">
                            {orphan.email || "E-mail não definido"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>ID: {orphan.id.slice(0, 8)}...</span>
                          <span>Criado em: {format(new Date(orphan.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!orphan.has_profile && (
                          <Badge variant="secondary" className="text-xs">Sem perfil</Badge>
                        )}
                        {!orphan.has_role && (
                          <Badge variant="secondary" className="text-xs">Sem papel</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleLoadOrphanUsers()}
              disabled={isLoadingOrphans || isDeletingOrphans}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Porteiro
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do porteiro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Nome completo *</Label>
              <Input
                id="edit_full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nome do porteiro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_phone">Telefone</Label>
              <MaskedInput
                id="edit_phone"
                mask="phone"
                value={editForm.phone}
                onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value }))}
              />
            </div>

            {editingPorter?.profile?.email && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">E-mail (não editável)</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                  <Mail className="w-4 h-4" />
                  {editingPorter.profile.email}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePorter} disabled={isUpdating}>
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
