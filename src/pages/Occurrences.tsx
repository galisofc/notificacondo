import { useState, useEffect } from "react";
import { formatDate } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Plus,
  Loader2,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Eye,
  Calendar,
  MapPin,
  Scale,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";

interface Condominium {
  id: string;
  name: string;
}

interface Block {
  id: string;
  condominium_id: string;
  name: string;
}

interface Apartment {
  id: string;
  block_id: string;
  number: string;
}

interface Resident {
  id: string;
  apartment_id: string;
  full_name: string;
  email: string;
}

interface UploadedFile {
  file: File;
  preview: string;
  type: string;
}

const CIVIL_CODE_ARTICLES = [
  { value: "1336-I", label: "Art. 1.336, I - Contribuir para as despesas do condomínio" },
  { value: "1336-II", label: "Art. 1.336, II - Não realizar obras que comprometam a segurança" },
  { value: "1336-III", label: "Art. 1.336, III - Não alterar forma/cor da fachada" },
  { value: "1336-IV", label: "Art. 1.336, IV - Dar às suas partes a mesma destinação" },
  { value: "1337", label: "Art. 1.337 - Conduta antissocial (multa até 10x)" },
  { value: "1337-unico", label: "Art. 1.337, § único - Reiterado descumprimento (multa até 5x)" },
];

const OCCURRENCE_TYPES = [
  { value: "advertencia", label: "Advertência" },
  { value: "notificacao", label: "Notificação" },
  { value: "multa", label: "Multa" },
];

