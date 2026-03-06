import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Calendar, User, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  concluida: { label: "Concluída", variant: "default", icon: CheckCircle2 },
  parcial: { label: "Parcial", variant: "secondary", icon: MinusCircle },
  nao_realizada: { label: "Não Realizada", variant: "destructive", icon: AlertCircle },
};

export default function ManutencoesHistorico() {
  const { user } = useAuth();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");

  const { data: condominiums = [] } = useQuery({
    queryKey: ["condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const condoIds = selectedCondominium === "all"
    ? condominiums.map((c) => c.id)
    : [selectedCondominium];

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ["maintenance-executions", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("*, maintenance_tasks(title, condominium_id)")
        .in("condominium_id", condoIds)
        .order("executed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
        <SindicoBreadcrumbs
          items={[
            { label: "Manutenção", href: "/sindico/manutencoes" },
            { label: "Histórico" },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Histórico de Execuções</h2>
            <p className="text-muted-foreground">Acompanhe as manutenções realizadas</p>
          </div>
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os condomínios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {condominiums.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : executions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma execução registrada ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="hidden md:table-cell">Executado por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Custo</TableHead>
                  <TableHead className="hidden lg:table-cell">Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((exec: any) => {
                  const sConfig = statusConfig[exec.status] || statusConfig.concluida;
                  const StatusIcon = sConfig.icon;
                  return (
                    <TableRow key={exec.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(parseISO(exec.executed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {exec.maintenance_tasks?.title || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{exec.executed_by_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {sConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {exec.cost ? `R$ ${Number(exec.cost).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                        {exec.observations || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
