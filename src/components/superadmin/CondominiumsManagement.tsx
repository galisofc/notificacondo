import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { isValidCNPJ } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MaskedInput, formatCNPJ, formatPhone } from "@/components/ui/masked-input";
import {
  Building2,
  Search,
  Edit,
  Eye,
  MapPin,
  Phone,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

interface Condominium {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface CondominiumWithOwner extends Condominium {
  owner?: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export function CondominiumsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCondominium, setSelectedCondominium] = useState<CondominiumWithOwner | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: "",
    cnpj: "",
    phone: "",
    zip_code: "",
    address: "",
    address_number: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const itemsPerPage = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-condominiums"],
    queryFn: async () => {
      // Fetch all condominiums
      const { data: condominiums, error } = await supabase
        .from("condominiums")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      // Get unique owner IDs
      const ownerIds = [...new Set(condominiums.map(c => c.owner_id))];
      
      // Fetch owner profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", ownerIds);

      // Map owners to condominiums
      const profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, typeof profiles[0]>);

      return condominiums.map(c => ({
        ...c,
        owner: profilesMap[c.owner_id] || null,
      })) as CondominiumWithOwner[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updateData: typeof editForm & { id: string }) => {
      const { error } = await supabase
        .from("condominiums")
        .update({
          name: updateData.name,
          cnpj: updateData.cnpj.replace(/\D/g, "") || null,
          phone: updateData.phone.replace(/\D/g, "") || null,
          zip_code: updateData.zip_code.replace(/\D/g, "") || null,
          address: updateData.address || null,
          address_number: updateData.address_number || null,
          neighborhood: updateData.neighborhood || null,
          city: updateData.city || null,
          state: updateData.state || null,
        })
        .eq("id", updateData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-condominiums"] });
      setIsEditDialogOpen(false);
      setSelectedCondominium(null);
      toast({
        title: "Condomínio atualizado",
        description: "Os dados foram salvos com sucesso.",
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

  const handleSearchCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    // Validar CNPJ matematicamente antes de buscar
    if (!isValidCNPJ(cleanCnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ informado não é matematicamente válido.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      const data = await response.json();

      if (data.message || response.status !== 200) {
        toast({
          title: "CNPJ não encontrado",
          description: data.message || "Verifique o CNPJ informado.",
          variant: "destructive",
        });
        return;
      }

      // Fill form with company data
      setEditForm(prev => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        phone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, "") : prev.phone,
        zip_code: data.cep ? data.cep.replace(/\D/g, "") : prev.zip_code,
        address: data.logradouro || prev.address,
        address_number: data.numero || prev.address_number,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "CNPJ encontrado",
        description: `Dados de "${data.razao_social || data.nome_fantasia}" preenchidos automaticamente.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CNPJ",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  const handleSearchCep = async (cep: string, autoSearch = false) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return;
      }

      setEditForm(prev => ({
        ...prev,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "Endereço encontrado",
        description: "Os dados foram preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleOpenEdit = (condominium: CondominiumWithOwner) => {
    setSelectedCondominium(condominium);
    setEditForm({
      name: condominium.name || "",
      cnpj: condominium.cnpj || "",
      phone: condominium.phone || "",
      zip_code: condominium.zip_code || "",
      address: condominium.address || "",
      address_number: (condominium as any).address_number || "",
      neighborhood: condominium.neighborhood || "",
      city: condominium.city || "",
      state: condominium.state || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenView = (condominium: CondominiumWithOwner) => {
    setSelectedCondominium(condominium);
    setIsViewDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedCondominium) return;
    if (!editForm.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do condomínio.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ ...editForm, id: selectedCondominium.id });
  };

  // Filter and paginate
  const filteredCondominiums = (data || []).filter(c => {
    const search = searchTerm.toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, ""); // Remove non-digits for CNPJ search
    return (
      c.name.toLowerCase().includes(search) ||
      (c.cnpj && c.cnpj.includes(searchDigits)) ||
      c.city?.toLowerCase().includes(search) ||
      c.owner?.full_name?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredCondominiums.length / itemsPerPage);
  const paginatedCondominiums = filteredCondominiums.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Condomínios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Condomínios Cadastrados
              </CardTitle>
              <CardDescription>
                {filteredCondominiums.length} condomínio(s) encontrado(s)
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ, cidade..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedCondominiums.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum condomínio encontrado</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Síndico</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCondominiums.map((condo) => (
                      <TableRow key={condo.id}>
                        <TableCell>
                          <div className="font-medium">{condo.name}</div>
                          {condo.address && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {condo.address}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {condo.cnpj ? formatCNPJ(condo.cnpj) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {condo.city && condo.state ? (
                            `${condo.city}/${condo.state}`
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {condo.owner ? (
                            <div>
                              <div className="font-medium text-sm">{condo.owner.full_name}</div>
                              <div className="text-xs text-muted-foreground">{condo.owner.email}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(condo.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenView(condo)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(condo)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Detalhes do Condomínio
            </DialogTitle>
          </DialogHeader>
          {selectedCondominium && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedCondominium.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">
                    {selectedCondominium.cnpj ? formatCNPJ(selectedCondominium.cnpj) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">
                    {selectedCondominium.phone ? formatPhone(selectedCondominium.phone) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CEP</p>
                  <p className="font-medium">{selectedCondominium.zip_code || "—"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">{selectedCondominium.address || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nº</p>
                  <p className="font-medium">{selectedCondominium.address_number || "—"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bairro</p>
                  <p className="font-medium">{selectedCondominium.neighborhood || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cidade</p>
                  <p className="font-medium">{selectedCondominium.city || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">UF</p>
                  <p className="font-medium">{selectedCondominium.state || "—"}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">Síndico Responsável</span>
                </div>
                {selectedCondominium.owner ? (
                  <div className="grid gap-2 sm:grid-cols-2 pl-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">{selectedCondominium.owner.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedCondominium.owner.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">
                        {selectedCondominium.owner.phone 
                          ? formatPhone(selectedCondominium.owner.phone) 
                          : "—"
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground pl-6">Não informado</p>
                )}
              </div>

              <div className="pt-4 border-t border-border grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Cadastrado em</p>
                  <p className="font-medium">
                    {formatDateTime(selectedCondominium.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Última atualização</p>
                  <p className="font-medium">
                    {formatDateTime(selectedCondominium.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (selectedCondominium) handleOpenEdit(selectedCondominium);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Editar Condomínio
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do condomínio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* CNPJ - Primeiro campo com busca automática */}
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="cnpj">CNPJ (busca automática)</Label>
                <div className="relative">
                  <MaskedInput
                    id="cnpj"
                    mask="cnpj"
                    value={editForm.cnpj}
                    onChange={(value) => {
                      setEditForm(prev => ({ ...prev, cnpj: value }));
                      // Busca automática quando completar 14 dígitos
                      const cleanCnpj = value.replace(/\D/g, "");
                      if (cleanCnpj.length === 14) {
                        handleSearchCnpj(value);
                      }
                    }}
                    placeholder="00.000.000/0000-00"
                  />
                  {isLoadingCnpj && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="name">Nome do Condomínio *</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do condomínio"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <MaskedInput
                  id="phone"
                  mask="phone"
                  value={editForm.phone}
                  onChange={(value) => setEditForm(prev => ({ ...prev, phone: value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* CEP com busca automática */}
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="zip_code">CEP (busca automática)</Label>
                <div className="relative">
                  <MaskedInput
                    id="zip_code"
                    mask="cep"
                    value={editForm.zip_code}
                    onChange={(value) => {
                      setEditForm(prev => ({ ...prev, zip_code: value }));
                      // Busca automática quando completar 8 dígitos
                      const cleanCep = value.replace(/\D/g, "");
                      if (cleanCep.length === 8) {
                        handleSearchCep(value, true);
                      }
                    }}
                    placeholder="00000-000"
                  />
                  {isLoadingCep && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Logradouro</Label>
                <Input
                  id="address"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, Avenida, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_number">Número</Label>
                <Input
                  id="address_number"
                  value={editForm.address_number}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address_number: e.target.value }))}
                  placeholder="Nº"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={editForm.neighborhood}
                  onChange={(e) => setEditForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                  placeholder="Bairro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={editForm.city}
                  onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={editForm.state}
                  onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            {selectedCondominium?.owner && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Síndico Responsável</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium">{selectedCondominium.owner.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCondominium.owner.email}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
