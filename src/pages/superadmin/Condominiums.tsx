import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { CondominiumsManagement } from "@/components/superadmin/CondominiumsManagement";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

export default function Condominiums() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Condomínios | Super Admin</title>
        <meta name="description" content="Gerenciamento de condomínios cadastrados na plataforma" />
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Condomínios" }]} />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Condomínios</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os condomínios cadastrados na plataforma
          </p>
        </div>
        <CondominiumsManagement />
      </div>
    </DashboardLayout>
  );
}
