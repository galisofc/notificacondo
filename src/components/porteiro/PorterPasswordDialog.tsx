import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ValidatedInput } from "@/components/ui/validated-input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Loader2, Copy, Check, ShieldCheck, MessageCircle } from "lucide-react";

interface Porter {
  id: string;
  user_id: string;
  condominium_id: string;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  condominium: {
    name: string;
  } | null;
}

interface PorterPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  porter: Porter | null;
}

export function PorterPasswordDialog({ open, onOpenChange, porter }: PorterPasswordDialogProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  
  // Result state
  const [resultData, setResultData] = useState<{
    success: boolean;
    password?: string;
    whatsapp_sent?: boolean;
    message?: string;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const passwordStrength = usePasswordStrength(password);

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setResultData(null);
    setPasswordCopied(false);
    setSendWhatsApp(true);
    onOpenChange(false);
  };

  const handleCopyPassword = async () => {
    if (resultData?.password) {
      await navigator.clipboard.writeText(resultData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    if (!porter) return;

    // Validation
    if (!password) {
      toast({
        title: "Senha obrigatória",
        description: "Digite a nova senha para o porteiro",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha deve ser igual à senha",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-porteiro-password", {
        body: {
          porter_user_id: porter.user_id,
          new_password: password,
          condominium_id: porter.condominium_id,
          send_whatsapp: sendWhatsApp && !!porter.profile?.phone,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.whatsapp_sent) {
        toast({
          title: "Senha atualizada! ✅",
          description: "As novas credenciais foram enviadas por WhatsApp",
        });
        handleClose();
      } else {
        // Show password result (WhatsApp not sent or no phone)
        setResultData({
          success: true,
          password: password,
          whatsapp_sent: false,
          message: "Senha atualizada. Informe manualmente ao porteiro.",
        });
      }
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Erro ao atualizar senha",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!porter) return null;

  // Result view (after password update)
  if (resultData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Senha Atualizada
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              A senha foi atualizada com sucesso
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 sm:py-4 space-y-4">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Informe os dados de acesso manualmente ao porteiro:
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium">{porter.profile?.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-mail de acesso</p>
                <p className="font-medium break-all">{porter.profile?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nova senha</p>
                <div className="flex items-center gap-2">
                  <code className="bg-background px-3 py-2 rounded border font-mono text-sm flex-1">
                    {resultData.password}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleCopyPassword}
                  >
                    {passwordCopied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Form view
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md p-4 sm:p-6">
        <DialogHeader className="space-y-1 sm:space-y-2">
          <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Definir Senha do Porteiro
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Defina uma nova senha de acesso para{" "}
            <span className="font-medium">{porter.profile?.full_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 sm:py-4 space-y-4">
          {/* Porter info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Porteiro</p>
            <p className="font-medium text-sm">{porter.profile?.full_name}</p>
            <p className="text-xs text-muted-foreground">{porter.profile?.email}</p>
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">Nova Senha *</Label>
            <ValidatedInput
              id="password"
              type="password"
              placeholder="Digite a nova senha"
              value={password}
              onChange={setPassword}
              showPasswordToggle
            />
            
            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Força da senha:</span>
                  <span className={passwordStrength.strength === "strong" ? "text-emerald-500" : 
                    passwordStrength.strength === "good" ? "text-emerald-400" :
                    passwordStrength.strength === "fair" ? "text-amber-500" : "text-destructive"}>
                    {passwordStrength.label}
                  </span>
                </div>
                <Progress 
                  value={(passwordStrength.score / 4) * 100} 
                  className="h-1.5"
                />
                {passwordStrength.suggestions.length > 0 && (
                  <ul className="text-[10px] text-muted-foreground space-y-0.5">
                    {passwordStrength.suggestions.slice(0, 2).map((suggestion, idx) => (
                      <li key={idx}>• {suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Confirm password input */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm">Confirmar Senha *</Label>
            <ValidatedInput
              id="confirmPassword"
              type="password"
              placeholder="Confirme a senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              showPasswordToggle
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">As senhas não conferem</p>
            )}
          </div>

          {/* WhatsApp option */}
          {porter.profile?.phone && (
            <Alert>
              <MessageCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span>Enviar nova senha por WhatsApp para {porter.profile.phone}</span>
                </label>
              </AlertDescription>
            </Alert>
          )}

          {!porter.profile?.phone && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                O porteiro não possui telefone cadastrado. A senha será exibida para você informar manualmente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !password || password !== confirmPassword}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Senha"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
