import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF } from "@/lib/utils";

interface BlockWithApartments {
  id: string;
  name: string;
  apartments: { id: string; number: string }[];
}

interface BulkResidentCSVImportProps {
  blocks: BlockWithApartments[];
  condominiumName: string;
  onSuccess: () => void;
}

interface ParsedResident {
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  is_owner: boolean;
  is_responsible: boolean;
  block_name: string;
  apartment_number: string;
  errors: string[];
  isValid: boolean;
  apartment_id?: string;
}

export function BulkResidentCSVImport({
  blocks,
  condominiumName,
  onSuccess,
}: BulkResidentCSVImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsedResidents, setParsedResidents] = useState<ParsedResident[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  });
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

  const downloadTemplate = () => {
    // Generate template with existing blocks and apartments
    let csvContent = `bloco,apartamento,nome,email,telefone,cpf,proprietario,responsavel\n`;
    
    // Add example rows for the first block and apartment
    if (blocks.length > 0 && blocks[0].apartments.length > 0) {
      const firstBlock = blocks[0];
      const firstApt = firstBlock.apartments[0];
      csvContent += `${firstBlock.name},${firstApt.number},João da Silva,joao@email.com,11999999999,12345678901,sim,sim\n`;
      csvContent += `${firstBlock.name},${firstApt.number},Maria Santos,maria@email.com,11988888888,,não,não`;
    } else {
      csvContent += `BLOCO 1,101,João da Silva,joao@email.com,11999999999,12345678901,sim,sim\n`;
      csvContent += `BLOCO 1,101,Maria Santos,maria@email.com,11988888888,,não,não`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_moradores_lote.csv";
    link.click();
  };

  const findApartmentId = (blockName: string, aptNumber: string): string | undefined => {
    const normalizedBlockName = blockName.toUpperCase().trim();
    const normalizedAptNumber = aptNumber.toUpperCase().trim();
    
    const block = blocks.find(
      (b) => b.name.toUpperCase() === normalizedBlockName
    );
    
    if (!block) return undefined;
    
    const apartment = block.apartments.find(
      (a) => a.number.toUpperCase() === normalizedAptNumber
    );
    
    return apartment?.id;
  };

  const parseCSV = (content: string): ParsedResident[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1);

    return dataLines
      .map((line) => {
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

        const [blockName, aptNumber, name, email, phone, cpf, isOwner, isResponsible] = values;

        const errors: string[] = [];

        // Validate block and apartment
        const apartmentId = findApartmentId(blockName || "", aptNumber || "");
        if (!blockName) {
          errors.push("Bloco não informado");
        } else if (!aptNumber) {
          errors.push("Apartamento não informado");
        } else if (!apartmentId) {
          errors.push(`Bloco "${blockName}" / Apto "${aptNumber}" não encontrado`);
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
          apartment_number: aptNumber || "",
          full_name: name || "",
          email: email || "",
          phone: phone?.replace(/\D/g, "") || "",
          cpf: cleanCPF,
          is_owner: parseBoolean(isOwner),
          is_responsible: parseBoolean(isResponsible),
          errors,
          isValid: errors.length === 0,
          apartment_id: apartmentId,
        };
      })
      .filter((r) => r.full_name || r.email || r.block_name); // Filter out completely empty rows
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
    const validResidents = parsedResidents.filter((r) => r.isValid && r.apartment_id);
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

    setImportResults({ success, failed });
    setStep("done");
    setImporting(false);

    if (success > 0) {
      onSuccess();
    }
  };

  const validCount = parsedResidents.filter((r) => r.isValid).length;
  const invalidCount = parsedResidents.filter((r) => !r.isValid).length;

  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-5 h-5" />
          <span className="text-sm">
            Importe moradores para os blocos e apartamentos criados
          </span>
        </div>

        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm mb-4">
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

        <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">Formato esperado do CSV:</h4>
          <code className="block text-xs bg-background p-3 rounded border overflow-x-auto">
            bloco,apartamento,nome,email,telefone,cpf,proprietario,responsavel
          </code>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>bloco</strong> e <strong>apartamento</strong>: devem corresponder aos criados</li>
            <li>• <strong>nome</strong> e <strong>email</strong>: obrigatórios</li>
            <li>• <strong>telefone</strong> e <strong>cpf</strong>: opcionais</li>
            <li>• <strong>proprietario</strong> e <strong>responsavel</strong>: sim/não ou s/n</li>
          </ul>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Baixar modelo CSV
          </Button>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Blocos disponíveis:</h4>
          <div className="flex flex-wrap gap-2">
            {blocks.map((block) => (
              <Badge key={block.id} variant="secondary" className="text-xs">
                {block.name} ({block.apartments.length} aptos)
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="flex flex-col space-y-4">
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

        <ScrollArea className="h-[250px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Status</TableHead>
                <TableHead>Bloco</TableHead>
                <TableHead>Apto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-16">Prop.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedResidents.map((resident, index) => (
                <TableRow
                  key={index}
                  className={!resident.isValid ? "bg-destructive/10" : ""}
                >
                  <TableCell>
                    {resident.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="relative group">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <div className="absolute left-0 top-6 z-10 hidden group-hover:block bg-popover border rounded p-2 text-xs whitespace-nowrap shadow-lg max-w-[300px]">
                          {resident.errors.join(", ")}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{resident.block_name}</TableCell>
                  <TableCell className="text-xs">{resident.apartment_number}</TableCell>
                  <TableCell className="font-medium text-xs">{resident.full_name}</TableCell>
                  <TableCell className="text-xs">{resident.email}</TableCell>
                  <TableCell>
                    <Checkbox checked={resident.is_owner} disabled />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" onClick={resetState}>
            Voltar
          </Button>
          <Button size="sm" onClick={handleImport} disabled={validCount === 0}>
            <Upload className="w-4 h-4 mr-2" />
            Importar {validCount} morador{validCount !== 1 ? "es" : ""}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="py-8 text-center space-y-4">
        <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
        <p className="text-muted-foreground">Importando moradores...</p>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="py-6 text-center space-y-4">
      {importResults.success > 0 && (
        <div className="flex items-center justify-center gap-2 text-green-600">
          <CheckCircle2 className="w-6 h-6" />
          <span className="text-lg font-medium">
            {importResults.success} morador{importResults.success !== 1 ? "es" : ""} importado
            {importResults.success !== 1 ? "s" : ""}!
          </span>
        </div>
      )}
      {importResults.failed > 0 && (
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>
            {importResults.failed} falha{importResults.failed !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={resetState}>
        Importar mais moradores
      </Button>
    </div>
  );
}
