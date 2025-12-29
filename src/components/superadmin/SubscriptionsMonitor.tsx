import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInHours, isPast } from "date-fns";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { formatCNPJ } from "@/components/ui/masked-input";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { CreditCard, AlertCircle, Eye, Search, Clock, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SubscriptionWithCondominium {
  id: string;
  condominium_id: string;
  plan: string;
  active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
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
    cnpj: string | null;
  } | null;
  owner_profile: {
    full_name: string;
    email: string;
  } | null;
}

// Formata CNPJ: XX.XXX.XXX/XXXX-XX
const formatCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return value; // Mantém texto se não houver dígitos
  
  // Se começou a digitar números, aplica máscara CNPJ
  return digits
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function SubscriptionsMonitor() {
  const navigate = useNavigate();
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { date: formatDate, dateTime: formatDateTime } = useDateFormatter();

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
            .select("name, owner_id, cnpj")
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
        .select("plan, active, is_trial, trial_ends_at");

      if (error) throw error;

      const stats = {
        start: { total: 0, active: 0, critical: 0 },
        essencial: { total: 0, active: 0, critical: 0 },
        profissional: { total: 0, active: 0, critical: 0 },
        enterprise: { total: 0, active: 0, critical: 0 },
        trial: { total: 0, active: 0, critical: 0 },
      };

      data.forEach((sub) => {
        const plan = sub.plan as keyof typeof stats;
        if (stats[plan]) {
          stats[plan].total++;
          if (sub.active) stats[plan].active++;
        }
        if (sub.is_trial) {
          stats.trial.total++;
          if (sub.active) stats.trial.active++;
          
          // Check if trial is expiring in 2 days or less
          if (sub.trial_ends_at) {
            const hoursRemaining = differenceInHours(new Date(sub.trial_ends_at), new Date());
            const daysRemaining = Math.ceil(hoursRemaining / 24);
            if (daysRemaining <= 2 && hoursRemaining > 0) {
              stats.trial.critical++;
            }
          }
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

  const getTrialStatus = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    const endDate = new Date(trialEndsAt);
    
    if (isPast(endDate)) {
      return { status: "expired", daysRemaining: 0, hoursRemaining: 0, label: "Expirado" };
    }
    
    const hoursRemaining = differenceInHours(endDate, new Date());
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    
    // Show hours when less than 24h remaining
    if (hoursRemaining < 24) {
      return { 
        status: "critical", 
        daysRemaining: 0, 
        hoursRemaining, 
        label: `${hoursRemaining}h restante${hoursRemaining !== 1 ? 's' : ''}` 
      };
    }
    
    if (daysRemaining <= 2) {
      return { status: "critical", daysRemaining, hoursRemaining, label: `${daysRemaining}d restante${daysRemaining !== 1 ? 's' : ''}` };
    }
    return { status: "normal", daysRemaining, hoursRemaining, label: `${daysRemaining}d` };
  };

  // Filter subscriptions based on search term (CNPJ or email)
  const filteredSubscriptions = useMemo(() => {
    if (!subscriptions || !searchTerm.trim()) return subscriptions;
    
    const search = searchTerm.toLowerCase().trim();
    const searchDigits = searchTerm.replace(/\D/g, ""); // Remove non-digits for CNPJ search
    
    return subscriptions.filter((sub) => {
      const cnpj = sub.condominium?.cnpj || "";
      const email = sub.owner_profile?.email?.toLowerCase() || "";
      const name = sub.condominium?.name?.toLowerCase() || "";
      const sindicoName = sub.owner_profile?.full_name?.toLowerCase() || "";
      
      return (searchDigits.length > 0 && cnpj.includes(searchDigits)) || 
             email.includes(search) || 
             name.includes(search) ||
             sindicoName.includes(search);
    });
  }, [subscriptions, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Plan Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(planStats || {}).map(([plan, stats]) => {
          const hasCritical = plan === "trial" && stats.critical > 0;
          return (
            <Card 
              key={plan} 
              className={`${
                hasCritical 
                  ? "border-orange-500/50 bg-orange-500/5" 
                  : plan === "trial" 
                    ? "border-amber-500/30 bg-amber-500/5" 
                    : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground capitalize flex items-center gap-1">
                      {plan === "trial" && (
                        hasCritical ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 animate-pulse" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )
                      )}
                      {plan}
                    </p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge 
                      variant="outline" 
                      className={plan === "trial" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : getPlanBadge(plan)}
                    >
                      {stats.active} ativos
                    </Badge>
                    {hasCritical && (
                      <Badge 
                        variant="outline" 
                        className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs animate-pulse"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {stats.critical} expirando
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CNPJ, email ou nome..."
                  value={searchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Se o valor começa com número, aplica máscara de CNPJ
                    if (/^\d/.test(value)) {
                      setSearchTerm(formatCnpj(value));
                    } else {
                      setSearchTerm(value);
                    }
                  }}
                  className="pl-9 w-full sm:w-[280px]"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
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
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredSubscriptions?.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma assinatura encontrada para a busca" : "Nenhuma assinatura encontrada"}
              </p>
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
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions?.map((sub) => (
                    <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/superadmin/subscriptions/${sub.id}`)}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.condominium?.name || "—"}</p>
                        {sub.condominium?.cnpj && (
                            <p className="text-xs text-muted-foreground">{formatCNPJ(sub.condominium.cnpj)}</p>
                          )}
                        </div>
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
                        <div className="flex items-center gap-2">
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
                          {sub.is_trial && (() => {
                            const trialStatus = getTrialStatus(sub.trial_ends_at);
                            const isCritical = trialStatus?.status === "critical";
                            const isExpired = trialStatus?.status === "expired";
                            return (
                              <Badge 
                                variant="outline" 
                                className={`gap-1 ${
                                  isExpired 
                                    ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" 
                                    : isCritical 
                                      ? "bg-orange-500/10 text-orange-600 border-orange-500/20 animate-pulse" 
                                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                }`}
                              >
                                {isExpired || isCritical ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                Trial
                                {trialStatus && (
                                  <span className="text-xs font-medium">
                                    ({trialStatus.label})
                                  </span>
                                )}
                              </Badge>
                            );
                          })()}
                        </div>
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
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/superadmin/subscriptions/${sub.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
