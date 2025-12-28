import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock, User, ArrowLeft, Loader2, Check, Building2, Phone, MapPin, FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";
import { MaskedInput } from "@/components/ui/masked-input";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const condominiumSchema = z.object({
  condominiumName: z.string().min(2, "Nome do condomínio é obrigatório"),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  condominiumPhone: z.string().optional(),
});

const sindicoSchema = z.object({
  fullName: z.string().min(2, "Nome completo é obrigatório"),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface FormData {
  // Condominium
  condominiumName: string;
  cnpj: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  condominiumPhone: string;
  // Síndico
  fullName: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    condominiumName: "",
    cnpj: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    condominiumPhone: "",
    fullName: "",
    cpf: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get selected plan from URL
  const searchParams = new URLSearchParams(location.search);
  const selectedPlanSlug = searchParams.get('plano');

  // Fetch selected plan details
  const { data: selectedPlan } = useQuery({
    queryKey: ['selected-plan', selectedPlanSlug],
    queryFn: async () => {
      if (!selectedPlanSlug) return null;
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('slug', selectedPlanSlug)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPlanSlug
  });

  // If plan is selected, default to signup
  useEffect(() => {
    if (selectedPlanSlug) {
      setIsLogin(false);
    }
  }, [selectedPlanSlug]);

  // Redirect authenticated users based on their role
  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      if (user) {
        try {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          const role = roleData?.role;

          if (role === "super_admin") {
            navigate("/superadmin", { replace: true });
            return;
          }

          if (role === "sindico") {
            navigate("/dashboard", { replace: true });
            return;
          }

          if (role === "morador") {
            navigate("/resident", { replace: true });
            return;
          }

          navigate("/dashboard", { replace: true });
        } catch (error) {
          console.error("Error checking role:", error);
          navigate("/dashboard", { replace: true });
        }
      }
    };

    checkRoleAndRedirect();
  }, [user, navigate]);

  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const role = roleData?.role;

      if (role === "super_admin") return "/superadmin";
      if (role === "sindico") return "/dashboard";
      if (role === "morador") return "/resident";

      return "/dashboard";
    } catch (error) {
      console.error("Error checking role:", error);
      return "/dashboard";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleMaskedChange = (name: string) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateStep1 = () => {
    const result = condominiumSchema.safeParse({
      condominiumName: formData.condominiumName,
      cnpj: formData.cnpj,
      address: formData.address,
      addressNumber: formData.addressNumber,
      neighborhood: formData.neighborhood,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
      condominiumPhone: formData.condominiumPhone,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const result = sindicoSchema.safeParse({
      fullName: formData.fullName,
      cpf: formData.cpf,
      phone: formData.phone,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      setErrors({});
    }
  };

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1);
      setErrors({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = loginSchema.safeParse({
          email: formData.email,
          password: formData.password,
        });

        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Erro de autenticação",
              description: "Email ou senha incorretos.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro",
              description: error.message,
              variant: "destructive",
            });
          }
          setIsLoading(false);
          return;
        }

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const redirectPath = await redirectBasedOnRole(currentUser.id);
          toast({
            title: "Bem-vindo!",
            description: "Login realizado com sucesso.",
          });
          navigate(redirectPath, { replace: true });
        }
      } else {
        // Validate step 2
        if (!validateStep2()) {
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Usuário já cadastrado",
              description: "Este email já está em uso. Tente fazer login.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro",
              description: error.message,
              variant: "destructive",
            });
          }
          setIsLoading(false);
          return;
        }

        // Get newly created user
        const { data: { user: newUser } } = await supabase.auth.getUser();
        
        if (newUser) {
          // Update profile with additional info
          await supabase
            .from('profiles')
            .update({
              cpf: formData.cpf || null,
              phone: formData.phone || null,
            })
            .eq('user_id', newUser.id);

          // Create the condominium for the new user
          const { data: condominium, error: condoError } = await supabase
            .from('condominiums')
            .insert({
              name: formData.condominiumName,
              owner_id: newUser.id,
              cnpj: formData.cnpj || null,
              address: formData.address || null,
              address_number: formData.addressNumber || null,
              neighborhood: formData.neighborhood || null,
              city: formData.city || null,
              state: formData.state || null,
              zip_code: formData.zipCode || null,
              phone: formData.condominiumPhone || null,
            })
            .select()
            .single();
          
          if (condoError) {
            console.error('Error creating condominium:', condoError);
            toast({
              title: "Aviso",
              description: "Conta criada, mas houve um erro ao criar o condomínio. Você pode criá-lo no painel.",
              variant: "destructive",
            });
          } else if (condominium && selectedPlan) {
            // Update the subscription with the selected plan limits
            const planType = selectedPlan.slug as Database['public']['Enums']['plan_type'];
            const { error: subError } = await supabase
              .from('subscriptions')
              .update({
                plan: planType,
                notifications_limit: selectedPlan.notifications_limit,
                warnings_limit: selectedPlan.warnings_limit,
                fines_limit: selectedPlan.fines_limit,
              })
              .eq('condominium_id', condominium.id);
            
            if (subError) {
              console.error('Error updating subscription:', subError);
            }
          }
        }

        toast({
          title: "Conta criada!",
          description: selectedPlan 
            ? `Bem-vindo ao NotificaCondo! Plano ${selectedPlan.name} ativado.`
            : "Bem-vindo ao NotificaCondo.",
        });
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      condominiumName: "",
      cnpj: "",
      address: "",
      addressNumber: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
      condominiumPhone: "",
      fullName: "",
      cpf: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setStep(1);
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-foreground">
              Notifica<span className="text-gradient">Condo</span>
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold mb-6 text-foreground">
            Gestão de multas com{" "}
            <span className="text-gradient">prova jurídica</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            Notificações, advertências e multas condominiais com contraditório, 
            ampla defesa e registro de ciência automático.
          </p>

          <div className="space-y-4">
            {[
              "Registro completo de ocorrências",
              "Envio automático via WhatsApp",
              "Prova de ciência irrefutável",
              "Dossiê jurídico exportável",
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </button>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              Notifica<span className="text-gradient">Condo</span>
            </span>
          </div>

          {/* Selected Plan Display */}
          {!isLogin && selectedPlan && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-card border border-primary/30">
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${selectedPlan.color}, ${selectedPlan.color}dd)` }}
                >
                  <span className="font-display text-lg font-bold text-white">
                    {selectedPlan.name[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano selecionado</p>
                  <p className="font-display text-lg font-bold text-foreground">{selectedPlan.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-foreground">
                    R$ {selectedPlan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>
              
              {selectedPlan.description && (
                <p className="text-sm text-muted-foreground mb-3">{selectedPlan.description}</p>
              )}
              
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Incluído no plano:</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground">
                      {selectedPlan.notifications_limit === -1 
                        ? "Notificações ilimitadas" 
                        : `${selectedPlan.notifications_limit} notificações`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground">
                      {selectedPlan.warnings_limit === -1 
                        ? "Advertências ilimitadas" 
                        : `${selectedPlan.warnings_limit} advertências`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground">
                      {selectedPlan.fines_limit === -1 
                        ? "Multas ilimitadas" 
                        : selectedPlan.fines_limit === 0 
                          ? "Sem multas" 
                          : `${selectedPlan.fines_limit} multas`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" /> Integração WhatsApp
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" /> Registro de ciência
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" /> Conformidade LGPD
                </span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {isLogin ? "Entrar na sua conta" : step === 1 ? "Dados do Condomínio" : "Dados do Síndico"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "Acesse seu painel de gestão condominial"
                : step === 1 
                  ? "Preencha os dados do condomínio que será gerenciado"
                  : "Preencha seus dados como síndico responsável"}
            </p>
          </div>

          {/* Step Indicator */}
          {!isLogin && (
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className={`flex-1 h-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                2
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isLogin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </>
            ) : step === 1 ? (
              <>
                {/* Step 1: Condominium Data */}
                <div className="space-y-2">
                  <Label htmlFor="condominiumName" className="text-foreground">
                    Nome do condomínio <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="condominiumName"
                      name="condominiumName"
                      type="text"
                      placeholder="Ex: Residencial das Flores"
                      value={formData.condominiumName}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.condominiumName && (
                    <p className="text-sm text-destructive">{errors.condominiumName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj" className="text-foreground">CNPJ</Label>
                    <MaskedInput
                      id="cnpj"
                      name="cnpj"
                      mask="cnpj"
                      value={formData.cnpj}
                      onChange={handleMaskedChange('cnpj')}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condominiumPhone" className="text-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <MaskedInput
                        id="condominiumPhone"
                        name="condominiumPhone"
                        mask="phone"
                        value={formData.condominiumPhone}
                        onChange={handleMaskedChange('condominiumPhone')}
                        className="pl-10 bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="text-foreground">CEP</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <MaskedInput
                      id="zipCode"
                      name="zipCode"
                      mask="cep"
                      value={formData.zipCode}
                      onChange={handleMaskedChange('zipCode')}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="address" className="text-foreground">Endereço</Label>
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="Rua, Avenida..."
                      value={formData.address}
                      onChange={handleChange}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressNumber" className="text-foreground">Número</Label>
                    <Input
                      id="addressNumber"
                      name="addressNumber"
                      type="text"
                      placeholder="123"
                      value={formData.addressNumber}
                      onChange={handleChange}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood" className="text-foreground">Bairro</Label>
                  <Input
                    id="neighborhood"
                    name="neighborhood"
                    type="text"
                    placeholder="Nome do bairro"
                    value={formData.neighborhood}
                    onChange={handleChange}
                    className="bg-secondary/50 border-border"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="city" className="text-foreground">Cidade</Label>
                    <Input
                      id="city"
                      name="city"
                      type="text"
                      placeholder="Nome da cidade"
                      value={formData.city}
                      onChange={handleChange}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-foreground">UF</Label>
                    <select
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">UF</option>
                      {BRAZILIAN_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="hero"
                  className="w-full"
                  onClick={handleNextStep}
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                {/* Step 2: Síndico Data */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="text-foreground">CPF</Label>
                    <MaskedInput
                      id="cpf"
                      name="cpf"
                      mask="cpf"
                      value={formData.cpf}
                      onChange={handleMaskedChange('cpf')}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <MaskedInput
                        id="phone"
                        name="phone"
                        mask="phone"
                        value={formData.phone}
                        onChange={handleMaskedChange('phone')}
                        className="pl-10 bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Senha <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    Confirmar senha <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handlePrevStep}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    variant="hero"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  resetForm();
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>

          {!isLogin && (
            <p className="mt-6 text-xs text-muted-foreground text-center">
              Ao criar uma conta, você concorda com nossos{" "}
              <a href="#" className="text-primary hover:underline">Termos de Uso</a> e{" "}
              <a href="#" className="text-primary hover:underline">Política de Privacidade</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
