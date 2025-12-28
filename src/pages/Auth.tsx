import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock, User, ArrowLeft, Loader2, Check, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  condominiumName: z.string().min(2, "Nome do condomínio deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    condominiumName: "",
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
          // Check user role - this is the primary determinant
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          const role = roleData?.role;

          // Super Admin goes to superadmin dashboard
          if (role === "super_admin") {
            navigate("/superadmin", { replace: true });
            return;
          }

          // Síndico goes to main dashboard (prioritize role over resident check)
          if (role === "sindico") {
            navigate("/dashboard", { replace: true });
            return;
          }

          // Morador goes to resident dashboard
          if (role === "morador") {
            navigate("/resident", { replace: true });
            return;
          }

          // Default fallback for new users without explicit role
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
      // Check user role - this is the primary determinant
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const role = roleData?.role;

      // Super Admin goes to superadmin dashboard
      if (role === "super_admin") {
        return "/superadmin";
      }

      // Síndico goes to main dashboard (prioritize role over resident check)
      if (role === "sindico") {
        return "/dashboard";
      }

      // Only for "morador" role, check if user is a resident
      if (role === "morador") {
        return "/resident";
      }

      // Default fallback for new users without explicit role
      return "/dashboard";
    } catch (error) {
      console.error("Error checking role:", error);
      return "/dashboard";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
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

        // Get current user to determine redirect
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
        const result = signupSchema.safeParse(formData);

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
          // Create the condominium for the new user
          const { data: condominium, error: condoError } = await supabase
            .from('condominiums')
            .insert({
              name: formData.condominiumName,
              owner_id: newUser.id,
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

        // New users (síndicos) go to main dashboard
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
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-12">
        <div className="max-w-md mx-auto w-full">
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

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {isLogin ? "Entrar na sua conta" : "Criar sua conta"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? "Acesse seu painel de gestão condominial"
                : "Comece a gerenciar seu condomínio hoje"}
            </p>
          </div>

          {/* Selected Plan Display */}
          {!isLogin && selectedPlan && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-card border border-primary/30">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${selectedPlan.color}, ${selectedPlan.color}dd)` }}
                >
                  <span className="font-display text-sm font-bold text-white">
                    {selectedPlan.name[0]}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Plano selecionado</p>
                  <p className="font-semibold text-foreground">{selectedPlan.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-foreground">
                    R$ {selectedPlan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                {selectedPlan.notifications_limit === -1 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-primary" /> Notificações ilimitadas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-primary" /> {selectedPlan.notifications_limit} notificações/mês
                  </span>
                )}
                {selectedPlan.warnings_limit === -1 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-primary" /> Advertências ilimitadas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-primary" /> {selectedPlan.warnings_limit} advertências/mês
                  </span>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">Nome completo</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="condominiumName" className="text-foreground">Nome do condomínio</Label>
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
              </>
            )}

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

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirmar senha</Label>
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
            )}

            <Button
              type="submit"
              variant="hero"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? "Entrando..." : "Criando conta..."}
                </>
              ) : (
                isLogin ? "Entrar" : "Criar conta"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({ fullName: "", condominiumName: "", email: "", password: "", confirmPassword: "" });
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
