import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, PackagePlus, PackageCheck, Clock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageCard } from "@/components/packages/PackageCard";
import { usePackages } from "@/hooks/usePackages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function PorteiroDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [condominiumIds, setCondominiumIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    pickedUpToday: 0,
  });

  // Fetch porter's condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data: userCondos } = await supabase
        .from("user_condominiums")
        .select("condominium_id")
        .eq("user_id", user.id);

      if (userCondos) {
        setCondominiumIds(userCondos.map((uc) => uc.condominium_id));
      }

      // Fetch user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setUserName(profile.full_name.split(" ")[0]);
      }
    };

    fetchCondominiums();
  }, [user]);

  const { packages, loading } = usePackages({
    condominiumIds,
    limit: 10,
    realtime: true,
  });

  // Calculate stats
  useEffect(() => {
    if (!packages.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = packages.filter((p) => p.status === "pendente").length;
    const pickedUpToday = packages.filter((p) => {
      if (p.status !== "retirada" || !p.picked_up_at) return false;
      const pickedUpDate = new Date(p.picked_up_at);
      pickedUpDate.setHours(0, 0, 0, 0);
      return pickedUpDate.getTime() === today.getTime();
    }).length;

    setStats({
      total: packages.length,
      pending,
      pickedUpToday,
    });
  }, [packages]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {userName || "Porteiro"}! 👋
            </h1>
            <p className="text-muted-foreground">
              Gerencie as encomendas do condomínio
            </p>
          </div>
          <Button onClick={() => navigate("/porteiro/registrar")} className="gap-2">
            <PackagePlus className="w-4 h-4" />
            Registrar Encomenda
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Encomendas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Últimas registradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Aguardando retirada</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retiradas Hoje</CardTitle>
              <PackageCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pickedUpToday}</div>
              <p className="text-xs text-muted-foreground">Entregues aos moradores</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Packages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Últimas Encomendas</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/porteiro/encomendas")}
            >
              Ver todas
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma encomenda</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Registre a primeira encomenda do dia
                </p>
                <Button onClick={() => navigate("/porteiro/registrar")} className="gap-2">
                  <PackagePlus className="w-4 h-4" />
                  Registrar Encomenda
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {packages.slice(0, 6).map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  id={pkg.id}
                  photoUrl={pkg.photo_url}
                  pickupCode={pkg.pickup_code}
                  status={pkg.status}
                  apartmentNumber={pkg.apartment?.number || ""}
                  blockName={pkg.block?.name || ""}
                  condominiumName={pkg.condominium?.name}
                  receivedAt={pkg.received_at}
                  description={pkg.description || undefined}
                  showCondominium={condominiumIds.length > 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
