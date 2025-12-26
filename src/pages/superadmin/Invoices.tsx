import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { InvoicesManagement } from "@/components/superadmin/InvoicesManagement";

export default function Invoices() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Central de Faturas | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Faturas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as faturas e pagamentos dos condomínios
          </p>
        </div>
        <InvoicesManagement />
      </div>
    </DashboardLayout>
  );
}
