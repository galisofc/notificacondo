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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, UserCheck, UserX, Mail, Building2 } from "lucide-react";
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
  subscription: {
    plan: string;
    active: boolean;
  } | null;
  condominiums_count: number;
}

export function SindicosManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sindicos, isLoading } = useQuery({
    queryKey: ["superadmin-sindicos"],
    queryFn: async () => {
      // Get all sindicos from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, created_at")
        .eq("role", "sindico");

      if (rolesError) throw rolesError;

      // For each sindico, get their profile, subscription and condominiums count
      const sindicosWithDetails = await Promise.all(
        (roles || []).map(async (role) => {
          const [profileRes, subscriptionRes, condominiumsRes] = await Promise.all([
            supabase.from("profiles").select("full_name, email, phone").eq("user_id", role.user_id).single(),
            supabase.from("subscriptions").select("plan, active").eq("user_id", role.user_id).single(),
            supabase.from("condominiums").select("id", { count: "exact" }).eq("owner_id", role.user_id),
          ]);

          return {
            ...role,
            profile: profileRes.data,
            subscription: subscriptionRes.data,
            condominiums_count: condominiumsRes.count || 0,
          } as SindicoWithProfile;
        })
      );

      return sindicosWithDetails;
    },
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ active })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-sindicos"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
      toast({
        title: active ? "Conta ativada" : "Conta desativada",
        description: `A conta do síndico foi ${active ? "ativada" : "desativada"} com sucesso.`,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Síndicos</CardTitle>
        <CardDescription>
          Gerencie os síndicos cadastrados na plataforma
        </CardDescription>
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
                      <Badge variant="outline" className={getPlanBadge(sindico.subscription?.plan)}>
                        {sindico.subscription?.plan?.toUpperCase() || "START"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {sindico.condominiums_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          sindico.subscription?.active
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {sindico.subscription?.active ? "Ativo" : "Inativo"}
                      </Badge>
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
                          <DropdownMenuItem
                            onClick={() =>
                              toggleSubscriptionMutation.mutate({
                                userId: sindico.user_id,
                                active: !sindico.subscription?.active,
                              })
                            }
                          >
                            {sindico.subscription?.active ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                Desativar conta
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Ativar conta
                              </>
                            )}
                          </DropdownMenuItem>
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
