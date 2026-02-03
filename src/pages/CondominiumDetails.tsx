import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput, formatPhone, formatCPF } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
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
  ChevronRight,
  MoreVertical,
  MapPin,
  FileSpreadsheet,
  Wand2,
  UsersRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { isValidCPF, formatCNPJ, formatCEP } from "@/lib/utils";
import { cn } from "@/lib/utils";
import ResidentCSVImportDialog from "@/components/condominium/ResidentCSVImportDialog";
import { BulkBlocksApartmentsWizard } from "@/components/condominium/BulkBlocksApartmentsWizard";
import BulkResidentCSVImportDialog from "@/components/condominium/BulkResidentCSVImportDialog";
import { QuickBlockApartmentSearch } from "@/components/packages/QuickBlockApartmentSearch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface Condominium {
  id: string;
  name: string;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  zip_code: string | null;
}

interface Block {
  id: string;
  name: string;
  description: string | null;
  floors: number;
  short_code: string | null;
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

  const [condominium, setCondominium] = useState<Condominium | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>("all");
  const [selectedApartmentFilter, setSelectedApartmentFilter] = useState<string>("all");
  const [highlightedApartmentId, setHighlightedApartmentId] = useState<string | null>(null);

  // Expanded blocks
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // Dialogs
  const [blockDialog, setBlockDialog] = useState(false);
  const [apartmentDialog, setApartmentDialog] = useState(false);
  const [residentDialog, setResidentDialog] = useState(false);
  const [csvImportDialog, setCsvImportDialog] = useState(false);
  const [bulkWizardDialog, setBulkWizardDialog] = useState(false);
  const [bulkResidentImportDialog, setBulkResidentImportDialog] = useState(false);
  const [csvImportApartment, setCsvImportApartment] = useState<{ id: string; number: string; blockName: string } | null>(null);

  // Editing states
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  // Pre-selected block for new apartment
  const [selectedBlockForApartment, setSelectedBlockForApartment] = useState<string>("");

  // Form data
  const [blockForm, setBlockForm] = useState({ name: "", description: "", floors: "1", short_code: "" });
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

  // Build full address
  const fullAddress = useMemo(() => {
    if (!condominium) return "";
    const parts = [
      condominium.address,
      condominium.address_number,
      condominium.neighborhood,
      condominium.city,
      condominium.state,
    ].filter(Boolean);
    return parts.join(", ");
  }, [condominium]);

  // Quick search logic: BBAA format (2 digits block, 2 digits apartment)
  const parseQuickSearch = (query: string) => {
    const digits = query.replace(/\D/g, "");
    if (digits.length === 4) {
      return {
        blockNumber: digits.substring(0, 2),
        aptNumber: digits.substring(2, 4),
      };
    }
    return null;
  };

  // Get unique blocks for filter dropdown
  const blocksForFilter = useMemo(() => {
    return [...blocks]
      .sort((a, b) => {
        const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
        return numA - numB;
      })
      .map(b => ({ id: b.id, name: b.name }));
  }, [blocks]);

  // Get apartments for selected block filter
  const apartmentsForFilter = useMemo(() => {
    if (selectedBlockFilter === "all") return [];
    const blockApts = apartments.filter(a => a.block_id === selectedBlockFilter);
    return blockApts
      .sort((a, b) => {
        const numA = parseInt(a.number.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.number.replace(/\D/g, "")) || 0;
        return numA - numB;
      })
      .map(a => ({ id: a.id, number: a.number }));
  }, [apartments, selectedBlockFilter]);

  // Filter blocks and apartments based on search and filters
  const filteredBlocks = useMemo(() => {
    // First, sort blocks numerically
    let sortedBlocks = [...blocks].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    // Apply block filter
    if (selectedBlockFilter !== "all") {
      sortedBlocks = sortedBlocks.filter(block => block.id === selectedBlockFilter);
    }

    // Apply apartment filter (needs to filter apartments within blocks)
    if (selectedApartmentFilter !== "all") {
      // When filtering by apartment, we still show the block but only matching apartments
      // This is handled in getFilteredApartments
    }

    if (!searchQuery.trim() && selectedBlockFilter === "all") return sortedBlocks;

    const query = searchQuery.toLowerCase().trim();
    const quickSearch = parseQuickSearch(searchQuery);

    if (!query) return sortedBlocks;

    return sortedBlocks.filter((block) => {
      // Match block name
      if (block.name.toLowerCase().includes(query)) return true;

      // Quick search: extract block number from name (e.g., "Bloco 3" -> "03")
      if (quickSearch) {
        const blockNumberMatch = block.name.match(/\d+/);
        if (blockNumberMatch) {
          const blockNum = blockNumberMatch[0].padStart(2, "0");
          if (blockNum === quickSearch.blockNumber) {
            // Check if any apartment in this block matches
            const blockApts = apartments.filter((a) => a.block_id === block.id);
            return blockApts.some((apt) => {
              const aptNum = apt.number.padStart(2, "0");
              return aptNum === quickSearch.aptNumber || apt.number.includes(quickSearch.aptNumber);
            });
          }
        }
      }

      // Check if any apartment in this block matches the search
      const blockApts = apartments.filter((a) => a.block_id === block.id);
      return blockApts.some((apt) => apt.number.toLowerCase().includes(query));
    });
  }, [blocks, apartments, searchQuery, selectedBlockFilter, selectedApartmentFilter]);

