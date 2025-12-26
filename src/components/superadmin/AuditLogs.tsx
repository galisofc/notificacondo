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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, Plus, Edit, Trash2, Eye } from "lucide-react";

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

export function AuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["superadmin-audit-logs", actionFilter, tableFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

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
    <Card>
      <CardHeader>
        <CardTitle>Logs de Auditoria</CardTitle>
        <CardDescription>
          Histórico de ações realizadas no sistema
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
          <Select value={actionFilter} onValueChange={setActionFilter}>
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
          <Select value={tableFilter} onValueChange={setTableFilter}>
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
          <div className="rounded-md border overflow-hidden max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>ID do Registro</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
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
