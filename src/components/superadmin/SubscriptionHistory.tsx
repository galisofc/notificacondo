import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/dateUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  Calendar,
  RefreshCw,
  CreditCard,
  ArrowRightLeft,
  User,
  Settings,
} from "lucide-react";

interface SubscriptionHistoryProps {
  subscriptionId: string;
  condominiumId: string;
}

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  user_id: string | null;
  created_at: string;
}

const getActionInfo = (log: AuditLog) => {
  const action = log.action?.toUpperCase() || "";
  const newData = log.new_data as Record<string, any> | null;

  // Custom actions
  if (action === "ADD_EXTRA_DAYS") {
    return {
      icon: Calendar,
      label: "Dias Adicionados",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      description: `+${newData?.days_added || 0} dias adicionados`,
      details: newData?.justification || null,
    };
  }

  if (action === "UPDATE" || action === "UPDATED") {
    const oldData = log.old_data as Record<string, any> | null;
    
    // Check what was updated
    if (newData?.plan !== oldData?.plan) {
      return {
        icon: CreditCard,
        label: "Plano Alterado",
        color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
        description: `${oldData?.plan || "?"} → ${newData?.plan || "?"}`,
        details: null,
      };
    }
    
    if (newData?.active !== oldData?.active) {
      return {
        icon: Settings,
        label: newData?.active ? "Assinatura Ativada" : "Assinatura Desativada",
        color: newData?.active 
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
          : "bg-red-500/10 text-red-600 border-red-500/20",
        description: newData?.active ? "Status alterado para ativo" : "Status alterado para inativo",
        details: null,
      };
    }

    // Check for period changes
    if (newData?.current_period_end !== oldData?.current_period_end) {
      return {
        icon: Calendar,
        label: "Período Alterado",
        color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        description: "Datas do período atualizadas",
        details: null,
      };
    }

    // Check for limit changes
    if (
      newData?.notifications_limit !== oldData?.notifications_limit ||
      newData?.warnings_limit !== oldData?.warnings_limit ||
      newData?.fines_limit !== oldData?.fines_limit
    ) {
      return {
        icon: Settings,
        label: "Limites Alterados",
        color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        description: "Limites de uso atualizados",
        details: null,
      };
    }

    // Check for usage reset
    if (
      newData?.notifications_used === 0 &&
      newData?.warnings_used === 0 &&
      newData?.fines_used === 0 &&
      (oldData?.notifications_used > 0 || oldData?.warnings_used > 0 || oldData?.fines_used > 0)
    ) {
      return {
        icon: RefreshCw,
        label: "Contadores Reiniciados",
        color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        description: "Uso zerado para novo período",
        details: null,
      };
    }

    return {
      icon: Settings,
      label: "Atualização",
      color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      description: "Dados da assinatura atualizados",
      details: null,
    };
  }

  if (action === "INSERT" || action === "CREATED") {
    return {
      icon: CreditCard,
      label: "Assinatura Criada",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      description: "Nova assinatura registrada",
      details: null,
    };
  }

  // For condominium transfer logs
  if (log.table_name === "condominium_transfers") {
    return {
      icon: ArrowRightLeft,
      label: "Transferência",
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      description: "Condomínio transferido para novo síndico",
      details: newData?.notes || null,
    };
  }

  return {
    icon: History,
    label: action || "Alteração",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    description: "Registro de alteração",
    details: null,
  };
};

export function SubscriptionHistory({ subscriptionId, condominiumId }: SubscriptionHistoryProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["subscription-history", subscriptionId, condominiumId],
    queryFn: async () => {
      // Fetch audit logs for the subscription
      const { data: subscriptionLogs, error: subError } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "subscriptions")
        .eq("record_id", subscriptionId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (subError) throw subError;

      // Fetch transfer logs for the condominium
      const { data: transferLogs, error: transferError } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "condominium_transfers")
        .order("created_at", { ascending: false })
        .limit(20);

      if (transferError) throw transferError;

      // Filter transfer logs that relate to this condominium
      const relevantTransfers = (transferLogs || []).filter((log: AuditLog) => {
        const newData = log.new_data as Record<string, any> | null;
        return newData?.condominium_id === condominiumId;
      });

      // Combine and sort all logs
      const allLogs = [...(subscriptionLogs || []), ...relevantTransfers]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch user profiles for the logs
      const userIds = [...new Set(allLogs.map(log => log.user_id).filter(Boolean))];
      
      let profiles: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        
        profiles = (profilesData || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      return { logs: allLogs, profiles };
    },
    enabled: !!subscriptionId && !!condominiumId,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { logs: auditLogs = [], profiles = {} } = logs || {};

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Histórico de Alterações
        </CardTitle>
        <CardDescription>
          Registro de todas as modificações realizadas na assinatura
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma alteração registrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {auditLogs.map((log: AuditLog) => {
                const info = getActionInfo(log);
                const Icon = info.icon;
                const userName = log.user_id ? profiles[log.user_id] : null;

                return (
                  <div
                    key={log.id}
                    className="flex gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${info.color.split(" ")[0]}`}>
                      <Icon className={`w-5 h-5 ${info.color.split(" ")[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={info.color}>
                          {info.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {info.description}
                      </p>
                      {info.details && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{info.details}"
                        </p>
                      )}
                      {userName && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>por {userName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
