import { useState } from "react";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { ConnectionStatus, TemplatesList, ConfigSheet } from "@/components/superadmin/whatsapp";

export default function WhatsApp() {
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <DashboardLayout>
      <Helmet>
        <title>Configuração WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }]} />
        
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">
            WhatsApp
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Configure a integração e gerencie os templates de mensagens
          </p>
        </div>

        {/* Connection Status Card */}
        <ConnectionStatus onConfigure={() => setConfigOpen(true)} />

        {/* Templates List with Categories */}
        <TemplatesList />

        {/* Config Sheet */}
        <ConfigSheet open={configOpen} onOpenChange={setConfigOpen} />
      </div>
    </DashboardLayout>
  );
}
