import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  User,
  Building2,
  Home,
  Scale,
  FileText,
  Image as ImageIcon,
  Video,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  Gavel,
  Download,
  X,
  MessageCircle,
  FileDown,
  Smartphone,
  Monitor,
  Eye,
  Globe,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { useDateFormatter } from "@/hooks/useFormattedDate";

interface Occurrence {
  id: string;
  title: string;
  description: string;
  type: "advertencia" | "notificacao" | "multa";
  status: string;
  occurred_at: string;
  created_at: string;
  location: string | null;
  convention_article: string | null;
  internal_rules_article: string | null;
  civil_code_article: string | null;
  legal_basis: string | null;
  condominiums: { name: string; defense_deadline_days: number } | null;
  blocks: { name: string } | null;
  apartments: { number: string } | null;
  residents: { id: string; full_name: string; email: string } | null;
}

interface Evidence {
  id: string;
  file_url: string;
  file_type: string;
  description: string | null;
  created_at: string;
}

interface Defense {
  id: string;
  content: string;
  deadline: string;
  submitted_at: string;
  residents: { full_name: string } | null;
  defense_attachments: { id: string; file_url: string; file_type: string }[];
}

interface Decision {
  id: string;
  decision: string;
  justification: string;
  decided_at: string;
}

interface Notification {
  id: string;
  sent_at: string;
  sent_via: string;
  delivered_at: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  device_info: unknown;
  location_info: unknown;
  ip_address: string | null;
  user_agent: string | null;
}

interface TimelineItem {
  id: string;
  type: "created" | "notification" | "defense" | "decision" | "evidence";
  title: string;
  description: string;
  date: string;
  icon: React.ReactNode;
  color: string;
}

const OccurrenceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dateTime: formatDateTime, dateTimeLong: formatDateTimeLong } = useDateFormatter();

  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  // Decision dialog
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionData, setDecisionData] = useState({
    decision: "" as "arquivada" | "advertido" | "multado" | "",
    justification: "",
  });
  const [savingDecision, setSavingDecision] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // WhatsApp notification
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      // Fetch occurrence
      const { data: occurrenceData, error: occurrenceError } = await supabase
        .from("occurrences")
        .select(`
          *,
          condominiums(name, defense_deadline_days),
          blocks(name),
          apartments(number),
          residents(id, full_name, email)
        `)
        .eq("id", id)
        .maybeSingle();

      if (occurrenceError) throw occurrenceError;
      if (!occurrenceData) {
        toast({ title: "Ocorrência não encontrada", variant: "destructive" });
        navigate("/occurrences");
        return;
      }
      setOccurrence(occurrenceData);

      // Fetch evidences
      const { data: evidencesData } = await supabase
        .from("occurrence_evidences")
        .select("*")
        .eq("occurrence_id", id)
        .order("created_at", { ascending: true });
      setEvidences(evidencesData || []);

      // Fetch defenses
      const { data: defensesData } = await supabase
        .from("defenses")
        .select(`
          *,
          residents(full_name),
          defense_attachments(id, file_url, file_type)
        `)
        .eq("occurrence_id", id)
        .order("submitted_at", { ascending: true });
      setDefenses(defensesData || []);

      // Fetch decisions
      const { data: decisionsData } = await supabase
        .from("decisions")
        .select("*")
        .eq("occurrence_id", id)
        .order("decided_at", { ascending: true });
      setDecisions(decisionsData || []);

      // Fetch notifications
      const { data: notificationsData } = await supabase
        .from("notifications_sent")
        .select("*")
        .eq("occurrence_id", id)
        .order("sent_at", { ascending: true });
      setNotifications(notificationsData || []);

      // Build timeline
      buildTimeline(
        occurrenceData,
        evidencesData || [],
        defensesData || [],
        decisionsData || [],
        notificationsData || []
      );
    } catch (error) {
      console.error("Error fetching occurrence:", error);
      toast({ title: "Erro ao carregar ocorrência", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buildTimeline = (
    occ: Occurrence,
    evs: Evidence[],
    defs: Defense[],
    decs: Decision[],
    notifs: Notification[]
  ) => {
    const items: TimelineItem[] = [];

    // Created
    items.push({
      id: "created",
      type: "created",
      title: "Ocorrência Registrada",
      description: occ.title,
      date: occ.created_at,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "bg-blue-500",
    });

    // Evidences
    evs.forEach((ev) => {
      items.push({
        id: `ev-${ev.id}`,
        type: "evidence",
        title: "Prova Adicionada",
        description: ev.description || `Arquivo ${ev.file_type}`,
        date: ev.created_at,
        icon: <FileText className="w-4 h-4" />,
        color: "bg-purple-500",
      });
    });

    // Notifications
    notifs.forEach((notif) => {
      items.push({
        id: `notif-${notif.id}`,
        type: "notification",
        title: "Notificação Enviada",
        description: `Via ${notif.sent_via}${notif.delivered_at ? " - Entregue" : ""}${notif.read_at ? " - Lida" : ""}${notif.acknowledged_at ? " - Confirmada" : ""}`,
        date: notif.sent_at,
        icon: <Send className="w-4 h-4" />,
        color: "bg-amber-500",
      });
    });

    // Defenses
    defs.forEach((def) => {
      items.push({
        id: `def-${def.id}`,
        type: "defense",
        title: "Defesa Apresentada",
        description: def.content.slice(0, 100) + (def.content.length > 100 ? "..." : ""),
        date: def.submitted_at,
        icon: <MessageSquare className="w-4 h-4" />,
        color: "bg-cyan-500",
      });
    });

    // Decisions
    decs.forEach((dec) => {
      const decisionLabels: Record<string, string> = {
        arquivada: "Arquivada",
        advertido: "Advertência Aplicada",
        multado: "Multa Aplicada",
      };
      items.push({
        id: `dec-${dec.id}`,
        type: "decision",
        title: decisionLabels[dec.decision] || "Decisão",
        description: dec.justification.slice(0, 100) + (dec.justification.length > 100 ? "..." : ""),
        date: dec.decided_at,
        icon: <Gavel className="w-4 h-4" />,
        color: dec.decision === "arquivada" ? "bg-muted" : "bg-red-500",
      });
    });

    // Sort by date
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTimeline(items);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registrada: "bg-blue-500/10 text-blue-500",
      notificado: "bg-amber-500/10 text-amber-500",
      em_defesa: "bg-purple-500/10 text-purple-500",
      arquivada: "bg-muted text-muted-foreground",
      advertido: "bg-orange-500/10 text-orange-500",
      multado: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      registrada: "Registrada",
      notificado: "Notificado",
      em_defesa: "Em Defesa",
      arquivada: "Arquivada",
      advertido: "Advertido",
      multado: "Multado",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || ""}`}>
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[type] || ""}`}>
        {labels[type] || type}
      </span>
    );
  };

  const handleSubmitDecision = async () => {
    if (!occurrence || !user) return;

    if (!decisionData.decision || !decisionData.justification.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setSavingDecision(true);
    try {
      // Insert decision
      const { error: decisionError } = await supabase.from("decisions").insert({
        occurrence_id: occurrence.id,
        decided_by: user.id,
        decision: decisionData.decision,
        justification: decisionData.justification,
      });

      if (decisionError) throw decisionError;

      // Update occurrence status
      const { error: updateError } = await supabase
        .from("occurrences")
        .update({ status: decisionData.decision })
        .eq("id", occurrence.id);

      if (updateError) throw updateError;

      toast({ title: "Decisão registrada com sucesso!" });
      setIsDecisionDialogOpen(false);
      setDecisionData({ decision: "", justification: "" });
      fetchData();
    } catch (error: any) {
      console.error("Error submitting decision:", error);
      toast({ title: "Erro ao registrar decisão", variant: "destructive" });
    } finally {
      setSavingDecision(false);
    }
  };

  const formatDateLocal = (dateStr: string) => {
    return formatDateTimeLong(dateStr);
  };

  const handleSendWhatsApp = async () => {
    if (!occurrence?.residents?.id) {
      toast({ 
        title: "Morador não encontrado", 
        description: "Esta ocorrência não possui um morador vinculado.",
        variant: "destructive" 
      });
      return;
    }

    setSendingWhatsApp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-notification", {
        body: {
          occurrence_id: occurrence.id,
          resident_id: occurrence.residents.id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: "Notificação enviada!", 
          description: "O morador foi notificado via WhatsApp com sucesso." 
        });
        
        // Update occurrence status if it was just registered
        if (occurrence.status === "registrada") {
          await supabase
            .from("occurrences")
            .update({ status: "notificado" })
            .eq("id", occurrence.id);
        }
        
        // Refresh data
        fetchData();
      } else {
        throw new Error(data?.error || "Erro ao enviar notificação");
      }
    } catch (error: any) {
      console.error("WhatsApp notification error:", error);
      toast({ 
        title: "Erro ao enviar notificação", 
        description: error.message || "Verifique as configurações do WhatsApp.",
        variant: "destructive" 
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const generatePDF = () => {
    if (!occurrence) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Type labels
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    const refLabels: Record<string, string> = {
      advertencia: "Aplicação de Advertência",
      notificacao: "Notificação",
      multa: "Aplicação de Multa",
    };

    // Format date for header (e.g., "Guarulhos, 04 de dezembro de 2025")
    const formatFullDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
      ];
      const day = date.getDate().toString().padStart(2, "0");
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} de ${month} de ${year}`;
    };

    const numberToPortugueseWords = (num: number): string => {
      const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
      const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
      const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
      
      if (num < 10) return units[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        return unit === 0 ? tens[ten] : `${tens[ten]} e ${units[unit]}`;
      }
      return String(num);
    };

    const formatShortDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    };

    // Get condominium city (if available from address) or default
    const condominiumName = occurrence.condominiums?.name || "Condomínio";
    const today = new Date().toISOString();

    // ===== PAGE 1: FORMAL LETTER =====

    // Header - Date aligned right
    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    doc.text(`São Paulo, ${formatFullDate(today)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 15;

    // Condominium Name - Centered, bold
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(condominiumName.toUpperCase(), pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Recipient info
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Ao Senhor(a): ${occurrence.residents?.full_name || "Não identificado"}`, margin, yPos);
    yPos += 8;

    // Block and Apartment
    const blockName = occurrence.blocks?.name || "-";
    const aptNumber = occurrence.apartments?.number || "-";
    doc.text(`Bloco: ${blockName}       APTO: ${aptNumber}`, margin, yPos);
    yPos += 8;

    // Condominium address (full name again)
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(condominiumName.toUpperCase(), margin, yPos);
    yPos += 20;

    // Reference line
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text(`REF: ${refLabels[occurrence.type] || "Ocorrência"}`, margin, yPos);
    yPos += 12;

    // Greeting
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Prezado(a) Condômino(a),", margin, yPos);
    yPos += 10;

    // Intro paragraph
    const introParagraph = "Na qualidade de síndico(a) deste Condomínio, no uso de minhas atribuições legais e atendendo a determinação do corpo diretivo, utilizo-me da presente para notificá-lo(a) por desrespeito às normas do Regimento Interno.";
    const introLines = doc.splitTextToSize(introParagraph, contentWidth);
    doc.text(introLines, margin, yPos);
    yPos += introLines.length * 5 + 8;

    // Legal basis section (FUNDAMENTAÇÃO LEGAL)
    const hasLegalBasis = occurrence.internal_rules_article || occurrence.convention_article || occurrence.civil_code_article || occurrence.legal_basis;
    
    if (hasLegalBasis) {
      // Section header
      doc.setFont("helvetica", "bold");
      doc.text("FUNDAMENTAÇÃO LEGAL:", margin, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");

      // List each legal reference with its description
      if (occurrence.civil_code_article) {
        const civilCodeText = `• Código Civil - Art. ${occurrence.civil_code_article}`;
        const civilLines = doc.splitTextToSize(civilCodeText, contentWidth);
        doc.text(civilLines, margin, yPos);
        yPos += civilLines.length * 5 + 3;
      }

      if (occurrence.convention_article) {
        const conventionText = `• Convenção do Condomínio - Art. ${occurrence.convention_article}`;
        const conventionLines = doc.splitTextToSize(conventionText, contentWidth);
        doc.text(conventionLines, margin, yPos);
        yPos += conventionLines.length * 5 + 3;
      }

      if (occurrence.internal_rules_article) {
        const rulesText = `• Regimento Interno - Art. ${occurrence.internal_rules_article}`;
        const rulesLines = doc.splitTextToSize(rulesText, contentWidth);
        doc.text(rulesLines, margin, yPos);
        yPos += rulesLines.length * 5 + 3;
      }

      // Additional legal basis description
      if (occurrence.legal_basis) {
        yPos += 3;
        const legalBasisLines = doc.splitTextToSize(occurrence.legal_basis, contentWidth);
        doc.text(legalBasisLines, margin, yPos);
        yPos += legalBasisLines.length * 5 + 5;
      }

      yPos += 5;
    }

    // Occurrence description paragraph
    const occurrenceDate = formatShortDate(occurrence.occurred_at);
    const occurrenceTime = formatTime(occurrence.occurred_at);
    
    let descriptionParagraph = `No dia ${occurrenceDate}, por volta das ${occurrenceTime}`;
    if (occurrence.location) {
      descriptionParagraph += `, no local: ${occurrence.location}`;
    }
    descriptionParagraph += `, foi verificado que: ${occurrence.description}`;
    descriptionParagraph += " Informamos que tal conduta caracteriza descumprimento do Regimento Interno, estando sujeita à aplicação das penalidades previstas nas normas condominiais.";

    const descLines = doc.splitTextToSize(descriptionParagraph, contentWidth);
    doc.text(descLines, margin, yPos);
    yPos += descLines.length * 5 + 8;

    // Penalty paragraph (based on type)
    let penaltyParagraph = "";
    if (occurrence.type === "multa") {
      penaltyParagraph = "Diante do ocorrido, torna-se necessária a aplicação da penalidade prevista no Regimento Interno deste Condomínio, a qual será lançada juntamente com sua quota condominial.";
    } else if (occurrence.type === "advertencia") {
      penaltyParagraph = "Diante do ocorrido, esta serve como ADVERTÊNCIA FORMAL, ficando registrado o descumprimento das normas condominiais. Reincidências poderão acarretar penalidades mais severas, incluindo aplicação de multa.";
    } else {
      penaltyParagraph = "Diante do ocorrido, serve a presente como NOTIFICAÇÃO FORMAL sobre o descumprimento das normas condominiais.";
    }
    const penaltyLines = doc.splitTextToSize(penaltyParagraph, contentWidth);
    doc.text(penaltyLines, margin, yPos);
    yPos += penaltyLines.length * 5 + 8;

    // Defense deadline paragraph
    const deadlineDays = occurrence.condominiums?.defense_deadline_days || 10;
    const deadlineWritten = deadlineDays === 10 ? "10 (dez)" : `${deadlineDays} (${numberToPortugueseWords(deadlineDays)})`;
    const defenseParagraph = `Outrossim, a partir desta data, fica estipulado o prazo de ${deadlineWritten} dias para que V. Sa. apresente, se assim desejar, suas razões mediante defesa por escrito, a qual será submetida à análise perante o Conselho Consultivo.`;
    const defenseLines = doc.splitTextToSize(defenseParagraph, contentWidth);
    doc.text(defenseLines, margin, yPos);
    yPos += defenseLines.length * 5 + 20;

    // Closing
    doc.text("Atenciosamente,", margin, yPos);
    yPos += 25;

    // Signature area
    doc.setFont("helvetica", "bold");
    doc.text(condominiumName.toUpperCase(), pageWidth / 2, yPos, { align: "center" });
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Síndico(a)", pageWidth / 2, yPos, { align: "center" });

    // ===== PAGE 2: AUTO DE INFRAÇÃO (Evidence) =====
    if (evidences.length > 0) {
      doc.addPage();
      yPos = margin;

      // Header
      doc.setFontSize(11);
      doc.setTextColor(33, 33, 33);
      doc.text(`São Paulo, ${formatFullDate(today)}`, pageWidth - margin, yPos, { align: "right" });
      yPos += 15;

      // Condominium Name
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(condominiumName.toUpperCase(), pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Section title
      doc.setFontSize(14);
      doc.text("AUTO DE INFRAÇÃO:", margin, yPos);
      yPos += 15;

      // Evidence info box
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`DATA: ${occurrenceDate}`, margin, yPos);
      yPos += 8;
      doc.text(`HORÁRIO: ${occurrenceTime}`, margin, yPos);
      yPos += 8;
      if (occurrence.location) {
        doc.text(`LOCAL: ${occurrence.location}`, margin, yPos);
        yPos += 8;
      }
      yPos += 10;

      // List evidences
      doc.setFontSize(10);
      doc.text("Provas anexadas:", margin, yPos);
      yPos += 8;

      evidences.forEach((evidence, index) => {
        const evidenceText = `${index + 1}. ${evidence.file_type.toUpperCase()}${evidence.description ? ` - ${evidence.description}` : ""} (${formatShortDate(evidence.created_at)})`;
        const evidenceLines = doc.splitTextToSize(evidenceText, contentWidth);
        doc.text(evidenceLines, margin + 5, yPos);
        yPos += evidenceLines.length * 5 + 3;
      });
    }

    // ===== PAGE 3: DEFENSES (if any) =====
    if (defenses.length > 0) {
      doc.addPage();
      yPos = margin;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("DEFESA(S) APRESENTADA(S)", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      defenses.forEach((defense, index) => {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Defesa ${index + 1} - ${defense.residents?.full_name || "Morador"}`, margin, yPos);
        yPos += 6;
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Prazo: ${formatShortDate(defense.deadline)} | Enviada em: ${formatShortDate(defense.submitted_at)}`, margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(33, 33, 33);
        const defenseLines = doc.splitTextToSize(defense.content, contentWidth);
        doc.text(defenseLines, margin, yPos);
        yPos += defenseLines.length * 5 + 15;
      });
    }

    // ===== PAGE 4: DECISIONS (if any) =====
    if (decisions.length > 0) {
      doc.addPage();
      yPos = margin;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text("DECISÃO", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      const statusLabels: Record<string, string> = {
        arquivada: "ARQUIVADA",
        advertido: "ADVERTÊNCIA MANTIDA",
        multado: "MULTA APLICADA",
      };

      decisions.forEach((decision, index) => {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Resultado: ${statusLabels[decision.decision] || decision.decision}`, margin, yPos);
        yPos += 8;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Data da decisão: ${formatShortDate(decision.decided_at)}`, margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setTextColor(33, 33, 33);
        doc.text("Justificativa:", margin, yPos);
        yPos += 6;

        const justificationLines = doc.splitTextToSize(decision.justification, contentWidth);
        doc.text(justificationLines, margin, yPos);
        yPos += justificationLines.length * 5 + 15;
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Bottom line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
      
      // Condominium info footer
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(condominiumName.toUpperCase(), pageWidth / 2, pageHeight - 18, { align: "center" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    // Generate filename
    const residentName = occurrence.residents?.full_name?.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20) || "morador";
    const blockApt = `BL_${blockName}_APTO_${aptNumber}`;
    const typeLabel = typeLabels[occurrence.type]?.toUpperCase() || "OCORRENCIA";
    const fileName = `${typeLabel}_-_${blockApt}_-_${residentName}.pdf`;

    doc.save(fileName);

    toast({
      title: "PDF gerado com sucesso!",
      description: "O download do documento foi iniciado.",
    });
  };

  const getFileIcon = (type: string) => {
    if (type === "image") return <ImageIcon className="w-5 h-5" />;
    if (type === "video") return <Video className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!occurrence) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Ocorrência não encontrada.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-up">
        <SindicoBreadcrumbs 
          items={[
            { label: "Ocorrências", href: "/occurrences" },
            { label: occurrence.title }
          ]} 
        />

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/occurrences")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getTypeBadge(occurrence.type)}
              {getStatusBadge(occurrence.status)}
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {occurrence.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={generatePDF}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Baixar PDF
            </Button>
            {occurrence.residents && !["arquivada", "advertido", "multado"].includes(occurrence.status) && (
              <Button 
                variant="outline" 
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-400"
              >
                {sendingWhatsApp ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
                )}
                Notificar via WhatsApp
              </Button>
            )}
            {!["arquivada", "advertido", "multado"].includes(occurrence.status) && (
              <Button variant="hero" onClick={() => setIsDecisionDialogOpen(true)}>
                <Gavel className="w-4 h-4 mr-2" />
                Registrar Decisão
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location & Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-card border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data da Ocorrência</p>
                      <p className="font-medium text-foreground">{formatDateLocal(occurrence.occurred_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {occurrence.location && (
                <Card className="bg-gradient-card border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Local</p>
                        <p className="font-medium text-foreground">{occurrence.location}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Description */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Descrição
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-line text-justify">{occurrence.description}</p>
              </CardContent>
            </Card>

            {/* Legal Basis */}
            {(occurrence.convention_article || occurrence.internal_rules_article || occurrence.civil_code_article || occurrence.legal_basis) && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Scale className="w-5 h-5 text-primary" />
                    Fundamentação Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {occurrence.convention_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo da Convenção</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.convention_article}</p>
                    </div>
                  )}
                  {occurrence.internal_rules_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo do Regimento Interno</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.internal_rules_article}</p>
                    </div>
                  )}
                  {occurrence.civil_code_article && (
                    <div>
                      <p className="text-sm text-muted-foreground">Artigo do Código Civil</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.civil_code_article}</p>
                    </div>
                  )}
                  {occurrence.legal_basis && (
                    <div>
                      <p className="text-sm text-muted-foreground">Observações Legais</p>
                      <p className="font-medium text-foreground whitespace-pre-line text-justify">{occurrence.legal_basis}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Evidences */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Provas ({evidences.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evidences.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma prova anexada.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {evidences.map((ev) => (
                      <div
                        key={ev.id}
                        className="relative group rounded-xl overflow-hidden border border-border/50 bg-muted/30"
                      >
                        {ev.file_type === "image" ? (
                          <img
                            src={ev.file_url}
                            alt={ev.description || "Prova"}
                            className="w-full h-32 object-cover cursor-pointer"
                            onClick={() => setPreviewImage(ev.file_url)}
                          />
                        ) : ev.file_type === "video" ? (
                          <video
                            src={ev.file_url}
                            className="w-full h-32 object-cover"
                            controls
                          />
                        ) : (
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full h-32 bg-muted"
                          >
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </a>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {ev.file_type === "image" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPreviewImage(ev.file_url)}
                            >
                              Ver
                            </Button>
                          )}
                          <a href={ev.file_url} download target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="secondary">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                        {ev.description && (
                          <p className="p-2 text-xs text-muted-foreground truncate">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Defenses */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Defesas ({defenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {defenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma defesa apresentada.</p>
                ) : (
                  <div className="space-y-4">
                    {defenses.map((def) => (
                      <div
                        key={def.id}
                        className="p-4 rounded-xl bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">
                            {def.residents?.full_name || "Morador"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateLocal(def.submitted_at)}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-line text-justify mb-3">{def.content}</p>
                        {def.defense_attachments && def.defense_attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {def.defense_attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {getFileIcon(att.file_type)}
                                Anexo
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decisions */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-primary" />
                  Decisões ({decisions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decisions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma decisão registrada.</p>
                ) : (
                  <div className="space-y-4">
                    {decisions.map((dec) => {
                      const decisionLabels: Record<string, string> = {
                        arquivada: "Arquivada",
                        advertido: "Advertência Aplicada",
                        multado: "Multa Aplicada",
                      };
                      const decisionColors: Record<string, string> = {
                        arquivada: "bg-muted text-muted-foreground",
                        advertido: "bg-orange-500/10 text-orange-500",
                        multado: "bg-red-500/10 text-red-500",
                      };
                      return (
                        <div
                          key={dec.id}
                          className="p-4 rounded-xl bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${decisionColors[dec.decision] || ""}`}>
                              {decisionLabels[dec.decision] || dec.decision}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateLocal(dec.decided_at)}
                            </span>
                          </div>
                          <p className="text-foreground whitespace-pre-line text-justify">{dec.justification}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Timeline & Info */}
          <div className="space-y-6">
            {/* Involved Parties */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Envolvidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Condomínio</p>
                    <p className="font-medium text-foreground">{occurrence.condominiums?.name}</p>
                  </div>
                </div>

                {occurrence.blocks?.name && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bloco / Apto</p>
                      <p className="font-medium text-foreground">
                        {occurrence.blocks.name}
                        {occurrence.apartments?.number && ` - Apto ${occurrence.apartments.number}`}
                      </p>
                    </div>
                  </div>
                )}

                {occurrence.residents?.full_name && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Morador</p>
                      <p className="font-medium text-foreground">{occurrence.residents.full_name}</p>
                      <p className="text-xs text-muted-foreground">{occurrence.residents.email}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sem eventos.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-6">
                      {timeline.map((item, index) => (
                        <div key={item.id} className="relative flex gap-4">
                          <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center text-white z-10`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="font-medium text-foreground text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">{item.description}</p>
                            <p className="text-xs text-muted-foreground/70">
                              {formatDateLocal(item.date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications */}
            {notifications.length > 0 && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    Notificações
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {notifications.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {notifications.map((notif, index) => {
                      const deviceInfo = notif.device_info as { browser?: string; os?: string; device?: string } | null;
                      const locationInfo = notif.location_info as { city?: string; region?: string; country?: string } | null;
                      
                      const getDeviceName = () => {
                        if (deviceInfo?.device) return deviceInfo.device;
                        if (deviceInfo?.browser) return deviceInfo.browser;
                        if (deviceInfo?.os) return deviceInfo.os;
                        if (notif.user_agent?.includes('Mobile')) return 'Celular';
                        if (notif.user_agent?.includes('Windows')) return 'Windows';
                        if (notif.user_agent?.includes('Mac')) return 'macOS';
                        if (notif.user_agent?.includes('Linux')) return 'Linux';
                        return 'Desconhecido';
                      };

                      const getDeviceIcon = () => {
                        const device = getDeviceName().toLowerCase();
                        if (device.includes('celular') || device.includes('mobile')) {
                          return <Smartphone className="w-4 h-4" />;
                        }
                        return <Monitor className="w-4 h-4" />;
                      };

                      const formatIp = (ip: string) => {
                        // Show only unique IPs, take first one
                        const ips = ip.split(',').map(i => i.trim());
                        return ips[0];
                      };
                      
                      return (
                        <div 
                          key={notif.id} 
                          className="relative overflow-hidden rounded-xl border border-border/50 bg-background/50 transition-all hover:border-primary/30 hover:shadow-sm"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/30">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-green-500" />
                              </div>
                              <div>
                                <span className="font-medium text-sm capitalize">{notif.sent_via.replace('_', ' ')}</span>
                                <p className="text-xs text-muted-foreground">
                                  Enviada em {formatDateTime(notif.sent_at)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Status */}
                            <div className="flex items-center gap-1.5">
                              {notif.acknowledged_at ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmada
                                </Badge>
                              ) : notif.read_at ? (
                                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
                                  <Eye className="w-3 h-3 mr-1" /> Lida
                                </Badge>
                              ) : notif.delivered_at ? (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Entregue
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Enviada
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Read details */}
                          {notif.read_at && (
                            <div className="px-4 py-3">
                              <div className="grid grid-cols-2 gap-3">
                                {/* Date */}
                                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Lida em</p>
                                    <p className="text-xs font-medium truncate">{formatDateTime(notif.read_at)}</p>
                                  </div>
                                </div>
                                
                                {/* Device */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 cursor-help">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                          {getDeviceIcon()}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dispositivo</p>
                                          <p className="text-xs font-medium truncate">{getDeviceName()}</p>
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    {notif.user_agent && (
                                      <TooltipContent side="top" className="max-w-xs break-all text-xs">
                                        <p className="font-mono">{notif.user_agent}</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                
                                {/* Location */}
                                {(locationInfo?.city || locationInfo?.region || locationInfo?.country) && (
                                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                      <MapPin className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Localização</p>
                                      <p className="text-xs font-medium truncate">
                                        {[locationInfo?.city, locationInfo?.region].filter(Boolean).join(', ') || locationInfo?.country || '-'}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                
                                {/* IP */}
                                {notif.ip_address && (
                                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                                    <div className="w-8 h-8 rounded-full bg-slate-500/10 flex items-center justify-center shrink-0">
                                      <Globe className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Endereço IP</p>
                                      <p className="text-xs font-medium font-mono truncate">{formatIp(notif.ip_address)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              Registrar Decisão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decisão</label>
              <Select
                value={decisionData.decision}
                onValueChange={(v: "arquivada" | "advertido" | "multado") => setDecisionData({ ...decisionData, decision: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione a decisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arquivada">Arquivar</SelectItem>
                  <SelectItem value="advertido">Aplicar Advertência</SelectItem>
                  <SelectItem value="multado">Aplicar Multa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Justificativa</label>
              <Textarea
                value={decisionData.justification}
                onChange={(e) => setDecisionData({ ...decisionData, justification: e.target.value })}
                placeholder="Descreva a justificativa para a decisão..."
                rows={5}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="hero" onClick={handleSubmitDecision} disabled={savingDecision}>
              {savingDecision && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="bg-card border-border max-w-4xl p-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4 text-white" />
            </Button>
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OccurrenceDetails;
