import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building,
  Home,
  Users,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  User,
  Search,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface Block {
  id: string;
  name: string;
  description: string | null;
  floors: number;
}

interface Apartment {
  id: string;
  block_id: string;
  number: string;
  floor: number | null;
  monthly_fee: number | null;
}

interface Resident {
  id: string;
  apartment_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  is_owner: boolean;
  is_responsible: boolean;
}

const CondominiumDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [condominium, setCondominium] = useState<{ name: string } | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [blockDialog, setBlockDialog] = useState(false);
  const [apartmentDialog, setApartmentDialog] = useState(false);
  const [residentDialog, setResidentDialog] = useState(false);

  // Editing states
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  // Form data
  const [blockForm, setBlockForm] = useState({ name: "", description: "", floors: "1" });
  const [apartmentForm, setApartmentForm] = useState({
    block_id: "",
    number: "",
    floor: "",
    monthly_fee: "",
  });
  const [residentForm, setResidentForm] = useState({
    apartment_id: "",
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    is_owner: false,
    is_responsible: false,
  });

  const [saving, setSaving] = useState(false);

  // Filters - Apartments
  const [apartmentFilterBlock, setApartmentFilterBlock] = useState("");
  const [apartmentFilterNumber, setApartmentFilterNumber] = useState("");

  // Filters - Residents
  const [residentFilterSearch, setResidentFilterSearch] = useState("");
  const [residentFilterApartment, setResidentFilterApartment] = useState("");

  // Filtered apartments
  const filteredApartments = apartments.filter((apt) => {
    const matchesBlock = !apartmentFilterBlock || apt.block_id === apartmentFilterBlock;
    const matchesNumber = !apartmentFilterNumber || apt.number.toLowerCase().includes(apartmentFilterNumber.toLowerCase());
    return matchesBlock && matchesNumber;
  });

  // Filtered residents
  const filteredResidents = residents.filter((res) => {
    const matchesSearch = !residentFilterSearch || 
      res.full_name.toLowerCase().includes(residentFilterSearch.toLowerCase()) ||
      res.email.toLowerCase().includes(residentFilterSearch.toLowerCase());
    const matchesApartment = !residentFilterApartment || res.apartment_id === residentFilterApartment;
    return matchesSearch && matchesApartment;
  });

  const fetchData = async () => {
    if (!id || !user) return;

    try {
      // Fetch condominium
      const { data: condoData, error: condoError } = await supabase
        .from("condominiums")
        .select("name")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (condoError) throw condoError;
      if (!condoData) {
        toast({ title: "Erro", description: "Condomínio não encontrado.", variant: "destructive" });
        navigate("/condominiums");
        return;
      }
      setCondominium(condoData);

      // Fetch blocks
      const { data: blocksData } = await supabase
        .from("blocks")
        .select("*")
        .eq("condominium_id", id)
        .order("name");

      setBlocks(blocksData || []);

      // Fetch apartments
      const blockIds = blocksData?.map((b) => b.id) || [];
      if (blockIds.length > 0) {
        const { data: aptsData } = await supabase
          .from("apartments")
          .select("*")
          .in("block_id", blockIds)
          .order("number");

        setApartments(aptsData || []);

        // Fetch residents
        const aptIds = aptsData?.map((a) => a.id) || [];
        if (aptIds.length > 0) {
          const { data: residentsData } = await supabase
            .from("residents")
            .select("*")
            .in("apartment_id", aptIds)
            .order("full_name");

          setResidents(residentsData || []);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erro", description: "Erro ao carregar dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  // Block handlers
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    try {
      if (editingBlock) {
        const { error } = await supabase
          .from("blocks")
          .update({ 
            name: blockForm.name, 
            description: blockForm.description || null,
            floors: parseInt(blockForm.floors) || 1,
          })
          .eq("id", editingBlock.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Bloco atualizado!" });
      } else {
        const { error } = await supabase.from("blocks").insert({
          condominium_id: id,
          name: blockForm.name,
          description: blockForm.description || null,
          floors: parseInt(blockForm.floors) || 1,
        });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Bloco cadastrado!" });
      }
      setBlockDialog(false);
      setEditingBlock(null);
      setBlockForm({ name: "", description: "", floors: "1" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("Excluir este bloco e todos os apartamentos?")) return;
    try {
      const { error } = await supabase.from("blocks").delete().eq("id", blockId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Bloco excluído!" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Apartment handlers
  const handleApartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Check for duplicate apartment number in the same block
      const isDuplicate = apartments.some(
        (apt) =>
          apt.block_id === apartmentForm.block_id &&
          apt.number.toLowerCase() === apartmentForm.number.toLowerCase() &&
          apt.id !== editingApartment?.id
      );

      if (isDuplicate) {
        toast({
          title: "Erro",
          description: "Já existe um apartamento com este número neste bloco.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (editingApartment) {
        const { error } = await supabase
          .from("apartments")
          .update({
            block_id: apartmentForm.block_id,
            number: apartmentForm.number,
            floor: apartmentForm.floor ? parseInt(apartmentForm.floor) : null,
            monthly_fee: apartmentForm.monthly_fee ? parseFloat(apartmentForm.monthly_fee) : null,
          })
          .eq("id", editingApartment.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Apartamento atualizado!" });
      } else {
        const { error } = await supabase.from("apartments").insert({
          block_id: apartmentForm.block_id,
          number: apartmentForm.number,
          floor: apartmentForm.floor ? parseInt(apartmentForm.floor) : null,
          monthly_fee: apartmentForm.monthly_fee ? parseFloat(apartmentForm.monthly_fee) : null,
        });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Apartamento cadastrado!" });
      }
      setApartmentDialog(false);
      setEditingApartment(null);
      setApartmentForm({ block_id: "", number: "", floor: "", monthly_fee: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApartment = async (aptId: string) => {
    if (!confirm("Excluir este apartamento e todos os moradores?")) return;
    try {
      const { error } = await supabase.from("apartments").delete().eq("id", aptId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Apartamento excluído!" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Resident handlers
  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingResident) {
        const { error } = await supabase
          .from("residents")
          .update({
            apartment_id: residentForm.apartment_id,
            full_name: residentForm.full_name,
            email: residentForm.email,
            phone: residentForm.phone || null,
            cpf: residentForm.cpf || null,
            is_owner: residentForm.is_owner,
            is_responsible: residentForm.is_responsible,
          })
          .eq("id", editingResident.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Morador atualizado!" });
      } else {
        const { error } = await supabase.from("residents").insert({
          apartment_id: residentForm.apartment_id,
          full_name: residentForm.full_name,
          email: residentForm.email,
          phone: residentForm.phone || null,
          cpf: residentForm.cpf || null,
          is_owner: residentForm.is_owner,
          is_responsible: residentForm.is_responsible,
        });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Morador cadastrado!" });
      }
      setResidentDialog(false);
      setEditingResident(null);
      setResidentForm({
        apartment_id: "",
        full_name: "",
        email: "",
        phone: "",
        cpf: "",
        is_owner: false,
        is_responsible: false,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResident = async (residentId: string) => {
    if (!confirm("Excluir este morador?")) return;
    try {
      const { error } = await supabase.from("residents").delete().eq("id", residentId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Morador excluído!" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getBlockName = (blockId: string) => blocks.find((b) => b.id === blockId)?.name || "";
  const getApartmentInfo = (aptId: string) => {
    const apt = apartments.find((a) => a.id === aptId);
    if (!apt) return "";
    const block = blocks.find((b) => b.id === apt.block_id);
    return `${block?.name || ""} - Apto ${apt.number}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/condominiums")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {condominium?.name}
            </h1>
            <p className="text-muted-foreground">
              Gerencie blocos, apartamentos e moradores
            </p>
          </div>
        </div>

        <Tabs defaultValue="blocks" className="w-full">
          <TabsList className="mb-6 bg-secondary/50">
            <TabsTrigger value="blocks" className="gap-2">
              <Building className="w-4 h-4" />
              Blocos ({blocks.length})
            </TabsTrigger>
            <TabsTrigger value="apartments" className="gap-2">
              <Home className="w-4 h-4" />
              Apartamentos ({apartments.length})
            </TabsTrigger>
            <TabsTrigger value="residents" className="gap-2">
              <Users className="w-4 h-4" />
              Moradores ({residents.length})
            </TabsTrigger>
          </TabsList>

          {/* BLOCKS TAB */}
          <TabsContent value="blocks">
            <div className="flex justify-end mb-4">
              <Button
                variant="hero"
                onClick={() => {
                  setEditingBlock(null);
                  setBlockForm({ name: "", description: "", floors: "1" });
                  setBlockDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Bloco
              </Button>
            </div>

            {blocks.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gradient-card border border-border/50">
                <Building className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhum bloco cadastrado
                </h3>
                <p className="text-muted-foreground">
                  Cadastre blocos para organizar os apartamentos.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="p-4 rounded-xl bg-gradient-card border border-border/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{block.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {apartments.filter((a) => a.block_id === block.id).length} apartamentos
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingBlock(block);
                            setBlockForm({ name: block.name, description: block.description || "", floors: String(block.floors || 1) });
                            setBlockDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* APARTMENTS TAB */}
          <TabsContent value="apartments">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número do apartamento..."
                      value={apartmentFilterNumber}
                      onChange={(e) => setApartmentFilterNumber(e.target.value)}
                      className="pl-10 bg-secondary/50"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <select
                    value={apartmentFilterBlock}
                    onChange={(e) => setApartmentFilterBlock(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary/50 border border-border text-foreground"
                  >
                    <option value="">Todos os blocos</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                variant="hero"
                onClick={() => {
                  if (blocks.length === 0) {
                    toast({ title: "Atenção", description: "Cadastre um bloco primeiro.", variant: "destructive" });
                    return;
                  }
                  setEditingApartment(null);
                  setApartmentForm({ block_id: blocks[0].id, number: "", floor: "", monthly_fee: "" });
                  setApartmentDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Apartamento
              </Button>
            </div>

            {/* Results counter */}
            {apartments.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{filteredApartments.length}</span> de <span className="font-medium text-foreground">{apartments.length}</span> apartamentos
                </p>
                {(apartmentFilterBlock || apartmentFilterNumber) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setApartmentFilterBlock("");
                      setApartmentFilterNumber("");
                    }}
                    className="text-xs"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}

            {apartments.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gradient-card border border-border/50">
                <Home className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhum apartamento cadastrado
                </h3>
                <p className="text-muted-foreground">
                  Cadastre apartamentos nos blocos.
                </p>
              </div>
            ) : filteredApartments.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gradient-card border border-border/50">
                <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-muted-foreground">
                  Ajuste os filtros para ver os apartamentos.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredApartments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-xl bg-gradient-card border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Home className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingApartment(apt);
                            setApartmentForm({
                              block_id: apt.block_id,
                              number: apt.number,
                              floor: apt.floor?.toString() || "",
                              monthly_fee: apt.monthly_fee?.toString() || "",
                            });
                            setApartmentDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteApartment(apt.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <h4 className="font-semibold text-foreground">Apto {apt.number}</h4>
                    <p className="text-sm text-muted-foreground">{getBlockName(apt.block_id)}</p>
                    {apt.floor !== null && (
                      <p className="text-xs text-muted-foreground">
                        {apt.floor === 0 ? "Térreo" : `${apt.floor}º Andar`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {residents.filter((r) => r.apartment_id === apt.id).length} moradores
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* RESIDENTS TAB */}
          <TabsContent value="residents">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={residentFilterSearch}
                      onChange={(e) => setResidentFilterSearch(e.target.value)}
                      className="pl-10 bg-secondary/50"
                    />
                  </div>
                </div>
                <div className="w-56">
                  <select
                    value={residentFilterApartment}
                    onChange={(e) => setResidentFilterApartment(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary/50 border border-border text-foreground"
                  >
                    <option value="">Todos os apartamentos</option>
                    {apartments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {getBlockName(apt.block_id)} - Apto {apt.number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                variant="hero"
                onClick={() => {
                  if (apartments.length === 0) {
                    toast({ title: "Atenção", description: "Cadastre um apartamento primeiro.", variant: "destructive" });
                    return;
                  }
                  setEditingResident(null);
                  setResidentForm({
                    apartment_id: apartments[0].id,
                    full_name: "",
                    email: "",
                    phone: "",
                    cpf: "",
                    is_owner: false,
                    is_responsible: false,
                  });
                  setResidentDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Morador
              </Button>
            </div>

            {/* Results counter */}
            {residents.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{filteredResidents.length}</span> de <span className="font-medium text-foreground">{residents.length}</span> moradores
                </p>
                {(residentFilterSearch || residentFilterApartment) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResidentFilterSearch("");
                      setResidentFilterApartment("");
                    }}
                    className="text-xs"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}

            {residents.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gradient-card border border-border/50">
                <Users className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhum morador cadastrado
                </h3>
                <p className="text-muted-foreground">
                  Cadastre moradores nos apartamentos.
                </p>
              </div>
            ) : filteredResidents.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-gradient-card border border-border/50">
                <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-muted-foreground">
                  Ajuste os filtros para ver os moradores.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResidents.map((resident) => (
                  <div
                    key={resident.id}
                    className="p-4 rounded-xl bg-gradient-card border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingResident(resident);
                            setResidentForm({
                              apartment_id: resident.apartment_id,
                              full_name: resident.full_name,
                              email: resident.email,
                              phone: resident.phone || "",
                              cpf: resident.cpf || "",
                              is_owner: resident.is_owner,
                              is_responsible: resident.is_responsible,
                            });
                            setResidentDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteResident(resident.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <h4 className="font-semibold text-foreground">{resident.full_name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {getApartmentInfo(resident.apartment_id)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{resident.email}</span>
                    </div>
                    {resident.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{resident.phone}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {resident.is_owner && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          Proprietário
                        </span>
                      )}
                      {resident.is_responsible && (
                        <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
                          Responsável
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        {/* Block Dialog */}
        <Dialog open={blockDialog} onOpenChange={setBlockDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingBlock ? "Editar Bloco" : "Novo Bloco"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBlockSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blockName">Nome *</Label>
                <Input
                  id="blockName"
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  required
                  className="bg-secondary/50"
                  placeholder="Ex: Bloco A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blockDesc">Descrição</Label>
                <Input
                  id="blockDesc"
                  value={blockForm.description}
                  onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blockFloors">Quantidade de Pavimentos (incluindo Térreo) *</Label>
                <Input
                  id="blockFloors"
                  type="number"
                  min="1"
                  value={blockForm.floors}
                  onChange={(e) => setBlockForm({ ...blockForm, floors: e.target.value })}
                  required
                  className="bg-secondary/50"
                  placeholder="Ex: 10"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setBlockDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="hero" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Apartment Dialog */}
        <Dialog open={apartmentDialog} onOpenChange={setApartmentDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingApartment ? "Editar Apartamento" : "Novo Apartamento"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleApartmentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Bloco *</Label>
                <select
                  value={apartmentForm.block_id}
                  onChange={(e) => setApartmentForm({ ...apartmentForm, block_id: e.target.value, floor: "" })}
                  required
                  className="w-full h-10 px-3 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  <option value="">Selecione um bloco...</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.floors} andares)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aptNumber">Número *</Label>
                  <Input
                    id="aptNumber"
                    value={apartmentForm.number}
                    onChange={(e) => setApartmentForm({ ...apartmentForm, number: e.target.value })}
                    required
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aptFloor">Andar</Label>
                  <select
                    id="aptFloor"
                    value={apartmentForm.floor}
                    onChange={(e) => setApartmentForm({ ...apartmentForm, floor: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-secondary/50 border border-border text-foreground"
                  >
                    <option value="">Selecione...</option>
                    <option value="0">Térreo</option>
                    {apartmentForm.block_id && (() => {
                      const selectedBlock = blocks.find(b => b.id === apartmentForm.block_id);
                      const floorsCount = selectedBlock?.floors || 1;
                      // floors = total de pavimentos (inclui térreo), então andares = floors - 1
                      return Array.from({ length: floorsCount - 1 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>{i + 1}º Andar</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aptFee">Taxa Condominial (R$)</Label>
                <Input
                  id="aptFee"
                  type="number"
                  step="0.01"
                  value={apartmentForm.monthly_fee}
                  onChange={(e) => setApartmentForm({ ...apartmentForm, monthly_fee: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setApartmentDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="hero" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Resident Dialog */}
        <Dialog open={residentDialog} onOpenChange={setResidentDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingResident ? "Editar Morador" : "Novo Morador"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResidentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Apartamento *</Label>
                <select
                  value={residentForm.apartment_id}
                  onChange={(e) => setResidentForm({ ...residentForm, apartment_id: e.target.value })}
                  required
                  className="w-full h-10 px-3 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getBlockName(a.block_id)} - Apto {a.number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resName">Nome Completo *</Label>
                <Input
                  id="resName"
                  value={residentForm.full_name}
                  onChange={(e) => setResidentForm({ ...residentForm, full_name: e.target.value })}
                  required
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resEmail">Email *</Label>
                <Input
                  id="resEmail"
                  type="email"
                  value={residentForm.email}
                  onChange={(e) => setResidentForm({ ...residentForm, email: e.target.value })}
                  required
                  className="bg-secondary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resPhone">Telefone</Label>
                  <MaskedInput
                    id="resPhone"
                    mask="phone"
                    value={residentForm.phone}
                    onChange={(value) => setResidentForm({ ...residentForm, phone: value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resCpf">CPF</Label>
                  <MaskedInput
                    id="resCpf"
                    mask="cpf"
                    value={residentForm.cpf}
                    onChange={(value) => setResidentForm({ ...residentForm, cpf: value })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={residentForm.is_owner}
                    onChange={(e) => setResidentForm({ ...residentForm, is_owner: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Proprietário</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={residentForm.is_responsible}
                    onChange={(e) => setResidentForm({ ...residentForm, is_responsible: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Responsável</span>
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setResidentDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="hero" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default CondominiumDetails;
