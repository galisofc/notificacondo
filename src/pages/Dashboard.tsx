import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  DollarSign,
  Users,
  Plus,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  condominiums: number;
  residents: number;
  occurrences: number;
  pendingFines: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    condominiums: 0,
    residents: 0,
    occurrences: 0,
    pendingFines: 0,
  });
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);

        const { count: condoCount } = await supabase
          .from("condominiums")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id);

        const { data: condos } = await supabase
          .from("condominiums")
          .select("id")
          .eq("owner_id", user.id);

        const condoIds = condos?.map((c) => c.id) || [];

        let residentsCount = 0;
        let occurrencesCount = 0;
        let finesCount = 0;

        if (condoIds.length > 0) {
          const { data: blocks } = await supabase
            .from("blocks")
            .select("id")
            .in("condominium_id", condoIds);

          const blockIds = blocks?.map((b) => b.id) || [];

          if (blockIds.length > 0) {
            const { data: apartments } = await supabase
              .from("apartments")
              .select("id")
              .in("block_id", blockIds);

            const apartmentIds = apartments?.map((a) => a.id) || [];

            if (apartmentIds.length > 0) {
              const { count: resCount } = await supabase
                .from("residents")
                .select("*", { count: "exact", head: true })
                .in("apartment_id", apartmentIds);

              residentsCount = resCount || 0;
            }
          }

          const { count: occCount } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds);

          occurrencesCount = occCount || 0;

          const { data: occurrencesData } = await supabase
            .from("occurrences")
            .select("id")
            .in("condominium_id", condoIds);

          if (occurrencesData && occurrencesData.length > 0) {
            const { count: fCount } = await supabase
              .from("fines")
              .select("*", { count: "exact", head: true })
              .in(
                "occurrence_id",
                occurrencesData.map((o) => o.id)
              )
              .eq("status", "em_aberto");

            finesCount = fCount || 0;
          }
        }

        setStats({
          condominiums: condoCount || 0,
          residents: residentsCount,
          occurrences: occurrencesCount,
          pendingFines: finesCount,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const statCards = [
    {
      title: "Condomínios",
      value: stats.condominiums,
      icon: Building2,
      gradient: "from-emerald-500 to-emerald-600",
      action: () => navigate("/condominiums"),
    },
    {
      title: "Moradores",
      value: stats.residents,
      icon: Users,
      gradient: "from-blue-500 to-blue-600",
      action: () => navigate("/condominiums"),
    },
    {
      title: "Ocorrências",
      value: stats.occurrences,
      icon: FileText,
      gradient: "from-amber-500 to-orange-500",
      action: () => navigate("/occurrences"),
    },
    {
      title: "Multas Pendentes",
      value: stats.pendingFines,
      icon: DollarSign,
      gradient: "from-rose-500 to-red-500",
      action: () => navigate("/occurrences"),
    },
  ];

  const quickActions = [
    {
      icon: Building2,
      label: "Gerenciar Condomínios",
      description: "Cadastrar e editar condomínios",
      action: () => navigate("/condominiums"),
    },
    {
      icon: AlertTriangle,
      label: "Nova Ocorrência",
      description: "Registrar uma nova ocorrência",
      action: () => navigate("/occurrences"),
    },
  ];

  return (
    <DashboardLayout>
      <Helmet>
        <title>Dashboard | NotificaCondo</title>
        <meta name="description" content="Painel de gestão condominial" />
      </Helmet>

      <div className="space-y-8 animate-fade-up">
        {/* Welcome Section */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || "Síndico"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao seu painel de gestão condominial.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
              onClick={stat.action}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="h-9 w-16 mb-1" />
                  ) : (
                    <p className="font-display text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Ações Rápidas
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="p-4 rounded-xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <action.icon className="w-5 h-5 text-primary" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{action.label}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {stats.condominiums === 0 && !loading && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Nenhum condomínio cadastrado
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Comece cadastrando seu primeiro condomínio para gerenciar ocorrências,
                notificações e multas.
              </p>
              <Button onClick={() => navigate("/condominiums")}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Condomínio
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
