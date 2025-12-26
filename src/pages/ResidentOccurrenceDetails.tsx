import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Building2,
  ArrowLeft,
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
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { user, signOut } = useAuth();
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

        if (occError) throw occError;
        if (!occData) {
          toast({
            title: "Erro",
            description: "Ocorrência não encontrada.",
            variant: "destructive",
          });
          navigate("/resident");
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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

      // Update occurrence status
      await supabase
        .from("occurrences")
        .update({ status: "em_defesa" })
        .eq("id", occurrence.id);

      toast({
        title: "Sucesso!",
        description: "Sua defesa foi enviada com sucesso.",
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
      analisando: "Analisando",
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!occurrence) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ocorrência não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">CondoMaster</span>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/resident")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Detalhes da Ocorrência
            </h1>
          </div>
        </div>

        {/* Occurrence Details */}
        <Card className="bg-gradient-card border-border/50 mb-8">
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
          <Card className="bg-gradient-card border-border/50 mb-8">
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
          <Card className="bg-gradient-card border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Enviar Defesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="defense">Sua Defesa</Label>
                <Textarea
                  id="defense"
                  placeholder="Escreva sua defesa aqui..."
                  value={defenseContent}
                  onChange={(e) => setDefenseContent(e.target.value)}
                  className="min-h-[150px] mt-2"
                />
              </div>

              {/* File Upload */}
              <div>
                <Label>Anexos (opcional)</Label>
                <div className="mt-2">
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <div className="text-center">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">
                        Clique para anexar arquivos
                      </span>
                    </div>
                    <Input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50"
                      >
                        {file.type === "image" ? (
                          <img
                            src={file.preview}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            {file.type === "video" ? (
                              <Video className="w-6 h-6 text-muted-foreground" />
                            ) : (
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-destructive-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="hero"
                onClick={handleSubmitDefense}
                disabled={submitting || !defenseContent.trim()}
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
      </main>
    </div>
  );
};

export default ResidentOccurrenceDetails;
