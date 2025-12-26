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
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  FileText,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { isValidCNPJ } from "@/lib/utils";

interface Condominium {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
}

const Condominiums = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
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
  });
  const [saving, setSaving] = useState(false);
  const [fetchingCNPJ, setFetchingCNPJ] = useState(false);

  const fetchCondominiums = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("condominiums")
        .select("*")
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
        toast({ title: "Sucesso", description: "Condomínio atualizado!" });
      } else {
        const { error } = await supabase.from("condominiums").insert({
          owner_id: user.id,
          name: formData.name,
          cnpj: formData.cnpj || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zip_code || null,
        });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Condomínio cadastrado!" });
      }

      setIsDialogOpen(false);
      setEditingCondo(null);
      setFormData({ name: "", cnpj: "", address: "", city: "", state: "", zip_code: "" });
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
    setFormData({ name: "", cnpj: "", address: "", city: "", state: "", zip_code: "" });
    setIsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Condomínios | CondoManager</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Condomínios
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus condomínios cadastrados
          </p>
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={openNewDialog}>
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
          <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Nenhum condomínio cadastrado
            </h3>
            <p className="text-muted-foreground mb-6">
              Cadastre seu primeiro condomínio para começar.
            </p>
            <Button variant="hero" onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Condomínio
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {condominiums.map((condo) => (
              <div
                key={condo.id}
                className="p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(condo)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(condo.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {condo.name}
                </h3>
                
                {condo.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    <span>{condo.address}</span>
                  </div>
                )}
                
                {condo.city && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {condo.city}{condo.state ? `, ${condo.state}` : ""}
                  </p>
                )}

                {condo.cnpj && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    <span>CNPJ: {condo.cnpj}</span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
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
