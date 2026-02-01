import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { WabaTemplateStatusCard, TemplateWabaLinkingCard } from "@/components/superadmin/whatsapp";

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
            Templates
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Gerencie os templates de mensagens
          </p>
        </div>

        {/* WABA Template Status Card - No topo */}
        <WabaTemplateStatusCard />

        {/* WABA Template Linking Card */}
        <TemplateWabaLinkingCard />
      </div>
    </DashboardLayout>
  );
}
