import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, History, User, CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistItem {
  id: string;
  item_name: string;
  category: string;
  is_ok: boolean;
  observation: string;
}

interface HandoverRecord {
  id: string;
  incoming_porter_name: string;
  shift_ended_at: string;
  general_observations: string | null;
  created_at: string;
  items?: { item_name: string; category: string | null; is_ok: boolean; observation: string | null }[];
}

export default function ShiftHandover() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [incomingPorterName, setIncomingPorterName] = useState("");
  const [generalObservations, setGeneralObservations] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [copied, setCopied] = useState(false);
  const [porterName, setPorterName] = useState("");
  // Fetch porter's name from profile
  useEffect(() => {
    const fetchPorterName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      if (data) setPorterName(data.full_name);
    };
    fetchPorterName();
  }, [user]);

  // Fetch condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_condominiums")
        .select("condominium_id, condominiums:condominium_id(id, name)")
        .eq("user_id", user.id);

      if (data) {
        const condos = data.map((d: any) => ({
          id: d.condominiums.id,
          name: d.condominiums.name,
        }));
        setCondominiums(condos);
        if (condos.length === 1) setSelectedCondominium(condos[0].id);
      }
    };
    fetchCondominiums();
  }, [user]);

  // Fetch checklist templates
  const { data: templates = [] } = useQuery({
    queryKey: ["shift-checklist-templates", selectedCondominium],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_checklist_templates")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCondominium,
  });

  // Update checklist items when templates load
  useEffect(() => {
    if (templates.length > 0) {
      setChecklistItems(
        templates.map((t) => ({
          id: t.id,
          item_name: t.item_name,
          category: t.category || "Geral",
          is_ok: true,
          observation: "",
        }))
      );
    } else {
      setChecklistItems([]);
    }
  }, [templates]);

  // Fetch history
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["shift-handovers", selectedCondominium],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_handovers")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as HandoverRecord[];
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
      // Load items if not cached
      const idx = history.findIndex((h) => h.id === id);
      if (idx >= 0 && !history[idx].items) {
        const items = await fetchHandoverItems(id);
        history[idx].items = items;
        queryClient.setQueryData(["shift-handovers", selectedCondominium], [...history]);
      }
    }
  };

  // Submit handover
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Create handover
      const { data: handover, error: handoverError } = await supabase
        .from("shift_handovers")
        .insert({
          condominium_id: selectedCondominium,
          outgoing_porter_id: user!.id,
          incoming_porter_name: incomingPorterName,
          general_observations: generalObservations || null,
        })
        .select("id")
        .single();

      if (handoverError) throw handoverError;

      // Create items
      if (checklistItems.length > 0) {
        const items = checklistItems.map((item) => ({
          handover_id: handover.id,
          item_name: item.item_name,
          category: item.category,
          is_ok: item.is_ok,
          observation: item.observation || null,
        }));

        const { error: itemsError } = await supabase.from("shift_handover_items").insert(items);
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      // Build summary text
      const itemsNotOk = checklistItems.filter((i) => !i.is_ok);
      const hasIssues = itemsNotOk.length > 0;
      
      let text = `EU QRA ${porterName || "Porteiro"} PASSANDO O QTH PARA QRA ${incomingPorterName}`;
      text += hasIssues ? " COM AS SEGUINTES OBSERVAÇÕES:" : " SEM NOVIDADES.";
      text += "\n\n📋 CHECKLIST:";
      
      Object.entries(groupedItems).forEach(([category, { items }]) => {
        text += `\n\n🔹 ${category}:`;
        items.forEach((item) => {
          const status = item.is_ok ? "✅" : "❌";
          text += `\n${status} ${item.item_name}`;
          if (!item.is_ok && item.observation) {
            text += ` — ${item.observation}`;
          }
        });
      });

      if (generalObservations) {
        text += `\n\n📝 Observações Gerais:\n${generalObservations}`;
      }

      setSummaryText(text);
      setShowSummaryModal(true);

      queryClient.invalidateQueries({ queryKey: ["shift-handovers"] });
      toast({ title: "Passagem de plantão registrada com sucesso!" });
      setIncomingPorterName("");
      setGeneralObservations("");
      setChecklistItems(
        templates.map((t) => ({
          id: t.id,
          item_name: t.item_name,
          category: t.category || "Geral",
          is_ok: true,
          observation: "",
        }))
      );
    },
    onError: () => toast({ title: "Erro ao registrar passagem de plantão", variant: "destructive" }),
  });

  const updateItem = (index: number, field: "is_ok" | "observation", value: any) => {
    setChecklistItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Texto copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  // Group items by category
  const groupedItems = checklistItems.reduce<Record<string, { items: ChecklistItem[]; indices: number[] }>>((acc, item, idx) => {
    const cat = item.category || "Geral";
    if (!acc[cat]) acc[cat] = { items: [], indices: [] };
    acc[cat].items.push(item);
    acc[cat].indices.push(idx);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Passagem de Plantão</h1>
          <p className="text-muted-foreground">Registre a passagem de turno com checklist de equipamentos</p>
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
        ) : (
          <Tabs defaultValue="new">
            <TabsList>
              <TabsTrigger value="new" className="gap-2"><ClipboardCheck className="w-4 h-4" /> Nova Passagem</TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" /> Informações do Plantão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome do porteiro que está assumindo</Label>
                    <Input value={incomingPorterName} onChange={(e) => setIncomingPorterName(e.target.value)} placeholder="Nome completo do próximo porteiro" />
                  </div>
                </CardContent>
              </Card>

              {checklistItems.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5" /> Checklist de Equipamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {Object.entries(groupedItems).map(([category, { items, indices }]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h3>
                        <div className="space-y-3">
                          {items.map((item, i) => {
                            const realIdx = indices[i];
                            return (
                              <div key={item.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={item.is_ok}
                                    onCheckedChange={(checked) => updateItem(realIdx, "is_ok", !!checked)}
                                  />
                                  <span className={`flex-1 text-sm ${!item.is_ok ? "text-destructive" : "text-foreground"}`}>
                                    {item.item_name}
                                  </span>
                                  {item.is_ok ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-destructive" />
                                  )}
                                </div>
                                {!item.is_ok && (
                                  <Input
                                    placeholder="Observação sobre o problema..."
                                    value={item.observation}
                                    onChange={(e) => updateItem(realIdx, "observation", e.target.value)}
                                    className="ml-7"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum item de checklist configurado pelo síndico para este condomínio.
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Observações Gerais</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={generalObservations}
                    onChange={(e) => setGeneralObservations(e.target.value)}
                    placeholder="Informações relevantes para o próximo turno..."
                    rows={3}
                  />
                </CardContent>
              </Card>

              <Button
                className="w-full"
                size="lg"
                onClick={() => submitMutation.mutate()}
                disabled={!incomingPorterName || submitMutation.isPending}
              >
                {submitMutation.isPending ? "Registrando..." : "Registrar Passagem de Plantão"}
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {loadingHistory ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
              ) : history.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma passagem registrada.</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <Card key={h.id} className="cursor-pointer" onClick={() => toggleHistory(h.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">
                              Passagem para: <span className="text-primary">{h.incoming_porter_name}</span>
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
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modal de Resumo da Passagem */}
      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Resumo da Passagem de Plantão
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 max-h-[50vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
              {summaryText}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSummaryModal(false)}>
              Fechar
            </Button>
            <Button onClick={handleCopySummary} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar Texto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
