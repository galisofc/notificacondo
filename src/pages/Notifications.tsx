import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { NotificationsMonitor } from "@/components/notifications/NotificationsMonitor";

export default function Notifications() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Monitoramento de Notificações | CondoManager</title>
        <meta
          name="description"
          content="Monitore o status das notificações WhatsApp enviadas aos moradores"
        />
      </Helmet>

      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SindicoBreadcrumbs items={[{ label: "Notificações WhatsApp" }]} />
        
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">
            Notificações WhatsApp
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Acompanhe o status de entrega das mensagens enviadas
          </p>
        </div>

        <NotificationsMonitor />
      </div>
    </DashboardLayout>
  );
}
