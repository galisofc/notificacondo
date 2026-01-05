import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Scale,
  FileText,
  User,
  Building2,
  Home,
  Calendar,
  MessageSquare,
  Gavel,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Image as ImageIcon,
  Video,
  File,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { useDateFormatter } from "@/hooks/useFormattedDate";

interface DefenseWithDetails {
  id: string;
  content: string;
  submitted_at: string;
  deadline: string;
  occurrence_id: string;
  resident_id: string;
  occurrences: {
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
    condominiums: { name: string } | null;
    blocks: { name: string } | null;
    apartments: { number: string } | null;
  };
  residents: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  defense_attachments: {
    id: string;
    file_url: string;
    file_type: string;
  }[];
}

interface OccurrenceEvidence {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
}

const DefenseAnalysis = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { date: formatDate, dateTime: formatDateTime } = useDateFormatter();

  const [defenses, setDefenses] = useState<DefenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDefense, setSelectedDefense] = useState<DefenseWithDetails | null>(null);
  const [evidences, setEvidences] = useState<OccurrenceEvidence[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);

  // Decision dialog
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"arquivada" | "advertido" | "multado" | "">("");
  const [justification, setJustification] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingDefenses();
  }, []);

  const fetchPendingDefenses = async () => {
    try {
      setLoading(true);
      
      // Fetch defenses where occurrence status is "analisando"
      const { data, error } = await supabase
        .from("defenses")
        .select(`
          *,
          occurrences!inner (
            id,
            title,
            description,
            type,
            status,
            occurred_at,
            location,
            convention_article,
            internal_rules_article,
            civil_code_article,
            legal_basis,
            condominiums (name),
            blocks (name),
            apartments (number)
          ),
          residents (
            id,
            full_name,
            email,
            phone
          ),
          defense_attachments (
            id,
            file_url,
            file_type
          )
        `)
        .eq("occurrences.status", "em_defesa")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setDefenses((data as DefenseWithDetails[]) || []);
    } catch (error: any) {
      console.error("Error fetching defenses:", error);
      toast({
        title: "Erro ao carregar defesas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidences = async (occurrenceId: string) => {
    try {
      setLoadingEvidences(true);
      const { data, error } = await supabase
        .from("occurrence_evidences")
        .select("*")
        .eq("occurrence_id", occurrenceId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setEvidences(data || []);
    } catch (error: any) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoadingEvidences(false);
    }
  };

  const handleSelectDefense = async (defense: DefenseWithDetails) => {
    setSelectedDefense(defense);
    await fetchEvidences(defense.occurrence_id);
  };

  const handleOpenDecisionDialog = (type: "arquivada" | "advertido" | "multado") => {
    setDecisionType(type);
    setJustification("");
    setIsDecisionDialogOpen(true);
  };

  const handleSubmitDecision = async () => {
    if (!selectedDefense || !user || !decisionType) return;

    if (!justification.trim()) {
      toast({ title: "Informe a justificativa da decisão", variant: "destructive" });
      return;
    }

    setSavingDecision(true);
    try {
      // Insert decision
      const { error: decisionError } = await supabase.from("decisions").insert({
        occurrence_id: selectedDefense.occurrence_id,
        decided_by: user.id,
        decision: decisionType,
        justification: justification.trim(),
      });

      if (decisionError) throw decisionError;

      // Update occurrence status
      const { error: updateError } = await supabase
        .from("occurrences")
        .update({ status: decisionType })
        .eq("id", selectedDefense.occurrence_id);

      if (updateError) throw updateError;

      // If it's a fine, create the fine record
      if (decisionType === "multado") {
        const { error: fineError } = await supabase.from("fines").insert({
          occurrence_id: selectedDefense.occurrence_id,
          resident_id: selectedDefense.resident_id,
          amount: 100, // Default amount, can be customized
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: "em_aberto",
        });

        if (fineError) {
          console.error("Error creating fine:", fineError);
        }
      }

      // Notify resident via WhatsApp (fire and forget)
      supabase.functions.invoke("notify-resident-decision", {
        body: {
          occurrence_id: selectedDefense.occurrence_id,
          decision: decisionType,
          justification: justification.trim(),
        },
      }).then((result) => {
        if (result.error) {
          console.log("Notification to resident failed (non-blocking):", result.error);
        } else {
          console.log("Resident notified successfully");
        }
      }).catch((err) => {
        console.log("Error notifying resident (non-blocking):", err);
      });

      const decisionLabels = {
        arquivada: "Ocorrência arquivada",
        advertido: "Advertência aplicada",
        multado: "Multa aplicada",
      };

      toast({ 
        title: "Decisão registrada!", 
        description: `${decisionLabels[decisionType]}. O morador será notificado.`
      });
      
      setIsDecisionDialogOpen(false);
      setSelectedDefense(null);
      setDecisionType("");
      setJustification("");
      fetchPendingDefenses();
    } catch (error: any) {
      console.error("Error submitting decision:", error);
      toast({ 
        title: "Erro ao registrar decisão", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setSavingDecision(false);
    }
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

  const getFileIcon = (type: string) => {
    if (type.startsWith("image")) return <ImageIcon className="w-4 h-4" />;
    if (type.startsWith("video")) return <Video className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatDateLocal = (dateString: string) => {
    return formatDateTime(dateString);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Análise de Defesas | NotificaCondo</title>
        <meta name="description" content="Analise as defesas apresentadas pelos moradores" />
      </Helmet>

      <div className="space-y-6">
        {/* Breadcrumbs */}
        <SindicoBreadcrumbs items={[{ label: "Análise de Defesas" }]} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Defesas</h1>
            <p className="text-muted-foreground">
              {defenses.length} {defenses.length === 1 ? "defesa pendente" : "defesas pendentes"} de análise
            </p>
          </div>
        </div>

        {defenses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma defesa pendente</h3>
              <p className="text-muted-foreground text-center">
                Todas as defesas foram analisadas. Novas defesas aparecerão aqui automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Defense List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Defesas Pendentes</h2>
              {defenses.map((defense) => (
                <Card
                  key={defense.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedDefense?.id === defense.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => handleSelectDefense(defense)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeBadge(defense.occurrences.type)}
                        <span className="text-xs text-muted-foreground">
                          {formatDateLocal(defense.submitted_at)}
                        </span>
                      </div>
                      {defense.defense_attachments.length > 0 && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {defense.defense_attachments.length} anexo(s)
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {defense.occurrences.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {defense.residents?.full_name}
                      </span>
                      {defense.occurrences.condominiums?.name && (
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <Building2 className="w-3 h-3" />
                          {defense.occurrences.condominiums.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {defense.occurrences.blocks?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Home className="w-3 h-3" />
                        Ap {defense.occurrences.apartments?.number}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {defense.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Defense Details */}
            <div className="space-y-4">
              {selectedDefense ? (
                <>
                  <h2 className="text-lg font-semibold">Detalhes da Defesa</h2>
                  
                  {/* Occurrence Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Ocorrência
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="font-medium">{selectedDefense.occurrences.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedDefense.occurrences.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(selectedDefense.occurrences.occurred_at)}
                        </span>
                        {selectedDefense.occurrences.location && (
                          <span className="text-muted-foreground">
                            Local: {selectedDefense.occurrences.location}
                          </span>
                        )}
                      </div>
                      
                      {/* Legal Basis */}
                      {(selectedDefense.occurrences.convention_article ||
                        selectedDefense.occurrences.internal_rules_article ||
                        selectedDefense.occurrences.civil_code_article) && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <Scale className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Base Legal</span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {selectedDefense.occurrences.convention_article && (
                              <p>Convenção: Art. {selectedDefense.occurrences.convention_article}</p>
                            )}
                            {selectedDefense.occurrences.internal_rules_article && (
                              <p>Regimento: Art. {selectedDefense.occurrences.internal_rules_article}</p>
                            )}
                            {selectedDefense.occurrences.civil_code_article && (
                              <p>Código Civil: Art. {selectedDefense.occurrences.civil_code_article}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Evidences */}
                  {loadingEvidences ? (
                    <Card>
                      <CardContent className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ) : evidences.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Evidências da Ocorrência ({evidences.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2">
                          {evidences.map((evidence) => (
                            <div
                              key={evidence.id}
                              className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => evidence.file_type.startsWith("image") && setPreviewImage(evidence.file_url)}
                            >
                              {evidence.file_type.startsWith("image") ? (
                                <img
                                  src={evidence.file_url}
                                  alt="Evidência"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getFileIcon(evidence.file_type)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Defense Content */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Defesa do Morador
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{selectedDefense.residents?.full_name}</span>
                        <span>•</span>
                        <span>{formatDateLocal(selectedDefense.submitted_at)}</span>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{selectedDefense.content}</p>
                      </div>
                      
                      {/* Defense Attachments */}
                      {selectedDefense.defense_attachments.length > 0 && (
                        <div className="pt-2">
                          <p className="text-sm font-medium mb-2">Anexos da Defesa:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {selectedDefense.defense_attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => attachment.file_type.startsWith("image") && setPreviewImage(attachment.file_url)}
                              >
                                {attachment.file_type.startsWith("image") ? (
                                  <img
                                    src={attachment.file_url}
                                    alt="Anexo da defesa"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {getFileIcon(attachment.file_type)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Decision Actions */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Gavel className="w-4 h-4" />
                        Decisão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Após analisar a defesa, selecione a decisão:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4 border-green-500/50 hover:bg-green-500/10 hover:text-green-600"
                          onClick={() => handleOpenDecisionDialog("arquivada")}
                        >
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                          <span>Arquivar</span>
                          <span className="text-xs text-muted-foreground">Aceitar defesa</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4 border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600"
                          onClick={() => handleOpenDecisionDialog("advertido")}
                        >
                          <AlertTriangle className="w-6 h-6 text-amber-500" />
                          <span>Advertir</span>
                          <span className="text-xs text-muted-foreground">Aplicar advertência</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4 border-red-500/50 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => handleOpenDecisionDialog("multado")}
                        >
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span>Multar</span>
                          <span className="text-xs text-muted-foreground">Aplicar multa</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate(`/occurrences/${selectedDefense.occurrence_id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver ocorrência completa
                  </Button>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Selecione uma defesa na lista para ver os detalhes e tomar uma decisão.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              {decisionType === "arquivada" && "Arquivar Ocorrência"}
              {decisionType === "advertido" && "Aplicar Advertência"}
              {decisionType === "multado" && "Aplicar Multa"}
            </DialogTitle>
            <DialogDescription>
              {decisionType === "arquivada" && "A defesa será aceita e a ocorrência arquivada."}
              {decisionType === "advertido" && "Será registrada uma advertência formal ao morador."}
              {decisionType === "multado" && "Será aplicada uma multa ao morador."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="justification">Justificativa da decisão *</Label>
              <Textarea
                id="justification"
                placeholder="Descreva os motivos da sua decisão..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDecisionDialogOpen(false)}
              disabled={savingDecision}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitDecision}
              disabled={savingDecision || !justification.trim()}
              className={
                decisionType === "arquivada"
                  ? "bg-green-600 hover:bg-green-700"
                  : decisionType === "advertido"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {savingDecision ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar Decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <img
            src={previewImage || ""}
            alt="Preview"
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DefenseAnalysis;
