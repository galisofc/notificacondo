import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Clock, Search, AlertTriangle, ClipboardList, ArrowUpRight, CalendarIcon, X } from "lucide-react";
import SubscriptionGate from "@/components/sindico/SubscriptionGate";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const DEFAULT_CATEGORIES = ["Visitante", "Entrega", "Manutenção", "Segurança", "Outros"];

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
  resolved_by_name?: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // New occurrence form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
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

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["porter-occurrence-categories", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("porter_occurrence_categories")
        .select("*")
        .eq("condominium_id", selectedCondominium)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!selectedCondominium,
  });

  // Set default category when categories load
  useEffect(() => {
    if (categories.length > 0 && !newCategory) {
      setNewCategory(categories[0].name);
    }
  }, [categories, newCategory]);

  // Seed default categories when a condominium is first selected and has no categories
  useEffect(() => {
    if (!selectedCondominium || !user) return;
    const seedIfNeeded = async () => {
      const { data, error } = await supabase
        .from("porter_occurrence_categories")
        .select("id")
        .eq("condominium_id", selectedCondominium)
        .limit(1);
      if (error || (data && data.length > 0)) return;

      await supabase.from("porter_occurrence_categories").insert(
        DEFAULT_CATEGORIES.map((name, idx) => ({
          condominium_id: selectedCondominium,
          name,
          display_order: idx,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ["porter-occurrence-categories"] });
    };
    seedIfNeeded();
  }, [selectedCondominium, user, queryClient]);

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

      // Fetch names of who resolved each occurrence
      const resolvedByIds = [...new Set((data || []).map((o) => o.resolved_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (resolvedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", resolvedByIds);
        profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.full_name]));
      }

      return (data || []).map((o) => ({
        ...o,
        resolved_by_name: o.resolved_by ? (profileMap[o.resolved_by] ?? null) : null,
      })) as Occurrence[];
    },
    enabled: !!selectedCondominium,
  });

  const filteredOccurrences = occurrences.filter((o) => {
    if (searchTerm && !o.title.toLowerCase().includes(searchTerm.toLowerCase()) && !o.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (dateRange?.from) {
      const date = new Date(o.created_at);
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      if (!isWithinInterval(date, { start: from, end: to })) return false;
    }
    return true;
  });

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
      setNewCategory(categories[0]?.name || "");
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
  const resolvedCount = occurrences.filter((o) => o.status === "resolvida").length;

  const statCards = [
    {
      title: "Em Aberto",
      value: openCount,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
    },
    {
      title: "Resolvidas",
      value: resolvedCount,
      icon: CheckCircle2,
      gradient: "from-accent to-emerald-600",
    },
    {
      title: "Total",
      value: occurrences.length,
      icon: ClipboardList,
      gradient: "from-primary to-blue-600",
    },
  ];

  return (
    <DashboardLayout>
      <SubscriptionGate>
      <div className="space-y-8 animate-fade-up">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
              Ocorrências da Portaria
              {openCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {openCount} em aberto
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Registre e acompanhe ocorrências operacionais do condomínio
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0" disabled={!selectedCondominium}>
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
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
                <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newDescription || !newCategory || createMutation.isPending}>
                  {createMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stat Cards */}
        {selectedCondominium && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {statCards.map((stat, index) => (
              <Card key={index} className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300 relative group">
                <CardContent className="p-3 sm:p-4 md:p-5">
                  <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                      <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 sm:mt-3 sm:w-full">
                      {isLoading ? (
                        <Skeleton className="h-6 sm:h-8 w-10 sm:w-16 mb-1" />
                      ) : (
                        <p className="font-display text-lg sm:text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
                      )}
                      <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground leading-tight">{stat.title}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="hidden sm:block w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors absolute top-3 right-3 md:top-4 md:right-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Ocorrências
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {condominiums.length > 1 && (
                <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecionar condomínio" /></SelectTrigger>
                  <SelectContent>
                    {condominiums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                {[
                  { value: "all", label: "Todas" },
                  { value: "aberta", label: "Abertas" },
                  { value: "resolvida", label: "Resolvidas" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStatus(opt.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      filterStatus === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por título ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM/yy")} – {format(dateRange.to, "dd/MM/yy")}</>
                    ) : format(dateRange.from, "dd/MM/yyyy")
                  ) : "Filtrar por data"}
                  {dateRange && (
                    <X className="ml-2 h-3 w-3 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDateRange(undefined); }} />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* List */}
        {!selectedCondominium ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Selecione um condomínio para visualizar as ocorrências.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filteredOccurrences.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma ocorrência encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOccurrences.map((occ) => (
              <Card key={occ.id} className="bg-card border-border shadow-card hover:shadow-elevated transition-all duration-300">
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        occ.status === "aberta"
                          ? "bg-gradient-to-br from-amber-500 to-orange-500"
                          : "bg-gradient-to-br from-accent to-emerald-600"
                      }`}>
                        {occ.status === "aberta"
                          ? <Clock className="w-5 h-5 text-white" />
                          : <CheckCircle2 className="w-5 h-5 text-white" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="font-semibold text-foreground">{occ.title}</h3>
                          {getPriorityBadge(occ.priority)}
                          <Badge variant="outline">{occ.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{occ.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(occ.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {occ.status === "resolvida" && occ.resolution_notes && (
                          <p className="text-sm text-muted-foreground mt-1.5">
                            Resolução: <span className="font-medium text-foreground">{occ.resolution_notes}</span>
                          </p>
                        )}
                        {occ.status === "resolvida" && occ.resolved_by_name && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              Finalizado por:{" "}
                              <span className="font-semibold text-foreground">{occ.resolved_by_name}</span>
                              {occ.resolved_at && (
                                <> · {format(new Date(occ.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      {occ.status === "aberta" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setResolveOccurrenceId(occ.id);
                            setResolveDialogOpen(true);
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Resolver
                        </Button>
                      )}
                    </div>
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
      </SubscriptionGate>
    </DashboardLayout>
  );
}
