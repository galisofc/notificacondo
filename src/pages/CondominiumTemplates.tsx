import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { CondominiumWhatsAppTemplates } from "@/components/sindico/CondominiumWhatsAppTemplates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle } from "lucide-react";

export default function CondominiumTemplates() {
  const { user } = useAuth();
  const [selectedCondominiumId, setSelectedCondominiumId] = useState<string>("");

  const { data: condominiums, isLoading } = useQuery({
    queryKey: ["sindico-condominiums", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-select first condominium
  if (condominiums?.length && !selectedCondominiumId) {
    setSelectedCondominiumId(condominiums[0].id);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Templates WhatsApp | CondoManager</title>
      </Helmet>
      <div className="space-y-6 animate-fade-up">
        <SindicoBreadcrumbs items={[{ label: "Templates WhatsApp" }]} />
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-primary" />
            Templates WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalize as mensagens de WhatsApp do seu condomínio
          </p>
        </div>

        {condominiums && condominiums.length > 1 && (
          <div className="space-y-2 max-w-xs">
            <Label>Condomínio</Label>
            <Select value={selectedCondominiumId} onValueChange={setSelectedCondominiumId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um condomínio" />
              </SelectTrigger>
              <SelectContent>
                {condominiums.map((condo) => (
                  <SelectItem key={condo.id} value={condo.id}>
                    {condo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedCondominiumId && (
          <CondominiumWhatsAppTemplates condominiumId={selectedCondominiumId} />
        )}
      </div>
    </DashboardLayout>
  );
}
