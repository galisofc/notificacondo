import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, CheckCircle2, Clock, Search, ChevronLeft, ChevronRight, RefreshCw, Eye, Webhook } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAGE_SIZE = 20;

const BsuidMigration = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");
  const [page, setPage] = useState(0);
  const [selectedPayload, setSelectedPayload] = useState<any>(null);
  const [logsPage, setLogsPage] = useState(0);
  const LOGS_PAGE_SIZE = 10;

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["bsuid-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("residents")
        .select("*", { count: "exact", head: true });

      const { count: withBsuid } = await supabase
        .from("residents")
        .select("*", { count: "exact", head: true })
        .not("bsuid", "is", null);

      const t = total || 0;
      const w = withBsuid || 0;
      return { total: t, withBsuid: w, withoutBsuid: t - w, percentage: t > 0 ? Math.round((w / t) * 100) : 0 };
    },
    staleTime: 30000,
  });

  // Residents list query
  const { data: residents, isLoading } = useQuery({
    queryKey: ["bsuid-residents", search, filter, page],
    queryFn: async () => {
      let query = supabase
        .from("residents")
        .select(`
          id, full_name, phone, bsuid, updated_at,
          apartments!inner(number, blocks!inner(name, condominiums!inner(name)))
        `)
        .order("full_name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter === "with") query = query.not("bsuid", "is", null);
      if (filter === "without") query = query.is("bsuid", null);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,bsuid.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 15000,
  });


  // Raw webhook payloads query
  const { data: rawLogs, isLoading: rawLogsLoading, refetch: refetchRawLogs } = useQuery({
    queryKey: ["bsuid-raw-logs", logsPage],
    queryFn: async () => {
      const from = logsPage * LOGS_PAGE_SIZE;
      const to = from + LOGS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("webhook_raw_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data || [];
    },
    staleTime: 15000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SuperAdminBreadcrumbs
          items={[
            { label: "WhatsApp", href: "/superadmin/whatsapp" },
            { label: "Migração BSUID" },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold text-foreground">Migração BSUID</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe a captura dos Business-Scoped User IDs (BSUIDs) dos moradores via WhatsApp.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Moradores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Com BSUID</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.withBsuid ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sem BSUID</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.withoutBsuid ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Progresso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.percentage ?? 0}%</div>
              <Progress value={stats?.percentage ?? 0} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou BSUID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v: "all" | "with" | "without") => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with">Com BSUID</SelectItem>
              <SelectItem value="without">Sem BSUID</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Morador</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Condomínio</TableHead>
                  <TableHead className="hidden lg:table-cell">Bloco / Apto</TableHead>
                  <TableHead>BSUID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : !residents?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum morador encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  residents.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell className="text-sm">{r.phone || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {r.apartments?.blocks?.condominiums?.name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.apartments?.blocks?.name} / {r.apartments?.number}
                      </TableCell>
                      <TableCell>
                        {r.bsuid ? (
                          <Badge variant="default" className="bg-green-600 text-xs font-mono">
                            {r.bsuid}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!residents || residents.length < PAGE_SIZE}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Payloads do Webhook Meta</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchRawLogs()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Statuses</TableHead>
                  <TableHead className="text-center">BSUIDs</TableHead>
                  <TableHead className="text-center">Notificações</TableHead>
                  <TableHead className="text-center">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawLogsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : !rawLogs?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum payload recebido ainda. Configure o webhook da Meta para começar a receber dados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rawLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.source}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{log.statuses_count}</TableCell>
                      <TableCell className="text-center">
                        {log.bsuids_captured > 0 ? (
                          <Badge variant="default" className="bg-green-600 text-xs">{log.bsuids_captured}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{log.notifications_updated}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayload(log.payload)}
                          title="Ver payload completo"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-sm text-muted-foreground">Página {logsPage + 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={logsPage === 0} onClick={() => setLogsPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!rawLogs || rawLogs.length < LOGS_PAGE_SIZE}
                onClick={() => setLogsPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Payload Dialog */}
        <Dialog open={!!selectedPayload} onOpenChange={(open) => !open && setSelectedPayload(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Payload do Webhook Meta
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
                {selectedPayload ? JSON.stringify(selectedPayload, null, 2) : ""}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default BsuidMigration;
