import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { SubscriptionsMonitor } from "@/components/superadmin/SubscriptionsMonitor";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
export default function Subscriptions() {
  return <DashboardLayout>
      <Helmet>
        <title>Monitoramento de Assinaturas | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{
        label: "Assinantes"
      }]} />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Assinantes</h1>
          <p className="text-muted-foreground mt-1">
            Monitore as assinaturas dos condomínios na plataforma
          </p>
        </div>
        <SubscriptionsMonitor />
      </div>
    </DashboardLayout>;
}