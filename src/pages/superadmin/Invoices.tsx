import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { InvoicesManagement } from "@/components/superadmin/InvoicesManagement";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Button } from "@/components/ui/button";

export default function Invoices() {
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  return (
    <DashboardLayout>
      <Helmet>
        <title>Central de Faturas | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Faturas" }]} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Faturas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todas as faturas e pagamentos dos condomínios
            </p>
          </div>
          <Button onClick={() => setCreateInvoiceOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fatura Avulsa
          </Button>
        </div>
        <InvoicesManagement 
          createInvoiceOpen={createInvoiceOpen}
          onCreateInvoiceOpenChange={setCreateInvoiceOpen}
        />
      </div>
    </DashboardLayout>
  );
}
