import { useEffect, useState, useMemo } from "react";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { Helmet } from "react-helmet-async";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Search,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ResidentBreadcrumbs from "@/components/resident/ResidentBreadcrumbs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Occurrence {
  id: string;
  title: string;
  type: string;
  status: string;
  occurred_at: string;
  created_at: string;
  description: string;
}

const ITEMS_PER_PAGE = 10;

const ResidentOccurrences = () => {
  const { residentInfo, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { date: formatDate } = useDateFormatter();

  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchOccurrences = async () => {
      if (!residentInfo) return;

      try {
        const { data, error } = await supabase
          .from("occurrences")
          .select("*")
          .eq("resident_id", residentInfo.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setOccurrences(data || []);
      } catch (error) {
        console.error("Error fetching occurrences:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar suas ocorrências.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (residentInfo) {
      fetchOccurrences();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [residentInfo, roleLoading]);

  // Filter occurrences
  const filteredOccurrences = useMemo(() => {
    let filtered = occurrences;

    if (searchTerm) {
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((o) => o.type === typeFilter);
    }

    return filtered;
  }, [searchTerm, statusFilter, typeFilter, occurrences]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredOccurrences.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOccurrences = filteredOccurrences.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registrada: "bg-blue-500/10 text-blue-500",
      notificado: "bg-amber-500/10 text-amber-500",
      em_defesa: "bg-purple-500/10 text-purple-500",
      analisando: "bg-cyan-500/10 text-cyan-500",
      arquivada: "bg-muted text-muted-foreground",
      advertido: "bg-orange-500/10 text-orange-500",
      multado: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      registrada: "Registrada",
      notificado: "Notificado",
      em_defesa: "Em Defesa",
      analisando: "Defesa em Análise",
      arquivada: "Arquivada",
      advertido: "Advertido",
      multado: "Multado",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      advertencia: "bg-amber-500/10 text-amber-500",
      notificacao: "bg-blue-500/10 text-blue-500",
      multa: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || ""}`}>
        {labels[type] || type}
      </span>
    );
  };

  const getDefenseDeadline = (occurrence: Occurrence) => {
    // Only show deadline for occurrences awaiting defense (not yet submitted)
    if (occurrence.status !== "notificado") {
      return null;
    }

    const createdAt = new Date(occurrence.created_at);
    const deadline = new Date(createdAt);
    deadline.setDate(deadline.getDate() + 10);

    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { days: 0, isExpired: true, isUrgent: true, deadline };
    } else if (diffDays <= 3) {
      return { days: diffDays, isExpired: false, isUrgent: true, deadline };
    } else {
      return { days: diffDays, isExpired: false, isUrgent: false, deadline };
    }
  };

  const renderDeadlineBadge = (occurrence: Occurrence) => {
    const deadlineInfo = getDefenseDeadline(occurrence);
    if (!deadlineInfo) return null;

    if (deadlineInfo.isExpired) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Prazo expirado</span>
        </div>
      );
    }

    if (deadlineInfo.isUrgent) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 animate-pulse">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">
            {deadlineInfo.days === 0 ? "Último dia!" : `${deadlineInfo.days} dia${deadlineInfo.days > 1 ? "s" : ""} restante${deadlineInfo.days > 1 ? "s" : ""}`}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500">
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{deadlineInfo.days} dias para defesa</span>
      </div>
    );
  };

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!residentInfo) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Perfil não encontrado
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Seu perfil de morador ainda não foi cadastrado. Entre em contato com o síndico do
            seu condomínio.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Minhas Ocorrências | Área do Morador</title>
        <meta name="description" content="Lista de ocorrências do morador" />
      </Helmet>

      <div className="space-y-6 animate-fade-up">
        {/* Breadcrumbs */}
        <ResidentBreadcrumbs items={[{ label: "Minhas Ocorrências" }]} />

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Minhas Ocorrências
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe todas as suas ocorrências registradas.
          </p>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="advertencia">Advertência</SelectItem>
                  <SelectItem value="notificacao">Notificação</SelectItem>
                  <SelectItem value="multa">Multa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="registrada">Registrada</SelectItem>
                  <SelectItem value="notificado">Notificado</SelectItem>
                  <SelectItem value="em_defesa">Em Defesa</SelectItem>
                  <SelectItem value="analisando">Defesa em Análise</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
                  <SelectItem value="advertido">Advertido</SelectItem>
                  <SelectItem value="multado">Multado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Occurrences List */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Ocorrências ({filteredOccurrences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOccurrences.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  Nenhuma ocorrência encontrada
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {occurrences.length === 0
                    ? "Você não possui nenhuma ocorrência registrada."
                    : "Nenhuma ocorrência corresponde aos filtros selecionados."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedOccurrences.map((occurrence) => {
                    const deadlineInfo = getDefenseDeadline(occurrence);
                    const hasUrgentDeadline = deadlineInfo?.isUrgent;
                    
                    return (
                      <div
                        key={occurrence.id}
                        className={`p-4 rounded-xl bg-background/50 border transition-all cursor-pointer ${
                          hasUrgentDeadline 
                            ? "border-amber-500/40 hover:border-amber-500/60" 
                            : "border-border/30 hover:border-primary/30"
                        }`}
                        onClick={() => navigate(`/resident/occurrences/${occurrence.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {getTypeBadge(occurrence.type)}
                              {getStatusBadge(occurrence.status)}
                              {renderDeadlineBadge(occurrence)}
                            </div>
                            <h4 className="font-medium text-foreground mb-1">{occurrence.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {occurrence.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Ocorrência: {formatDate(occurrence.occurred_at)}
                              </span>
                              {deadlineInfo && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Prazo: {formatDate(deadlineInfo.deadline)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1}-{Math.min(endIndex, filteredOccurrences.length)} de{" "}
                      {filteredOccurrences.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            // Show first, last, current, and adjacent pages
                            return (
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 1
                            );
                          })
                          .map((page, index, array) => (
                            <div key={page} className="flex items-center">
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="px-2 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                className="w-9 h-9 p-0"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próximo
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ResidentOccurrences;
