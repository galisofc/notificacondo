import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  MapPin,
  FileText,
  AlertTriangle,
  Scale,
  Send,
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
  Video,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ResidentBreadcrumbs from "@/components/resident/ResidentBreadcrumbs";

interface OccurrenceDetails {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  occurred_at: string;
  location: string | null;
  convention_article: string | null;
  internal_rules_article: string | null;
  civil_code_article: string | null;
  legal_basis: string | null;
  created_at: string;
  condominiums: { name: string } | null;
  blocks: { name: string } | null;
  apartments: { number: string } | null;
}

interface Defense {
  id: string;
  content: string;
  submitted_at: string;
  deadline: string;
}

interface Evidence {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
}

interface UploadedFile {
  file: File;
  preview: string;
  type: string;
}

const ResidentOccurrenceDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { residentInfo, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [occurrence, setOccurrence] = useState<OccurrenceDetails | null>(null);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [defenseContent, setDefenseContent] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      if (!id || !residentInfo) return;

      try {
        // Fetch occurrence details
        const { data: occData, error: occError } = await supabase
          .from("occurrences")
          .select(`
            *,
            condominiums(name),
            blocks(name),
            apartments(number)
          `)
          .eq("id", id)
          .eq("resident_id", residentInfo.id)
          .maybeSingle();

        if (occError) {
          console.error("Error fetching occurrence:", occError);
          setAccessError("Erro ao carregar a ocorrência. Tente novamente.");
          setLoading(false);
          return;
        }
        
        if (!occData) {
          setAccessError("Você não tem permissão para visualizar esta ocorrência ou ela não existe.");
          setLoading(false);
          return;
        }

        setOccurrence(occData);

        // Fetch defenses
        const { data: defensesData } = await supabase
          .from("defenses")
          .select("*")
          .eq("occurrence_id", id)
          .eq("resident_id", residentInfo.id)
          .order("submitted_at", { ascending: false });

        setDefenses(defensesData || []);

        // Fetch evidences
        const { data: evidencesData } = await supabase
          .from("occurrence_evidences")
          .select("*")
          .eq("occurrence_id", id);

        setEvidences(evidencesData || []);
      } catch (error) {
        console.error("Error fetching occurrence:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (residentInfo) {
      fetchData();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [id, residentInfo, roleLoading]);


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

  const handleSubmitDefense = async () => {
    if (!defenseContent.trim() || !residentInfo || !occurrence) {
      toast({
        title: "Erro",
        description: "Por favor, escreva sua defesa.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Calculate deadline (7 days from now)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);

      // Create defense
      const { data: defenseData, error: defenseError } = await supabase
        .from("defenses")
        .insert({
          occurrence_id: occurrence.id,
          resident_id: residentInfo.id,
          content: defenseContent,
          deadline: deadline.toISOString(),
        })
        .select()
        .single();

      if (defenseError) throw defenseError;

      // Upload files if any
      if (uploadedFiles.length > 0) {
        for (const uploadedFile of uploadedFiles) {
          const fileExt = uploadedFile.file.name.split(".").pop();
          const fileName = `${user!.id}/${defenseData.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("occurrence-evidences")
            .upload(fileName, uploadedFile.file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("occurrence-evidences")
              .getPublicUrl(fileName);

            await supabase.from("defense_attachments").insert({
              defense_id: defenseData.id,
              file_url: urlData.publicUrl,
              file_type: uploadedFile.type,
            });
          }
        }
      }

      // Update occurrence status to "em_defesa" when defense is submitted
      await supabase
        .from("occurrences")
        .update({ status: "em_defesa" })
        .eq("id", occurrence.id);

      // Notify síndico via WhatsApp (fire and forget - don't block on result)
      supabase.functions.invoke("notify-sindico-defense", {
        body: {
          occurrence_id: occurrence.id,
          resident_name: residentInfo.full_name,
          occurrence_title: occurrence.title,
        },
      }).then((result) => {
        if (result.error) {
          console.log("Notification to síndico failed (non-blocking):", result.error);
        } else {
          console.log("Síndico notified successfully");
        }
      }).catch((err) => {
        console.log("Error notifying síndico (non-blocking):", err);
      });

      toast({
        title: "Sucesso!",
        description: "Sua defesa foi enviada com sucesso. O síndico irá analisar.",
      });

      // Refresh data
      setDefenseContent("");
      setUploadedFiles([]);
      setDefenses([defenseData, ...defenses]);
      setOccurrence({ ...occurrence, status: "em_defesa" });
    } catch (error: any) {
      console.error("Error submitting defense:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a defesa.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${styles[status] || ""}`}>
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
      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${styles[type] || ""}`}>
        {labels[type] || type}
      </span>
    );
  };

  const canSubmitDefense = occurrence && 
    (occurrence.status === "notificado" || occurrence.status === "registrada") &&
    defenses.length === 0;

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando detalhes da ocorrência...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!occurrence || accessError) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Acesso Negado
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {accessError || "Você não tem permissão para visualizar esta ocorrência."}
          </p>
          <Button variant="outline" onClick={() => navigate("/resident/occurrences")}>
            Voltar para Minhas Ocorrências
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>{occurrence.title} | Área do Morador</title>
        <meta name="description" content="Detalhes da ocorrência" />
      </Helmet>

      <div className="space-y-6 animate-fade-up">
        {/* Breadcrumbs */}
        <ResidentBreadcrumbs
          items={[
            { label: "Minhas Ocorrências", href: "/resident/occurrences" },
            { label: occurrence.title },
          ]}
        />

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Detalhes da Ocorrência
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize os detalhes e envie sua defesa se necessário.
          </p>
        </div>

        {/* Occurrence Details */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              {getTypeBadge(occurrence.type)}
              {getStatusBadge(occurrence.status)}
            </div>
            <CardTitle className="text-xl">{occurrence.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Descrição</h4>
              <p className="text-foreground">{occurrence.description}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium">
                    {new Date(occurrence.occurred_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              {occurrence.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Local</p>
                    <p className="text-sm font-medium">{occurrence.location}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Legal Basis */}
            {(occurrence.convention_article || occurrence.internal_rules_article || occurrence.civil_code_article) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Fundamentação Legal
                </h4>
                <div className="space-y-2 text-sm">
                  {occurrence.convention_article && (
                    <p><span className="text-muted-foreground">Convenção:</span> {occurrence.convention_article}</p>
                  )}
                  {occurrence.internal_rules_article && (
                    <p><span className="text-muted-foreground">Regimento Interno:</span> {occurrence.internal_rules_article}</p>
                  )}
                  {occurrence.civil_code_article && (
                    <p><span className="text-muted-foreground">Código Civil:</span> {occurrence.civil_code_article}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidences */}
        {evidences.length > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Evidências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {evidences.map((evidence) => (
                  <a
                    key={evidence.id}
                    href={evidence.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg bg-background/50 border border-border/30 flex items-center justify-center hover:border-primary/50 transition-colors overflow-hidden"
                  >
                    {evidence.file_type === "image" ? (
                      <img
                        src={evidence.file_url}
                        alt={evidence.description || "Evidência"}
                        className="w-full h-full object-cover"
                      />
                    ) : evidence.file_type === "video" ? (
                      <Video className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    )}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Defense Section */}
        {canSubmitDefense && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Enviar Defesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="defense">Sua Defesa</Label>
                <Textarea
                  id="defense"
                  value={defenseContent}
                  onChange={(e) => setDefenseContent(e.target.value)}
                  placeholder="Escreva sua defesa aqui..."
                  rows={6}
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Anexos (opcional)</Label>
                <div className="flex flex-wrap gap-4">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 rounded-lg border border-border/30 overflow-hidden"
                    >
                      {file.type === "image" ? (
                        <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                      ) : file.type === "video" ? (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video className="w-8 h-8 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Adicionar</span>
                    <Input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      multiple
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <Button
                onClick={handleSubmitDefense}
                disabled={submitting || !defenseContent.trim()}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Defesa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Submitted Defenses */}
        {defenses.length > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Defesa Enviada
              </CardTitle>
            </CardHeader>
            <CardContent>
              {defenses.map((defense) => (
                <div key={defense.id} className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-sm text-muted-foreground mb-2">
                    Enviada em {new Date(defense.submitted_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(defense.submitted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{defense.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ResidentOccurrenceDetails;
