import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HandoverRecord {
  id: string;
  incoming_porter_name: string;
  shift_ended_at: string;
  general_observations: string | null;
  created_at: string;
  outgoing_porter_id: string;
  outgoing_porter_name?: string;
  items?: { item_name: string; category: string | null; is_ok: boolean; observation: string | null }[];
}

export default function SindicoPortariaShiftHandovers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Fetch condominiums owned by síndico
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");

      if (data) {
        setCondominiums(data);
        if (data.length === 1) setSelectedCondominium(data[0].id);
      }
    };
    fetchCondominiums();
  }, [user]);

  // Fetch handovers
  const { data: handovers = [], isLoading } = useQuery({
    queryKey: ["sindico-shift-handovers", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("shift_handovers")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Fetch porter names
      const porterIds = [...new Set((data || []).map((h: any) => h.outgoing_porter_id))];
      let porterNames: Record<string, string> = {};
      if (porterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", porterIds);
        if (profiles) {
          porterNames = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]));
        }
      }

      return (data || []).map((h: any) => ({
        ...h,
        outgoing_porter_name: porterNames[h.outgoing_porter_id] || "Porteiro",
      })) as HandoverRecord[];
    },
    enabled: !!selectedCondominium,
  });

  // Fetch items for expanded history
  const fetchHandoverItems = async (handoverId: string) => {
    const { data } = await supabase
      .from("shift_handover_items")
      .select("*")
      .eq("handover_id", handoverId);
    return data || [];
  };

  const toggleHistory = async (id: string) => {
    if (expandedHistory === id) {
      setExpandedHistory(null);
    } else {
      setExpandedHistory(id);
      const idx = handovers.findIndex((h) => h.id === id);
      if (idx >= 0 && !handovers[idx].items) {
        const items = await fetchHandoverItems(id);
        handovers[idx].items = items;
        queryClient.setQueryData(["sindico-shift-handovers", selectedCondominium], [...handovers]);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Passagens de Plantão</h1>
          <p className="text-muted-foreground">Acompanhe as passagens de plantão registradas pelos porteiros</p>
        </div>

        {condominiums.length > 1 && (
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecionar condomínio" /></SelectTrigger>
            <SelectContent>
              {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {!selectedCondominium ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um condomínio.</CardContent></Card>
        ) : isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : handovers.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma passagem de plantão registrada.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {handovers.map((h) => (
              <Card key={h.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => toggleHistory(h.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        <span className="text-muted-foreground">De:</span>{" "}
                        <span className="text-primary">{h.outgoing_porter_name}</span>
                        {" → "}
                        <span className="text-primary">{h.incoming_porter_name}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(h.shift_ended_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {h.general_observations && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{h.general_observations}</p>
                      )}
                    </div>
                    {expandedHistory === h.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  {expandedHistory === h.id && h.items && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      {h.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {item.is_ok ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive shrink-0" />
                          )}
                          <span className={!item.is_ok ? "text-destructive" : "text-foreground"}>{item.item_name}</span>
                          {item.observation && <span className="text-muted-foreground">— {item.observation}</span>}
                        </div>
                      ))}
                      {h.general_observations && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium text-foreground">Observações Gerais:</p>
                          <p className="text-sm text-muted-foreground">{h.general_observations}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
