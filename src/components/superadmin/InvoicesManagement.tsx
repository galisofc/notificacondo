import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  Eye,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  QrCode,
  Loader2,
} from "lucide-react";

interface InvoiceWithDetails {
  id: string;
  subscription_id: string;
  condominium_id: string;
  amount: number;
  due_date: string;
  period_start: string;
  period_end: string;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  description: string | null;
  created_at: string;
  invoice_number: string | null;
  condominium: {
    name: string;
    owner_id: string;
    cnpj: string | null;
  } | null;
  owner_profile: {
    full_name: string;
    email: string;
  } | null;
}

type SortColumn = "invoice_number" | "due_date" | "amount" | "status";
type SortDirection = "asc" | "desc";

export function InvoicesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const saved = localStorage.getItem("invoices-sort-column");
    return (saved as SortColumn) || "invoice_number";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem("invoices-sort-direction");
    return (saved as SortDirection) || "desc";
  });
  const [generatingPix, setGeneratingPix] = useState<string | null>(null);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [pixInvoice, setPixInvoice] = useState<InvoiceWithDetails | null>(null);
  const [pixDocument, setPixDocument] = useState("");
  const [pixDocumentType, setPixDocumentType] = useState<"CPF" | "CNPJ">("CPF");
  const [pixDocumentError, setPixDocumentError] = useState("");
  const itemsPerPage = 10;

  // Validação de CPF
  const validateCPF = (cpf: string): boolean => {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  };

  // Validação de CNPJ
  const validateCNPJ = (cnpj: string): boolean => {
    cnpj = cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  };

  // Formatar CPF/CNPJ durante digitação
  const formatDocument = (value: string, type: "CPF" | "CNPJ"): string => {
    const numbers = value.replace(/\D/g, "");
    if (type === "CPF") {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        .substring(0, 14);
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
        .substring(0, 18);
    }
  };

  // Handler para abrir dialog do PIX
  const handleOpenPixDialog = (invoice: InvoiceWithDetails) => {
    if (invoice.status === "paid") {
      toast({
        title: "Fatura já paga",
        description: "Esta fatura já foi paga, não é possível gerar PIX.",
        variant: "destructive",
      });
      return;
    }
    setPixInvoice(invoice);
    setPixDocument("");
    setPixDocumentError("");
    setPixDocumentType("CPF");
    setShowPixDialog(true);
  };

  // Handler para mudança de documento
  const handleDocumentChange = (value: string) => {
    const formatted = formatDocument(value, pixDocumentType);
    setPixDocument(formatted);
    setPixDocumentError("");
  };

  // Handler para mudança de tipo de documento
  const handleDocumentTypeChange = (type: "CPF" | "CNPJ") => {
    setPixDocumentType(type);
    setPixDocument("");
    setPixDocumentError("");
  };

  // Validar e gerar PIX
  const handleGeneratePixWithValidation = async () => {
    if (!pixInvoice) return;

    const cleanDocument = pixDocument.replace(/\D/g, "");
    
    if (pixDocumentType === "CPF") {
      if (!validateCPF(cleanDocument)) {
        setPixDocumentError("CPF inválido. Verifique os dígitos.");
        return;
      }
    } else {
      if (!validateCNPJ(cleanDocument)) {
        setPixDocumentError("CNPJ inválido. Verifique os dígitos.");
        return;
      }
    }

    setShowPixDialog(false);
    await generateInvoicePDFWithPix(pixInvoice, cleanDocument, pixDocumentType);
  };

  // Persistir preferências de ordenação
  useEffect(() => {
    localStorage.setItem("invoices-sort-column", sortColumn);
    localStorage.setItem("invoices-sort-direction", sortDirection);
  }, [sortColumn, sortDirection]);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["superadmin-invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*")
        .order("invoice_number", { ascending: false, nullsFirst: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const invoicesWithDetails = await Promise.all(
        (data || []).map(async (invoice) => {
          const { data: condo } = await supabase
            .from("condominiums")
            .select("name, owner_id, cnpj")
            .eq("id", invoice.condominium_id)
            .single();

          let ownerProfile = null;
          if (condo?.owner_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", condo.owner_id)
              .single();
            ownerProfile = profile;
          }

          return {
            ...invoice,
            condominium: condo,
            owner_profile: ownerProfile,
          } as InvoiceWithDetails;
        })
      );

      return invoicesWithDetails;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["superadmin-invoice-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("status, amount, due_date");

      if (error) throw error;

      const today = new Date();
      const currentMonthStart = startOfMonth(today);
      const currentMonthEnd = endOfMonth(today);

      const result = {
        pending: { count: 0, total: 0 },
        paid: { count: 0, total: 0 },
        overdue: { count: 0, total: 0 },
        thisMonth: { count: 0, total: 0 },
      };

      data.forEach((invoice) => {
        const dueDate = new Date(invoice.due_date);
        const isPastDue = dueDate < today && invoice.status === "pending";

        if (invoice.status === "paid") {
          result.paid.count++;
          result.paid.total += Number(invoice.amount);
        } else if (isPastDue) {
          result.overdue.count++;
          result.overdue.total += Number(invoice.amount);
        } else if (invoice.status === "pending") {
          result.pending.count++;
          result.pending.total += Number(invoice.amount);
        }

        if (dueDate >= currentMonthStart && dueDate <= currentMonthEnd) {
          result.thisMonth.count++;
          result.thisMonth.total += Number(invoice.amount);
        }
      });

      return result;
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      method,
      reference,
    }: {
      invoiceId: string;
      method: string;
      reference: string;
    }) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: method,
          payment_reference: reference,
        })
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-invoice-stats"] });
      toast({
        title: "Pagamento registrado",
        description: "A fatura foi marcada como paga com sucesso.",
      });
      setShowPaymentDialog(false);
      setPaymentMethod("");
      setPaymentReference("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível registrar o pagamento.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "—";
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return cnpj;
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  const formatCNPJInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return value;
    
    // Se parece ser um CNPJ (apenas números), aplica a máscara
    if (/^\d+$/.test(value.replace(/[\.\-\/]/g, ""))) {
      let formatted = digits;
      if (digits.length > 2) formatted = digits.slice(0, 2) + "." + digits.slice(2);
      if (digits.length > 5) formatted = formatted.slice(0, 6) + "." + digits.slice(5);
      if (digits.length > 8) formatted = formatted.slice(0, 10) + "/" + digits.slice(8);
      if (digits.length > 12) formatted = formatted.slice(0, 15) + "-" + digits.slice(12, 14);
      return formatted;
    }
    return value;
  };

  const generateInvoicePDF = (invoice: InvoiceWithDetails) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Cores
    const primaryBlue = [0, 136, 204]; // #0088CC
    const darkBlue = [0, 102, 153]; // #006699
    const lightGray = [245, 245, 245];
    const textDark = [51, 51, 51];
    const textGray = [100, 100, 100];
    
    // ===== HEADER BAR =====
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, pageWidth, 25, "F");
    
    // Nome da empresa no header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("NOTIFICACONDO", pageWidth / 2, 15, { align: "center" });
    
    // ===== INFO ABAIXO DO HEADER =====
    let yPos = 35;
    
    // Lado esquerdo - Endereço da empresa
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text("Sistema de Gestao de Ocorrencias", 20, yPos);
    doc.text("Condominiais", 20, yPos + 5);
    
    // Lado direito - Contato
    doc.text("notificacondo.com.br", pageWidth - 20, yPos, { align: "right" });
    doc.text("contato@notificacondo.com.br", pageWidth - 20, yPos + 5, { align: "right" });
    
    // ===== TITULO FATURA =====
    yPos = 60;
    doc.setFontSize(36);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Fatura.", 20, yPos);
    
    // Numero e data à direita
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text("Fatura  : " + (invoice.invoice_number || "—"), pageWidth - 20, yPos - 15, { align: "right" });
    doc.text("Data    : " + formatDate(invoice.created_at), pageWidth - 20, yPos - 7, { align: "right" });
    
    // ===== EMITIDO PARA =====
    yPos = 75;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Emitido Para", 20, yPos);
    
    // Dados do cliente
    yPos += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(invoice.condominium?.name || "—", 20, yPos);
    yPos += 5;
    doc.text("CNPJ: " + formatCNPJ(invoice.condominium?.cnpj || null), 20, yPos);
    yPos += 5;
    doc.text("Sindico: " + (invoice.owner_profile?.full_name || "—"), 20, yPos);
    yPos += 5;
    doc.text(invoice.owner_profile?.email || "—", 20, yPos);
    
    // ===== VALOR GRANDE À DIREITA =====
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(formatCurrency(Number(invoice.amount)), pageWidth - 20, 85, { align: "right" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text("DATA DE VENCIMENTO: " + formatDate(invoice.due_date), pageWidth - 20, 93, { align: "right" });
    
    // ===== CALCULAR DESCONTO =====
    // Extrair percentual de desconto da descrição (ex: "Desconto: 15%")
    const discountMatch = invoice.description?.match(/Desconto:\s*(\d+)%/);
    const discountPercent = discountMatch ? parseFloat(discountMatch[1]) : 0;
    
    // Se há desconto, calcular o valor original
    // amount = originalAmount - (originalAmount * discountPercent / 100)
    // amount = originalAmount * (1 - discountPercent/100)
    // originalAmount = amount / (1 - discountPercent/100)
    const hasDiscount = discountPercent > 0;
    const originalAmount = hasDiscount 
      ? Number(invoice.amount) / (1 - discountPercent / 100)
      : Number(invoice.amount);
    const discountValue = hasDiscount ? originalAmount - Number(invoice.amount) : 0;
    
    // ===== TABELA DE ITENS =====
    yPos = 115;
    
    // Header da tabela
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(20, yPos, pageWidth - 40, 10, "F");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Descricao", 25, yPos + 7);
    doc.text("Qtd", 120, yPos + 7, { align: "center" });
    doc.text("Preco", 150, yPos + 7, { align: "center" });
    doc.text("Total", pageWidth - 25, yPos + 7, { align: "right" });
    
    // Linha do item
    yPos += 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    
    const periodText = "Assinatura - Periodo: " + formatDate(invoice.period_start) + " a " + formatDate(invoice.period_end);
    doc.text(periodText, 25, yPos);
    doc.text("01", 120, yPos, { align: "center" });
    doc.text(formatCurrency(originalAmount), 150, yPos, { align: "center" });
    doc.text(formatCurrency(originalAmount), pageWidth - 25, yPos, { align: "right" });
    
    // Linha separadora
    yPos += 5;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(20, yPos, pageWidth - 20, yPos);
    
    // ===== RESUMO =====
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    
    doc.text("Subtotal", 140, yPos);
    doc.text(formatCurrency(originalAmount), pageWidth - 25, yPos, { align: "right" });
    
    // Mostrar desconto apenas se houver
    if (hasDiscount) {
      yPos += 8;
      doc.setTextColor(34, 139, 34); // Verde para desconto
      doc.text("Desconto (" + discountPercent + "%)", 140, yPos);
      doc.text("-" + formatCurrency(discountValue), pageWidth - 25, yPos, { align: "right" });
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    }
    
    // Total com fundo azul
    yPos += 12;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(130, yPos - 5, pageWidth - 150, 10, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Total", 140, yPos + 2);
    doc.text(formatCurrency(Number(invoice.amount)), pageWidth - 25, yPos + 2, { align: "right" });
    
    // ===== INFORMACOES DE PAGAMENTO =====
    yPos += 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Informacao de pagamento", 20, yPos);
    
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    
    const statusText = invoice.status === "paid" ? "Status: PAGO" : "Status: PENDENTE";
    doc.text(statusText, 20, yPos);
    
    if (invoice.paid_at) {
      yPos += 5;
      doc.text("Pago em: " + formatDate(invoice.paid_at), 20, yPos);
    }
    
    if (invoice.payment_method) {
      yPos += 5;
      doc.text("Forma de pagamento: " + invoice.payment_method, 20, yPos);
    }
    
    if (invoice.payment_reference) {
      yPos += 5;
      doc.text("Referencia: " + invoice.payment_reference, 20, yPos);
    }
    
    yPos += 10;
    doc.text("Se voce tiver alguma duvida sobre esta fatura, favor entrar em contato.", 20, yPos);
    
    // ===== FOOTER =====
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("contato@notificacondo.com.br", pageWidth / 2 - 30, pageHeight - 10, { align: "center" });
    doc.text("notificacondo.com.br", pageWidth / 2 + 40, pageHeight - 10, { align: "center" });
    
    // Gerado em
    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.text("Gerado em: " + format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageWidth / 2, pageHeight - 4, { align: "center" });
    
    // Save
    doc.save((invoice.invoice_number || "fatura") + ".pdf");
    
    toast({
      title: "PDF gerado",
      description: "Fatura " + (invoice.invoice_number || "") + " exportada com sucesso.",
    });
  };

  // Gerar PDF com QR Code PIX
  const generateInvoicePDFWithPix = async (
    invoice: InvoiceWithDetails, 
    documentNumber: string, 
    documentType: "CPF" | "CNPJ"
  ) => {
    setGeneratingPix(invoice.id);

    try {
      // Gerar PIX via Mercado Pago
      const { data: pixData, error: pixError } = await supabase.functions.invoke(
        "mercadopago-create-pix",
        {
          body: {
            invoice_id: invoice.id,
            payer_email: invoice.owner_profile?.email || "cliente@email.com",
            payer_first_name: invoice.owner_profile?.full_name?.split(" ")[0] || "Cliente",
            payer_last_name: invoice.owner_profile?.full_name?.split(" ").slice(1).join(" ") || "NotificaCondo",
            payer_identification_type: documentType,
            payer_identification_number: documentNumber,
          },
        }
      );

      if (pixError || !pixData?.success) {
        throw new Error(pixData?.error || "Erro ao gerar PIX");
      }

      // Gerar PDF com QR Code
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Cores
      const primaryBlue = [0, 136, 204];
      const textDark = [51, 51, 51];
      const textGray = [100, 100, 100];
      
      // ===== HEADER BAR =====
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, 0, pageWidth, 25, "F");
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("NOTIFICACONDO", pageWidth / 2, 15, { align: "center" });
      
      // ===== INFO ABAIXO DO HEADER =====
      let yPos = 35;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text("Sistema de Gestao de Ocorrencias Condominiais", 20, yPos);
      doc.text("notificacondo.com.br", pageWidth - 20, yPos, { align: "right" });
      
      // ===== TITULO FATURA =====
      yPos = 55;
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Fatura.", 20, yPos);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text("Fatura  : " + (invoice.invoice_number || "—"), pageWidth - 20, yPos - 10, { align: "right" });
      doc.text("Data    : " + formatDate(invoice.created_at), pageWidth - 20, yPos - 2, { align: "right" });
      
      // ===== EMITIDO PARA =====
      yPos = 70;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Emitido Para", 20, yPos);
      
      yPos += 7;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(invoice.condominium?.name || "—", 20, yPos);
      doc.text("CNPJ: " + formatCNPJ(invoice.condominium?.cnpj || null), 20, yPos + 5);
      doc.text(invoice.owner_profile?.full_name || "—", 20, yPos + 10);
      
      // ===== VALOR =====
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatCurrency(Number(invoice.amount)), pageWidth - 20, 75, { align: "right" });
      
      doc.setFontSize(9);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text("VENCIMENTO: " + formatDate(invoice.due_date), pageWidth - 20, 83, { align: "right" });
      
      // ===== DESCRICAO =====
      yPos = 105;
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(20, yPos, pageWidth - 40, 8, "F");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Descricao", 25, yPos + 6);
      doc.text("Valor", pageWidth - 25, yPos + 6, { align: "right" });
      
      yPos += 13;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Assinatura - Periodo: " + formatDate(invoice.period_start) + " a " + formatDate(invoice.period_end), 25, yPos);
      doc.text(formatCurrency(Number(invoice.amount)), pageWidth - 25, yPos, { align: "right" });
      
      // ===== PIX SECTION =====
      yPos = 135;
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, yPos, pageWidth - 40, 100, 3, 3, "F");
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text("Pagamento via PIX", pageWidth / 2, yPos + 12, { align: "center" });
      
      // QR Code
      if (pixData.qr_code_base64) {
        const qrCodeImg = "data:image/png;base64," + pixData.qr_code_base64;
        doc.addImage(qrCodeImg, "PNG", pageWidth / 2 - 25, yPos + 18, 50, 50);
      }
      
      // Código Copia e Cola
      yPos += 75;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text("Codigo Copia e Cola:", pageWidth / 2, yPos, { align: "center" });
      
      // Quebrar o código em linhas menores
      const pixCode = pixData.qr_code || "";
      const maxCharsPerLine = 60;
      const lines = [];
      for (let i = 0; i < pixCode.length; i += maxCharsPerLine) {
        lines.push(pixCode.substring(i, i + maxCharsPerLine));
      }
      
      doc.setFontSize(6);
      lines.slice(0, 3).forEach((line, index) => {
        doc.text(line, pageWidth / 2, yPos + 5 + (index * 4), { align: "center" });
      });
      if (lines.length > 3) {
        doc.text("...", pageWidth / 2, yPos + 17, { align: "center" });
      }
      
      // ===== FOOTER =====
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
      
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("contato@notificacondo.com.br | notificacondo.com.br", pageWidth / 2, pageHeight - 10, { align: "center" });
      
      doc.setFontSize(7);
      doc.setTextColor(200, 200, 200);
      doc.text("Gerado em: " + format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageWidth / 2, pageHeight - 4, { align: "center" });
      
      // Save
      doc.save((invoice.invoice_number || "fatura") + "-pix.pdf");
      
      toast({
        title: "PDF com PIX gerado",
        description: "Fatura com QR Code PIX exportada com sucesso.",
      });
    } catch (error: any) {
      console.error("Error generating PIX:", error);
      toast({
        title: "Erro ao gerar PIX",
        description: error.message || "Não foi possível gerar o código PIX.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPix(null);
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const isPastDue = due < today && status === "pending";

    if (status === "paid") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }

    if (isPastDue) {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Vencido
        </Badge>
      );
    }

    const daysUntilDue = differenceInDays(due, today);
    if (daysUntilDue <= 7) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Vence em {daysUntilDue} dias
        </Badge>
      );
    }

    return (
      <Badge className="bg-primary/10 text-primary border-primary/20">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const filteredInvoices = invoices?.filter((invoice) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      invoice.condominium?.name.toLowerCase().includes(query) ||
      invoice.condominium?.cnpj?.toLowerCase().includes(query) ||
      invoice.owner_profile?.full_name.toLowerCase().includes(query) ||
      invoice.owner_profile?.email.toLowerCase().includes(query);

    return matchesSearch;
  });

  // Ordenação
  const sortedInvoices = [...(filteredInvoices || [])].sort((a, b) => {
    let comparison = 0;
    
    switch (sortColumn) {
      case "invoice_number":
        const numA = a.invoice_number || "";
        const numB = b.invoice_number || "";
        comparison = numA.localeCompare(numB);
        break;
      case "due_date":
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        break;
      case "amount":
        comparison = Number(a.amount) - Number(b.amount);
        break;
      case "status":
        // Ordem: vencido > pendente > pago
        const getStatusPriority = (invoice: InvoiceWithDetails) => {
          const today = new Date();
          const due = new Date(invoice.due_date);
          if (invoice.status === "paid") return 3;
          if (due < today && invoice.status === "pending") return 1; // vencido
          return 2; // pendente
        };
        comparison = getStatusPriority(a) - getStatusPriority(b);
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Paginação
  const totalItems = sortedInvoices?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = sortedInvoices?.slice(startIndex, startIndex + itemsPerPage);

  // Função para alternar ordenação
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  // Componente de header ordenável
  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );

  // Reset página quando filtros mudam
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const onlyDigitsOrMask = /^[\d\.\-\/]*$/.test(value);
    
    if (onlyDigitsOrMask && value.replace(/\D/g, "").length <= 14) {
      setSearchQuery(formatCNPJInput(value));
    } else {
      setSearchQuery(value);
    }
    setCurrentPage(1);
  };

  const handleMarkAsPaid = () => {
    if (!selectedInvoice || !paymentMethod) return;
    markAsPaidMutation.mutate({
      invoiceId: selectedInvoice.id,
      method: paymentMethod,
      reference: paymentReference,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-xl font-bold">{stats?.thisMonth.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.thisMonth.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold">{stats?.pending.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.pending.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold">{stats?.paid.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.paid.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-xl font-bold">{stats?.overdue.count || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.overdue.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Central de Faturas</CardTitle>
              <CardDescription>
                Gerencie todas as faturas dos condomínios
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CNPJ, email ou condomínio..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9 w-full sm:w-[280px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedInvoices?.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="invoice_number">Nº Fatura</SortableHeader>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Síndico</TableHead>
                      <TableHead>Período</TableHead>
                      <SortableHeader column="due_date">Vencimento</SortableHeader>
                      <SortableHeader column="amount">Valor</SortableHeader>
                      <SortableHeader column="status">Status</SortableHeader>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices?.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-primary">
                            {(invoice as any).invoice_number || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {invoice.condominium?.name || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground font-mono">
                            {formatCNPJ(invoice.condominium?.cnpj)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {invoice.owner_profile?.full_name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.owner_profile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatDate(invoice.due_date)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">
                              {formatCurrency(Number(invoice.amount))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status, invoice.due_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => generateInvoicePDF(invoice)}
                              title="Baixar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {invoice.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPixDialog(invoice)}
                                title="Baixar PDF com PIX"
                                disabled={generatingPix === invoice.id}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                              >
                                {generatingPix === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <QrCode className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {invoice.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setShowPaymentDialog(true);
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalItems)} de {totalItems} faturas
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalPages <= 5) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, idx, arr) => (
                          <span key={page} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-1 text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Fatura</DialogTitle>
            <DialogDescription>
              Informações completas sobre a fatura
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Condomínio</Label>
                  <p className="font-medium">{selectedInvoice.condominium?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Síndico</Label>
                  <p className="font-medium">{selectedInvoice.owner_profile?.full_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Valor</Label>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedInvoice.amount))}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedInvoice.status, selectedInvoice.due_date)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Período</Label>
                  <p className="text-sm">
                    {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Vencimento</Label>
                  <p className="text-sm">{formatDate(selectedInvoice.due_date)}</p>
                </div>
              </div>

              {selectedInvoice.paid_at && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <Label className="text-muted-foreground text-xs">Data do Pagamento</Label>
                    <p className="text-sm">{formatDate(selectedInvoice.paid_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Método</Label>
                    <p className="text-sm">{selectedInvoice.payment_method || "—"}</p>
                  </div>
                  {selectedInvoice.payment_reference && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Referência</Label>
                      <p className="text-sm">{selectedInvoice.payment_reference}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoice.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição</Label>
                  <p className="text-sm">{selectedInvoice.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Marque esta fatura como paga e registre os detalhes do pagamento
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedInvoice.condominium?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento: {formatDate(selectedInvoice.due_date)}
                    </p>
                  </div>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedInvoice.amount))}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-method">Método de Pagamento *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="payment-reference">Referência / Comprovante</Label>
                  <Input
                    id="payment-reference"
                    placeholder="ID da transação, número do comprovante, etc."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={!paymentMethod || markAsPaidMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {markAsPaidMutation.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIX Document Validation Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Gerar PIX
            </DialogTitle>
            <DialogDescription>
              Informe o CPF ou CNPJ do pagador para gerar o QR Code PIX
            </DialogDescription>
          </DialogHeader>
          {pixInvoice && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pixInvoice.condominium?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Fatura: {pixInvoice.invoice_number}
                    </p>
                  </div>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(pixInvoice.amount))}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Tipo de Documento</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={pixDocumentType === "CPF" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDocumentTypeChange("CPF")}
                      className={pixDocumentType === "CPF" ? "" : ""}
                    >
                      CPF
                    </Button>
                    <Button
                      type="button"
                      variant={pixDocumentType === "CNPJ" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDocumentTypeChange("CNPJ")}
                    >
                      CNPJ
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="pix-document">
                    {pixDocumentType} do Pagador *
                  </Label>
                  <Input
                    id="pix-document"
                    placeholder={pixDocumentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={pixDocument}
                    onChange={(e) => handleDocumentChange(e.target.value)}
                    maxLength={pixDocumentType === "CPF" ? 14 : 18}
                    className={pixDocumentError ? "border-destructive" : ""}
                  />
                  {pixDocumentError && (
                    <p className="text-sm text-destructive mt-1">{pixDocumentError}</p>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  O documento do pagador é necessário para validar o pagamento PIX junto ao Mercado Pago.
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPixDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGeneratePixWithValidation}
              disabled={!pixDocument || pixDocument.replace(/\D/g, "").length < (pixDocumentType === "CPF" ? 11 : 14)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Gerar QR Code PIX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
