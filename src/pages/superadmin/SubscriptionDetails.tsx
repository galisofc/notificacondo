import { useState } from "react";
import { formatPhone, formatCPF, MaskedInput } from "@/components/ui/masked-input";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isValidCPF } from "@/lib/utils";

type PlanType = "start" | "essencial" | "profissional" | "enterprise";

const PLAN_LIMITS: Record<PlanType, { notifications: number; warnings: number; fines: number }> = {
  start: { notifications: 10, warnings: 10, fines: 0 },
  essencial: { notifications: 50, warnings: 50, fines: 25 },
  profissional: { notifications: 200, warnings: 200, fines: 100 },
  enterprise: { notifications: 999999, warnings: 999999, fines: 999999 },
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

  const [isEditing, setIsEditing] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferCpf, setTransferCpf] = useState("");
  const [foundSindico, setFoundSindico] = useState<{
    user_id: string;
    full_name: string;
    email: string;
    cpf: string;
  } | null>(null);
  const [isSearchingSindico, setIsSearchingSindico] = useState(false);
  const [editedData, setEditedData] = useState<{
    plan: PlanType;
    active: boolean;
    notifications_limit: number;
    warnings_limit: number;
    fines_limit: number;
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

      return {
        subscription,
        condominium,
        owner: ownerProfile,
        invoices: invoices || [],
      };
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updateData: typeof editedData) => {
      if (!id || !updateData) throw new Error("Dados inválidos");

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: updateData.plan,
          active: updateData.active,
          notifications_limit: updateData.notifications_limit,
          warnings_limit: updateData.warnings_limit,
          fines_limit: updateData.fines_limit,
        })
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

  const transferCondominiumMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!data?.condominium?.id) throw new Error("Condomínio não encontrado");

      const { error } = await supabase
        .from("condominiums")
        .update({ owner_id: newOwnerId })
        .eq("id", data.condominium.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-details", id] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      setIsTransferDialogOpen(false);
      setTransferCpf("");
      setFoundSindico(null);
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
      transferCondominiumMutation.mutate(foundSindico.user_id);
    }
  };

  const handleOpenTransferDialog = () => {
    setTransferCpf("");
    setFoundSindico(null);
    setIsTransferDialogOpen(true);
  };

  const handleStartEditing = () => {
    if (data?.subscription) {
      setEditedData({
        plan: data.subscription.plan as PlanType,
        active: data.subscription.active,
        notifications_limit: data.subscription.notifications_limit,
        warnings_limit: data.subscription.warnings_limit,
        fines_limit: data.subscription.fines_limit,
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

  const { subscription, condominium, owner, invoices = [] } = data;
  const planInfo = PLAN_INFO[subscription.plan as PlanType];

  const getInvoiceStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status === "pending";
    
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

      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {condominium.name}
              </h1>
              <p className="text-muted-foreground">
                {condominium.address && `${condominium.address}, `}
                {condominium.city} - {condominium.state}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </>
            ) : (
              <Button onClick={handleStartEditing}>Editar Assinatura</Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Plan Card */}
          <Card className="lg:col-span-2 bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Plano de Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing && editedData ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Plano</Label>
                      <Select
                        value={editedData.plan}
                        onValueChange={(v) => handlePlanChange(v as PlanType)}
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
                        />
                        <span className="text-sm text-muted-foreground">
                          {editedData.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Limite de Notificações</Label>
                      <Input
                        type="number"
                        value={editedData.notifications_limit}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            notifications_limit: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Advertências</Label>
                      <Input
                        type="number"
                        value={editedData.warnings_limit}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            warnings_limit: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Multas</Label>
                      <Input
                        type="number"
                        value={editedData.fines_limit}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            fines_limit: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-6">
                  <div
                    className={`w-16 h-16 rounded-2xl ${planInfo.color} flex items-center justify-center shrink-0`}
                  >
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        {planInfo.name}
                      </h3>
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
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-4 h-4" />
                        {subscription.notifications_limit} notificações/mês
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        {subscription.warnings_limit} advertências/mês
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" />
                        {subscription.fines_limit} multas/mês
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {subscription.current_period_end && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Período: {" "}
                        {subscription.current_period_start &&
                          format(new Date(subscription.current_period_start), "dd/MM/yyyy", { locale: ptBR })}
                        {" - "}
                        {format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetUsageMutation.mutate()}
                      disabled={resetUsageMutation.isPending}
                    >
                      {resetUsageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Reiniciar Período
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Owner Card */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4 text-primary" />
                  Síndico Responsável
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTransferDialog}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transferir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{owner?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{owner?.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{owner?.phone ? formatPhone(owner.phone) : "—"}</p>
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
          <CardHeader>
            <CardTitle>Uso do Período Atual</CardTitle>
            <CardDescription>
              Acompanhe o consumo de recursos neste período de assinatura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Notifications */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">Notificações</span>
                  </div>
                  <span
                    className={`text-sm font-medium ${getUsageColor(
                      getUsagePercentage(subscription.notifications_used, subscription.notifications_limit)
                    )}`}
                  >
                    {subscription.notifications_used} / {subscription.notifications_limit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.notifications_used, subscription.notifications_limit)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {subscription.notifications_limit - subscription.notifications_used} restantes
                </p>
              </div>

              {/* Warnings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">Advertências</span>
                  </div>
                  <span
                    className={`text-sm font-medium ${getUsageColor(
                      getUsagePercentage(subscription.warnings_used, subscription.warnings_limit)
                    )}`}
                  >
                    {subscription.warnings_used} / {subscription.warnings_limit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.warnings_used, subscription.warnings_limit)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {subscription.warnings_limit - subscription.warnings_used} restantes
                </p>
              </div>

              {/* Fines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-red-500" />
                    <span className="font-medium">Multas</span>
                  </div>
                  <span
                    className={`text-sm font-medium ${getUsageColor(
                      getUsagePercentage(subscription.fines_used, subscription.fines_limit)
                    )}`}
                  >
                    {subscription.fines_used} / {subscription.fines_limit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(subscription.fines_used, subscription.fines_limit)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {subscription.fines_limit - subscription.fines_used} restantes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Faturas do Condomínio
                </CardTitle>
                <CardDescription>
                  Histórico das últimas faturas geradas
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/superadmin/invoices")}
              >
                Ver Todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                          {format(new Date(invoice.period_start), "dd/MM/yy", { locale: ptBR })}
                          {" - "}
                          {format(new Date(invoice.period_end), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          {getInvoiceStatusBadge(invoice.status, invoice.due_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.paid_at 
                            ? format(new Date(invoice.paid_at), "dd/MM/yyyy", { locale: ptBR })
                            : "—"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Informações da Assinatura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">ID da Assinatura</p>
                <p className="font-mono text-xs">{subscription.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="font-medium">
                  {format(new Date(subscription.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última atualização</p>
                <p className="font-medium">
                  {format(new Date(subscription.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
