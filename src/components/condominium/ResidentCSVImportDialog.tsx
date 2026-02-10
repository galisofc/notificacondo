import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

interface ResidentCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apartmentId: string;
  apartmentNumber: string;
  blockName: string;
  onSuccess: () => void;
}

interface ParsedResident {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  is_owner: boolean;
  is_responsible: boolean;
  errors: string[];
  isValid: boolean;
}

const ResidentCSVImportDialog = ({
  open,
  onOpenChange,
  apartmentId,
  apartmentNumber,
  blockName,
  onSuccess,
}: ResidentCSVImportDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedResidents, setParsedResidents] = useState<ParsedResident[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [importing, setImporting] = useState(false);

  const resetState = () => {
    setStep("upload");
    setParsedResidents([]);
    setImportResults({ success: 0, failed: 0 });
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const csvContent = `nome,telefone,proprietario,responsavel
João da Silva,11999999999,sim,sim
Maria Santos,11988888888,não,não`;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_moradores.csv";
    link.click();
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

      const [name, phone, isOwner, isResponsible] = values;
      
      const errors: string[] = [];
      
      // Validate name
      if (!name || name.length < 2) {
        errors.push("Nome inválido");
      }
      
      

      // Parse boolean fields
      const parseBoolean = (value: string | undefined): boolean => {
        if (!value) return false;
        const lower = value.toLowerCase().trim();
        return ["sim", "s", "yes", "y", "true", "1", "x"].includes(lower);
      };

      return {
        full_name: name || "",
        email: "",
        phone: phone?.replace(/\D/g, "") || "",
        cpf: "",
        is_owner: parseBoolean(isOwner),
        is_responsible: parseBoolean(isResponsible),
        errors,
        isValid: errors.length === 0,
      };
    }).filter(r => r.full_name); // Filter out completely empty rows
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setParsedResidents(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validResidents = parsedResidents.filter(r => r.isValid);
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
          apartment_id: apartmentId,
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

    setImportResults({ success, failed });
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Moradores via CSV
          </DialogTitle>
          <DialogDescription className="uppercase">
            {blockName} - APTO {apartmentNumber}
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
                nome,telefone,proprietario,responsavel
              </code>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>nome</strong>: obrigatório</li>
                <li>• <strong>telefone</strong>: opcional</li>
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

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky top-0 bg-background z-10">Status</TableHead>
                    <TableHead className="sticky top-0 bg-background z-10">Nome</TableHead>
                    <TableHead className="sticky top-0 bg-background z-10">Telefone</TableHead>
                    <TableHead className="w-20 sticky top-0 bg-background z-10">Prop.</TableHead>
                    <TableHead className="w-20 sticky top-0 bg-background z-10">Resp.</TableHead>
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
                      <TableCell className="font-medium">{resident.full_name}</TableCell>
                      <TableCell>{resident.email}</TableCell>
                      <TableCell>{resident.phone || "-"}</TableCell>
                      <TableCell>{resident.cpf || "-"}</TableCell>
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

export default ResidentCSVImportDialog;
