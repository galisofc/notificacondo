import { Helmet } from "react-helmet-async";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { NotificationsMonitor } from "@/components/notifications/NotificationsMonitor";

export default function Notifications() {
  return (
    <>
      <Helmet>
        <title>Monitoramento de Notificações | CondoManager</title>
        <meta
          name="description"
          content="Monitore o status das notificações WhatsApp enviadas aos moradores"
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Notificações WhatsApp</h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o status de entrega das mensagens enviadas
            </p>
          </div>

          <NotificationsMonitor />
        </main>
      </div>
    </>
  );
}
