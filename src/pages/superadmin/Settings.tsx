import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings,
  Bell,
  Shield,
  Database,
  CreditCard,
  MessageCircle,
  Zap,
  Building2,
  Crown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Package,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MercadoPagoSettings } from "@/components/superadmin/MercadoPagoSettings";
import { MercadoPagoWebhookLogs } from "@/components/superadmin/MercadoPagoWebhookLogs";
import { RlsPoliciesCard } from "@/components/superadmin/RlsPoliciesCard";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  notifications_limit: number;
  warnings_limit: number;
  fines_limit: number;
  price: number;
  is_active: boolean;
  color: string;
  display_order: number;
}

const COLOR_OPTIONS = [
  { value: "bg-gray-500", label: "Cinza" },
  { value: "bg-blue-500", label: "Azul" },
  { value: "bg-violet-500", label: "Violeta" },
  { value: "bg-amber-500", label: "Âmbar" },
  { value: "bg-green-500", label: "Verde" },
  { value: "bg-red-500", label: "Vermelho" },
  { value: "bg-pink-500", label: "Rosa" },
  { value: "bg-indigo-500", label: "Índigo" },
];

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    description: "",
    notifications_limit: 10,
    warnings_limit: 10,
    fines_limit: 0,
    price: 0,
    color: "bg-gray-500",
    display_order: 0,
    is_active: true,
  });

  // Fetch plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as Plan[];
    },
  });

  // Platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["superadmin-platform-stats"],
    queryFn: async () => {
      const [usersRes, condosRes, occurrencesRes, subsRes] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact" }),
        supabase.from("condominiums").select("*", { count: "exact" }),
        supabase.from("occurrences").select("*", { count: "exact" }),
        supabase.from("subscriptions").select("*"),
      ]);

      const subscriptions = subsRes.data || [];
      const planCounts: Record<string, number> = {};
      (plans || []).forEach((p) => {
        planCounts[p.slug] = subscriptions.filter((s) => s.plan === p.slug).length;
      });

      return {
        totalUsers: usersRes.count || 0,
        totalCondominiums: condosRes.count || 0,
        totalOccurrences: occurrencesRes.count || 0,
        activeSubscriptions: subscriptions.filter((s) => s.active).length,
        planCounts,
      };
    },
    enabled: !!plans,
  });

  // WhatsApp config status
  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-config-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("is_active, provider, api_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: Omit<Plan, "id">) => {
      const { error } = await supabase.from("plans").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-plans"] });
      toast({ title: "Plano criado com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar plano", description: error.message, variant: "destructive" });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Plan> }) => {
      const { error } = await supabase.from("plans").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-plans"] });
      toast({ title: "Plano atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingPlan(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar plano", description: error.message, variant: "destructive" });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-plans"] });
      toast({ title: "Plano excluído com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir plano", description: error.message, variant: "destructive" });
    },
  });

  // Reset usage mutation
  const resetUsageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          notifications_used: 0,
          warnings_used: 0,
          fines_used: 0,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-platform-stats"] });
      toast({
        title: "Contadores resetados",
        description: "Os contadores de uso de todos os usuários foram zerados.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resetar contadores",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      description: "",
      notifications_limit: 10,
      warnings_limit: 10,
      fines_limit: 0,
      price: 0,
      color: "bg-gray-500",
      display_order: 0,
      is_active: true,
    });
  };

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        slug: plan.slug,
        name: plan.name,
        description: plan.description || "",
        notifications_limit: plan.notifications_limit,
        warnings_limit: plan.warnings_limit,
        fines_limit: plan.fines_limit,
        price: plan.price,
        color: plan.color,
        display_order: plan.display_order,
        is_active: plan.is_active,
      });
    } else {
      setEditingPlan(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData as Omit<Plan, "id">);
    }
  };

  const handleDelete = (plan: Plan) => {
    if (confirm(`Tem certeza que deseja excluir o plano "${plan.name}"?`)) {
      deletePlanMutation.mutate(plan.id);
    }
  };

  const handleChangePassword = async () => {
    // Validate inputs
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a nova senha e a confirmação.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua nova senha já está ativa.",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Configurações | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Configurações da Plataforma
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações gerais e monitore a saúde do sistema
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview" className="gap-2">
              <Database className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="manage-plans" className="gap-2">
              <Package className="w-4 h-4" />
              Cadastro de Planos
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Distribuição
            </TabsTrigger>
            <TabsTrigger value="mercadopago" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Mercado Pago
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Usuários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalUsers}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Condomínios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalCondominiums}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ocorrências
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalOccurrences}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Assinaturas Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.activeSubscriptions}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Status do Sistema
                </CardTitle>
                <CardDescription>
                  Informações sobre o estado atual da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium text-green-500">Sistema Operacional</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    Online
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Banco de Dados</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Conectado
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Edge Functions</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Ativas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Manutenção
                </CardTitle>
                <CardDescription>
                  Ações de manutenção e gerenciamento da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium text-foreground">Resetar Contadores de Uso</p>
                    <p className="text-sm text-muted-foreground">
                      Zera os contadores de notificações, advertências e multas de todos os usuários
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja resetar todos os contadores de uso?")) {
                        resetUsageMutation.mutate();
                      }
                    }}
                    disabled={resetUsageMutation.isPending}
                  >
                    {resetUsageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Resetar"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Plans Tab */}
          <TabsContent value="manage-plans" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Cadastro de Planos
                  </CardTitle>
                  <CardDescription>
                    Gerencie os planos disponíveis na plataforma
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Plano
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingPlan ? "Editar Plano" : "Novo Plano"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingPlan
                          ? "Edite as informações do plano"
                          : "Preencha as informações para criar um novo plano"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="slug">Slug</Label>
                          <Input
                            id="slug"
                            value={formData.slug}
                            onChange={(e) =>
                              setFormData({ ...formData, slug: e.target.value })
                            }
                            placeholder="ex: premium"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            placeholder="ex: Premium"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="Descrição do plano"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="notifications_limit">Notificações</Label>
                          <Input
                            id="notifications_limit"
                            type="number"
                            value={formData.notifications_limit}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                notifications_limit: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="warnings_limit">Advertências</Label>
                          <Input
                            id="warnings_limit"
                            type="number"
                            value={formData.warnings_limit}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                warnings_limit: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fines_limit">Multas</Label>
                          <Input
                            id="fines_limit"
                            type="number"
                            value={formData.fines_limit}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fines_limit: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Preço (R$)</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="display_order">Ordem</Label>
                          <Input
                            id="display_order"
                            type="number"
                            value={formData.display_order}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                display_order: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Cor</Label>
                          <Select
                            value={formData.color}
                            onValueChange={(value) =>
                              setFormData({ ...formData, color: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded ${opt.value}`} />
                                    {opt.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <div className="flex items-center space-x-2 pt-2">
                            <Switch
                              checked={formData.is_active}
                              onCheckedChange={(checked) =>
                                setFormData({ ...formData, is_active: checked })
                              }
                            />
                            <Label>{formData.is_active ? "Ativo" : "Inativo"}</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                      >
                        {(createPlanMutation.isPending || updatePlanMutation.isPending) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingPlan ? "Salvar" : "Criar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Notificações</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Advertências</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Multas</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Preço</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans?.map((plan) => (
                          <tr key={plan.id} className="border-b border-border/30">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${plan.color} flex items-center justify-center`}>
                                  {plan.slug === "enterprise" ? (
                                    <Crown className="w-4 h-4 text-white" />
                                  ) : (
                                    <Zap className="w-4 h-4 text-white" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{plan.name}</p>
                                  <p className="text-xs text-muted-foreground">{plan.slug}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center py-3 px-4 font-mono">
                              {plan.notifications_limit >= 999999 ? "∞" : plan.notifications_limit}
                            </td>
                            <td className="text-center py-3 px-4 font-mono">
                              {plan.warnings_limit >= 999999 ? "∞" : plan.warnings_limit}
                            </td>
                            <td className="text-center py-3 px-4 font-mono">
                              {plan.fines_limit >= 999999 ? "∞" : plan.fines_limit}
                            </td>
                            <td className="text-center py-3 px-4 font-mono">
                              {plan.price === 0 ? "Grátis" : `R$ ${plan.price.toFixed(2)}`}
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={plan.is_active ? "default" : "secondary"}>
                                {plan.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(plan)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(plan)}
                                  disabled={deletePlanMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Distribution Tab */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Distribuição de Planos
                </CardTitle>
                <CardDescription>
                  Quantidade de usuários por tipo de plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {plans?.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/20"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg ${plan.color} flex items-center justify-center`}>
                            {plan.slug === "enterprise" ? (
                              <Crown className="w-5 h-5 text-white" />
                            ) : (
                              <Zap className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{plan.name}</p>
                            <p className="text-2xl font-bold text-primary">
                              {statsLoading ? "..." : stats?.planCounts?.[plan.slug] || 0}
                            </p>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Notificações: {plan.notifications_limit >= 999999 ? "∞" : plan.notifications_limit}/mês</p>
                          <p>Advertências: {plan.warnings_limit >= 999999 ? "∞" : plan.warnings_limit}/mês</p>
                          <p>Multas: {plan.fines_limit >= 999999 ? "∞" : plan.fines_limit}/mês</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Limites por Plano</CardTitle>
                <CardDescription>
                  Configuração atual dos limites de cada plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plano</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Notificações</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Advertências</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Multas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans?.map((plan) => (
                        <tr key={plan.id} className="border-b border-border/30">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-foreground">
                              {plan.name}
                            </Badge>
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.notifications_limit >= 999999 ? "Ilimitado" : plan.notifications_limit}
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.warnings_limit >= 999999 ? "Ilimitado" : plan.warnings_limit}
                          </td>
                          <td className="text-center py-3 px-4 font-mono">
                            {plan.fines_limit >= 999999 ? "Ilimitado" : plan.fines_limit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mercado Pago Tab */}
          <TabsContent value="mercadopago" className="space-y-6">
            <MercadoPagoSettings />
            <MercadoPagoWebhookLogs />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-green-500" />
                      Configurações de WhatsApp
                    </CardTitle>
                  </div>
                  {whatsappConfig?.is_active ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Não configurado
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Gerencie as configurações de integração com WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {whatsappConfig?.is_active ? (
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {whatsappConfig?.provider?.toUpperCase() || "Integração Z-API / Z-PRO"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {whatsappConfig?.is_active 
                            ? "Integração configurada e ativa" 
                            : "Configure as credenciais de acesso à API de WhatsApp"}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <Link to="/superadmin/whatsapp">
                        {whatsappConfig?.is_active ? "Gerenciar" : "Configurar"}
                      </Link>
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-notify">Notificação Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar notificação automaticamente ao registrar ocorrência
                      </p>
                    </div>
                    <Switch id="auto-notify" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="read-confirm">Confirmação de Leitura</Label>
                      <p className="text-sm text-muted-foreground">
                        Exigir confirmação de leitura do morador
                      </p>
                    </div>
                    <Switch id="read-confirm" defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Change Password Card */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Altere sua senha de acesso à plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Digite a nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirme a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  className="w-full sm:w-auto"
                >
                  {isChangingPassword ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  {isChangingPassword ? "Alterando..." : "Alterar Senha"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Configurações de Segurança
                </CardTitle>
                <CardDescription>
                  Gerencie as políticas de segurança da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="2fa">Autenticação em Dois Fatores</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir 2FA para administradores
                    </p>
                  </div>
                  <Switch id="2fa" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="session-timeout">Timeout de Sessão</Label>
                    <p className="text-sm text-muted-foreground">
                      Encerrar sessões inativas automaticamente
                    </p>
                  </div>
                  <Switch id="session-timeout" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="audit-logs">Logs de Auditoria</Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar todas as ações administrativas
                    </p>
                  </div>
                  <Switch id="audit-logs" defaultChecked />
                </div>
              </CardContent>
            </Card>

            <RlsPoliciesCard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}