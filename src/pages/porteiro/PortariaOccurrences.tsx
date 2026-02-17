import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, CheckCircle2, Clock, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES = [
  { value: "visitante", label: "Visitante" },
  { value: "entrega", label: "Entrega" },
  { value: "manutencao", label: "Manutenção" },
  { value: "seguranca", label: "Segurança" },
  { value: "outros", label: "Outros" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "media", label: "Média", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "alta", label: "Alta", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

interface Occurrence {
  id: string;
  condominium_id: string;
  registered_by: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  occurred_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export default function PortariaOccurrences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [condominiums, setCondominiums] = useState<{ id: string; name: string }[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // New occurrence form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("outros");
  const [newPriority, setNewPriority] = useState("media");

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveOccurrenceId, setResolveOccurrenceId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

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

  // Fetch occurrences
  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ["porter-occurrences", selectedCondominium, filterStatus, filterCategory],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      let query = supabase
        .from("porter_occurrences")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterCategory !== "all") query = query.eq("category", filterCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as Occurrence[];
    },
    enabled: !!selectedCondominium,
  });

  const filteredOccurrences = occurrences.filter((o) =>
    searchTerm ? o.title.toLowerCase().includes(searchTerm.toLowerCase()) || o.description.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  // Create occurrence
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("porter_occurrences").insert({
        condominium_id: selectedCondominium,
        registered_by: user!.id,
        title: newTitle,
        description: newDescription,
        category: newCategory,
        priority: newPriority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["porter-occurrences"] });
      toast({ title: "Ocorrência registrada com sucesso!" });
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewCategory("outros");
      setNewPriority("media");
    },
    onError: () => toast({ title: "Erro ao registrar ocorrência", variant: "destructive" }),
  });

  // Resolve occurrence
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("porter_occurrences")
        .update({
          status: "resolvida",
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
          resolution_notes: resolutionNotes || null,
        })
        .eq("id", resolveOccurrenceId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["porter-occurrences"] });
      toast({ title: "Ocorrência marcada como resolvida!" });
      setResolveDialogOpen(false);
      setResolveOccurrenceId(null);
      setResolutionNotes("");
    },
    onError: () => toast({ title: "Erro ao resolver ocorrência", variant: "destructive" }),
  });

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find((pr) => pr.value === priority);
    return <Badge className={p?.color || ""}>{p?.label || priority}</Badge>;
  };

  const openCount = occurrences.filter((o) => o.status === "aberta").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ocorrências da Portaria</h1>
            <p className="text-muted-foreground">
              Registre e acompanhe ocorrências do condomínio
              {openCount > 0 && (
                <span className="ml-2 text-yellow-600 font-medium">• {openCount} aberta(s)</span>
              )}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!selectedCondominium}>
                <Plus className="w-4 h-4" /> Nova Ocorrência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Nova Ocorrência</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Visitante suspeito no estacionamento" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descreva o ocorrido..." rows={4} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newDescription || createMutation.isPending}>
                  {createMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {condominiums.length > 1 && (
            <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecionar condomínio" /></SelectTrigger>
              <SelectContent>
                {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="aberta">Abertas</SelectItem>
              <SelectItem value="resolvida">Resolvidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar ocorrência..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* List */}
        {!selectedCondominium ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um condomínio para visualizar as ocorrências.</CardContent></Card>
        ) : isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : filteredOccurrences.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma ocorrência encontrada.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredOccurrences.map((occ) => (
              <Card key={occ.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {occ.status === "aberta" ? (
                        <Clock className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{occ.title}</h3>
                          {getPriorityBadge(occ.priority)}
                          <Badge variant="outline">{CATEGORIES.find((c) => c.value === occ.category)?.label || occ.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{occ.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(occ.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {occ.resolution_notes && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Resolução: {occ.resolution_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    {occ.status === "aberta" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setResolveOccurrenceId(occ.id);
                          setResolveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Resolver
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Ocorrência</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Observações da resolução (opcional)</Label>
              <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Descreva como foi resolvido..." rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
                {resolveMutation.isPending ? "Resolvendo..." : "Marcar como Resolvida"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
