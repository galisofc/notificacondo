import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Mail, Building2, Plus, Loader2, Eye, User, Phone, Calendar, CreditCard, CheckCircle, XCircle } from "lucide-react";
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
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
            .select("full_name, email, phone")
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
      setFormData({ full_name: "", email: "", password: "", phone: "" });
      toast({
        title: "Síndico criado!",
        description: "O novo síndico foi cadastrado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar síndico",
        description: error.message || "Tente novamente.",
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

  const filteredSindicos = sindicos?.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.profile?.full_name?.toLowerCase().includes(query) ||
      s.profile?.email?.toLowerCase().includes(query)
    );
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
  };


  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.password) {
      toast({
        title: "Preencha todos os campos obrigatórios",
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
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  <Button type="submit" disabled={createSindicoMutation.isPending} className="w-full sm:w-auto">
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
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
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
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedSindico.profile?.full_name || "—"}</h3>
                      <p className="text-muted-foreground">{selectedSindico.profile?.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium">{selectedSindico.profile?.phone || "Não informado"}</p>
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
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
