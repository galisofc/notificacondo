import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { AuditLogs } from "@/components/superadmin/AuditLogs";

export default function Logs() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs de Auditoria | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Logs de Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de ações realizadas na plataforma
          </p>
        </div>
        <AuditLogs />
      </div>
    </DashboardLayout>
  );
}