const Occurrences = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data states
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [condominiumFilter, setCondominiumFilter] = useState<string>("all");

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [formData, setFormData] = useState({
    condominium_id: "",
    block_id: "",
    apartment_id: "",
    resident_id: "",
    type: "advertencia" as "advertencia" | "notificacao" | "multa",
    title: "",
    description: "",
    location: "",
    occurred_at: new Date().toISOString().slice(0, 16),
    convention_article: "",
    internal_rules_article: "",
    civil_code_article: "",
    legal_basis: "",
  });

  // Filtered data based on selection
  const filteredBlocks = blocks.filter((b) => b.condominium_id === formData.condominium_id);
  const filteredApartments = apartments.filter((a) => a.block_id === formData.block_id);
  const filteredResidents = residents.filter((r) => r.apartment_id === formData.apartment_id);

  // Filter occurrences based on status, type and condominium filters
  const filteredOccurrences = occurrences.filter((occ) => {
    const matchesStatus = statusFilter === "all" || occ.status === statusFilter;
    const matchesType = typeFilter === "all" || occ.type === typeFilter;
    const matchesCondominium = condominiumFilter === "all" || occ.condominium_id === condominiumFilter;
    return matchesStatus && matchesType && matchesCondominium;
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch condominiums
      const { data: condosData } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id);
      setCondominiums(condosData || []);

      if (condosData && condosData.length > 0) {
        const condoIds = condosData.map((c) => c.id);

        // Fetch blocks
        const { data: blocksData } = await supabase
          .from("blocks")
          .select("id, condominium_id, name")
          .in("condominium_id", condoIds);
        setBlocks(blocksData || []);

        // Fetch apartments
        if (blocksData && blocksData.length > 0) {
          const blockIds = blocksData.map((b) => b.id);
          const { data: aptsData } = await supabase
            .from("apartments")
            .select("id, block_id, number")
            .in("block_id", blockIds);
          setApartments(aptsData || []);

          // Fetch residents
          if (aptsData && aptsData.length > 0) {
            const aptIds = aptsData.map((a) => a.id);
            const { data: residentsData } = await supabase
              .from("residents")
              .select("id, apartment_id, full_name, email")
              .in("apartment_id", aptIds);
            setResidents(residentsData || []);
          }
        }

        // Fetch occurrences
        const { data: occurrencesData } = await supabase
          .from("occurrences")
          .select(`
            *,
            condominiums(name),
            blocks(name),
            apartments(number),
            residents(full_name)
          `)
          .in("condominium_id", condoIds)
          .order("created_at", { ascending: false });
        setOccurrences(occurrencesData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : "document";
      newFiles.push({ file, preview, type });
    }

    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };

  const uploadFilesToStorage = async (occurrenceId: string): Promise<string[]> => {
    const urls: string[] = [];

    for (const uploadedFile of uploadedFiles) {
      const fileExt = uploadedFile.file.name.split(".").pop();
      const fileName = `${user!.id}/${occurrenceId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("occurrence-evidences")
        .upload(fileName, uploadedFile.file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Use signed URL instead of public URL for security
      const { data: urlData, error: signedUrlError } = await supabase.storage
        .from("occurrence-evidences")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year for storage reference

      if (signedUrlError) {
        console.error("Signed URL error:", signedUrlError);
        // Fallback to storing just the file path
        urls.push(fileName);
      } else {
        urls.push(urlData.signedUrl);
      }
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.condominium_id) {
      toast({ title: "Erro", description: "Selecione um condomínio.", variant: "destructive" });
      return;
    }

    if (!formData.title || !formData.description) {
      toast({ title: "Erro", description: "Preencha título e descrição.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Check plan limits before creating occurrence
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("*, condominiums!inner(id)")
        .eq("condominiums.id", formData.condominium_id)
        .single();

      if (subError || !subscription) {
        toast({ title: "Erro", description: "Assinatura não encontrada para este condomínio.", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Get current usage by counting occurrences with relevant statuses in period
      const periodStart = subscription.current_period_start;
      const periodEnd = subscription.current_period_end;

      let occurrencesQuery = supabase
        .from("occurrences")
        .select("type, status")
        .eq("condominium_id", formData.condominium_id)
        .in("status", ["notificado", "arquivada", "advertido", "multado"]);

      if (periodStart) {
        occurrencesQuery = occurrencesQuery.gte("created_at", periodStart);
      }
      if (periodEnd) {
        occurrencesQuery = occurrencesQuery.lte("created_at", periodEnd);
      }

      const { data: existingOccurrences } = await occurrencesQuery;

      const realUsage = {
        notifications: 0,
        warnings: 0,
        fines: 0,
      };

      if (existingOccurrences) {
        existingOccurrences.forEach((occ) => {
          if (occ.type === "notificacao") realUsage.notifications++;
          else if (occ.type === "advertencia") realUsage.warnings++;
          else if (occ.type === "multa") realUsage.fines++;
        });
      }

      // Check limit based on occurrence type
      const typeLabels: Record<string, string> = {
        notificacao: "notificações",
        advertencia: "advertências",
        multa: "multas",
      };

      if (formData.type === "notificacao" && realUsage.notifications >= subscription.notifications_limit) {
        toast({ 
          title: "Limite atingido", 
          description: `Você atingiu o limite de ${subscription.notifications_limit} ${typeLabels.notificacao} do seu plano. Faça upgrade para continuar.`, 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      if (formData.type === "advertencia" && realUsage.warnings >= subscription.warnings_limit) {
        toast({ 
          title: "Limite atingido", 
          description: `Você atingiu o limite de ${subscription.warnings_limit} ${typeLabels.advertencia} do seu plano. Faça upgrade para continuar.`, 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      if (formData.type === "multa" && realUsage.fines >= subscription.fines_limit) {
        toast({ 
          title: "Limite atingido", 
          description: `Você atingiu o limite de ${subscription.fines_limit} ${typeLabels.multa} do seu plano. Faça upgrade para continuar.`, 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      // Create occurrence
      const { data: occurrenceData, error: occurrenceError } = await supabase
        .from("occurrences")
        .insert({
          condominium_id: formData.condominium_id,
          block_id: formData.block_id || null,
          apartment_id: formData.apartment_id || null,
          resident_id: formData.resident_id || null,
          registered_by: user.id,
          type: formData.type,
          status: "registrada",
          title: formData.title,
          description: formData.description,
          location: formData.location || null,
          occurred_at: formData.occurred_at,
          convention_article: formData.convention_article || null,
          internal_rules_article: formData.internal_rules_article || null,
          civil_code_article: formData.civil_code_article || null,
          legal_basis: formData.legal_basis || null,
        })
        .select()
        .single();

      if (occurrenceError) throw occurrenceError;

      // Upload files and create evidence records
      if (uploadedFiles.length > 0) {
        const urls = await uploadFilesToStorage(occurrenceData.id);
        
        for (let i = 0; i < urls.length; i++) {
          await supabase.from("occurrence_evidences").insert({
            occurrence_id: occurrenceData.id,
            file_url: urls[i],
            file_type: uploadedFiles[i].type,
            uploaded_by: user.id,
          });
        }
      }

      toast({
        title: "Sucesso!",
        description: "Ocorrência registrada com sucesso.",
      });

      // Reset form
      setIsDialogOpen(false);
      setUploadedFiles([]);
      setFormData({
        condominium_id: "",
        block_id: "",
        apartment_id: "",
        resident_id: "",
        type: "advertencia",
        title: "",
        description: "",
        location: "",
        occurred_at: new Date().toISOString().slice(0, 16),
        convention_article: "",
        internal_rules_article: "",
        civil_code_article: "",
        legal_basis: "",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error creating occurrence:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível registrar a ocorrência.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <DashboardLayout>
      <Helmet>
        <title>Ocorrências | CondoManager</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SindicoBreadcrumbs items={[{ label: "Ocorrências" }]} />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Ocorrências
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Registre e gerencie ocorrências do condomínio
          </p>
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
            <Select value={condominiumFilter} onValueChange={setCondominiumFilter}>
              <SelectTrigger className="bg-card border-border text-sm">
                <SelectValue placeholder="Condomínio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Condomínios</SelectItem>
                {condominiums.map((condo) => (
                  <SelectItem key={condo.id} value={condo.id}>
                    {condo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-card border-border text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="registrada">Registrada</SelectItem>
                <SelectItem value="notificado">Notificado</SelectItem>
                <SelectItem value="em_defesa">Em Defesa</SelectItem>
                <SelectItem value="analisando">Defesa em Análise</SelectItem>
                <SelectItem value="arquivada">Arquivada</SelectItem>
                <SelectItem value="advertido">Advertido</SelectItem>
                <SelectItem value="multado">Multado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-card border-border text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="advertencia">Advertência</SelectItem>
                <SelectItem value="notificacao">Notificação</SelectItem>
                <SelectItem value="multa">Multa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="hero"
            onClick={() => {
              if (condominiums.length === 0) {
                toast({
                  title: "Atenção",
                  description: "Cadastre um condomínio primeiro.",
                  variant: "destructive",
                });
                return;
              }
              setIsDialogOpen(true);
            }}
            className="w-full sm:w-auto sm:self-end"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Ocorrência
          </Button>
        </div>

        {/* Results Counter */}
        {!loading && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <p className="text-xs md:text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{filteredOccurrences.length}</span> de{" "}
              <span className="font-medium text-foreground">{occurrences.length}</span> ocorrência{occurrences.length !== 1 ? "s" : ""}
            </p>
            {(statusFilter !== "all" || typeFilter !== "all" || condominiumFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setCondominiumFilter("all");
                }}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredOccurrences.length === 0 ? (
          <div className="text-center py-8 md:py-12 px-4 rounded-2xl bg-card border border-border shadow-card">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
              {statusFilter !== "all" || typeFilter !== "all" 
                ? "Nenhuma ocorrência encontrada" 
                : "Nenhuma ocorrência registrada"}
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mb-6">
              {statusFilter !== "all" || typeFilter !== "all" 
                ? "Tente ajustar os filtros para ver mais resultados." 
                : "Registre ocorrências para iniciar o fluxo de notificações."}
            </p>
            {statusFilter === "all" && typeFilter === "all" && (
              <Button variant="hero" onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Registrar Ocorrência
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {filteredOccurrences.map((occurrence) => (
              <div
                key={occurrence.id}
                className="p-3 md:p-4 rounded-xl bg-card border border-border shadow-card hover:shadow-elevated transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getTypeBadge(occurrence.type)}
                      {getStatusBadge(occurrence.status)}
                    </div>
                    <h3 className="font-semibold text-sm md:text-base text-foreground mb-1 truncate">
                      {occurrence.title}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-2">
                      {occurrence.description}
                    </p>
                    <div className="flex flex-wrap gap-2 md:gap-4 text-xs text-muted-foreground">
                      <span className="truncate max-w-[120px]">{occurrence.condominiums?.name}</span>
                      {occurrence.blocks?.name && (
                        <span>{occurrence.blocks.name}</span>
                      )}
                      {occurrence.apartments?.number && (
                        <span>Apto {occurrence.apartments.number}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(occurrence.occurred_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-start">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/occurrences/${occurrence.id}`)} className="text-xs">
                      <Eye className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                      Ver
                    </Button>
                    {occurrence.status === "registrada" && occurrence.resident_id && (
                      <Button variant="hero" size="sm" className="text-xs">
                        <Send className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        Notificar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" />
                Registrar Ocorrência
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Localização
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Condomínio *</Label>
                    <Select
                      value={formData.condominium_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, condominium_id: v, block_id: "", apartment_id: "", resident_id: "" })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {condominiums.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bloco</Label>
                    <Select
                      value={formData.block_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, block_id: v, apartment_id: "", resident_id: "" })
                      }
                      disabled={!formData.condominium_id}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredBlocks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Apartamento</Label>
                    <Select
                      value={formData.apartment_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, apartment_id: v, resident_id: "" })
                      }
                      disabled={!formData.block_id}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredApartments.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            Apto {a.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Morador</Label>
                    <Select
                      value={formData.resident_id}
                      onValueChange={(v) => setFormData({ ...formData, resident_id: v })}
                      disabled={!formData.apartment_id}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredResidents.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Occurrence Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Detalhes da Ocorrência
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v: "advertencia" | "notificacao" | "multa") =>
                        setFormData({ ...formData, type: v })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCURRENCE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data/Hora da Ocorrência *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.occurred_at}
                      onChange={(e) => setFormData({ ...formData, occurred_at: e.target.value })}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Barulho excessivo após 22h"
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição Detalhada *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a ocorrência com o máximo de detalhes possível..."
                    className="bg-secondary/50 min-h-[100px]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Local Específico</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Área da piscina, Salão de festas..."
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              {/* Legal Basis */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />
                  Base Legal (Obrigatório para multas)
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Artigo do Código Civil</Label>
                    <Select
                      value={formData.civil_code_article}
                      onValueChange={(v) => setFormData({ ...formData, civil_code_article: v })}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione o artigo" />
                      </SelectTrigger>
                      <SelectContent>
                        {CIVIL_CODE_ARTICLES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Artigo da Convenção</Label>
                      <Input
                        value={formData.convention_article}
                        onChange={(e) => setFormData({ ...formData, convention_article: e.target.value })}
                        placeholder="Ex: Art. 15, § 2º"
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Artigo do Regimento Interno</Label>
                      <Input
                        value={formData.internal_rules_article}
                        onChange={(e) => setFormData({ ...formData, internal_rules_article: e.target.value })}
                        placeholder="Ex: Art. 8º"
                        className="bg-secondary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fundamentação Legal Adicional</Label>
                    <Textarea
                      value={formData.legal_basis}
                      onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })}
                      placeholder="Descreva a fundamentação legal completa se necessário..."
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Evidence Upload */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Provas e Evidências
                </h3>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para enviar fotos, vídeos ou documentos
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (Máx. 20MB por arquivo)
                    </span>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden bg-secondary/50"
                      >
                        {file.type === "image" ? (
                          <img
                            src={file.preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : file.type === "video" ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="hero" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Registrar Ocorrência
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Occurrences;
