import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, X, Mail, CreditCard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF } from "@/lib/utils";

interface Block {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  block_id: string;
  number: string;
}

interface BulkResidentCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  condominiumName: string;
  blocks: Block[];
  apartments: Apartment[];
  onSuccess: () => void;
}

interface ParsedResident {
  block_name: string;
  apartment_number: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  is_owner: boolean;
  is_responsible: boolean;
  errors: string[];
  isValid: boolean;
  apartment_id?: string;
}

const BulkResidentCSVImportDialog = ({
  open,
  onOpenChange,
  condominiumId,
  condominiumName,
  blocks,
  apartments,
  onSuccess,
}: BulkResidentCSVImportDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedResidents, setParsedResidents] = useState<ParsedResident[]>([]);
  const [existingResidents, setExistingResidents] = useState<{ apartment_id: string; email: string }[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; skipped: number }>({ success: 0, failed: 0, skipped: 0 });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [failedImports, setFailedImports] = useState<{ resident: ParsedResident; error: string }[]>([]);

  const resetState = () => {
    setStep("upload");
    setParsedResidents([]);
    setExistingResidents([]);
    setImportResults({ success: 0, failed: 0, skipped: 0 });
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setFailedImports([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Fetch existing residents when dialog opens
  const fetchExistingResidents = async () => {
    if (apartments.length === 0) return;
    
    const apartmentIds = apartments.map(a => a.id);
    const { data } = await supabase
      .from("residents")
      .select("apartment_id, email")
      .in("apartment_id", apartmentIds);
    
    setExistingResidents(data || []);
  };

  // Check if a resident already exists
  const isResidentDuplicate = (apartmentId: string, email: string): boolean => {
    const normalizedEmail = email.toLowerCase().trim();
    return existingResidents.some(
      r => r.apartment_id === apartmentId && r.email.toLowerCase().trim() === normalizedEmail
    );
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const csvContent = `bloco,apartamento,nome,email,telefone,cpf,proprietario,responsavel
BLOCO 1,101,João da Silva,joao@email.com,11999999999,12345678901,sim,sim
BLOCO 1,102,Maria Santos,maria@email.com,11988888888,,não,não
BLOCO 2,201,Carlos Souza,carlos@email.com,11977777777,98765432100,sim,não`;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `modelo_moradores_${condominiumName.replace(/\s+/g, "_").toLowerCase()}.csv`;
    link.click();
  };

  const findApartmentId = (blockName: string, apartmentNumber: string): string | undefined => {
    const normalizedBlockName = blockName.toUpperCase().trim();
    const normalizedAptNumber = apartmentNumber.toUpperCase().trim();
    
    const block = blocks.find(b => b.name.toUpperCase() === normalizedBlockName);
    if (!block) return undefined;
    
    const apartment = apartments.find(
      a => a.block_id === block.id && a.number.toUpperCase() === normalizedAptNumber
    );
    return apartment?.id;
  };

  const parseCSV = (content: string): ParsedResident[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1);
    
    return dataLines.map((line) => {
      // Handle CSV with potential commas inside quoted fields
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const [blockName, apartmentNumber, name, email, phone, cpf, isOwner, isResponsible] = values;
      
      const errors: string[] = [];
      
      // Validate block and apartment
      if (!blockName || blockName.length < 1) {
        errors.push("Bloco obrigatório");
      }
      
      if (!apartmentNumber || apartmentNumber.length < 1) {
        errors.push("Apartamento obrigatório");
      }
      
      // Find apartment_id
      const apartment_id = findApartmentId(blockName || "", apartmentNumber || "");
      if (blockName && apartmentNumber && !apartment_id) {
        errors.push("Bloco/Apartamento não encontrado");
      }
      
      // Validate name
      if (!name || name.length < 2) {
        errors.push("Nome inválido");
      }
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        errors.push("E-mail inválido");
      }
      
      // Validate CPF if provided
      const cleanCPF = cpf?.replace(/\D/g, "") || "";
      if (cleanCPF && cleanCPF.length > 0 && !isValidCPF(cleanCPF)) {
        errors.push("CPF inválido");
      }

      // Parse boolean fields
      const parseBoolean = (value: string | undefined): boolean => {
        if (!value) return false;
        const lower = value.toLowerCase().trim();
        return ["sim", "s", "yes", "y", "true", "1", "x"].includes(lower);
      };

      return {
        block_name: blockName || "",
        apartment_number: apartmentNumber || "",
        full_name: name || "",
        email: email || "",
        phone: phone?.replace(/\D/g, "") || "",
        cpf: cleanCPF,
        is_owner: parseBoolean(isOwner),
        is_responsible: parseBoolean(isResponsible),
        errors,
        isValid: errors.length === 0,
        apartment_id,
      };
    }).filter(r => r.full_name || r.email || r.block_name || r.apartment_number); // Filter out completely empty rows
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive",
      });
      return;
    }

    // Fetch existing residents first
    await fetchExistingResidents();

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      
      if (parsed.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados válidos.",
          variant: "destructive",
        });
        return;
      }

      // Mark duplicates as invalid
      const parsedWithDuplicateCheck = parsed.map(resident => {
        if (resident.apartment_id && resident.email) {
          const isDuplicate = isResidentDuplicate(resident.apartment_id, resident.email);
          if (isDuplicate) {
            return {
              ...resident,
              errors: [...resident.errors, "Morador já cadastrado neste apartamento"],
              isValid: false,
            };
          }
        }
        return resident;
      });

      setParsedResidents(parsedWithDuplicateCheck);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validResidents = parsedResidents.filter(r => r.isValid && r.apartment_id);
    if (validResidents.length === 0) {
      toast({
        title: "Nenhum registro válido",
        description: "Corrija os erros antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setStep("importing");
    setImportProgress({ current: 0, total: validResidents.length });
    setFailedImports([]);

    let success = 0;
    let failed = 0;
    const failures: { resident: ParsedResident; error: string }[] = [];

    for (let i = 0; i < validResidents.length; i++) {
      const resident = validResidents[i];
      setImportProgress({ current: i + 1, total: validResidents.length });
      
      try {
        const { error } = await supabase.from("residents").insert({
          apartment_id: resident.apartment_id!,
          full_name: resident.full_name.toUpperCase(),
          email: resident.email,
          phone: resident.phone || null,
          cpf: resident.cpf || null,
          is_owner: resident.is_owner,
          is_responsible: resident.is_responsible,
        });

        if (error) {
          failed++;
          const errorMessage = error.message.includes("duplicate") 
            ? "E-mail já cadastrado" 
            : error.message.includes("violates") 
              ? "Violação de regra do banco de dados" 
              : error.message;
          failures.push({ resident, error: errorMessage });
          console.error("Error inserting resident:", error);
        } else {
          success++;
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        failures.push({ resident, error: errorMessage });
        console.error("Error inserting resident:", error);
      }
    }

    setFailedImports(failures);
    setImportResults({ success, failed, skipped: 0 });
    setStep("done");
    setImporting(false);

    if (success > 0) {
      onSuccess();
    }
  };

  const validCount = parsedResidents.filter(r => r.isValid).length;
  const invalidCount = parsedResidents.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Moradores em Lote via CSV
          </DialogTitle>
          <DialogDescription className="uppercase">
            {condominiumName}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Formato esperado do CSV:</h4>
              <code className="block text-xs bg-background p-3 rounded border overflow-x-auto">
                bloco,apartamento,nome,email,telefone,cpf,proprietario,responsavel
              </code>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>bloco</strong> e <strong>apartamento</strong>: devem corresponder aos já cadastrados</li>
                <li>• <strong>nome</strong> e <strong>email</strong>: obrigatórios</li>
                <li>• <strong>telefone</strong> e <strong>cpf</strong>: opcionais</li>
                <li>• <strong>proprietario</strong> e <strong>responsavel</strong>: sim/não ou s/n</li>
              </ul>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Baixar modelo CSV
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col flex-1 overflow-hidden space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {invalidCount} com erros
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[350px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead>Bloco</TableHead>
                      <TableHead>Apto</TableHead>
                      <TableHead>Nome</TableHead>
                     <TableHead>E-mail</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-16">Prop.</TableHead>
                      <TableHead className="w-16">Resp.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedResidents.map((resident, index) => (
                      <TableRow key={index} className={!resident.isValid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {resident.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <div className="relative group">
                              <AlertCircle className="w-4 h-4 text-destructive" />
                              <div className="absolute left-0 top-6 z-20 hidden group-hover:block bg-popover border rounded p-2 text-xs whitespace-nowrap shadow-lg">
                                {resident.errors.join(", ")}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{resident.block_name}</TableCell>
                        <TableCell>{resident.apartment_number}</TableCell>
                        <TableCell>{resident.full_name}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs truncate max-w-[150px]">{resident.email}</span>
                                  {resident.email && (
                                    resident.errors.some(e => e.toLowerCase().includes("e-mail") || e.toLowerCase().includes("email")) ? (
                                      <Mail className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                    ) : (
                                      <Mail className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                    )
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {resident.errors.some(e => e.toLowerCase().includes("e-mail") || e.toLowerCase().includes("email")) ? (
                                  <span className="text-destructive">E-mail inválido ou já cadastrado</span>
                                ) : (
                                  <span className="text-green-500">E-mail válido</span>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {resident.cpf ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs">{resident.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                    {resident.errors.some(e => e.toLowerCase().includes("cpf")) ? (
                                      <CreditCard className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                    ) : (
                                      <CreditCard className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {resident.errors.some(e => e.toLowerCase().includes("cpf")) ? (
                                    <span className="text-destructive">CPF inválido</span>
                                  ) : (
                                    <span className="text-green-500">CPF válido</span>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{resident.phone || "-"}</TableCell>
                        <TableCell>
                          <Checkbox checked={resident.is_owner} disabled />
                        </TableCell>
                        <TableCell>
                          <Checkbox checked={resident.is_responsible} disabled />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={resetState}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                <Upload className="w-4 h-4 mr-2" />
                Importar {validCount} morador{validCount !== 1 ? "es" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-12 text-center space-y-6">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <div className="space-y-3 max-w-md mx-auto">
              <p className="text-muted-foreground">
                Importando moradores... {importProgress.current} de {importProgress.total}
              </p>
              <Progress 
                value={(importProgress.current / importProgress.total) * 100} 
                className="h-3"
              />
              <p className="text-sm text-muted-foreground">
                {Math.round((importProgress.current / importProgress.total) * 100)}% concluído
              </p>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-2">
              {importResults.success > 0 && (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="text-lg font-medium">
                    {importResults.success} morador{importResults.success !== 1 ? "es" : ""} importado{importResults.success !== 1 ? "s" : ""} com sucesso!
                  </span>
                </div>
              )}
              {importResults.failed > 0 && (
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span>
                    {importResults.failed} falha{importResults.failed !== 1 ? "s" : ""} na importação
                  </span>
                </div>
              )}
            </div>

            {failedImports.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Detalhes das falhas:
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Bloco</TableHead>
                          <TableHead>Apto</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedImports.map((failure, index) => (
                          <TableRow key={index} className="bg-destructive/5">
                            <TableCell className="font-medium">{failure.resident.block_name}</TableCell>
                            <TableCell>{failure.resident.apartment_number}</TableCell>
                            <TableCell>{failure.resident.full_name}</TableCell>
                            <TableCell className="text-xs">{failure.resident.email}</TableCell>
                            <TableCell className="text-xs text-destructive font-medium">
                              {failure.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkResidentCSVImportDialog;
