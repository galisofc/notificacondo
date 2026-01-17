import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  Home,
  Save,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ResidentBreadcrumbs from "@/components/resident/ResidentBreadcrumbs";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().trim().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres"),
  phone: z.string().trim().max(20, "Telefone deve ter no máximo 20 caracteres").optional().or(z.literal("")),
});

const ResidentProfile = () => {
  const { user, signOut } = useAuth();
  const { residentInfo, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (residentInfo) {
      setFormData({
        full_name: residentInfo.full_name || "",
        email: residentInfo.email || "",
        phone: residentInfo.phone || "",
      });
      setLoading(false);
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [residentInfo, roleLoading]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!residentInfo) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("residents")
        .update({
          full_name: formData.full_name.trim().toUpperCase(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq("id", residentInfo.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Seus dados foram atualizados.",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar seus dados.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!residentInfo) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 px-4 rounded-2xl bg-gradient-card border border-border/50">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Perfil não encontrado
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Seu perfil de morador ainda não foi cadastrado. Entre em contato com o síndico do
            seu condomínio.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Meu Perfil | Área do Morador</title>
        <meta name="description" content="Gerencie seus dados pessoais" />
      </Helmet>

      <div className="space-y-6 animate-fade-up max-w-2xl">
        {/* Breadcrumbs */}
        <ResidentBreadcrumbs items={[{ label: "Meu Perfil" }]} />

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Meu Perfil
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus dados pessoais
          </p>
        </div>

        {/* Apartment Info Card (Read-only) */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Meu Apartamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Condomínio</p>
                <p className="font-medium text-foreground">{residentInfo.condominium_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">BLOCO</p>
                <p className="font-medium text-foreground">{residentInfo.block_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Apartamento</p>
                <p className="font-medium text-foreground">{residentInfo.apartment_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium text-foreground">
                  {residentInfo.is_owner ? "Proprietário" : "Inquilino"}
                  {residentInfo.is_responsible && " (Responsável)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Nome Completo
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  placeholder="Seu nome completo"
                  className={errors.full_name ? "border-destructive" : ""}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Para alterar o email, entre em contato com o síndico.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Telefone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Para alterar o telefone, entre em contato com o síndico.
                </p>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Alterações
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ResidentProfile;
