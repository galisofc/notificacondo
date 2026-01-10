import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Camera, ClipboardCheck } from "lucide-react";

interface ChecklistItem {
  item_name: string;
  category: string;
  is_ok: boolean;
  observation: string;
}

interface Booking {
  id: string;
  booking_date: string;
  resident: {
    id: string;
    full_name: string;
    apartment: {
      number: string;
      block: {
        name: string;
      };
    };
  };
  party_hall_setting: {
    id: string;
    name: string;
  };
  condominium: {
    id: string;
    name: string;
  };
}

interface ChecklistFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  type: "entrada" | "saida";
}

export default function ChecklistFormDialog({ open, onOpenChange, booking, type }: ChecklistFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [generalObservations, setGeneralObservations] = useState("");

  // Fetch checklist templates
  const { data: templates = [] } = useQuery({
    queryKey: ["checklist-templates", booking.condominium.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_checklist_templates")
        .select("*")
        .eq("condominium_id", booking.condominium.id)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch entry checklist for comparison (if this is exit checklist)
  const { data: entryChecklist } = useQuery({
    queryKey: ["entry-checklist", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_checklists")
        .select(`
          id,
          general_observations,
          items:party_hall_checklist_items(
            item_name,
            category,
            is_ok,
            observation
          )
        `)
        .eq("booking_id", booking.id)
        .eq("type", "entrada")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open && type === "saida",
  });

  // Initialize items from templates
  useEffect(() => {
    if (templates.length > 0 && items.length === 0) {
      const initialItems = templates.map((t: any) => ({
        item_name: t.item_name,
        category: t.category,
        is_ok: true,
        observation: "",
      }));
      setItems(initialItems);
    }
  }, [templates, items.length]);

  // Submit checklist mutation
  const submitChecklistMutation = useMutation({
    mutationFn: async () => {
      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from("party_hall_checklists")
        .insert({
          booking_id: booking.id,
          type,
          checked_by: user?.id,
          general_observations: generalObservations || null,
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create checklist items
      const itemsToInsert = items.map((item) => ({
        checklist_id: checklist.id,
        item_name: item.item_name,
        category: item.category,
        is_ok: item.is_ok,
        observation: item.observation || null,
      }));

      const { error: itemsError } = await supabase
        .from("party_hall_checklist_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-bookings"] });
      onOpenChange(false);
      setItems([]);
      setGeneralObservations("");
      toast({ title: `Checklist de ${type} salvo com sucesso!` });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar checklist", description: error.message, variant: "destructive" });
    },
  });

  const updateItem = (index: number, updates: Partial<ChecklistItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const getEntryItemStatus = (itemName: string): boolean | null => {
    if (!entryChecklist?.items) return null;
    const item = entryChecklist.items.find((i: any) => i.item_name === itemName);
    return item ? item.is_ok : null;
  };

  const groupedItems = items.reduce((acc, item, index) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push({ ...item, index });
    return acc;
  }, {} as Record<string, (ChecklistItem & { index: number })[]>);

  const issuesCount = items.filter((i) => !i.is_ok).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de {type === "entrada" ? "Entrada" : "Saída"}
          </DialogTitle>
          <DialogDescription>
            {booking.party_hall_setting.name} - {booking.resident.full_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryItems.map((item) => {
                    const entryStatus = getEntryItemStatus(item.item_name);
                    const hasChanged = type === "saida" && entryStatus !== null && entryStatus !== item.is_ok;
                    
                    return (
                      <Card 
                        key={item.index} 
                        className={`overflow-hidden ${hasChanged ? "border-destructive" : ""}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => updateItem(item.index, { is_ok: true })}
                                className={`p-1.5 rounded-full transition-colors ${
                                  item.is_ok 
                                    ? "bg-green-500 text-white" 
                                    : "bg-muted text-muted-foreground hover:bg-green-100"
                                }`}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(item.index, { is_ok: false })}
                                className={`p-1.5 rounded-full transition-colors ${
                                  !item.is_ok 
                                    ? "bg-destructive text-destructive-foreground" 
                                    : "bg-muted text-muted-foreground hover:bg-red-100"
                                }`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.item_name}</span>
                                {type === "saida" && entryStatus !== null && (
                                  <Badge variant={entryStatus ? "outline" : "destructive"} className="text-xs">
                                    Entrada: {entryStatus ? "OK" : "Problema"}
                                  </Badge>
                                )}
                                {hasChanged && (
                                  <Badge variant="destructive" className="text-xs">
                                    Alterado
                                  </Badge>
                                )}
                              </div>
                              {!item.is_ok && (
                                <Input
                                  placeholder="Descreva o problema..."
                                  value={item.observation}
                                  onChange={(e) => updateItem(item.index, { observation: e.target.value })}
                                  className="text-sm"
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item de checklist configurado para este condomínio.</p>
                <p className="text-sm">Configure os itens em Configurações do Salão.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="general-observations">Observações Gerais</Label>
              <Textarea
                id="general-observations"
                value={generalObservations}
                onChange={(e) => setGeneralObservations(e.target.value)}
                placeholder="Observações adicionais sobre a vistoria..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {issuesCount > 0 ? (
                <span className="text-destructive font-medium">{issuesCount} problema(s) identificado(s)</span>
              ) : (
                <span className="text-green-600">Todos os itens OK</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => submitChecklistMutation.mutate()}
                disabled={items.length === 0 || submitChecklistMutation.isPending}
              >
                Salvar Checklist
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}