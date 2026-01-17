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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, X } from "lucide-react";
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

  const resetState = () => {
    setStep("upload");
    setParsedResidents([]);
    setExistingResidents([]);
    setImportResults({ success: 0, failed: 0, skipped: 0 });
    setImporting(false);
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

    let success = 0;
    let failed = 0;

    for (const resident of validResidents) {
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
          console.error("Error inserting resident:", error);
        } else {
          success++;
        }
      } catch (error) {
        failed++;
        console.error("Error inserting resident:", error);
      }
    }

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

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Bloco</TableHead>
                    <TableHead>Apto</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
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
                            <div className="absolute left-0 top-6 z-10 hidden group-hover:block bg-popover border rounded p-2 text-xs whitespace-nowrap shadow-lg">
                              {resident.errors.join(", ")}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{resident.block_name}</TableCell>
                      <TableCell>{resident.apartment_number}</TableCell>
                      <TableCell>{resident.full_name}</TableCell>
                      <TableCell className="text-xs">{resident.email}</TableCell>
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
            </ScrollArea>

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
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Importando moradores...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-6">
            <div className="space-y-2">
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
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkResidentCSVImportDialog;
