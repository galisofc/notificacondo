import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EdgeFunctionLog {
  id: string;
  function_name: string;
  trigger_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  result: any;
  error_message: string | null;
}

interface PauseStatus {
  function_name: string;
  paused: boolean;
  paused_at: string | null;
}

interface JobStatus {
  name: string;
  label: string;
  description: string;
  isPaused: boolean;
  lastExecution: EdgeFunctionLog | null;
  successRate: number;
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  avgDuration: number;
}

const availableFunctions = [
  { name: "notify-trial-ending", label: "Avisar Fim do Trial", description: "Notifica síndicos sobre expiração do período de teste" },
  { name: "generate-invoices", label: "Gerar Faturas", description: "Gera faturas mensais para assinaturas ativas" },
  { name: "notify-party-hall-reminders", label: "Lembretes Salão de Festas", description: "Envia lembretes de reservas" },
  { name: "start-party-hall-usage", label: "Iniciar Uso Salão", description: "Marca reservas como 'em uso'" },
  { name: "finish-party-hall-usage", label: "Finalizar Uso Salão", description: "Marca reservas como 'concluídas'" },
];

export function CronJobsMonitor() {
  const queryClient = useQueryClient();
  const { custom: formatCustom } = useDateFormatter();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["edge-function-logs-monitor"] });
      queryClient.invalidateQueries({ queryKey: ["cron-job-pause-status-monitor"] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // Fetch pause statuses
  const { data: pauseStatuses } = useQuery({
    queryKey: ["cron-job-pause-status-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_job_pause_status" as any);
      if (error) {
        console.error("Error fetching pause statuses:", error);
        return [];
      }
      return (data || []) as PauseStatus[];
    },
    refetchInterval: 30000,
  });

  // Fetch last 100 edge function logs for statistics
  const { data: logs, isLoading } = useQuery({
    queryKey: ["edge-function-logs-monitor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edge_function_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("Error fetching edge function logs:", error);
        return [];
      }
      return (data || []) as EdgeFunctionLog[];
    },
    refetchInterval: 30000,
  });

  const jobStatuses: JobStatus[] = useMemo(() => {
    return availableFunctions.map(fn => {
      const fnLogs = logs?.filter(l => l.function_name === fn.name) || [];
      const successLogs = fnLogs.filter(l => l.status === "success" || l.status === "succeeded");
      const failedLogs = fnLogs.filter(l => l.status === "error" || l.status === "failed");
      const lastExecution = fnLogs[0] || null;
      const pauseStatus = pauseStatuses?.find(p => p.function_name === fn.name);
      
      const durations = fnLogs
        .filter(l => l.duration_ms !== null)
        .map(l => l.duration_ms as number);
      const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      return {
        name: fn.name,
        label: fn.label,
        description: fn.description,
        isPaused: pauseStatus?.paused || false,
        lastExecution,
        successRate: fnLogs.length > 0 ? Math.round((successLogs.length / fnLogs.length) * 100) : 0,
        totalExecutions: fnLogs.length,
        successCount: successLogs.length,
        failedCount: failedLogs.length,
        avgDuration,
      };
    });
  }, [logs, pauseStatuses]);

  const overallStats = useMemo(() => {
    const total = logs?.length || 0;
    const success = logs?.filter(l => l.status === "success" || l.status === "succeeded").length || 0;
    const failed = logs?.filter(l => l.status === "error" || l.status === "failed").length || 0;
    const paused = pauseStatuses?.filter(p => p.paused).length || 0;
    
    return {
      total,
      success,
      failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      pausedJobs: paused,
      activeJobs: availableFunctions.length - paused,
    };
  }, [logs, pauseStatuses]);

  const getStatusIcon = (status: JobStatus) => {
    if (status.isPaused) {
      return <Pause className="h-5 w-5 text-amber-500" />;
    }
    if (!status.lastExecution) {
      return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
    if (status.lastExecution.status === "success" || status.lastExecution.status === "succeeded") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    if (status.lastExecution.status === "error" || status.lastExecution.status === "failed") {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (status.lastExecution.status === "running") {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    return <Clock className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusColor = (status: JobStatus): string => {
    if (status.isPaused) return "border-amber-500/50 bg-amber-500/5";
    if (!status.lastExecution) return "border-muted-foreground/30";
    if (status.lastExecution.status === "success" || status.lastExecution.status === "succeeded") {
      return "border-emerald-500/50 bg-emerald-500/5";
    }
    if (status.lastExecution.status === "error" || status.lastExecution.status === "failed") {
      return "border-destructive/50 bg-destructive/5";
    }
    if (status.lastExecution.status === "running") {
      return "border-blue-500/50 bg-blue-500/5";
    }
    return "border-muted-foreground/30";
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 90) return "text-emerald-500";
    if (rate >= 70) return "text-amber-500";
    return "text-destructive";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Carregando monitoramento...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Monitoramento em Tempo Real</CardTitle>
                <CardDescription>
                  Atualização automática a cada 30 segundos
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Ao vivo</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-background/50 border">
              <div className="text-2xl font-bold text-primary">{availableFunctions.length}</div>
              <div className="text-xs text-muted-foreground">Total de Jobs</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-2xl font-bold text-emerald-500">{overallStats.activeJobs}</div>
              <div className="text-xs text-muted-foreground">Jobs Ativos</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-2xl font-bold text-amber-500">{overallStats.pausedJobs}</div>
              <div className="text-xs text-muted-foreground">Jobs Pausados</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50 border">
              <div className={`text-2xl font-bold ${getSuccessRateColor(overallStats.successRate)}`}>
                {overallStats.successRate}%
              </div>
              <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50 border">
              <div className="text-2xl font-bold text-muted-foreground">{overallStats.total}</div>
              <div className="text-xs text-muted-foreground">Execuções (últ. 100)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Job Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobStatuses.map((status) => (
          <Card 
            key={status.name} 
            className={`transition-all duration-300 hover:shadow-md ${getStatusColor(status)}`}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <div>
                    <h4 className="font-medium text-sm">{status.label}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">{status.description}</p>
                  </div>
                </div>
                {status.isPaused && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                    Pausado
                  </Badge>
                )}
              </div>

              {/* Success Rate Progress */}
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taxa de Sucesso</span>
                  <span className={getSuccessRateColor(status.successRate)}>{status.successRate}%</span>
                </div>
                <Progress 
                  value={status.successRate} 
                  className="h-1.5"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 rounded bg-muted/50">
                  <div className="text-xs font-medium">{status.totalExecutions}</div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                </div>
                <div className="p-1.5 rounded bg-emerald-500/10">
                  <div className="text-xs font-medium text-emerald-500">{status.successCount}</div>
                  <div className="text-[10px] text-muted-foreground">Sucesso</div>
                </div>
                <div className="p-1.5 rounded bg-destructive/10">
                  <div className="text-xs font-medium text-destructive">{status.failedCount}</div>
                  <div className="text-[10px] text-muted-foreground">Falhas</div>
                </div>
              </div>

              {/* Last Execution */}
              {status.lastExecution && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Última execução:</span>
                    <span>{formatCustom(status.lastExecution.started_at, "dd/MM HH:mm")}</span>
                  </div>
                  {status.avgDuration > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Duração média:</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />
                        {status.avgDuration}ms
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!status.lastExecution && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Nenhuma execução registrada
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
