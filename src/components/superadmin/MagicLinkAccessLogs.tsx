import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateFormatter } from "@/hooks/useFormattedDate";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  Link2, 
  Search, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  User,
  Monitor,
  MapPin,
  Calendar
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MagicLinkLog {
  id: string;
  token_id: string;
  resident_id: string | null;
  occurrence_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  access_at: string;
  success: boolean;
  error_message: string | null;
  is_new_user: boolean;
  redirect_url: string | null;
  created_at: string;
}

interface Resident {
  id: string;
  full_name: string;
  email: string;
}

const ITEMS_PER_PAGE = 20;

export function MagicLinkAccessLogs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [residentFilter, setResidentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<MagicLinkLog | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { date: formatDate, dateTime: formatDateTime, custom: formatCustom } = useDateFormatter();

  // Buscar lista de moradores para o filtro
  const { data: residents } = useQuery({
    queryKey: ["magic-link-residents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("id, full_name, email")
        .order("full_name");
      
      if (error) throw error;
      return data as Resident[];
    },
  });

  // Query para contar total de registros
  const { data: totalCount } = useQuery({
    queryKey: ["magic-link-logs-count", statusFilter, residentFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("magic_link_access_logs")
        .select("*", { count: "exact", head: true });

      if (statusFilter === "success") {
        query = query.eq("success", true);
      } else if (statusFilter === "error") {
        query = query.eq("success", false);
      }

      if (residentFilter !== "all") {
        query = query.eq("resident_id", residentFilter);
      }

      if (startDate) {
        query = query.gte("access_at", `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte("access_at", `${endDate}T23:59:59`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["magic-link-logs", statusFilter, residentFilter, startDate, endDate, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("magic_link_access_logs")
        .select("*")
        .order("access_at", { ascending: false })
        .range(from, to);

      if (statusFilter === "success") {
        query = query.eq("success", true);
      } else if (statusFilter === "error") {
        query = query.eq("success", false);
      }

      if (residentFilter !== "all") {
        query = query.eq("resident_id", residentFilter);
      }

      if (startDate) {
        query = query.gte("access_at", `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte("access_at", `${endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MagicLinkLog[];
    },
  });

  // Buscar dados dos moradores dos logs
  const residentIds = logs?.map(l => l.resident_id).filter(Boolean) as string[] || [];
  const uniqueResidentIds = [...new Set(residentIds)];

  const { data: logResidents } = useQuery({
    queryKey: ["magic-link-log-residents", uniqueResidentIds],
    queryFn: async () => {
      if (uniqueResidentIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("residents")
        .select("id, full_name, email")
        .in("id", uniqueResidentIds);

      if (error) throw error;
      
      const residentMap: Record<string, { full_name: string; email: string }> = {};
      data?.forEach(r => {
        residentMap[r.id] = { full_name: r.full_name, email: r.email };
      });
      return residentMap;
    },
    enabled: uniqueResidentIds.length > 0,
  });

  const getResidentName = (residentId: string | null) => {
    if (!residentId) return null;
    return logResidents?.[residentId]?.full_name || null;
  };

  const getResidentInitials = (residentId: string | null) => {
    const name = getResidentName(residentId);
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const residentName = getResidentName(log.resident_id)?.toLowerCase() || "";
    return (
      residentName.includes(query) ||
      log.ip_address?.toLowerCase().includes(query) ||
      log.token_id?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const parseUserAgent = (userAgent: string | null) => {
    if (!userAgent) return "Desconhecido";
    
    // Simplificação do user agent
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Mobile")) return "Mobile";
    return "Outro";
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setResidentFilter("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Logs de Acesso por Magic Link
          </CardTitle>
          <CardDescription>
            Histórico de acessos via links mágicos
            {totalCount !== undefined && (
              <span className="ml-2 text-xs">({totalCount.toLocaleString("pt-BR")} registros)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            {/* Primeira linha de filtros */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por morador, IP ou token..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select 
                value={statusFilter} 
                onValueChange={(v) => {
                  setStatusFilter(v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={residentFilter} 
                onValueChange={(v) => {
                  setResidentFilter(v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Morador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos moradores</SelectItem>
                  {residents?.map((resident) => (
                    <SelectItem key={resident.id} value={resident.id}>
                      {resident.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segunda linha de filtros - datas */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 flex gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data inicial
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-[160px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data final
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-[160px]"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs?.length === 0 ? (
            <div className="text-center py-12">
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Morador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Novo Usuário</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => (
                      <TableRow key={log.id} className="group">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {formatDate(log.access_at)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCustom(log.access_at, "HH:mm:ss")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.resident_id ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getResidentInitials(log.resident_id)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium truncate max-w-[150px]">
                                  {getResidentName(log.resident_id) || "Carregando..."}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span className="text-sm">—</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
                              <XCircle className="h-3 w-3" />
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground font-mono">
                            {log.ip_address || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {parseUserAgent(log.user_agent)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.is_new_user ? (
                            <Badge variant="secondary" className="text-xs">
                              Novo
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages || 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Detalhes do Acesso
            </DialogTitle>
            <DialogDescription>
              Informações completas do acesso via magic link
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{formatDateTime(selectedLog.access_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {selectedLog.success ? (
                    <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <CheckCircle className="h-3 w-3" />
                      Sucesso
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
                      <XCircle className="h-3 w-3" />
                      Erro
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Morador</p>
                <p className="font-medium">
                  {selectedLog.resident_id 
                    ? getResidentName(selectedLog.resident_id) || "Carregando..."
                    : "—"
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Endereço IP
                  </p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Novo Usuário</p>
                  <p className="font-medium">{selectedLog.is_new_user ? "Sim" : "Não"}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Monitor className="h-3 w-3" />
                  User Agent
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded-md break-all">
                  {selectedLog.user_agent || "—"}
                </p>
              </div>

              {selectedLog.redirect_url && (
                <div>
                  <p className="text-sm text-muted-foreground">URL de Redirecionamento</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded-md break-all">
                    {selectedLog.redirect_url}
                  </p>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <p className="text-sm text-muted-foreground">Mensagem de Erro</p>
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Token ID</p>
                <p className="text-xs font-mono bg-muted p-2 rounded-md break-all">
                  {selectedLog.token_id}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
