import { useState } from "react";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { WabaTemplateStatusCard, TemplateWabaLinkingCard } from "@/components/superadmin/whatsapp";
import { WabaTemplateSubmitDialog } from "@/components/superadmin/whatsapp/WabaTemplateSubmitDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function WhatsApp() {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  return (
    <DashboardLayout>
      <Helmet>
        <title>Templates WhatsApp | Super Admin</title>
      </Helmet>
      <div className="space-y-4 sm:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[{ label: "WhatsApp" }, { label: "Templates" }]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-lg sm:text-xl md:text-3xl font-bold text-foreground">
              Templates
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
              Gerencie os templates de mensagens
            </p>
          </div>
          
          <Button onClick={() => setSubmitDialogOpen(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Criar / Vincular Template
          </Button>
        </div>

        {/* WABA Template Status Card - No topo */}
        <WabaTemplateStatusCard />

        {/* WABA Template Linking Card */}
        <TemplateWabaLinkingCard />
        
        {/* Dialog para criar/vincular templates */}
        <WabaTemplateSubmitDialog 
          open={submitDialogOpen} 
          onOpenChange={setSubmitDialogOpen} 
        />
      </div>
    </DashboardLayout>
  );
}