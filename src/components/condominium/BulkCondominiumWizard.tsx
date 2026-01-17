import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Check, Wand2 } from "lucide-react";
import { isValidCNPJ } from "@/lib/utils";
import { WizardStepIndicator } from "./WizardStepIndicator";
import { ApartmentPreviewGrid } from "./ApartmentPreviewGrid";
import { BlockNamesPreview } from "./BlockNamesPreview";
import { ConfirmationSummary } from "./ConfirmationSummary";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  notifications_limit: number;
  warnings_limit: number;
  fines_limit: number;
}

interface BulkCondominiumWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  onSuccess: () => void;
}

type BlockNamingPattern = "numeric" | "alpha" | "custom";

const WIZARD_STEPS = [
  { id: 1, name: "Dados" },
  { id: 2, name: "Apartamentos" },
  { id: 3, name: "Blocos" },
  { id: 4, name: "Confirmar" },
];

export function BulkCondominiumWizard({
  open,
  onOpenChange,
  plans,
  onSuccess,
}: BulkCondominiumWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [fetchingCNPJ, setFetchingCNPJ] = useState(false);
  const [fetchingCEP, setFetchingCEP] = useState(false);

  // Step 1: Condominium data
  const [condoData, setCondoData] = useState({
    name: "",
    cnpj: "",
    phone: "",
    zip_code: "",
    address: "",
    address_number: "",
    neighborhood: "",
    city: "",
    state: "",
    plan_slug: "start",
  });

  // Step 2: Apartments structure
  const [apartmentsInput, setApartmentsInput] = useState("01,02,03,04");
  const [autoDetectFloor, setAutoDetectFloor] = useState(true);

  // Step 3: Blocks
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

  // CNPJ auto-fetch
  const fetchCNPJData = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    if (cleanCNPJ.length !== 14) return;

    if (!isValidCNPJ(cleanCNPJ)) {
      toast({
        title: "CNPJ inválido",
        description: "Por favor, verifique o número do CNPJ.",
        variant: "destructive",
      });
      return;
    }

    setFetchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");

      const data = await response.json();
      setCondoData((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        phone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, "") : prev.phone,
        zip_code: data.cep ? data.cep.replace(/\D/g, "") : prev.zip_code,
        address: data.logradouro || prev.address,
        address_number: data.numero || prev.address_number,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "Dados encontrados",
        description: `Dados de "${data.razao_social || data.nome_fantasia}" preenchidos.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao consultar CNPJ",
        description: "Preencha os dados manualmente.",
        variant: "destructive",
      });
    } finally {
      setFetchingCNPJ(false);
    }
  };

  // CEP auto-fetch
  const fetchCEPData = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    if (cleanCEP.length !== 8) return;

    setFetchingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return;
      }

      setCondoData((prev) => ({
        ...prev,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));

      toast({
        title: "Endereço encontrado",
        description: "Dados preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setFetchingCEP(false);
    }
  };

  // Validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!condoData.name.trim()) {
          toast({
            title: "Campo obrigatório",
            description: "Informe o nome do condomínio.",
            variant: "destructive",
          });
          return false;
        }
        if (condoData.cnpj && !isValidCNPJ(condoData.cnpj.replace(/\D/g, ""))) {
          toast({
            title: "CNPJ inválido",
            description: "Verifique o CNPJ informado.",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 2:
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

      case 3:
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
      setCurrentStep((prev) => Math.min(prev + 1, 4));
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
    if (!user) return;

    setSaving(true);
    try {
      // 1. Create condominium
      const { data: newCondo, error: condoError } = await supabase
        .from("condominiums")
        .insert({
          owner_id: user.id,
          name: condoData.name,
          cnpj: condoData.cnpj.replace(/\D/g, "") || null,
          phone: condoData.phone.replace(/\D/g, "") || null,
          zip_code: condoData.zip_code.replace(/\D/g, "") || null,
          address: condoData.address || null,
          address_number: condoData.address_number || null,
          neighborhood: condoData.neighborhood || null,
          city: condoData.city || null,
          state: condoData.state || null,
        })
        .select()
        .single();

      if (condoError) throw condoError;

      // 2. Update subscription with selected plan (trigger already creates the subscription)
      const selectedPlan = plans.find((p) => p.slug === condoData.plan_slug);
      if (selectedPlan && newCondo) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            plan: condoData.plan_slug as "start" | "essencial" | "profissional" | "enterprise",
            notifications_limit: selectedPlan.notifications_limit,
            warnings_limit: selectedPlan.warnings_limit,
            fines_limit: selectedPlan.fines_limit,
          })
          .eq("condominium_id", newCondo.id);

        if (subError) throw subError;
      }

      // 3. Create blocks in batch (names in uppercase)
      const blocksToInsert = blockNames.map((name) => ({
        condominium_id: newCondo.id,
        name: name.toUpperCase(),
        floors: autoDetectFloor ? Math.max(...apartmentPreviews.map((a) => a.floor || 1)) : 1,
      }));

      const { data: createdBlocks, error: blocksError } = await supabase
        .from("blocks")
        .insert(blocksToInsert)
        .select();

      if (blocksError) throw blocksError;

      // 4. Create apartments for each block in batch
      const apartmentsToInsert = createdBlocks.flatMap((block) =>
        apartmentPreviews.map((apt) => ({
          block_id: block.id,
          number: apt.number,
          floor: apt.floor,
        }))
      );

      const { error: aptsError } = await supabase.from("apartments").insert(apartmentsToInsert);

      if (aptsError) throw aptsError;

      toast({
        title: "Sucesso!",
        description: `Condomínio criado com ${blockNames.length} blocos e ${apartmentNumbers.length * blockNames.length} apartamentos.`,
      });

      onOpenChange(false);
      onSuccess();

      // Navigate to the new condominium
      navigate(`/condominiums/${newCondo.id}`);
    } catch (error: any) {
      console.error("Error creating condominium:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o condomínio.",
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
      setCondoData({
        name: "",
        cnpj: "",
        phone: "",
        zip_code: "",
        address: "",
        address_number: "",
        neighborhood: "",
        city: "",
        state: "",
        plan_slug: "start",
      });
      setApartmentsInput("01,02,03,04");
      setAutoDetectFloor(true);
      setBlockCount(1);
      setBlockNamingPattern("numeric");
      setCustomBlockNames([]);
    }
    onOpenChange(isOpen);
  };

  // Build address string for summary
  const fullAddress = [
    condoData.address,
    condoData.address_number,
    condoData.neighborhood,
    condoData.city,
    condoData.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Cadastro Rápido de Condomínio
          </DialogTitle>
        </DialogHeader>

        <WizardStepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        <div className="flex-1 overflow-y-auto px-1">
          {/* Step 1: Condominium Data */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wizard-cnpj">CNPJ (busca automática)</Label>
                <div className="relative">
                  <MaskedInput
                    id="wizard-cnpj"
                    mask="cnpj"
                    value={condoData.cnpj}
                    onChange={(value) => {
                      setCondoData({ ...condoData, cnpj: value });
                      const cleanCnpj = value.replace(/\D/g, "");
                      if (cleanCnpj.length === 14) {
                        fetchCNPJData(value);
                      }
                    }}
                    className="bg-secondary/50"
                    placeholder="00.000.000/0000-00"
                  />
                  {fetchingCNPJ && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-name">Nome do Condomínio *</Label>
                <Input
                  id="wizard-name"
                  value={condoData.name}
                  onChange={(e) => setCondoData({ ...condoData, name: e.target.value })}
                  className="bg-secondary/50"
                  placeholder="Nome do condomínio"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wizard-phone">Telefone</Label>
                  <MaskedInput
                    id="wizard-phone"
                    mask="phone"
                    value={condoData.phone}
                    onChange={(value) => setCondoData({ ...condoData, phone: value })}
                    className="bg-secondary/50"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wizard-cep">CEP</Label>
                  <div className="relative">
                    <MaskedInput
                      id="wizard-cep"
                      mask="cep"
                      value={condoData.zip_code}
                      onChange={(value) => {
                        setCondoData({ ...condoData, zip_code: value });
                        const cleanCep = value.replace(/\D/g, "");
                        if (cleanCep.length === 8) {
                          fetchCEPData(value);
                        }
                      }}
                      className="bg-secondary/50"
                      placeholder="00000-000"
                    />
                    {fetchingCEP && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="wizard-address">Endereço</Label>
                  <Input
                    id="wizard-address"
                    value={condoData.address}
                    onChange={(e) => setCondoData({ ...condoData, address: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-number">Número</Label>
                  <Input
                    id="wizard-number"
                    value={condoData.address_number}
                    onChange={(e) => setCondoData({ ...condoData, address_number: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wizard-neighborhood">Bairro</Label>
                  <Input
                    id="wizard-neighborhood"
                    value={condoData.neighborhood}
                    onChange={(e) => setCondoData({ ...condoData, neighborhood: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Bairro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-city">Cidade</Label>
                  <Input
                    id="wizard-city"
                    value={condoData.city}
                    onChange={(e) => setCondoData({ ...condoData, city: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-state">Estado</Label>
                  <Input
                    id="wizard-state"
                    value={condoData.state}
                    onChange={(e) => setCondoData({ ...condoData, state: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-plan">Plano</Label>
                <Select
                  value={condoData.plan_slug}
                  onValueChange={(value) => setCondoData({ ...condoData, plan_slug: value })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.slug}>
                        {plan.name} - R$ {plan.price.toFixed(2)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Apartments Structure */}
          {currentStep === 2 && (
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

          {/* Step 3: Blocks */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="block-count">Quantos blocos possui o condomínio?</Label>
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
                        Bloco 1, Bloco 2, Bloco 3...
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <RadioGroupItem value="alpha" id="alpha" />
                    <Label htmlFor="alpha" className="flex-1 cursor-pointer">
                      <span className="font-medium">Alfabético</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        Bloco A, Bloco B, Bloco C...
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

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <ConfirmationSummary
              condominiumName={condoData.name}
              cnpj={condoData.cnpj.replace(/\D/g, "")}
              address={fullAddress}
              blockNames={blockNames}
              apartmentsPerBlock={apartmentNumbers.length}
              planName={plans.find((p) => p.slug === condoData.plan_slug)?.name}
            />
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

          {currentStep < 4 ? (
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
                  Confirmar e Criar
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
