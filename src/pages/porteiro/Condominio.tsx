import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  Loader2,
  Home,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MaskedInput, formatCPF } from "@/components/ui/masked-input";
import { QuickBlockApartmentSearch } from "@/components/packages/QuickBlockApartmentSearch";

interface Resident {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  is_owner: boolean;
  is_responsible: boolean;
  apartment_id: string;
}

interface Apartment {
  id: string;
  number: string;
  block_id: string;
  residents: Resident[];
}

interface Block {
  id: string;
  name: string;
  apartments: Apartment[];
}

interface Condominium {
  id: string;
  name: string;
}

const isValidCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

  return true;
};

export default function PorteiroCondominio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCondoId, setSelectedCondoId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>("all");
  const [selectedApartmentFilter, setSelectedApartmentFilter] = useState<string>("all");
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [expandedApartments, setExpandedApartments] = useState<Set<string>>(new Set());
  const [highlightedApartmentId, setHighlightedApartmentId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [residentToDelete, setResidentToDelete] = useState<Resident | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    is_owner: false,
    is_responsible: false,
  });

  // Fetch condominiums the porteiro has access to
  const { data: condominiums, isLoading: loadingCondos } = useQuery({
    queryKey: ["porteiro-condominiums", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_condominiums")
        .select("condominium_id, condominiums(id, name)")
        .eq("user_id", user.id);

      if (error) throw error;
      return data
        ?.map((uc) => uc.condominiums as unknown as Condominium)
        .filter(Boolean) || [];
    },
    enabled: !!user,
  });

  // Auto-select first condominium
  useState(() => {
    if (condominiums && condominiums.length > 0 && !selectedCondoId) {
      setSelectedCondoId(condominiums[0].id);
    }
  });

  // Update selected condo when data loads
  useMemo(() => {
    if (condominiums && condominiums.length > 0 && !selectedCondoId) {
      setSelectedCondoId(condominiums[0].id);
    }
  }, [condominiums, selectedCondoId]);

  // Fetch blocks, apartments and residents
  const { data: blocks, isLoading: loadingBlocks } = useQuery({
    queryKey: ["porteiro-blocks-residents", selectedCondoId],
    queryFn: async () => {
      if (!selectedCondoId) return [];

      // Fetch blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from("blocks")
        .select("id, name")
        .eq("condominium_id", selectedCondoId)
        .order("name");

      if (blocksError) throw blocksError;

      // Fetch apartments with residents
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from("apartments")
        .select(`
          id,
          number,
          block_id,
          residents (
            id,
            full_name,
            email,
            phone,
            cpf,
            is_owner,
            is_responsible,
            apartment_id
          )
        `)
        .in("block_id", blocksData?.map((b) => b.id) || [])
        .order("number");

      if (apartmentsError) throw apartmentsError;

      // Group apartments by block and sort blocks numerically
      const blocksWithApartments: Block[] = (blocksData || [])
        .map((block) => ({
          ...block,
          apartments: (apartmentsData || [])
            .filter((apt) => apt.block_id === block.id)
            .map((apt) => ({
              ...apt,
              residents: apt.residents || [],
            })),
        }))
        .sort((a, b) => {
          // Extract numbers from block names for proper numeric sorting
          const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
          return numA - numB;
        });

      return blocksWithApartments;
    },
    enabled: !!selectedCondoId,
  });

  // Get unique blocks for filter dropdown
  const blocksForFilter = useMemo(() => {
    if (!blocks) return [];
    return blocks.map(b => ({ id: b.id, name: b.name }));
  }, [blocks]);

  // Get apartments for selected block filter
  const apartmentsForFilter = useMemo(() => {
    if (!blocks || selectedBlockFilter === "all") return [];
    const block = blocks.find(b => b.id === selectedBlockFilter);
    return block?.apartments.map(a => ({ id: a.id, number: a.number })) || [];
  }, [blocks, selectedBlockFilter]);

  // Filter blocks based on search and filters
  const filteredBlocks = useMemo(() => {
    if (!blocks) return [];
    
    let result = blocks;
    
    // Apply block filter
    if (selectedBlockFilter !== "all") {
      result = result.filter(block => block.id === selectedBlockFilter);
    }
    
    // Apply apartment filter
    if (selectedApartmentFilter !== "all") {
      result = result.map(block => ({
        ...block,
        apartments: block.apartments.filter(apt => apt.id === selectedApartmentFilter)
      })).filter(block => block.apartments.length > 0);
    }
    
    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result
        .map((block) => ({
          ...block,
          apartments: block.apartments
            .map((apt) => ({
              ...apt,
              residents: apt.residents.filter(
                (r) =>
                  r.full_name.toLowerCase().includes(term) ||
                  r.email.toLowerCase().includes(term) ||
                  r.phone?.includes(term)
              ),
            }))
            .filter(
              (apt) =>
                apt.number.toLowerCase().includes(term) ||
                apt.residents.length > 0
            ),
        }))
        .filter(
          (block) =>
            block.name.toLowerCase().includes(term) ||
            block.apartments.length > 0
        );
    }
    
    return result;
  }, [blocks, searchTerm, selectedBlockFilter, selectedApartmentFilter]);

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const toggleApartment = (apartmentId: string) => {
    setExpandedApartments((prev) => {
      const next = new Set(prev);
      if (next.has(apartmentId)) {
        next.delete(apartmentId);
      } else {
        next.add(apartmentId);
      }
      return next;
    });
  };

  const openEditDialog = (resident: Resident) => {
    setEditingResident(resident);
    setSelectedApartmentId(resident.apartment_id);
    setFormData({
      full_name: resident.full_name,
      email: resident.email,
      phone: resident.phone || "",
      cpf: resident.cpf || "",
      is_owner: resident.is_owner,
      is_responsible: resident.is_responsible,
    });
    setDialogOpen(true);
  };

  const openAddDialog = (apartmentId: string) => {
    setEditingResident(null);
    setSelectedApartmentId(apartmentId);
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      cpf: "",
      is_owner: false,
      is_responsible: false,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingResident(null);
    setSelectedApartmentId("");
  };
  const openDeleteDialog = (resident: Resident) => {
    setResidentToDelete(resident);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setResidentToDelete(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate CPF if provided
      if (formData.cpf && !isValidCPF(formData.cpf)) {
        throw new Error("CPF inválido");
      }

      const residentData = {
        full_name: formData.full_name.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || null,
        cpf: formData.cpf || null,
        is_owner: formData.is_owner,
        is_responsible: formData.is_responsible,
        apartment_id: selectedApartmentId,
      };

      if (editingResident) {
        const { error } = await supabase
          .from("residents")
          .update(residentData)
          .eq("id", editingResident.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("residents").insert(residentData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["porteiro-blocks-residents", selectedCondoId],
      });
      toast({
        title: editingResident
          ? "Morador atualizado com sucesso!"
          : "Morador cadastrado com sucesso!",
      });
      closeDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e email são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const deleteMutation = useMutation({
    mutationFn: async (residentId: string) => {
      const { error } = await supabase
        .from("residents")
        .delete()
        .eq("id", residentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["porteiro-blocks-residents", selectedCondoId],
      });
      toast({
        title: "Morador excluído com sucesso!",
      });
      closeDeleteDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (residentToDelete) {
      deleteMutation.mutate(residentToDelete.id);
    }
  };

  const getTotalResidents = () => {
    return (
      blocks?.reduce(
        (total, block) =>
          total +
          block.apartments.reduce(
            (aptTotal, apt) => aptTotal + apt.residents.length,
            0
          ),
        0
      ) || 0
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Condomínio</h1>
            <p className="text-muted-foreground">
              Gerencie os moradores do condomínio
            </p>
          </div>

          {condominiums && condominiums.length > 1 && (
            <Select value={selectedCondoId} onValueChange={setSelectedCondoId}>
              <SelectTrigger className="w-full md:w-[300px]">
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
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Blocos
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blocks?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Apartamentos
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {blocks?.reduce((t, b) => t + b.apartments.length, 0) || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Moradores
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalResidents()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-3 flex-wrap">
              {/* Quick Search */}
              {selectedCondoId && (
                <QuickBlockApartmentSearch
                  condominiumId={selectedCondoId}
                  onBlockFound={(blockId) => {
                    setSelectedBlockFilter(blockId);
                    setSelectedApartmentFilter("all");
                    setExpandedBlocks((prev) => new Set(prev).add(blockId));
                  }}
                  onApartmentFound={(apartmentId) => {
                    setSelectedApartmentFilter(apartmentId);
                    setExpandedApartments((prev) => new Set(prev).add(apartmentId));
                    setHighlightedApartmentId(apartmentId);
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
                disabled={!selectedCondoId}
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Clear Filters Button */}
              {(selectedBlockFilter !== "all" || selectedApartmentFilter !== "all" || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBlockFilter("all");
                    setSelectedApartmentFilter("all");
                    setSearchTerm("");
                  }}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Blocks List */}
        {loadingCondos || loadingBlocks ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBlocks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                {searchTerm
                  ? "Nenhum resultado encontrado"
                  : "Nenhum bloco cadastrado neste condomínio"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBlocks.map((block) => (
              <Card key={block.id}>
                <Collapsible
                  open={expandedBlocks.has(block.id)}
                  onOpenChange={() => toggleBlock(block.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          {expandedBlocks.has(block.id) ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <Building2 className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{block.name.toUpperCase()}</CardTitle>
                          <Badge variant="secondary">
                            {block.apartments.length} apto(s)
                          </Badge>
                          {(() => {
                            const emptyCount = block.apartments.filter(apt => apt.residents.length === 0).length;
                            return emptyCount > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {emptyCount} sem morador
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {block.apartments.map((apartment) => (
                          <Collapsible
                            key={apartment.id}
                            open={expandedApartments.has(apartment.id)}
                            onOpenChange={() => toggleApartment(apartment.id)}
                          >
                            <div 
                              className={`rounded-lg border bg-card transition-all duration-500 ${
                                highlightedApartmentId === apartment.id 
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/10" 
                                  : ""
                              }`} 
                              data-apartment-id={apartment.id}
                            >
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {expandedApartments.has(apartment.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <span className="font-medium">
                                      Apto {apartment.number}
                                    </span>
                                    <Badge
                                      variant={
                                        apartment.residents.length === 0
                                          ? "destructive"
                                          : "outline"
                                      }
                                    >
                                      {apartment.residents.length} morador(es)
                                    </Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAddDialog(apartment.id);
                                    }}
                                  >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Adicionar
                                  </Button>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t p-3 space-y-2">
                                  {apartment.residents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                      Nenhum morador cadastrado
                                    </p>
                                  ) : (
                                    apartment.residents.map((resident) => (
                                      <div
                                        key={resident.id}
                                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                              {resident.full_name}
                                            </span>
                                            {resident.is_owner && (
                                              <Badge variant="secondary" className="text-xs">
                                                Proprietário
                                              </Badge>
                                            )}
                                            {resident.is_responsible && (
                                              <Badge variant="outline" className="text-xs">
                                                Responsável
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                              <Mail className="h-3 w-3" />
                                              {resident.email}
                                            </span>
                                            {resident.phone && (
                                              <span className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                {resident.phone}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openEditDialog(resident)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => openDeleteDialog(resident)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* Edit/Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingResident ? "Editar Morador" : "Cadastrar Morador"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="Nome completo do morador"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <MaskedInput
                  id="phone"
                  mask="phone"
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <MaskedInput
                  id="cpf"
                  mask="cpf"
                  value={formData.cpf}
                  onChange={(value) => setFormData({ ...formData, cpf: value })}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_owner"
                    checked={formData.is_owner}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_owner: !!checked })
                    }
                  />
                  <Label htmlFor="is_owner" className="cursor-pointer">
                    Proprietário
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_responsible"
                    checked={formData.is_responsible}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_responsible: !!checked })
                    }
                  />
                  <Label htmlFor="is_responsible" className="cursor-pointer">
                    Responsável
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : editingResident ? (
                    "Atualizar"
                  ) : (
                    "Cadastrar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o morador{" "}
                <span className="font-semibold">{residentToDelete?.full_name}</span>?
                <br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
