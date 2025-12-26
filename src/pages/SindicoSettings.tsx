import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  Bell,
  AlertTriangle,
  DollarSign,
  Crown,
  Zap,
  Building2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";

interface CondominiumWithSubscription {
  id: string;
  name: string;
  subscription: {
    id: string;
    plan: "start" | "essencial" | "profissional" | "enterprise";
    active: boolean;
    notifications_limit: number;
    notifications_used: number;
    warnings_limit: number;
    warnings_used: number;
    fines_limit: number;
    fines_used: number;
    current_period_start: string | null;
    current_period_end: string | null;
  } | null;
}

interface Profile {
  full_name: string;
  email: string;
  phone: string | null;
}

const PLAN_DETAILS = {
  start: {
    name: "Start",
    description: "Ideal para começar",
    color: "from-slate-500 to-slate-600",
    icon: Zap,
    features: ["10 notificações/mês", "10 advertências/mês", "Sem multas"],
  },
  essencial: {
    name: "Essencial",
    description: "Para condomínios pequenos",
    color: "from-blue-500 to-blue-600",
    icon: Building2,
    features: ["50 notificações/mês", "50 advertências/mês", "10 multas/mês"],
  },
  profissional: {
    name: "Profissional",
    description: "Para condomínios médios",
    color: "from-purple-500 to-purple-600",
    icon: Crown,
    features: ["200 notificações/mês", "200 advertências/mês", "50 multas/mês", "Relatórios avançados"],
  },
  enterprise: {
    name: "Enterprise",
    description: "Para grandes condomínios",
    color: "from-amber-500 to-amber-600",
    icon: Crown,
    features: ["Ilimitado", "Suporte prioritário", "API personalizada"],
  },
};

const SindicoSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [condominiums, setCondominiums] = useState<CondominiumWithSubscription[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedCondo, setSelectedCondo] = useState<CondominiumWithSubscription | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user's condominiums
        const { data: condosData, error: condosError } = await supabase
          .from("condominiums")
          .select("id, name")
          .eq("owner_id", user.id);

        if (condosError) throw condosError;

        // Fetch subscriptions for each condominium
        const condosWithSubs = await Promise.all(
          (condosData || []).map(async (condo) => {
            const { data: subData } = await supabase
              .from("subscriptions")
              .select("*")
              .eq("condominium_id", condo.id)
              .maybeSingle();
            return { ...condo, subscription: subData } as CondominiumWithSubscription;
          })
        );

        setCondominiums(condosWithSubs);
        if (condosWithSubs.length > 0) {
          setSelectedCondo(condosWithSubs[0]);
        }

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching settings data:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-primary";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const subscription = selectedCondo?.subscription;
  const currentPlan = subscription?.plan || "start";
  const planInfo = PLAN_DETAILS[currentPlan];
  const PlanIcon = planInfo.icon;

  return (
    <DashboardLayout>
      <Helmet>
        <title>Configurações | CondoManager</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu plano e limites de uso
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Condominium Selector */}
          {condominiums.length > 1 && (
            <Card className="lg:col-span-3 bg-gradient-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selecionar Condomínio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {condominiums.map((condo) => (
                    <Button
                      key={condo.id}
                      variant={selectedCondo?.id === condo.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCondo(condo)}
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      {condo.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Plan Card */}
          <Card className="lg:col-span-2 bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {selectedCondo ? `Plano - ${selectedCondo.name}` : "Plano Atual"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${planInfo.color} flex items-center justify-center shrink-0`}>
                  <PlanIcon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-foreground">{planInfo.name}</h3>
                    {subscription?.active && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mb-4">{planInfo.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {planInfo.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {subscription?.current_period_end && (
                <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Período atual: {" "}
                    <span className="font-medium text-foreground">
                      {subscription.current_period_start && 
                        new Date(subscription.current_period_start).toLocaleDateString("pt-BR")}
                      {" - "}
                      {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upgrade Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Precisa de mais?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Faça upgrade do seu plano para ter mais recursos e limites maiores.
                </p>
                <Button 
                  variant="hero" 
                  className="w-full"
                  onClick={() => toast({ title: "Em breve", description: "Integração de pagamento em desenvolvimento." })}
                >
                  Ver Planos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Stats */}
        <h2 className="font-display text-xl font-semibold text-foreground mt-8 mb-4">
          Uso do Período
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Notifications Usage */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-foreground">
                  {subscription?.notifications_used || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {subscription?.notifications_limit || 0}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(
                  subscription?.notifications_used || 0, 
                  subscription?.notifications_limit || 1
                )} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {(subscription?.notifications_limit || 0) - (subscription?.notifications_used || 0)} restantes
              </p>
            </CardContent>
          </Card>

          {/* Warnings Usage */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Advertências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-foreground">
                  {subscription?.warnings_used || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {subscription?.warnings_limit || 0}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(
                  subscription?.warnings_used || 0, 
                  subscription?.warnings_limit || 1
                )} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {(subscription?.warnings_limit || 0) - (subscription?.warnings_used || 0)} restantes
              </p>
            </CardContent>
          </Card>

          {/* Fines Usage */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-red-500" />
                Multas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-foreground">
                  {subscription?.fines_used || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {subscription?.fines_limit || 0}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(
                  subscription?.fines_used || 0, 
                  subscription?.fines_limit || 1
                )} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {(subscription?.fines_limit || 0) - (subscription?.fines_used || 0)} restantes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Account Info */}
        <h2 className="font-display text-xl font-semibold text-foreground mt-8 mb-4">
          Dados da Conta
        </h2>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nome</p>
                <p className="font-medium text-foreground">{profile?.full_name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium text-foreground">{profile?.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefone</p>
                <p className="font-medium text-foreground">{profile?.phone || "-"}</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border/50">
              <Button 
                variant="outline" 
                onClick={() => navigate("/sindico/profile")}
              >
                Editar Perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SindicoSettings;
