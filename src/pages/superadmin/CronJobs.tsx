import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { CronJobsLogs } from "@/components/superadmin/CronJobsLogs";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

export default function CronJobs() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Cron Jobs | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Cron Jobs" }]} />
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">Cron Jobs</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie e monitore as tarefas agendadas do sistema
          </p>
        </div>
        <CronJobsLogs />
      </div>
    </DashboardLayout>
  );
}
