import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Shield, 
  AlertTriangle,
  Loader2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RlsTableStatus {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
}

export function RlsPoliciesCard() {
  const { toast } = useToast();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const { data: rlsStatus, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rls-policies-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rls_status');
      
      if (error) {
        console.error("Error fetching RLS status:", error);
        throw error;
      }
      
      setLastChecked(new Date());
      return data as RlsTableStatus[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Status atualizado",
      description: "As políticas RLS foram verificadas com sucesso.",
    });
  };

  const protectedTables = rlsStatus?.filter(t => t.rls_enabled && t.policy_count > 0) || [];
  const unprotectedTables = rlsStatus?.filter(t => !t.rls_enabled || t.policy_count === 0) || [];
  const totalPolicies = rlsStatus?.reduce((acc, t) => acc + t.policy_count, 0) || 0;

  const allProtected = unprotectedTables.length === 0 && protectedTables.length > 0;

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${allProtected ? "bg-green-500/10" : "bg-amber-500/10"}`}>
              <Shield className={`w-5 h-5 ${allProtected ? "text-green-500" : "text-amber-500"}`} />
            </div>
            <div>
              <CardTitle>Políticas de Acesso (RLS)</CardTitle>
              <CardDescription>
                Verificação em tempo real das políticas de segurança
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefetching}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Badge 
              variant="outline" 
              className={`gap-1 ${
                allProtected 
                  ? "bg-green-500/10 text-green-500 border-green-500/20" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${allProtected ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
              {allProtected ? "Protegido" : "Atenção"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Verificando políticas...</span>
          </div>
        ) : (
          <>
            {unprotectedTables.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-amber-500">
                    {unprotectedTables.length} tabela(s) sem proteção completa
                  </span>
                </div>
                <div className="grid gap-2 mt-2">
                  {unprotectedTables.map((table) => (
                    <div
                      key={table.table_name}
                      className="flex items-center gap-2 p-2 rounded bg-amber-500/5"
                    >
                      <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-mono text-sm">{table.table_name}</span>
                      <Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                        {!table.rls_enabled ? "RLS desativado" : `${table.policy_count} políticas`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {protectedTables.map((table) => (
                <div
                  key={table.table_name}
                  className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="font-mono text-sm truncate">{table.table_name}</span>
                  <Badge 
                    variant="outline" 
                    className="ml-auto text-xs bg-green-500/10 text-green-500 border-green-500/20 shrink-0"
                  >
                    {table.policy_count} {table.policy_count === 1 ? "política" : "políticas"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{protectedTables.length} tabelas protegidas</span> com {totalPolicies} políticas RLS ativas.
                </p>
                {lastChecked && (
                  <span className="text-xs text-muted-foreground">
                    Última verificação: {lastChecked.toLocaleTimeString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
