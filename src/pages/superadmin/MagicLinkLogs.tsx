import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { MagicLinkAccessLogs } from "@/components/superadmin/MagicLinkAccessLogs";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

export default function MagicLinkLogs() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs de Magic Link | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[
          { label: "Logs", href: "/superadmin/logs" },
          { label: "Magic Link" }
        ]} />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Logs de Magic Link</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de acessos via links mágicos para rastreabilidade e suporte
          </p>
        </div>
        <MagicLinkAccessLogs />
      </div>
    </DashboardLayout>
  );
}
