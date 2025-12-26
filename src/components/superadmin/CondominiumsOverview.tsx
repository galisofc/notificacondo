import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Building2, MapPin, Users } from "lucide-react";

interface CondominiumWithDetails {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  created_at: string;
  owner: {
    full_name: string;
    email: string;
  } | null;
  blocks_count: number;
  residents_count: number;
}

export function CondominiumsOverview() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: condominiums, isLoading } = useQuery({
    queryKey: ["superadmin-condominiums"],
    queryFn: async () => {
      const { data: condos, error } = await supabase
        .from("condominiums")
        .select("id, name, city, state, created_at, owner_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const condosWithDetails = await Promise.all(
        (condos || []).map(async (condo) => {
          const [ownerRes, blocksRes] = await Promise.all([
            supabase.from("profiles").select("full_name, email").eq("user_id", condo.owner_id).single(),
            supabase.from("blocks").select("id", { count: "exact" }).eq("condominium_id", condo.id),
          ]);

          // Count residents through blocks -> apartments -> residents
          const { data: blocks } = await supabase
            .from("blocks")
            .select("id")
            .eq("condominium_id", condo.id);

          let residentsCount = 0;
          if (blocks && blocks.length > 0) {
            const { count } = await supabase
              .from("apartments")
              .select("id", { count: "exact" })
              .in("block_id", blocks.map(b => b.id));
            residentsCount = count || 0;
          }

          return {
            ...condo,
            owner: ownerRes.data,
            blocks_count: blocksRes.count || 0,
            residents_count: residentsCount,
          } as CondominiumWithDetails;
        })
      );

      return condosWithDetails;
    },
  });

  const filteredCondominiums = condominiums?.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.owner?.full_name?.toLowerCase().includes(query)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão Geral de Condomínios</CardTitle>
        <CardDescription>
          Todos os condomínios cadastrados na plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou síndico..."
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
        ) : filteredCondominiums?.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum condomínio encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condomínio</TableHead>
                  <TableHead>Síndico</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Blocos</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCondominiums?.map((condo) => (
                  <TableRow key={condo.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <p className="font-medium">{condo.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{condo.owner?.full_name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{condo.owner?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {condo.city && condo.state
                            ? `${condo.city}, ${condo.state}`
                            : "Não informado"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{condo.blocks_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {condo.residents_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {format(new Date(condo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
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
