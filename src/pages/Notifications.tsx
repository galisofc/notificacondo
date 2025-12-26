import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
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

      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Notificações WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o status de entrega das mensagens enviadas
          </p>
        </div>

        <NotificationsMonitor />
      </div>
    </DashboardLayout>
  );
}
