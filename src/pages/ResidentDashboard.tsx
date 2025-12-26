import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  FileText,
  AlertTriangle,
  DollarSign,
  Home,
  User,
  Calendar,
  Eye,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ResidentStats {
  totalOccurrences: number;
  pendingDefenses: number;
  totalFines: number;
  pendingFines: number;
}

interface Occurrence {
  id: string;
  title: string;
  type: string;
  status: string;
  occurred_at: string;
  created_at: string;
}

interface Fine {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  occurrence_id: string;
}

const ResidentDashboard = () => {
  const { user, signOut } = useAuth();
  const { residentInfo, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<ResidentStats>({
    totalOccurrences: 0,
    pendingDefenses: 0,
    totalFines: 0,
    pendingFines: 0,
  });
  const [recentOccurrences, setRecentOccurrences] = useState<Occurrence[]>([]);
  const [pendingFines, setPendingFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!residentInfo) return;

      try {
        // Fetch occurrences for this resident
        const { data: occurrencesData, error: occError } = await supabase
          .from("occurrences")
          .select("*")
          .eq("resident_id", residentInfo.id)
          .order("created_at", { ascending: false });

        if (occError) throw occError;

        const occurrences = occurrencesData || [];
        setRecentOccurrences(occurrences.slice(0, 5));

        // Count pending defenses (occurrences in 'notificado' or 'em_defesa' status)
        const pendingDefenseCount = occurrences.filter(
          (o) => o.status === "notificado" || o.status === "em_defesa"
        ).length;

        // Fetch fines for this resident
        const { data: finesData, error: finesError } = await supabase
          .from("fines")
          .select("*")
          .eq("resident_id", residentInfo.id);

        if (finesError) throw finesError;

        const fines = finesData || [];
        const pendingFinesList = fines.filter((f) => f.status === "em_aberto" || f.status === "vencido");
        setPendingFines(pendingFinesList);

        setStats({
          totalOccurrences: occurrences.length,
          pendingDefenses: pendingDefenseCount,
          totalFines: fines.length,
          pendingFines: pendingFinesList.length,
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registrada: "bg-blue-500/10 text-blue-500",
      notificado: "bg-amber-500/10 text-amber-500",
      em_defesa: "bg-purple-500/10 text-purple-500",
      analisando: "bg-cyan-500/10 text-cyan-500",
      arquivada: "bg-muted text-muted-foreground",
      advertido: "bg-orange-500/10 text-orange-500",
      multado: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      registrada: "Registrada",
      notificado: "Notificado",
      em_defesa: "Em Defesa",
      analisando: "Analisando",
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!residentInfo) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-foreground">CondoMaster</span>
            </div>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">
              Perfil não encontrado
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Seu perfil de morador ainda não foi cadastrado. Entre em contato com o síndico do seu condomínio.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const statCards = [
    {
      icon: FileText,
      label: "Ocorrências",
      value: stats.totalOccurrences,
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: Shield,
      label: "Defesas Pendentes",
      value: stats.pendingDefenses,
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: DollarSign,
      label: "Multas Pendentes",
      value: stats.pendingFines,
      color: "from-red-500 to-red-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">CondoMaster</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/resident/profile")}>
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Olá, {residentInfo.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao seu painel de morador.
          </p>
        </div>

        {/* Apartment Info Card */}
        <Card className="bg-gradient-card border-border/50 mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Meu Apartamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Condomínio</p>
                <p className="font-semibold text-foreground">{residentInfo.condominium_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bloco</p>
                <p className="font-semibold text-foreground">{residentInfo.block_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Apartamento</p>
                <p className="font-semibold text-foreground">{residentInfo.apartment_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-semibold text-foreground">
                  {residentInfo.is_owner ? "Proprietário" : "Inquilino"}
                  {residentInfo.is_responsible && " (Responsável)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-gradient-card border border-border/50"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="font-display text-3xl font-bold text-foreground mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Occurrences */}
        <Card className="bg-gradient-card border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Minhas Ocorrências
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOccurrences.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-muted-foreground">
                  Você não possui nenhuma ocorrência registrada.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOccurrences.map((occurrence) => (
                  <div
                    key={occurrence.id}
                    className="p-4 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => navigate(`/resident/occurrences/${occurrence.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeBadge(occurrence.type)}
                          {getStatusBadge(occurrence.status)}
                        </div>
                        <h4 className="font-medium text-foreground mb-1">
                          {occurrence.title}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(occurrence.occurred_at).toLocaleDateString("pt-BR")}
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

        {/* Pending Fines */}
        {pendingFines.length > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-500" />
                Multas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingFines.map((fine) => (
                  <div
                    key={fine.id}
                    className="p-4 rounded-xl bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(fine.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Vencimento: {new Date(fine.due_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        fine.status === "vencido" 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {fine.status === "vencido" ? "Vencida" : "Em Aberto"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ResidentDashboard;
