import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, ArrowRight, Check, Wand2, Building2, Home } from "lucide-react";
import { WizardStepIndicator } from "./WizardStepIndicator";
import { ApartmentPreviewGrid } from "./ApartmentPreviewGrid";
import { BlockNamesPreview } from "./BlockNamesPreview";

interface BulkBlocksApartmentsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiumId: string;
  condominiumName: string;
  onSuccess: () => void;
}

type BlockNamingPattern = "numeric" | "alpha" | "custom";

const WIZARD_STEPS = [
  { id: 1, name: "Apartamentos" },
  { id: 2, name: "Blocos" },
  { id: 3, name: "Confirmar" },
];

export function BulkBlocksApartmentsWizard({
  open,
  onOpenChange,
  condominiumId,
  condominiumName,
  onSuccess,
}: BulkBlocksApartmentsWizardProps) {
  const { toast } = useToast();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Apartments structure
  const [apartmentsInput, setApartmentsInput] = useState("01,02,03,04");
  const [autoDetectFloor, setAutoDetectFloor] = useState(true);

  // Step 2: Blocks
  const [blockCount, setBlockCount] = useState(1);
  const [blockNamingPattern, setBlockNamingPattern] = useState<BlockNamingPattern>("numeric");
  const [customBlockNames, setCustomBlockNames] = useState<string[]>([]);

  // Derived state
  const parseApartments = (input: string) => {
    return input
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num.length > 0);
  };

  const detectFloor = (aptNumber: string): number | null => {
    if (!autoDetectFloor) return null;
    if (aptNumber.length >= 2) {
      const firstDigit = parseInt(aptNumber.charAt(0));
      return isNaN(firstDigit) ? null : firstDigit;
    }
    return null;
  };

  const apartmentNumbers = parseApartments(apartmentsInput);
  const apartmentPreviews = apartmentNumbers.map((num) => ({
    number: num,
    floor: detectFloor(num),
  }));

  const generateBlockNames = (count: number, pattern: BlockNamingPattern): string[] => {
    if (pattern === "numeric") {
      return Array.from({ length: count }, (_, i) => `Bloco ${i + 1}`);
    }
    if (pattern === "alpha") {
      return Array.from({ length: Math.min(count, 26) }, (_, i) =>
        `Bloco ${String.fromCharCode(65 + i)}`
      );
    }
    return customBlockNames.slice(0, count);
  };

  const blockNames =
    blockNamingPattern === "custom"
      ? customBlockNames.slice(0, blockCount)
      : generateBlockNames(blockCount, blockNamingPattern);

  // Validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (apartmentNumbers.length === 0) {
          toast({
            title: "Nenhum apartamento",
            description: "Informe pelo menos um número de apartamento.",
            variant: "destructive",
          });
          return false;
        }
        const uniqueApts = new Set(apartmentNumbers);
        if (uniqueApts.size !== apartmentNumbers.length) {
          toast({
            title: "Apartamentos duplicados",
            description: "Remova os números duplicados.",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 2:
        if (blockCount < 1) {
          toast({
            title: "Quantidade inválida",
            description: "Informe pelo menos 1 bloco.",
            variant: "destructive",
          });
          return false;
        }
        if (blockNamingPattern === "alpha" && blockCount > 26) {
          toast({
            title: "Limite excedido",
            description: "O padrão alfabético suporta no máximo 26 blocos.",
            variant: "destructive",
          });
          return false;
        }
        if (blockNamingPattern === "custom") {
          const validNames = customBlockNames.filter((n) => n.trim()).length;
          if (validNames < blockCount) {
            toast({
              title: "Nomes incompletos",
              description: `Informe nomes para todos os ${blockCount} blocos.`,
              variant: "destructive",
            });
            return false;
          }
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleStepClick = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  // Handle block count change
  const handleBlockCountChange = (value: string) => {
    const count = parseInt(value) || 1;
    setBlockCount(Math.max(1, Math.min(count, 100)));
    
    // Initialize custom names if needed
    if (blockNamingPattern === "custom" && customBlockNames.length < count) {
      const newNames = [...customBlockNames];
      for (let i = customBlockNames.length; i < count; i++) {
        newNames.push(`Bloco ${i + 1}`);
      }
      setCustomBlockNames(newNames);
    }
  };

  // Handle custom block name change
  const handleCustomBlockNameChange = (index: number, value: string) => {
    const newNames = [...customBlockNames];
    newNames[index] = value;
    setCustomBlockNames(newNames);
  };

  // Save all data
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Create blocks in batch (names in uppercase)
      const blocksToInsert = blockNames.map((name) => ({
        condominium_id: condominiumId,
        name: name.toUpperCase(),
        floors: autoDetectFloor ? Math.max(...apartmentPreviews.map((a) => a.floor || 1)) : 1,
      }));

      const { data: createdBlocks, error: blocksError } = await supabase
        .from("blocks")
        .insert(blocksToInsert)
        .select();

      if (blocksError) throw blocksError;

      // 2. Create apartments for each block in batch (numbers in uppercase)
      const apartmentsToInsert = createdBlocks.flatMap((block) =>
        apartmentPreviews.map((apt) => ({
          block_id: block.id,
          number: apt.number.toUpperCase(),
          floor: apt.floor,
        }))
      );

      const { error: aptsError } = await supabase.from("apartments").insert(apartmentsToInsert);

      if (aptsError) throw aptsError;

      toast({
        title: "Sucesso!",
        description: `Criados ${blockNames.length} blocos com ${apartmentNumbers.length * blockNames.length} apartamentos.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating blocks and apartments:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar os blocos e apartamentos.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentStep(1);
      setApartmentsInput("01,02,03,04");
      setAutoDetectFloor(true);
      setBlockCount(1);
      setBlockNamingPattern("numeric");
      setCustomBlockNames([]);
    }
    onOpenChange(isOpen);
  };

  const totalApartments = apartmentNumbers.length * blockNames.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Cadastro Rápido de Blocos e Apartamentos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{condominiumName}</p>
        </DialogHeader>

        <WizardStepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        <div className="flex-1 overflow-y-auto px-1">
          {/* Step 1: Apartments Structure */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="apartments-input">
                  Números dos Apartamentos (separados por vírgula)
                </Label>
                <Textarea
                  id="apartments-input"
                  value={apartmentsInput}
                  onChange={(e) => setApartmentsInput(e.target.value)}
                  className="bg-secondary/50 min-h-[100px]"
                  placeholder="01,02,03,04,11,12,13,14,21,22,23,24"
                />
                <p className="text-xs text-muted-foreground">
                  Exemplo: 01,02,03,04 (térreo), 11,12,13,14 (1º andar), etc.
                </p>
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-secondary/30 rounded-lg">
                <div>
                  <Label htmlFor="auto-floor" className="text-sm font-medium">
                    Detectar andar automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Usa o primeiro dígito como número do andar
                  </p>
                </div>
                <Switch
                  id="auto-floor"
                  checked={autoDetectFloor}
                  onCheckedChange={setAutoDetectFloor}
                />
              </div>

              <ApartmentPreviewGrid apartments={apartmentPreviews} />
            </div>
          )}

          {/* Step 2: Blocks */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="block-count">Quantos blocos deseja criar?</Label>
                <Input
                  id="block-count"
                  type="number"
                  min={1}
                  max={100}
                  value={blockCount}
                  onChange={(e) => handleBlockCountChange(e.target.value)}
                  className="bg-secondary/50 w-32"
                />
              </div>

              <div className="space-y-3">
                <Label>Padrão de nomes dos blocos</Label>
                <RadioGroup
                  value={blockNamingPattern}
                  onValueChange={(value) => {
                    setBlockNamingPattern(value as BlockNamingPattern);
                    if (value === "custom" && customBlockNames.length < blockCount) {
                      const newNames = [];
                      for (let i = 0; i < blockCount; i++) {
                        newNames.push(`Bloco ${i + 1}`);
                      }
                      setCustomBlockNames(newNames);
                    }
                  }}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <RadioGroupItem value="numeric" id="numeric" />
                    <Label htmlFor="numeric" className="flex-1 cursor-pointer">
                      <span className="font-medium">Numérico</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        BLOCO 1, BLOCO 2, BLOCO 3...
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <RadioGroupItem value="alpha" id="alpha" />
                    <Label htmlFor="alpha" className="flex-1 cursor-pointer">
                      <span className="font-medium">Alfabético</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        BLOCO A, BLOCO B, BLOCO C...
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="flex-1 cursor-pointer">
                      <span className="font-medium">Personalizado</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        Defina nomes manualmente
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {blockNamingPattern === "custom" && (
                <div className="space-y-2 max-h-[150px] overflow-y-auto border border-border rounded-lg p-3">
                  {Array.from({ length: blockCount }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-8">{idx + 1}.</span>
                      <Input
                        value={customBlockNames[idx] || ""}
                        onChange={(e) => handleCustomBlockNameChange(idx, e.target.value)}
                        className="bg-secondary/50"
                        placeholder={`Nome do bloco ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <BlockNamesPreview blockNames={blockNames} />
            </div>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Resumo do Cadastro
                </h3>
                
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Blocos a criar</p>
                      <p className="font-semibold text-foreground">{blockNames.length} blocos</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Apartamentos por bloco</p>
                      <p className="font-semibold text-foreground">{apartmentNumbers.length} apartamentos</p>
                    </div>
                  </div>

                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground">Total de apartamentos</p>
                    <p className="text-2xl font-bold text-primary">{totalApartments} apartamentos</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Blocos:</p>
                  <div className="flex flex-wrap gap-2">
                    {blockNames.map((name, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      >
                        {name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Apartamentos em cada bloco:</p>
                  <div className="flex flex-wrap gap-2">
                    {apartmentNumbers.slice(0, 10).map((num, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-secondary text-foreground rounded text-sm"
                      >
                        {num.toUpperCase()}
                      </span>
                    ))}
                    {apartmentNumbers.length > 10 && (
                      <span className="px-2 py-1 text-muted-foreground text-sm">
                        +{apartmentNumbers.length - 10} mais
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          {currentStep < 3 ? (
            <Button type="button" onClick={handleNext}>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="hero"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Criar Blocos e Apartamentos
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
