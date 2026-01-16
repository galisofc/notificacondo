import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  PackageCheck,
  PackageX,
  Clock,
  Building2,
  TrendingUp,
  Calendar,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PackageWithRelations {
  id: string;
  status: "pendente" | "retirada" | "expirada";
  received_at: string;
  picked_up_at: string | null;
  block_id: string;
  condominium_id: string;
  block: { name: string } | null;
  condominium: { name: string } | null;
}

interface BlockStats {
  name: string;
  pendente: number;
  retirada: number;
  expirada: number;
  total: number;
}

interface MonthlyStats {
  month: string;
  monthLabel: string;
  received: number;
  pickedUp: number;
}

interface Condominium {
  id: string;
  name: string;
}

const COLORS = {
  pendente: "hsl(var(--chart-4))",
  retirada: "hsl(var(--chart-2))",
  expirada: "hsl(var(--chart-1))",
};

const PackagesDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [packages, setPackages] = useState<PackageWithRelations[]>([]);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch condominiums owned by user
        const { data: condosData } = await supabase
          .from("condominiums")
          .select("id, name")
          .eq("owner_id", user.id)
          .order("name");

        setCondominiums(condosData || []);

        const condoIds = condosData?.map((c) => c.id) || [];

        if (condoIds.length === 0) {
          setPackages([]);
          setLoading(false);
          return;
        }

        // Fetch all packages for these condominiums (last 12 months)
        const twelveMonthsAgo = subMonths(new Date(), 12).toISOString();
        
        const { data: packagesData } = await supabase
          .from("packages")
          .select(`
            id,
            status,
            received_at,
            picked_up_at,
            block_id,
            condominium_id,
            block:blocks(name),
            condominium:condominiums(name)
          `)
          .in("condominium_id", condoIds)
          .gte("received_at", twelveMonthsAgo)
          .order("received_at", { ascending: false });

        setPackages((packagesData as PackageWithRelations[]) || []);
      } catch (error) {
        console.error("Error fetching packages data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Filter packages by selected condominium
  const filteredPackages = useMemo(() => {
    if (selectedCondominium === "all") return packages;
    return packages.filter((p) => p.condominium_id === selectedCondominium);
  }, [packages, selectedCondominium]);

  // Calculate stats by status
  const statusStats = useMemo(() => {
    const stats = {
      pendente: 0,
      retirada: 0,
      expirada: 0,
      total: 0,
    };

    filteredPackages.forEach((pkg) => {
      stats[pkg.status]++;
      stats.total++;
    });

    return stats;
  }, [filteredPackages]);

  // Calculate stats by block
  const blockStats = useMemo(() => {
    const blockMap = new Map<string, BlockStats>();

    filteredPackages.forEach((pkg) => {
      const blockName = pkg.block?.name || "Sem bloco";
      
      if (!blockMap.has(blockName)) {
        blockMap.set(blockName, {
          name: blockName,
          pendente: 0,
          retirada: 0,
          expirada: 0,
          total: 0,
        });
      }

      const stats = blockMap.get(blockName)!;
      stats[pkg.status]++;
      stats.total++;
    });

    return Array.from(blockMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredPackages]);

  // Calculate monthly history
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 5);
    
    const months = eachMonthOfInterval({
      start: startOfMonth(sixMonthsAgo),
      end: endOfMonth(now),
    });

    return months.map((monthDate) => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthPackages = filteredPackages.filter((pkg) => {
        const receivedDate = parseISO(pkg.received_at);
        return receivedDate >= monthStart && receivedDate <= monthEnd;
      });

      const pickedUpInMonth = filteredPackages.filter((pkg) => {
        if (!pkg.picked_up_at) return false;
        const pickedDate = parseISO(pkg.picked_up_at);
        return pickedDate >= monthStart && pickedDate <= monthEnd;
      });

      return {
        month: format(monthDate, "yyyy-MM"),
        monthLabel: format(monthDate, "MMM", { locale: ptBR }),
        received: monthPackages.length,
        pickedUp: pickedUpInMonth.length,
      };
    });
  }, [filteredPackages]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: "Pendentes", value: statusStats.pendente, color: COLORS.pendente },
      { name: "Retiradas", value: statusStats.retirada, color: COLORS.retirada },
      { name: "Expiradas", value: statusStats.expirada, color: COLORS.expirada },
    ].filter((item) => item.value > 0);
  }, [statusStats]);

  // Average pickup time (in hours)
  const avgPickupTime = useMemo(() => {
    const pickedUpPackages = filteredPackages.filter(
      (pkg) => pkg.status === "retirada" && pkg.picked_up_at
    );

    if (pickedUpPackages.length === 0) return null;

    const totalHours = pickedUpPackages.reduce((acc, pkg) => {
      const received = parseISO(pkg.received_at);
      const pickedUp = parseISO(pkg.picked_up_at!);
      const hours = (pickedUp.getTime() - received.getTime()) / (1000 * 60 * 60);
      return acc + hours;
    }, 0);

    return Math.round(totalHours / pickedUpPackages.length);
  }, [filteredPackages]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    color,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    description?: string;
    color: string;
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-20 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <Helmet>
        <title>Estatísticas de Encomendas | NotificaCondo</title>
        <meta name="description" content="Dashboard de estatísticas de encomendas" />
      </Helmet>

      <div className="space-y-6 animate-fade-up">
        <SindicoBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Encomendas" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-primary" />
              Estatísticas de Encomendas
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o fluxo de encomendas dos seus condomínios
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por condomínio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os condomínios</SelectItem>
                {condominiums.map((condo) => (
                  <SelectItem key={condo.id} value={condo.id}>
                    {condo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Encomendas"
            value={statusStats.total}
            icon={Package}
            description="Últimos 12 meses"
            color="bg-primary"
          />
          <StatCard
            title="Pendentes"
            value={statusStats.pendente}
            icon={Clock}
            description="Aguardando retirada"
            color="bg-yellow-500"
          />
          <StatCard
            title="Retiradas"
            value={statusStats.retirada}
            icon={PackageCheck}
            description="Entregues com sucesso"
            color="bg-green-500"
          />
          <StatCard
            title="Expiradas"
            value={statusStats.expirada}
            icon={PackageX}
            description="Não retiradas"
            color="bg-red-500"
          />
        </div>

        {/* Average pickup time */}
        {avgPickupTime !== null && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo médio de retirada</p>
                  <p className="text-xl font-bold text-foreground">
                    {avgPickupTime < 24
                      ? `${avgPickupTime} horas`
                      : `${Math.round(avgPickupTime / 24)} dias`}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Baseado em {statusStats.retirada} retiradas
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Status Distribution Pie Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Distribuição por Status
              </CardTitle>
              <CardDescription>Visão geral do status das encomendas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : pieData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhuma encomenda encontrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly History Line Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Histórico Mensal
              </CardTitle>
              <CardDescription>Encomendas recebidas e retiradas por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="received"
                      name="Recebidas"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pickedUp"
                      name="Retiradas"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Block Stats Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Encomendas por Bloco
            </CardTitle>
            <CardDescription>Distribuição de encomendas em cada bloco</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : blockStats.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma encomenda encontrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={blockStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="pendente" name="Pendentes" fill={COLORS.pendente} stackId="a" />
                  <Bar dataKey="retirada" name="Retiradas" fill={COLORS.retirada} stackId="a" />
                  <Bar dataKey="expirada" name="Expiradas" fill={COLORS.expirada} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Empty State */}
        {!loading && packages.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Nenhuma encomenda registrada
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Ainda não há encomendas registradas nos seus condomínios. As estatísticas aparecerão
                quando os porteiros começarem a registrar encomendas.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PackagesDashboard;
