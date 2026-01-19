import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, ArrowLeft, ArrowRight, Loader2, Check, Building2, Phone, MapPin, ChevronRight, ChevronLeft, RefreshCw, FileText, Sparkles, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import logoImage from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";
import { MaskedInput } from "@/components/ui/masked-input";
import { motion, AnimatePresence } from "framer-motion";
import { useTrialDays } from "@/hooks/useTrialDays";

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
  const { trialDays } = useTrialDays();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [step, setStep] = useState(1);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
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

  // Redirect authenticated users based on their roles
  // Only runs on initial load, not during login process
  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      // Don't redirect if we're in the middle of a login/signup process
      if (isLoading) return;

      if (user) {
        try {
          const redirectPath = await redirectBasedOnRole(user.id);
          navigate(redirectPath, { replace: true });
        } catch (error) {
          console.error("Error checking role:", error);
          navigate("/dashboard", { replace: true });
        }
      }
    };

    checkRoleAndRedirect();
  }, [user, navigate, isLoading]);

  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roles = (rolesData || []).map((r) => r.role);

      // Same priority used across the app
      if (roles.includes("super_admin")) return "/superadmin";
      if (roles.includes("porteiro")) return "/porteiro";
      if (roles.includes("sindico")) return "/dashboard";
      if (roles.includes("morador")) return "/resident";

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

  // Busca automática de dados pelo CNPJ
  const searchCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({
          ...prev,
          condominiumName: data.razao_social || data.nome_fantasia || prev.condominiumName,
          address: data.logradouro || prev.address,
          addressNumber: data.numero || prev.addressNumber,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.municipio || prev.city,
          state: data.uf || prev.state,
          zipCode: data.cep ? data.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : prev.zipCode,
          condominiumPhone: data.ddd_telefone_1 
            ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2).replace(/(\d{4,5})(\d{4})/, '$1-$2')}`
            : prev.condominiumPhone,
        }));
        toast({
          title: "CNPJ encontrado!",
          description: "Os dados foram preenchidos automaticamente.",
        });
      } else {
        toast({
          title: "CNPJ não encontrado",
          description: "Verifique o número ou preencha os dados manualmente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar o CNPJ. Preencha os dados manualmente.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCnpjChange = (value: string) => {
    setFormData((prev) => ({ ...prev, cnpj: value }));
    setErrors((prev) => ({ ...prev, cnpj: "" }));
    
    // Buscar automaticamente quando o CNPJ estiver completo
    const cleanCnpj = value.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      searchCnpj(value);
    }
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

        const { error } = await signUp(formData.email, formData.password, {
          fullName: formData.fullName,
          phone: formData.phone,
          cpf: formData.cpf,
          role: 'sindico',
        });
        
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
          // Note: Profile and sindico role are now created automatically by the handle_new_user() trigger
          // We only need to create the condominium here

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
          <div className="flex items-center mb-8">
            <img 
              src={logoImage} 
              alt="NotificaCondo" 
              className="h-16 w-auto object-contain"
            />
          </div>

          <h1 className="font-display text-4xl font-bold mb-6 text-foreground">
            Gestão completa do{" "}
            <span className="text-gradient">seu condomínio</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            Sistema integrado para gestão de multas, controle de encomendas 
            e reservas do salão de festas com notificações automáticas.
          </p>

          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Gestão de Multas</h3>
              <div className="space-y-2">
                {["Registro de ocorrências com prova jurídica", "Notificação automática via WhatsApp", "Contraditório e ampla defesa"].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-blue-500 uppercase tracking-wide">Controle de Encomendas</h3>
              <div className="space-y-2">
                {["Registro com foto e código de retirada", "Notificação instantânea ao morador", "Histórico completo de entregas"].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-purple-500 uppercase tracking-wide">Salão de Festas</h3>
              <div className="space-y-2">
                {["Reservas online com calendário", "Lembretes automáticos", "Checklist de entrada e saída"].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
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
          <div className="lg:hidden flex items-center mb-8">
            <img 
              src={logoImage} 
              alt="NotificaCondo" 
              className="h-12 w-auto object-contain"
            />
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

              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                <button
                  type="button"
                  onClick={() => navigate('/#planos')}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  Trocar plano
                </button>
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

          {/* Animated Step Progress */}
          {!isLogin && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors duration-300 ${
                      step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {step > 1 ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <Check className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </motion.div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-medium ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                      Etapa 1
                    </span>
                    <span className="text-sm font-semibold text-foreground">Condomínio</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className={`text-xs font-medium ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                      Etapa 2
                    </span>
                    <span className="text-sm font-semibold text-foreground">Síndico</span>
                  </div>
                  <motion.div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors duration-300 ${
                      step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                    animate={{ 
                      scale: step >= 2 ? [1, 1.1, 1] : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <User className="w-5 h-5" />
                  </motion.div>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: step === 1 ? "50%" : "100%" }}
                  transition={{ 
                    duration: 0.5, 
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 rounded-full"
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ width: "50%" }}
                />
              </div>

              {/* Step Labels */}
              <div className="flex justify-between mt-2">
                <span className={`text-xs ${step >= 1 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  Início
                </span>
                <span className={`text-xs ${step >= 2 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  Conclusão
                </span>
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

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground hover:text-primary"
                    onClick={() => setShowPasswordRecovery(true)}
                  >
                    Esqueceu sua senha?
                  </Button>
                </div>
              </>
            ) : (
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="space-y-4"
                  >
                    {/* Step 1: Condominium Data */}
                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Label htmlFor="cnpj" className="text-foreground">
                        CNPJ do Condomínio
                      </Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <MaskedInput
                          id="cnpj"
                          name="cnpj"
                          mask="cnpj"
                          value={formData.cnpj}
                          onChange={handleCnpjChange}
                          className="pl-10 bg-secondary/50 border-border"
                        />
                        {isSearchingCnpj && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Digite o CNPJ para preencher os dados automaticamente
                      </p>
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="grid grid-cols-3 gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="grid grid-cols-3 gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
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
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                    >
                      <Button
                        type="button"
                        variant="hero"
                        className="w-full"
                        onClick={handleNextStep}
                      >
                        Próximo
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="space-y-4"
                  >
                    {/* Step 2: Síndico Data */}
                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="grid grid-cols-2 gap-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
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
                    </motion.div>

                    <motion.div 
                      className="flex gap-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
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
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </form>

          {isLogin ? (
            <div className="mt-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-amber-500/10 to-primary/5 rounded-2xl blur-xl" />
              <div className="relative bg-gradient-to-br from-card/80 to-card border border-primary/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-md animate-pulse" />
                    <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-full">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Novo por aqui?
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => navigate('/planos')}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Começar Trial Gratuito
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {trialDays} dias grátis
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Sem cartão
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Cancele quando quiser
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    resetForm();
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Fazer login
                </button>
              </p>
            </div>
          )}

          {!isLogin && (
            <p className="mt-6 text-xs text-muted-foreground text-center">
              Ao criar uma conta, você concorda com nossos{" "}
              <a href="#" className="text-primary hover:underline">Termos de Uso</a> e{" "}
              <a href="#" className="text-primary hover:underline">Política de Privacidade</a>.
            </p>
          )}
        </div>
      </div>

      {/* Password Recovery Modal */}
      <Dialog open={showPasswordRecovery} onOpenChange={setShowPasswordRecovery}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Recuperar Senha via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Digite o número do WhatsApp cadastrado na sua conta. Você receberá um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="recoveryPhone">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <MaskedInput
                  id="recoveryPhone"
                  name="recoveryPhone"
                  mask="phone"
                  placeholder="(11) 99999-9999"
                  value={recoveryPhone}
                  onChange={(value) => setRecoveryPhone(value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="hero"
              className="w-full"
              disabled={isRecovering || recoveryPhone.replace(/\D/g, '').length < 10}
              onClick={async () => {
                setIsRecovering(true);
                try {
                  const phoneDigits = recoveryPhone.replace(/\D/g, '');
                  const formattedPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
                  
                  const { data, error } = await supabase.functions.invoke('send-password-recovery', {
                    body: { phone: formattedPhone }
                  });
                  
                  if (error) throw error;
                  
                  toast({
                    title: "Link enviado!",
                    description: "Verifique seu WhatsApp para redefinir sua senha.",
                  });
                  setShowPasswordRecovery(false);
                  setRecoveryPhone("");
                } catch (error: any) {
                  toast({
                    title: "Erro ao enviar",
                    description: error.message || "Não foi possível enviar o link de recuperação.",
                    variant: "destructive",
                  });
                } finally {
                  setIsRecovering(false);
                }
              }}
            >
              {isRecovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enviar Link de Recuperação
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Certifique-se de que o número informado está vinculado à sua conta de síndico.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
