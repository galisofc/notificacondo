import { useEffect, useState } from "react";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Home,
  Calendar,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ResidentBreadcrumbs from "@/components/resident/ResidentBreadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

interface ResidentStats {
  totalOccurrences: number;
  pendingDefenses: number;
}

interface Occurrence {
  id: string;
  title: string;
  type: string;
  status: string;
  occurred_at: string;
  created_at: string;
}


const ResidentDashboard = () => {
  const { user } = useAuth();
  const { residentInfo, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { date: formatDate } = useDateFormatter();

  const [stats, setStats] = useState<ResidentStats>({
    totalOccurrences: 0,
    pendingDefenses: 0,
  });
  const [recentOccurrences, setRecentOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!residentInfo) return;

      try {
        const { data: occurrencesData, error: occError } = await supabase
          .from("occurrences")
          .select("*")
          .eq("resident_id", residentInfo.id)
          .order("created_at", { ascending: false });

        if (occError) throw occError;

        const occurrences = occurrencesData || [];
        setRecentOccurrences(occurrences.slice(0, 5));

        const pendingDefenseCount = occurrences.filter(
          (o) => o.status === "notificado"
        ).length;

        setStats({
          totalOccurrences: occurrences.length,
          pendingDefenses: pendingDefenseCount,
        });
      } catch (error) {
        console.error("Error fetching resident data:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (residentInfo) {
      fetchData();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [residentInfo, roleLoading]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registrada: "bg-blue-500/10 text-blue-500",
      notificado: "bg-amber-500/10 text-amber-500",
      em_defesa: "bg-purple-500/10 text-purple-500",
      arquivada: "bg-muted text-muted-foreground",
      advertido: "bg-orange-500/10 text-orange-500",
      multado: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      registrada: "Registrada",
      notificado: "Notificado",
      em_defesa: "Em Defesa",
      arquivada: "Arquivada",
      advertido: "Advertido",
      multado: "Multado",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      advertencia: "bg-amber-500/10 text-amber-500",
      notificacao: "bg-blue-500/10 text-blue-500",
      multa: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || ""}`}>
        {labels[type] || type}
      </span>
    );
  };


  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!residentInfo) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Perfil não encontrado
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Seu perfil de morador ainda não foi cadastrado. Entre em contato com o síndico do
            seu condomínio.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      title: "Ocorrências",
      value: stats.totalOccurrences,
      icon: FileText,
      gradient: "from-primary to-blue-600",
    },
    {
      title: "Defesas Pendentes",
      value: stats.pendingDefenses,
      icon: Shield,
      gradient: "from-violet-500 to-purple-600",
    },
  ];

  return (
    <DashboardLayout>
      <Helmet>
        <title>Dashboard | Área do Morador</title>
        <meta name="description" content="Painel do morador" />
      </Helmet>

      <div className="space-y-6 md:space-y-8 animate-fade-up">
        <ResidentBreadcrumbs items={[{ label: "Dashboard" }]} />
        {/* Pending Defense Alert */}
        {stats.pendingDefenses > 0 && (
          <div 
            className="p-3 md:p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 cursor-pointer hover:border-amber-500/50 transition-all animate-pulse-slow"
            onClick={() => navigate("/resident/occurrences")}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm md:text-base text-foreground flex items-center gap-2">
                  Você tem {stats.pendingDefenses} {stats.pendingDefenses === 1 ? 'ocorrência pendente' : 'ocorrências pendentes'} de defesa
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Clique para visualizar e enviar sua defesa
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Olá, {residentInfo.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Bem-vindo ao seu painel de morador.</p>
        </div>

        {/* Apartment Info Card */}
        <Card className="bg-card border-border shadow-card">
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Home className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Meu Apartamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Condomínio</p>
                <p className="font-semibold text-sm md:text-base text-foreground">{residentInfo.condominium_name}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">BLOCO</p>
                <p className="font-semibold text-sm md:text-base text-foreground">{residentInfo.block_name}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Apartamento</p>
                <p className="font-semibold text-sm md:text-base text-foreground">{residentInfo.apartment_number}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Tipo</p>
                <p className="font-semibold text-sm md:text-base text-foreground">
                  {residentInfo.is_owner ? "Proprietário" : "Inquilino"}
                  {residentInfo.is_responsible && " (Responsável)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <CardContent className="p-3 md:p-5">
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div
                    className={`w-9 h-9 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="h-7 md:h-9 w-12 md:w-16 mb-1" />
                  ) : (
                    <p className="font-display text-xl md:text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-xs md:text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Occurrences */}
        <Card className="bg-card border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Ocorrências Recentes
            </CardTitle>
            {recentOccurrences.length > 0 && (
              <button
                onClick={() => navigate("/resident/occurrences")}
                className="text-xs md:text-sm text-primary hover:underline flex items-center gap-1"
              >
                Ver todas
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {recentOccurrences.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Você não possui nenhuma ocorrência registrada.
                </p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {recentOccurrences.map((occurrence) => (
                  <div
                    key={occurrence.id}
                    className="p-3 md:p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => navigate(`/resident/occurrences/${occurrence.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3 md:gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getTypeBadge(occurrence.type)}
                          {getStatusBadge(occurrence.status)}
                        </div>
                        <h4 className="font-medium text-sm md:text-base text-foreground mb-1">{occurrence.title}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(occurrence.occurred_at)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default ResidentDashboard;
