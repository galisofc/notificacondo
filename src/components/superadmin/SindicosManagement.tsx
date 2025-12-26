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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Search, MoreHorizontal, Mail, Building2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      plan: string;
      active: boolean;
    } | null;
  }[];
  condominiums_count: number;
}

type PlanType = "start" | "essencial" | "profissional" | "enterprise";

const planInfo: Record<PlanType, { name: string; description: string }> = {
  start: { name: "Start", description: "10 notificações/mês" },
  essencial: { name: "Essencial", description: "50 notificações/mês" },
  profissional: { name: "Profissional", description: "200 notificações/mês" },
  enterprise: { name: "Enterprise", description: "Ilimitado" },
};

export function SindicosManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    plan: "start" as PlanType,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                .select("plan, active")
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
      setFormData({ full_name: "", email: "", password: "", phone: "", plan: "start" });
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

  const getPlanBadge = (plan: string | undefined) => {
    const planColors: Record<string, string> = {
      start: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      essencial: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      profissional: "bg-violet-500/10 text-violet-500 border-violet-500/20",
      enterprise: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    };
    return planColors[plan || "start"] || planColors.start;
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestão de Síndicos</CardTitle>
            <CardDescription>
              Gerencie os síndicos cadastrados na plataforma
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Síndico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Criar Novo Síndico</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo síndico e escolha o plano de assinatura.
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
                  <div className="grid gap-2">
                    <Label htmlFor="plan">Plano de Assinatura *</Label>
                    <Select
                      value={formData.plan}
                      onValueChange={(value: PlanType) => setFormData({ ...formData, plan: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(planInfo) as [PlanType, { name: string; description: string }][]).map(
                          ([key, info]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex flex-col">
                                <span className="font-medium">{info.name}</span>
                                <span className="text-xs text-muted-foreground">{info.description}</span>
                              </div>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createSindicoMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createSindicoMutation.isPending}>
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
      <CardContent>
        <div className="mb-6">
          <div className="relative max-w-sm">
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum síndico encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Síndico</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Condomínios</TableHead>
                  <TableHead>Status</TableHead>
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
                            <Badge key={c.id} variant="outline" className={getPlanBadge(c.subscription?.plan)}>
                              {c.subscription?.plan?.toUpperCase() || "START"}
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
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {sindico.condominiums_count}
                      </div>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
