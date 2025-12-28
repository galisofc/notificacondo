import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { SindicosManagement } from "@/components/superadmin/SindicosManagement";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

export default function Sindicos() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Gestão de Síndicos | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Síndicos" }]} />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Síndicos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie os síndicos cadastrados na plataforma
          </p>
        </div>
        <SindicosManagement />
      </div>
    </DashboardLayout>
  );
}