  // Get apartments for a block, filtered by search and filters
  const getFilteredApartments = (blockId: string) => {
    let blockApts = apartments.filter((a) => a.block_id === blockId);
    
    // Apply apartment filter
    if (selectedApartmentFilter !== "all") {
      blockApts = blockApts.filter(apt => apt.id === selectedApartmentFilter);
    }
    
    if (!searchQuery.trim()) {
      return blockApts.sort((a, b) => {
        const numA = parseInt(a.number.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.number.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
    }

    const query = searchQuery.toLowerCase().trim();
    const quickSearch = parseQuickSearch(searchQuery);

    if (quickSearch) {
      return blockApts.filter((apt) => {
        const aptNum = apt.number.padStart(2, "0");
        return aptNum === quickSearch.aptNumber || apt.number.includes(quickSearch.aptNumber);
      });
    }

    return blockApts.filter((apt) => apt.number.toLowerCase().includes(query));
  };

  const fetchData = async () => {
    if (!id || !user) return;

    try {
      // Fetch condominium with full data
      const { data: condoData, error: condoError } = await supabase
        .from("condominiums")
        .select("id, name, address, address_number, neighborhood, city, state, cnpj, zip_code")
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

  // Toggle block expansion
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  // Block handlers
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    // Validate short_code format (1-3 uppercase letters/numbers)
    const shortCode = blockForm.short_code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

    setSaving(true);
    try {
      if (editingBlock) {
        const { error } = await supabase
          .from("blocks")
          .update({ 
            name: blockForm.name.toUpperCase(), 
            description: blockForm.description || null,
            floors: parseInt(blockForm.floors) || 1,
            short_code: shortCode || null,
          })
          .eq("id", editingBlock.id);
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Erro", description: "Código curto já está em uso por outro bloco.", variant: "destructive" });
          } else {
            throw error;
          }
          setSaving(false);
          return;
        }
        toast({ title: "Sucesso", description: "Bloco atualizado!" });
      } else {
        const { error } = await supabase.from("blocks").insert({
          condominium_id: id,
          name: blockForm.name.toUpperCase(),
          description: blockForm.description || null,
          floors: parseInt(blockForm.floors) || 1,
          short_code: shortCode || null,
        });
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Erro", description: "Código curto já está em uso por outro bloco.", variant: "destructive" });
          } else {
            throw error;
          }
          setSaving(false);
          return;
        }
        toast({ title: "Sucesso", description: "Bloco cadastrado!" });
      }
      setBlockDialog(false);
      setEditingBlock(null);
      setBlockForm({ name: "", description: "", floors: "1", short_code: "" });
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
  const openNewApartmentDialog = (blockId: string) => {
    setEditingApartment(null);
    setApartmentForm({ block_id: blockId, number: "", floor: "", monthly_fee: "" });
    setApartmentDialog(true);
  };

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
            number: apartmentForm.number.toUpperCase(),
            floor: apartmentForm.floor ? parseInt(apartmentForm.floor) : null,
            monthly_fee: apartmentForm.monthly_fee ? parseFloat(apartmentForm.monthly_fee) : null,
          })
          .eq("id", editingApartment.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Apartamento atualizado!" });
      } else {
        const { error } = await supabase.from("apartments").insert({
          block_id: apartmentForm.block_id,
          number: apartmentForm.number.toUpperCase(),
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
  const openNewResidentDialog = (apartmentId: string) => {
    setEditingResident(null);
    setResidentForm({
      apartment_id: apartmentId,
      full_name: "",
      email: "",
      phone: "",
      cpf: "",
      is_owner: false,
      is_responsible: false,
    });
    setResidentDialog(true);
  };

  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate CPF if provided
    if (residentForm.cpf && residentForm.cpf.replace(/\D/g, "").length > 0) {
      if (!isValidCPF(residentForm.cpf)) {
        toast({ title: "Erro", description: "CPF inválido", variant: "destructive" });
        return;
      }
    }
    
    setSaving(true);
    try {
      if (editingResident) {
        const { error } = await supabase
          .from("residents")
          .update({
            apartment_id: residentForm.apartment_id,
            full_name: residentForm.full_name.toUpperCase(),
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
          full_name: residentForm.full_name.toUpperCase(),
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
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <button
          onClick={() => navigate("/condominiums")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Condomínios
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl md:text-2xl font-bold text-foreground uppercase tracking-tight">
                {condominium?.name}
              </h1>
              {fullAddress && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="uppercase">{fullAddress}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setBulkResidentImportDialog(true)}
              className="gap-2"
              disabled={blocks.length === 0 || apartments.length === 0}
              title={blocks.length === 0 || apartments.length === 0 ? "Cadastre blocos e apartamentos primeiro" : "Importar moradores via CSV"}
            >
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Importar Moradores</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkWizardDialog(true)}
              className="gap-2"
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastro Rápido</span>
            </Button>
            <Button
              variant="hero"
            onClick={() => {
                setEditingBlock(null);
                setBlockForm({ name: "", description: "", floors: "1", short_code: "" });
                setBlockDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Bloco
            </Button>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
            <Building2 className="w-3.5 h-3.5" />
            {blocks.length} bloco(s)
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
            <Home className="w-3.5 h-3.5" />
            {apartments.length} apartamento(s)
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
            <Users className="w-3.5 h-3.5" />
            {residents.length} morador(es)
          </Badge>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3 flex-wrap p-4 rounded-lg border bg-card">
          {/* Quick Search */}
          {id && (
            <QuickBlockApartmentSearch
              condominiumId={id}
              onBlockFound={(blockId) => {
                setSelectedBlockFilter(blockId);
                setSelectedApartmentFilter("all");
                setExpandedBlocks((prev) => new Set(prev).add(blockId));
              }}
              onApartmentFound={(apartmentId) => {
                setSelectedApartmentFilter(apartmentId);
                setHighlightedApartmentId(apartmentId);
                // Find and expand the block containing this apartment
                const apt = apartments.find(a => a.id === apartmentId);
                if (apt) {
                  setSelectedBlockFilter(apt.block_id);
                  setExpandedBlocks((prev) => new Set(prev).add(apt.block_id));
                }
                setTimeout(() => {
                  const element = document.querySelector(`[data-apartment-id="${apartmentId}"]`);
                  element?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 200);
                setTimeout(() => {
                  setHighlightedApartmentId(null);
                }, 5000);
              }}
              className="w-full md:w-[200px]"
              placeholder="Ex: 0344, ARM101"
            />
          )}

          {/* Block Filter */}
          <Select
            value={selectedBlockFilter}
            onValueChange={(v) => {
              setSelectedBlockFilter(v);
              setSelectedApartmentFilter("all");
            }}
          >
            <SelectTrigger className="w-full md:w-[160px]">
              <Building2 className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Bloco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os blocos</SelectItem>
              {blocksForFilter.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Apartment Filter */}
          <Select
            value={selectedApartmentFilter}
            onValueChange={setSelectedApartmentFilter}
            disabled={selectedBlockFilter === "all"}
          >
            <SelectTrigger className="w-full md:w-[140px]">
              <Home className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Apto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {apartmentsForFilter.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Text Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Clear Filters Button */}
          {(selectedBlockFilter !== "all" || selectedApartmentFilter !== "all" || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedBlockFilter("all");
                setSelectedApartmentFilter("all");
                setSearchQuery("");
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Blocks List */}
        <div className="space-y-3">
          {blocks.length === 0 ? (
            <div className="text-center py-16 rounded-xl bg-card border border-border">
              <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                Nenhum bloco cadastrado
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Cadastre blocos e apartamentos para organizar seu condomínio. Use o cadastro rápido para criar vários de uma só vez.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="hero"
                  onClick={() => setBulkWizardDialog(true)}
                  className="gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  Cadastro Rápido
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingBlock(null);
                    setBlockForm({ name: "", description: "", floors: "1", short_code: "" });
                    setBlockDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Bloco Individual
                </Button>
              </div>
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="text-center py-12 rounded-xl bg-card border border-border">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-muted-foreground">
                Tente outra busca ou limpe o filtro.
              </p>
            </div>
          ) : (
            filteredBlocks.map((block) => {
              const blockApartments = getFilteredApartments(block.id);
              const allBlockApartments = apartments.filter((a) => a.block_id === block.id);
              const isExpanded = expandedBlocks.has(block.id);

              return (
                <Collapsible key={block.id} open={isExpanded} onOpenChange={() => toggleBlock(block.id)}>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Block Header */}
                    <div className="flex items-center justify-between p-4">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-3 flex-1 text-left">
                          <ChevronRight
                            className={cn(
                              "w-5 h-5 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-90"
                            )}
                          />
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{block.name.toUpperCase()}</h4>
                            {block.short_code && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {block.short_code}
                                      </Badge>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-50">
                                    <p>Código curto para busca rápida</p>
                                    <p className="text-xs text-muted-foreground">Ex: {block.short_code}44 = {block.name}, Apt 44</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {allBlockApartments.length} apartamento(s)
                          </p>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openNewApartmentDialog(block.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Apto
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingBlock(block);
                                setBlockForm({
                                  name: block.name,
                                  description: block.description || "",
                                  floors: String(block.floors || 1),
                                  short_code: block.short_code || "",
                                });
                                setBlockDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar Bloco
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteBlock(block.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir Bloco
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Apartments List (Collapsible) */}
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        {blockApartments.length === 0 ? (
                          <div className="p-6 text-center text-muted-foreground">
                            {searchQuery ? "Nenhum apartamento encontrado" : "Nenhum apartamento neste bloco"}
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {blockApartments.map((apt) => {
                              const aptResidents = residents.filter((r) => r.apartment_id === apt.id);
                              const isHighlighted = highlightedApartmentId === apt.id;
                              return (
                                <div 
                                  key={apt.id} 
                                  data-apartment-id={apt.id}
                                  className={cn(
                                    "p-4 transition-all duration-300",
                                    isHighlighted 
                                      ? "bg-primary/20 ring-2 ring-primary ring-inset" 
                                      : "hover:bg-secondary/30"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                                        <Home className="w-4 h-4 text-accent" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-foreground">
                                            Apto {apt.number}
                                          </span>
                                          {apt.floor !== null && (
                                            <span className="text-xs text-muted-foreground">
                                              ({apt.floor === 0 ? "Térreo" : `${apt.floor}º andar`})
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {aptResidents.length} morador(es)
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openNewResidentDialog(apt.id)}
                                      >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Morador
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
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
                                            <Edit className="w-4 h-4 mr-2" />
                                            Editar Apartamento
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              const blockName = blocks.find(b => b.id === apt.block_id)?.name || "";
                                              setCsvImportApartment({ id: apt.id, number: apt.number, blockName });
                                              setCsvImportDialog(true);
                                            }}
                                          >
                                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                                            Importar Moradores (CSV)
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteApartment(apt.id)}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Excluir Apartamento
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  {/* Residents under apartment */}
                                  {aptResidents.length > 0 && (
                                    <div className="mt-3 ml-12 space-y-2">
                                      {aptResidents.map((resident) => (
                                        <div
                                          key={resident.id}
                                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                              <User className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                              <p className="font-medium text-sm text-foreground">
                                                {resident.full_name}
                                              </p>
                                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {resident.email && (
                                                  <span className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {resident.email}
                                                  </span>
                                                )}
                                                {resident.phone && (
                                                  <span className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    {formatPhone(resident.phone)}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex gap-1 mt-1">
                                                {resident.is_owner && (
                                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                                                    Proprietário
                                                  </span>
                                                )}
                                                {resident.is_responsible && (
                                                  <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px]">
                                                    Responsável
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreVertical className="w-3 h-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem
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
                                                <Edit className="w-4 h-4 mr-2" />
                                                Editar Morador
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleDeleteResident(resident.id)}
                                                className="text-destructive focus:text-destructive"
                                              >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir Morador
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>

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
              <div className="space-y-2">
                <Label htmlFor="blockShortCode">Código Curto (para busca rápida)</Label>
                <Input
                  id="blockShortCode"
                  value={blockForm.short_code}
                  onChange={(e) => setBlockForm({ ...blockForm, short_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) })}
                  className="bg-secondary/50"
                  placeholder="Ex: AR, VI, BL1"
                  maxLength={3}
                />
                <p className="text-xs text-muted-foreground">
                  1 a 3 caracteres para identificar o bloco na busca rápida (ex: AR=ARMANDO, VI=VILELA)
                </p>
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

        {/* CSV Import Dialog */}
        {csvImportApartment && (
          <ResidentCSVImportDialog
            open={csvImportDialog}
            onOpenChange={(open) => {
              setCsvImportDialog(open);
              if (!open) setCsvImportApartment(null);
            }}
            apartmentId={csvImportApartment.id}
            apartmentNumber={csvImportApartment.number}
            blockName={csvImportApartment.blockName}
            onSuccess={fetchData}
          />
        )}

        {/* Bulk Blocks & Apartments Wizard */}
        <BulkBlocksApartmentsWizard
          open={bulkWizardDialog}
          onOpenChange={setBulkWizardDialog}
          condominiumId={id!}
          condominiumName={condominium?.name || ""}
          onSuccess={fetchData}
        />

        {/* Bulk Resident CSV Import Dialog */}
        <BulkResidentCSVImportDialog
          open={bulkResidentImportDialog}
          onOpenChange={setBulkResidentImportDialog}
          condominiumId={id!}
          condominiumName={condominium?.name || ""}
          blocks={blocks}
          apartments={apartments}
          onSuccess={fetchData}
        />
      </div>
    </DashboardLayout>
  );
};

export default CondominiumDetails;
