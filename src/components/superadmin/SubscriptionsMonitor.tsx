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
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, TrendingUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SubscriptionWithCondominium {
  id: string;
  condominium_id: string;
  plan: string;
  active: boolean;
  notifications_limit: number;
  notifications_used: number;
  warnings_limit: number;
  warnings_used: number;
  fines_limit: number;
  fines_used: number;
  created_at: string;
  current_period_end: string | null;
  condominium: {
    name: string;
    owner_id: string;
  } | null;
  owner_profile: {
    full_name: string;
    email: string;
  } | null;
}

export function SubscriptionsMonitor() {
  const [planFilter, setPlanFilter] = useState<string>("all");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["superadmin-subscriptions", planFilter],
    queryFn: async () => {
      let query = supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (planFilter !== "all") {
        query = query.eq("plan", planFilter as "start" | "essencial" | "profissional" | "enterprise");
      }

      const { data, error } = await query;
      if (error) throw error;

      const subsWithDetails = await Promise.all(
        (data || []).map(async (sub) => {
          // Get condominium details
          const { data: condo } = await supabase
            .from("condominiums")
            .select("name, owner_id")
            .eq("id", sub.condominium_id)
            .single();

          // Get owner profile if condominium exists
          let ownerProfile = null;
          if (condo?.owner_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", condo.owner_id)
              .single();
            ownerProfile = profile;
          }

          return { 
            ...sub, 
            condominium: condo,
            owner_profile: ownerProfile 
          } as SubscriptionWithCondominium;
        })
      );

      return subsWithDetails;
    },
  });

  const { data: planStats } = useQuery({
    queryKey: ["superadmin-plan-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan, active");

      if (error) throw error;

      const stats = {
        start: { total: 0, active: 0 },
        essencial: { total: 0, active: 0 },
        profissional: { total: 0, active: 0 },
        enterprise: { total: 0, active: 0 },
      };

      data.forEach((sub) => {
        const plan = sub.plan as keyof typeof stats;
        if (stats[plan]) {
          stats[plan].total++;
          if (sub.active) stats[plan].active++;
        }
      });

      return stats;
    },
  });

  const getPlanBadge = (plan: string) => {
    const planColors: Record<string, string> = {
      start: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      essencial: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      profissional: "bg-violet-500/10 text-violet-500 border-violet-500/20",
      enterprise: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    };
    return planColors[plan] || planColors.start;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Plan Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(planStats || {}).map(([plan, stats]) => (
          <Card key={plan}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground capitalize">{plan}</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Badge variant="outline" className={getPlanBadge(plan)}>
                  {stats.active} ativos
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Monitoramento de Assinaturas</CardTitle>
              <CardDescription>
                Acompanhe planos e uso de recursos dos condomínios
              </CardDescription>
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="start">Start</SelectItem>
                <SelectItem value="essencial">Essencial</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : subscriptions?.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condomínio</TableHead>
                    <TableHead>Síndico</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notificações</TableHead>
                    <TableHead>Advertências</TableHead>
                    <TableHead>Multas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions?.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <p className="font-medium">{sub.condominium?.name || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.owner_profile?.full_name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{sub.owner_profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPlanBadge(sub.plan)}>
                          {sub.plan.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sub.active
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }
                        >
                          {sub.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{sub.notifications_used}/{sub.notifications_limit}</span>
                            {getUsagePercentage(sub.notifications_used, sub.notifications_limit) >= 90 && (
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <Progress 
                            value={getUsagePercentage(sub.notifications_used, sub.notifications_limit)} 
                            className="h-1.5"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{sub.warnings_used}/{sub.warnings_limit}</span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(sub.warnings_used, sub.warnings_limit)} 
                            className="h-1.5"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{sub.fines_used}/{sub.fines_limit}</span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(sub.fines_used, sub.fines_limit)} 
                            className="h-1.5"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
