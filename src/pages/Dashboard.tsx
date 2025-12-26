import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Building2, 
  FileText, 
  AlertTriangle, 
  DollarSign, 
  Users,
  Plus,
  LogOut,
  Bell,
  Settings,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  condominiums: number;
  residents: number;
  occurrences: number;
  pendingFines: number;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setProfile(profileData);

        // Fetch condominiums count
        const { count: condoCount } = await supabase
          .from("condominiums")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id);

        // Fetch user's condominium IDs for other queries
        const { data: condos } = await supabase
          .from("condominiums")
          .select("id")
          .eq("owner_id", user.id);

        const condoIds = condos?.map(c => c.id) || [];

        let residentsCount = 0;
        let occurrencesCount = 0;
        let finesCount = 0;

        if (condoIds.length > 0) {
          // Fetch blocks for these condominiums
          const { data: blocks } = await supabase
            .from("blocks")
            .select("id")
            .in("condominium_id", condoIds);
          
          const blockIds = blocks?.map(b => b.id) || [];

          if (blockIds.length > 0) {
            // Fetch apartments
            const { data: apartments } = await supabase
              .from("apartments")
              .select("id")
              .in("block_id", blockIds);
            
            const apartmentIds = apartments?.map(a => a.id) || [];

            if (apartmentIds.length > 0) {
              // Count residents
              const { count: resCount } = await supabase
                .from("residents")
                .select("*", { count: "exact", head: true })
                .in("apartment_id", apartmentIds);
              
              residentsCount = resCount || 0;
            }
          }

          // Count occurrences
          const { count: occCount } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds);
          
          occurrencesCount = occCount || 0;

          // Count pending fines
          const { data: occurrencesData } = await supabase
            .from("occurrences")
            .select("id")
            .in("condominium_id", condoIds);
          
          if (occurrencesData && occurrencesData.length > 0) {
            const { count: fCount } = await supabase
              .from("fines")
              .select("*", { count: "exact", head: true })
              .in("occurrence_id", occurrencesData.map(o => o.id))
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

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Até logo!",
      description: "Você saiu da sua conta.",
    });
    navigate("/");
  };

  const statCards = [
    {
      icon: Building2,
      label: "Condomínios",
      value: stats.condominiums,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      icon: Users,
      label: "Moradores",
      value: stats.residents,
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: FileText,
      label: "Ocorrências",
      value: stats.occurrences,
      color: "from-amber-500 to-orange-500",
    },
    {
      icon: DollarSign,
      label: "Multas Pendentes",
      value: stats.pendingFines,
      color: "from-rose-500 to-red-500",
    },
  ];

  const quickActions = [
    {
      icon: Building2,
      label: "Novo Condomínio",
      description: "Cadastrar um novo condomínio",
      action: () => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" }),
    },
    {
      icon: AlertTriangle,
      label: "Nova Ocorrência",
      description: "Registrar uma nova ocorrência",
      action: () => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" }),
    },
    {
      icon: Bell,
      label: "Enviar Notificação",
      description: "Notificar um morador",
      action: () => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" }),
    },
    {
      icon: FileText,
      label: "Gerar Relatório",
      description: "Exportar dossiê jurídico",
      action: () => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" }),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                Notifica<span className="text-gradient">Condo</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <div className="h-8 w-px bg-border" />
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Olá, {profile?.full_name?.split(" ")[0] || "Síndico"}! 👋
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao seu painel de gestão condominial.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="font-display text-3xl font-bold text-foreground mb-1">
                {loading ? "..." : stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Ações Rápidas
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
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
            <Button variant="hero" onClick={() => toast({ title: "Em breve", description: "Funcionalidade em desenvolvimento" })}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Condomínio
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
