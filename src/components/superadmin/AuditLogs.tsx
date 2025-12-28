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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Plus, Edit, Trash2, Eye, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string | null;
  table_name: string;
  action: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 20;

function JsonViewer({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data) {
    return (
      <div className="text-muted-foreground text-sm italic">
        Sem dados
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function DataDiffViewer({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  if (!oldData && !newData) {
    return <div className="text-muted-foreground text-sm italic">Sem dados disponíveis</div>;
  }

  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {})
  ]);

  const changedKeys = Array.from(allKeys).filter(key => {
    const oldVal = JSON.stringify(oldData?.[key]);
    const newVal = JSON.stringify(newData?.[key]);
    return oldVal !== newVal;
  });

  if (changedKeys.length === 0 && oldData && newData) {
    return <div className="text-muted-foreground text-sm italic">Nenhuma alteração detectada</div>;
  }

  return (
    <div className="space-y-3">
      {changedKeys.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Campos Alterados</h4>
          <div className="space-y-2">
            {changedKeys.map(key => (
              <div key={key} className="bg-muted/50 p-2 rounded-md text-xs">
                <span className="font-medium text-foreground">{key}:</span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-destructive line-through">
                    {oldData?.[key] !== undefined ? JSON.stringify(oldData[key]) : "—"}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-emerald-500">
                    {newData?.[key] !== undefined ? JSON.stringify(newData[key]) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Query para contar total de registros
  const { data: totalCount } = useQuery({
    queryKey: ["superadmin-audit-logs-count", actionFilter, tableFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true });

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["superadmin-audit-logs", actionFilter, tableFilter, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const { data: tables } = useQuery({
    queryKey: ["superadmin-audit-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("table_name")
        .limit(1000);

      if (error) throw error;
      const uniqueTables = [...new Set(data.map(l => l.table_name))];
      return uniqueTables.sort();
    },
  });

  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.record_id?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  // Reset para página 1 quando filtros mudam
  const handleFilterChange = (type: "action" | "table", value: string) => {
    setCurrentPage(1);
    if (type === "action") {
      setActionFilter(value);
    } else {
      setTableFilter(value);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "insert":
        return <Plus className="h-3 w-3" />;
      case "update":
        return <Edit className="h-3 w-3" />;
      case "delete":
        return <Trash2 className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const getActionBadge = (action: string) => {
    const actionColors: Record<string, string> = {
      insert: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      delete: "bg-destructive/10 text-destructive border-destructive/20",
      select: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return actionColors[action.toLowerCase()] || actionColors.select;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Logs de Auditoria</CardTitle>
          <CardDescription>
            Histórico de ações realizadas no sistema
            {totalCount !== undefined && (
              <span className="ml-2 text-xs">({totalCount.toLocaleString("pt-BR")} registros)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tabela, ação ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => handleFilterChange("action", v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ações</SelectItem>
                <SelectItem value="INSERT">Insert</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={(v) => handleFilterChange("table", v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas tabelas</SelectItem>
                {tables?.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs?.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>ID do Registro</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => (
                      <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                        <>
                          <TableRow className="group">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleRow(log.id)}
                                >
                                  {expandedRows.has(log.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {log.table_name}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`gap-1 ${getActionBadge(log.action)}`}>
                                {getActionIcon(log.action)}
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-muted-foreground">
                                {log.record_id?.slice(0, 8) || "—"}
                              </code>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {log.ip_address || "—"}
                              </span>
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
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={7} className="p-4">
                                {log.action.toLowerCase() === "update" ? (
                                  <DataDiffViewer oldData={log.old_data} newData={log.new_data} />
                                ) : log.action.toLowerCase() === "delete" ? (
                                  <JsonViewer data={log.old_data} label="Dados Removidos" />
                                ) : (
                                  <JsonViewer data={log.new_data} label="Dados Inseridos" />
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
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
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog para ver dados completos */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className={`gap-1 ${selectedLog ? getActionBadge(selectedLog.action) : ""}`}>
                {selectedLog && getActionIcon(selectedLog.action)}
                {selectedLog?.action}
              </Badge>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {selectedLog?.table_name}
              </code>
            </DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              {selectedLog?.record_id && (
                <span className="ml-2">• ID: {selectedLog.record_id}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {selectedLog?.action.toLowerCase() === "update" ? (
                <>
                  <DataDiffViewer oldData={selectedLog.old_data} newData={selectedLog.new_data} />
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <JsonViewer data={selectedLog.old_data} label="Dados Anteriores (Completo)" />
                    <JsonViewer data={selectedLog.new_data} label="Dados Atuais (Completo)" />
                  </div>
                </>
              ) : selectedLog?.action.toLowerCase() === "delete" ? (
                <JsonViewer data={selectedLog?.old_data} label="Dados Removidos" />
              ) : (
                <JsonViewer data={selectedLog?.new_data} label="Dados Inseridos" />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
