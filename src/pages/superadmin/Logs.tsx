import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { AuditLogs } from "@/components/superadmin/AuditLogs";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Link2 } from "lucide-react";

export default function Logs() {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs de Auditoria | Super Admin</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "Logs de Auditoria" }]} />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Logs de Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de ações realizadas na plataforma
          </p>
        </div>

        {/* Submenu de Logs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/superadmin/logs">
            <Card className="hover:bg-muted/50 transition-colors border-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Logs de Auditoria</CardTitle>
                    <CardDescription className="text-xs">
                      Ações de INSERT, UPDATE e DELETE
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/superadmin/logs/magic-link">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Link2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Logs de Magic Link</CardTitle>
                    <CardDescription className="text-xs">
                      Acessos via links mágicos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <AuditLogs />
      </div>
    </DashboardLayout>
  );
}
