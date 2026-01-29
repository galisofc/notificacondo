import { useState, useEffect, useRef } from "react";
import { 
  PackageCheck, 
  Check, 
  X, 
  Loader2, 
  AlertCircle,
  KeyRound,
  Camera
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Package } from "@/hooks/usePackages";
import { PackagePhoto } from "./PackagePhoto";

interface PackagePickupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package_: Package | null;
  onConfirm: (pickedUpByName: string) => Promise<{ success: boolean; error?: string }>;
  /** When false, the pickup code will not be rendered anywhere in the dialog. */
  revealPickupCode?: boolean;
}

type Step = "validate" | "processing" | "success" | "error";

export function PackagePickupDialog({
  open,
  onOpenChange,
  package_,
  onConfirm,
  revealPickupCode = true,
}: PackagePickupDialogProps) {
  const [step, setStep] = useState<Step>("validate");
  const [inputCode, setInputCode] = useState("");
  const [pickedUpByName, setPickedUpByName] = useState("");
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("validate");
      setInputCode("");
      setPickedUpByName("");
      setCodeValid(null);
      setErrorMessage("");
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Validate code as user types
  useEffect(() => {
    if (!package_ || !inputCode) {
      setCodeValid(null);
      return;
    }
    const isValid = inputCode.toUpperCase() === package_.pickup_code.toUpperCase();
    setCodeValid(isValid);
  }, [inputCode, package_]);

  const handleConfirm = async () => {
    if (!codeValid || !pickedUpByName.trim()) return;
    
    setStep("processing");
    const result = await onConfirm(pickedUpByName.trim());
    
    if (result.success) {
      setStep("success");
      // Auto close after success animation
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } else {
      setErrorMessage(result.error || "Erro ao confirmar retirada");
      setStep("error");
    }
  };

  const handleClose = () => {
    if (step === "processing") return; // Prevent closing while processing
    onOpenChange(false);
  };

  if (!package_) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "validate" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-primary" />
                Confirmar Retirada
              </DialogTitle>
              <DialogDescription>
                Digite o código de retirada para confirmar
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Package Preview */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-background shrink-0">
                  <PackagePhoto
                    photoUrl={package_.photo_url}
                    aspectRatio="square"
                    className="w-full h-full"
                    showLoadingState={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {revealPickupCode && (
                    <p className="font-mono font-bold text-xl text-primary tracking-wider">
                      {package_.pickup_code}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {package_.block?.name} - Apto {package_.apartment?.number}
                  </p>
                  {package_.description && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {package_.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Picked Up By Name Input */}
              <div className="space-y-2">
                <Label htmlFor="picked-up-by-name" className="flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" />
                  Nome de quem está retirando
                </Label>
                <Input
                  id="picked-up-by-name"
                  placeholder="Digite o nome completo..."
                  value={pickedUpByName}
                  onChange={(e) => setPickedUpByName(e.target.value)}
                  className="text-base"
                  maxLength={100}
                />
              </div>

              {/* Code Input */}
              <div className="space-y-2">
                <Label htmlFor="pickup-code" className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Código de Retirada
                </Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="pickup-code"
                    placeholder="000000"
                    value={inputCode}
                    onChange={(e) => {
                      // Apenas números
                      const numericValue = e.target.value.replace(/\D/g, '');
                      setInputCode(numericValue);
                    }}
                    className={cn(
                      "font-mono text-2xl tracking-[0.5em] text-center pr-10",
                      codeValid === true && "border-green-500 focus-visible:ring-green-500",
                      codeValid === false && "border-destructive focus-visible:ring-destructive"
                    )}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  {codeValid !== null && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {codeValid ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <X className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {codeValid === false && inputCode.length >= 4 && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Código inválido
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!codeValid || !pickedUpByName.trim()}
                  className="flex-1 gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  Confirmar
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <p className="mt-6 text-lg font-medium">Processando retirada...</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde um momento</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative animate-in zoom-in-50 duration-300">
              <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <div className="absolute -inset-2 rounded-full border-4 border-green-500/30 animate-ping" />
            </div>
            <p className="mt-6 text-xl font-bold text-green-600 dark:text-green-400">
              Retirada Confirmada!
            </p>
            <div className="mt-3 p-3 bg-muted rounded-lg text-center">
              {revealPickupCode && (
                <p className="font-mono font-bold text-lg text-primary">
                  {package_.pickup_code}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {package_.block?.name} - Apto {package_.apartment?.number}
              </p>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-10 h-10 text-destructive" />
            </div>
            <p className="mt-6 text-lg font-medium text-destructive">Erro na Retirada</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">{errorMessage}</p>
            <Button
              variant="outline"
              onClick={() => setStep("validate")}
              className="mt-6"
            >
              Tentar Novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
