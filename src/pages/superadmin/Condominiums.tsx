import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { CondominiumsOverview } from "@/components/superadmin/CondominiumsOverview";

export default function Condominiums() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Visão de Condomínios | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Condomínios</h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os condomínios cadastrados
          </p>
        </div>
        <CondominiumsOverview />
      </div>
    </DashboardLayout>
  );
}
