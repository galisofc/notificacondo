import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { WhatsAppConfig } from "@/components/superadmin/WhatsAppConfig";

export default function WhatsApp() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Configuração WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Configure a integração com WhatsApp
          </p>
        </div>
        <WhatsAppConfig />
      </div>
    </DashboardLayout>
  );
}
