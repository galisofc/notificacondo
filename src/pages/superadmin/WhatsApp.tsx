import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { WhatsAppConfig } from "@/components/superadmin/WhatsAppConfig";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

export default function WhatsApp() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Configuração WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }]} />
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Configure a integração com WhatsApp
          </p>
        </div>
        <WhatsAppConfig />
      </div>
    </DashboardLayout>
  );
}
