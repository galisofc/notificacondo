import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export function CronJobsLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);

  // Fetch cron jobs
  const { data: cronJobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ["cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_jobs" as any);
      if (error) {
        console.error("Error fetching cron jobs:", error);
        // Return empty array if function doesn't exist
        return [];
      }
      return (data || []) as CronJob[];
    },
  });

  // Fetch cron job runs (last 50)
  const { data: cronRuns, isLoading: isLoadingRuns, refetch: refetchRuns } = useQuery({
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
      refetchRuns();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao executar função",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleManualTrigger = (functionName: string) => {
    setIsRunDialogOpen(false);
    triggerMutation.mutate(functionName);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Sucesso
          </Badge>
        );
      case "failed":
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
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {status}
          </Badge>
        );
    }
  };

  const getJobNameFromCommand = (command: string) => {
    const match = command.match(/functions\/v1\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : "Desconhecido";
  };

  const formatSchedule = (schedule: string) => {
    // Parse cron expression to human readable
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
  ];

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
              onClick={() => queryClient.invalidateQueries({ queryKey: ["cron-jobs"] })}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingJobs ? (
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronJobs.map((job) => (
                    <TableRow key={job.jobid}>
                      <TableCell className="font-medium">{job.jobname}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatSchedule(job.schedule)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {getJobNameFromCommand(job.command)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            job.active
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {job.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  Últimas 50 execuções de cron jobs
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRuns()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                          ? format(new Date(run.start_time), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.end_time
                          ? format(new Date(run.end_time), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
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
              <p className="text-muted-foreground">Nenhuma execução registrada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Execute uma função manualmente ou aguarde a próxima execução agendada
              </p>
            </div>
          )}
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
