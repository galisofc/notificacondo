import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  FileText,
  Search,
  Crown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { isValidCNPJ } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  color: string;
  notifications_limit: number;
  warnings_limit: number;
  fines_limit: number;
}

interface Condominium {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  subscription?: {
    plan: string;
  } | null;
}

const Condominiums = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCondo, setEditingCondo] = useState<Condominium | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    plan_slug: "start",
  });
  const [saving, setSaving] = useState(false);
  const [fetchingCNPJ, setFetchingCNPJ] = useState(false);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchCondominiums = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("condominiums")
        .select(`
          *,
          subscription:subscriptions(plan)
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCondominiums(data || []);
    } catch (error) {
      console.error("Error fetching condominiums:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os condomínios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchCondominiums();
  }, [user]);

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    
    if (cleanCNPJ.length !== 14) return;
    
    if (!isValidCNPJ(cleanCNPJ)) {
      toast({
        title: "CNPJ inválido",
        description: "Por favor, verifique o número do CNPJ.",
        variant: "destructive",
      });
      return;
    }

    setFetchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        address: data.logradouro ? `${data.logradouro}, ${data.numero}${data.complemento ? ` - ${data.complemento}` : ""}` : prev.address,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        zip_code: data.cep ? data.cep.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2") : prev.zip_code,
      }));

      toast({
        title: "Dados encontrados",
        description: "Os dados do CNPJ foram preenchidos automaticamente.",
      });
    } catch (error) {
      console.error("Error fetching CNPJ:", error);
      toast({
        title: "Erro ao consultar CNPJ",
        description: "Não foi possível consultar os dados. Preencha manualmente.",
        variant: "destructive",
      });
    } finally {
      setFetchingCNPJ(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate CNPJ if provided
    if (formData.cnpj && formData.cnpj.replace(/\D/g, "").length > 0) {
      if (!isValidCNPJ(formData.cnpj)) {
        toast({ title: "Erro", description: "CNPJ inválido", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      if (editingCondo) {
        // Update condominium
        const { error } = await supabase
          .from("condominiums")
          .update({
            name: formData.name,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zip_code: formData.zip_code || null,
          })
          .eq("id", editingCondo.id);

        if (error) throw error;

        // Update subscription plan if changed
        const selectedPlan = plans.find((p) => p.slug === formData.plan_slug);
        if (selectedPlan) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              plan: formData.plan_slug as "start" | "essencial" | "profissional" | "enterprise",
              notifications_limit: selectedPlan.notifications_limit,
              warnings_limit: selectedPlan.warnings_limit,
              fines_limit: selectedPlan.fines_limit,
            })
            .eq("condominium_id", editingCondo.id);

          if (subError) throw subError;
        }

        toast({ title: "Sucesso", description: "Condomínio atualizado!" });
      } else {
        // Create condominium
        const { data: newCondo, error } = await supabase
          .from("condominiums")
          .insert({
            owner_id: user.id,
            name: formData.name,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zip_code: formData.zip_code || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Create subscription with selected plan
        const selectedPlan = plans.find((p) => p.slug === formData.plan_slug);
        if (selectedPlan && newCondo) {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { error: subError } = await supabase.from("subscriptions").insert({
            condominium_id: newCondo.id,
            plan: formData.plan_slug as "start" | "essencial" | "profissional" | "enterprise",
            active: true,
            notifications_limit: selectedPlan.notifications_limit,
            warnings_limit: selectedPlan.warnings_limit,
            fines_limit: selectedPlan.fines_limit,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });

          if (subError) throw subError;
        }

        toast({ title: "Sucesso", description: "Condomínio cadastrado!" });
      }

      setIsDialogOpen(false);
      setEditingCondo(null);
      setFormData({ name: "", cnpj: "", address: "", city: "", state: "", zip_code: "", plan_slug: "start" });
      fetchCondominiums();
    } catch (error: any) {
      console.error("Error saving condominium:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o condomínio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (condo: Condominium) => {
    setEditingCondo(condo);
    setFormData({
      name: condo.name,
      cnpj: condo.cnpj || "",
      address: condo.address || "",
      city: condo.city || "",
      state: condo.state || "",
      zip_code: condo.zip_code || "",
      plan_slug: condo.subscription?.plan || "start",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este condomínio? Todos os blocos, apartamentos e moradores serão excluídos.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("condominiums")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Condomínio excluído!" });
      fetchCondominiums();
    } catch (error: any) {
      console.error("Error deleting condominium:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o condomínio.",
        variant: "destructive",
      });
    }
  };

  const openNewDialog = () => {
    setEditingCondo(null);
    setFormData({ name: "", cnpj: "", address: "", city: "", state: "", zip_code: "", plan_slug: "start" });
    setIsDialogOpen(true);
  };

  const getPlanColor = (planSlug: string) => {
    const plan = plans.find((p) => p.slug === planSlug);
    return plan?.color || "bg-gray-500";
  };

  const getPlanName = (planSlug: string) => {
    const plan = plans.find((p) => p.slug === planSlug);
    return plan?.name || planSlug;
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Condomínios | CondoManager</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Condomínios
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie seus condomínios cadastrados
          </p>
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-4 md:mb-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={openNewDialog} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Novo Condomínio
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editingCondo ? "Editar Condomínio" : "Novo Condomínio"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <div className="flex gap-2">
                    <MaskedInput
                      id="cnpj"
                      mask="cnpj"
                      value={formData.cnpj}
                      onChange={(value) => setFormData({ ...formData, cnpj: value })}
                      className="bg-secondary/50 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchCNPJData(formData.cnpj)}
                      disabled={fetchingCNPJ || formData.cnpj.replace(/\D/g, "").length !== 14}
                      title="Buscar dados do CNPJ"
                    >
                      {fetchingCNPJ ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o CNPJ e clique na lupa para preencher automaticamente
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Condomínio *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="bg-secondary/50"
                      maxLength={2}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <MaskedInput
                    id="zip_code"
                    mask="cep"
                    value={formData.zip_code}
                    onChange={(value) => setFormData({ ...formData, zip_code: value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan">Plano *</Label>
                  <Select
                    value={formData.plan_slug}
                    onValueChange={(value) => setFormData({ ...formData, plan_slug: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.slug}>
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4" />
                            <span>{plan.name}</span>
                            <span className="text-muted-foreground">
                              - R$ {plan.price.toFixed(2)}/mês
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O plano define os limites de notificações, advertências e multas
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="hero" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : condominiums.length === 0 ? (
          <div className="text-center py-8 md:py-12 px-4 rounded-2xl bg-card border border-border shadow-card">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
              Nenhum condomínio cadastrado
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mb-6">
              Cadastre seu primeiro condomínio para começar.
            </p>
            <Button variant="hero" onClick={openNewDialog} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Condomínio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {condominiums.map((condo) => (
              <div
                key={condo.id}
                className="p-4 md:p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    {condo.subscription?.plan && (
                      <Badge className={`${getPlanColor(condo.subscription.plan)} text-white text-xs`}>
                        {getPlanName(condo.subscription.plan)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(condo)}
                      className="h-8 w-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(condo.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-display text-base md:text-lg font-semibold text-foreground mb-2">
                  {condo.name}
                </h3>
                
                {condo.address && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{condo.address}</span>
                  </div>
                )}
                
                {condo.city && (
                  <p className="text-xs md:text-sm text-muted-foreground mb-3">
                    {condo.city}{condo.state ? `, ${condo.state}` : ""}
                  </p>
                )}

                {condo.cnpj && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    <span>CNPJ: {condo.cnpj}</span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs md:text-sm"
                    onClick={() => navigate(`/condominiums/${condo.id}`)}
                  >
                    Gerenciar Blocos e Unidades
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Condominiums;
