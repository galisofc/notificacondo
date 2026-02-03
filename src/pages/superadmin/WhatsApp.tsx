import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { TemplateGrid } from "@/components/superadmin/whatsapp/TemplateGrid";

export default function WhatsApp() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Templates WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-4 sm:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }, { label: "Templates" }]} />
        
        <div>
          <h1 className="font-display text-lg sm:text-xl md:text-3xl font-bold text-foreground">
            Templates WhatsApp
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Gerencie os templates de mensagens para a API oficial da Meta
          </p>
        </div>

        <TemplateGrid />
      </div>
    </DashboardLayout>
  );
}
