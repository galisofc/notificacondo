import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Zap,
  AlertTriangle,
  Pause,
  PlayCircle,
  SkipForward,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
  jobname: string;
}

interface CronJobRun {
  runid: number;
  jobid: number;
  job_pid: number;
  database: string;
  username: string;
  command: string;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
}

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

export function CronJobsLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const { dateTime: formatDateTime, custom: formatCustom } = useDateFormatter();

  // Fetch cron jobs
  const { data: cronJobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_jobs" as any);
      if (error) {
        console.error("Error fetching cron jobs:", error);
        return [];
      }
      return (data || []) as CronJob[];
    },
  });

  // Fetch pause statuses
  const { data: pauseStatuses, isLoading: isLoadingPauseStatus } = useQuery({
    queryKey: ["cron-job-pause-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_job_pause_status" as any);
      if (error) {
        console.error("Error fetching pause statuses:", error);
        return [];
      }
      return (data || []) as PauseStatus[];
    },
  });

  // Fetch cron job runs (last 50 from pg_cron)
  const { data: cronRuns, isLoading: isLoadingRuns } = useQuery({
    queryKey: ["cron-job-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_job_runs" as any);
      if (error) {
        console.error("Error fetching cron job runs:", error);
        return [];
      }
      return (data || []) as CronJobRun[];
    },
  });

  // Fetch edge function logs (our custom table - includes manual executions)
  const { data: edgeFunctionLogs, isLoading: isLoadingEdgeLogs, refetch: refetchEdgeLogs } = useQuery({
    queryKey: ["edge-function-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edge_function_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("Error fetching edge function logs:", error);
        return [];
      }
      return (data || []) as EdgeFunctionLog[];
    },
  });

  // Manual trigger mutation
  const triggerMutation = useMutation({
    mutationFn: async (functionName: string) => {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Função executada com sucesso!",
        description: `Resultado: ${JSON.stringify(data?.results || data).substring(0, 100)}...`,
      });
      refetchEdgeLogs();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao executar função",
        description: error.message,
        variant: "destructive",
      });
      refetchEdgeLogs();
    },
  });

  // Toggle pause mutation
  const togglePauseMutation = useMutation({
    mutationFn: async (functionName: string) => {
      const { data, error } = await supabase.rpc("toggle_cron_job_pause" as any, { 
        p_function_name: functionName 
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (isPaused: boolean, functionName: string) => {
      toast({
        title: isPaused ? "Job pausado!" : "Job reativado!",
        description: isPaused 
          ? `O job "${functionName}" foi pausado e não executará ações até ser reativado.`
          : `O job "${functionName}" foi reativado e voltará a executar normalmente.`,
      });
      queryClient.invalidateQueries({ queryKey: ["cron-job-pause-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status do job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleManualTrigger = (functionName: string) => {
    setIsRunDialogOpen(false);
    triggerMutation.mutate(functionName);
  };

  const handleTogglePause = (functionName: string) => {
    togglePauseMutation.mutate(functionName);
  };

  // Get pause status for a function
  const isPaused = (functionName: string): boolean => {
    const status = pauseStatuses?.find(s => s.function_name === functionName);
    return status?.paused || false;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
      case "success":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Sucesso
          </Badge>
        );
      case "failed":
      case "error":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <XCircle className="h-3 w-3" />
            Falhou
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Executando
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
            <SkipForward className="h-3 w-3" />
            Pulado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {status}
          </Badge>
        );
    }
  };

  const getTriggerTypeBadge = (triggerType: string) => {
    if (triggerType === "manual") {
      return (
        <Badge variant="outline" className="bg-violet-500/10 text-violet-500 border-violet-500/20 text-xs">
          Manual
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
        Agendado
      </Badge>
    );
  };

  const getJobNameFromCommand = (command: string) => {
    const match = command.match(/functions\/v1\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : "Desconhecido";
  };

  const formatSchedule = (schedule: string) => {
    const parts = schedule.split(" ");
    if (parts.length !== 5) return schedule;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    if (minute === "*" && hour === "*") return "A cada minuto";
    if (minute === "0" && hour === "*") return "A cada hora";
    if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return `Diariamente às ${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;
    }
    
    return schedule;
  };

  const availableFunctions = [
    { name: "notify-trial-ending", description: "Notificar trials expirando em 1-2 dias" },
    { name: "generate-invoices", description: "Gerar faturas mensais" },
    { name: "notify-party-hall-reminders", description: "Lembretes de reservas de salão de festas" },
    { name: "start-party-hall-usage", description: "Iniciar uso de reservas do dia" },
  ];

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["cron-job-pause-status"] });
    queryClient.invalidateQueries({ queryKey: ["cron-job-runs"] });
    refetchEdgeLogs();
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Execução Manual</CardTitle>
              <CardDescription>
                Dispare funções agendadas manualmente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {availableFunctions.map((fn) => (
              <Button
                key={fn.name}
                variant="outline"
                onClick={() => {
                  setSelectedJob({ jobname: fn.name } as CronJob);
                  setIsRunDialogOpen(true);
                }}
                disabled={triggerMutation.isPending}
                className="gap-2"
              >
                {triggerMutation.isPending && triggerMutation.variables === fn.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {fn.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Jobs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle>Cron Jobs Agendados</CardTitle>
                <CardDescription>
                  Tarefas agendadas para execução automática
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingJobs || isLoadingPauseStatus ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : cronJobs && cronJobs.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Ação</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronJobs.map((job) => {
                    const functionName = getJobNameFromCommand(job.command);
                    const paused = isPaused(functionName);
                    const effectivelyActive = job.active && !paused;
                    
                    return (
                      <TableRow key={job.jobid}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePause(functionName)}
                            disabled={togglePauseMutation.isPending}
                            title={paused ? "Reativar job" : "Pausar job"}
                          >
                            {togglePauseMutation.isPending && togglePauseMutation.variables === functionName ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : paused ? (
                              <PlayCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Pause className="h-4 w-4 text-amber-500" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{job.jobname}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatSchedule(job.schedule)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {functionName}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                effectivelyActive
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              }
                            >
                              {effectivelyActive ? "Ativo" : "Pausado"}
                            </Badge>
                            {paused && (
                              <Badge variant="outline" className="bg-violet-500/10 text-violet-500 border-violet-500/20 text-xs">
                                via painel
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500/50 mb-4" />
              <p className="text-muted-foreground mb-2">Nenhum cron job encontrado</p>
              <p className="text-sm text-muted-foreground">
                Os cron jobs podem estar configurados mas não visíveis via RPC.
                <br />
                O job <code className="bg-muted px-1 rounded">notify-trial-ending-daily</code> está agendado para 9h UTC diariamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Clock className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle>Histórico de Execuções</CardTitle>
                <CardDescription>
                  Últimas 50 execuções (manuais e agendadas)
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="cron">Agendados (pg_cron)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              {isLoadingEdgeLogs ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : edgeFunctionLogs && edgeFunctionLogs.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Função</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {edgeFunctionLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {log.function_name}
                            </code>
                          </TableCell>
                          <TableCell>{getTriggerTypeBadge(log.trigger_type)}</TableCell>
                          <TableCell className="text-sm">
                            {log.started_at
                              ? formatCustom(log.started_at, "dd/MM/yyyy HH:mm:ss")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.duration_ms ? `${log.duration_ms}ms` : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {log.error_message || 
                              (log.result ? JSON.stringify(log.result).substring(0, 50) + "..." : "—")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma execução registrada ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Execute uma função manualmente ou aguarde a próxima execução agendada
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="cron">
              {isLoadingRuns ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : cronRuns && cronRuns.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mensagem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cronRuns.map((run) => (
                        <TableRow key={run.runid}>
                          <TableCell className="font-mono text-xs">{run.runid}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {getJobNameFromCommand(run.command)}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm">
                            {run.start_time
                              ? formatCustom(run.start_time, "dd/MM/yyyy HH:mm:ss")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {run.end_time
                              ? formatCustom(run.end_time, "dd/MM/yyyy HH:mm:ss")
                              : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(run.status)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {run.return_message || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma execução do pg_cron registrada</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Manual Trigger Dialog */}
      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Executar Função Manualmente</DialogTitle>
            <DialogDescription>
              Deseja executar a função <code className="bg-muted px-2 py-1 rounded">{selectedJob?.jobname}</code> agora?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Esta ação irá disparar a função imediatamente, independente do agendamento configurado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedJob && handleManualTrigger(selectedJob.jobname)}
              disabled={triggerMutation.isPending}
              className="gap-2"
            >
              {triggerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Executar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
