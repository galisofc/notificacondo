import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/layouts/DashboardLayout";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCPF } from "@/components/ui/masked-input";
import {
  ArrowRightLeft,
  Building2,
  User,
  Calendar,
  Search,
  ArrowRight,
} from "lucide-react";

interface TransferWithDetails {
  id: string;
  condominium_id: string;
  from_owner_id: string;
  to_owner_id: string;
  transferred_by: string;
  transferred_at: string;
  notes: string | null;
  condominium: {
    name: string;
  } | null;
  from_owner: {
    full_name: string;
    email: string;
    cpf: string | null;
  } | null;
  to_owner: {
    full_name: string;
    email: string;
    cpf: string | null;
  } | null;
  transferred_by_user: {
    full_name: string;
    email: string;
  } | null;
}

export default function Transfers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["superadmin-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominium_transfers")
        .select("*")
        .order("transferred_at", { ascending: false });

      if (error) throw error;

      // Fetch related data for each transfer
      const transfersWithDetails = await Promise.all(
        (data || []).map(async (transfer) => {
          // Get condominium name
          const { data: condominium } = await supabase
            .from("condominiums")
            .select("name")
            .eq("id", transfer.condominium_id)
            .single();

          // Get from owner profile
          const { data: fromOwner } = await supabase
            .from("profiles")
            .select("full_name, email, cpf")
            .eq("user_id", transfer.from_owner_id)
            .single();

          // Get to owner profile
          const { data: toOwner } = await supabase
            .from("profiles")
            .select("full_name, email, cpf")
            .eq("user_id", transfer.to_owner_id)
            .single();

          // Get transferred by profile
          const { data: transferredBy } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", transfer.transferred_by)
            .single();

          return {
            ...transfer,
            condominium,
            from_owner: fromOwner,
            to_owner: toOwner,
            transferred_by_user: transferredBy,
          } as TransferWithDetails;
        })
      );

      return transfersWithDetails;
    },
  });

  const filteredTransfers = transfers?.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, "");
    return (
      t.condominium?.name?.toLowerCase().includes(query) ||
      t.from_owner?.full_name?.toLowerCase().includes(query) ||
      t.from_owner?.email?.toLowerCase().includes(query) ||
      t.to_owner?.full_name?.toLowerCase().includes(query) ||
      t.to_owner?.email?.toLowerCase().includes(query) ||
      (t.from_owner?.cpf && t.from_owner.cpf.includes(queryDigits)) ||
      (t.to_owner?.cpf && t.to_owner.cpf.includes(queryDigits))
    );
  });

  return (
    <DashboardLayout>
      <Helmet>
        <title>Histórico de Transferências | NotificaCondo</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Histórico de Transferências
            </h1>
            <p className="text-muted-foreground">
              Visualize todas as transferências de propriedade de condomínios
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{transfers?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total de Transferências</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(transfers?.map((t) => t.condominium_id)).size || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Condomínios Transferidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Calendar className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {transfers?.[0]
                      ? format(new Date(transfers[0].transferred_at), "dd/MM/yyyy")
                      : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Última Transferência</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Transferências Realizadas</CardTitle>
                <CardDescription>
                  Histórico completo de transferências de condomínios entre síndicos
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, CPF ou condomínio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTransfers?.length === 0 ? (
              <div className="text-center py-12">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">Nenhuma transferência encontrada</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Nenhuma transferência corresponde à sua busca."
                    : "Ainda não há transferências de condomínios registradas."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead className="text-center w-12"></TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Realizado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransfers?.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {format(new Date(transfer.transferred_at), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(transfer.transferred_at), "HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {transfer.condominium?.name || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {transfer.from_owner?.full_name || "—"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {transfer.from_owner?.email}
                            </p>
                            {transfer.from_owner?.cpf && (
                              <p className="text-xs text-muted-foreground font-mono">
                                CPF: {formatCPF(transfer.from_owner.cpf)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <div className="p-1.5 rounded-full bg-primary/10">
                              <ArrowRight className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-emerald-500" />
                              <span className="font-medium">
                                {transfer.to_owner?.full_name || "—"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {transfer.to_owner?.email}
                            </p>
                            {transfer.to_owner?.cpf && (
                              <p className="text-xs text-muted-foreground font-mono">
                                CPF: {formatCPF(transfer.to_owner.cpf)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {transfer.transferred_by_user?.full_name || "Sistema"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}