import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function ZeladorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ emDia: 0, proximas: 0, atrasadas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const { data: userCondos } = await supabase
        .from("user_condominiums")
        .select("condominium_id")
        .eq("user_id", user.id);

      const condoIds = userCondos?.map((c) => c.condominium_id) || [];
      if (condoIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: tasks } = await supabase
        .from("maintenance_tasks")
        .select("status")
        .in("condominium_id", condoIds)
        .eq("is_active", true);

      const s = { emDia: 0, proximas: 0, atrasadas: 0 };
      (tasks || []).forEach((t) => {
        if (t.status === "em_dia") s.emDia++;
        else if (t.status === "proximo") s.proximas++;
        else if (t.status === "atrasado") s.atrasadas++;
      });
      setStats(s);
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            Painel do Zelador
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe as manutenções do condomínio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em dia</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{loading ? "—" : stats.emDia}</div>
              <p className="text-xs text-muted-foreground">manutenções em dia</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Próximas</CardTitle>
              <Clock className="w-5 h-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{loading ? "—" : stats.proximas}</div>
              <p className="text-xs text-muted-foreground">manutenções próximas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{loading ? "—" : stats.atrasadas}</div>
              <p className="text-xs text-muted-foreground">manutenções atrasadas</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
