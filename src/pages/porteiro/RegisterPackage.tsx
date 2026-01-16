import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, CheckCircle2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/packages/CameraCapture";
import { CondominiumBlockApartmentSelect } from "@/components/packages/CondominiumBlockApartmentSelect";
import { PickupCodeDisplay } from "@/components/packages/PickupCodeDisplay";
import { generatePickupCode } from "@/lib/packageConstants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type RegistrationStep = "form" | "success";

export default function RegisterPackage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [step, setStep] = useState<RegistrationStep>("form");
  const [condominiumIds, setCondominiumIds] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedCondominium, setSelectedCondominium] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCode, setRegisteredCode] = useState("");

  // Fetch porter's condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("user_condominiums")
        .select("condominium_id")
        .eq("user_id", user.id);

      if (data) {
        setCondominiumIds(data.map((uc) => uc.condominium_id));
      }
    };

    fetchCondominiums();
  }, [user]);

  const handleSubmit = async () => {
    if (!capturedImage) {
      toast({
        title: "Foto obrigatória",
        description: "Por favor, tire uma foto da encomenda",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCondominium || !selectedBlock || !selectedApartment) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o condomínio, bloco e apartamento",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Não autenticado",
        description: "Faça login para registrar encomendas",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload image to storage
      const pickupCode = generatePickupCode();
      const fileName = `${Date.now()}_${pickupCode}.jpg`;
      
      // Convert base64 to blob
      const base64Data = capturedImage.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("package-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("package-photos")
        .getPublicUrl(fileName);

      // 3. Insert package record
      const { error: insertError } = await supabase.from("packages").insert({
        condominium_id: selectedCondominium,
        block_id: selectedBlock,
        apartment_id: selectedApartment,
        received_by: user.id,
        pickup_code: pickupCode,
        description: description || null,
        photo_url: urlData.publicUrl,
        status: "pendente",
      });

      if (insertError) throw insertError;

      setRegisteredCode(pickupCode);
      setStep("success");

      toast({
        title: "Encomenda registrada!",
        description: `Código de retirada: ${pickupCode}`,
      });
    } catch (error) {
      console.error("Error registering package:", error);
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível registrar a encomenda. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPackage = () => {
    setCapturedImage(null);
    setSelectedCondominium("");
    setSelectedBlock("");
    setSelectedApartment("");
    setDescription("");
    setRegisteredCode("");
    setStep("form");
  };

  if (step === "success") {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">
                Encomenda Registrada!
              </h2>
              <p className="text-muted-foreground text-center mb-8">
                Informe o código abaixo ao morador para retirada
              </p>
              
              <PickupCodeDisplay code={registeredCode} className="mb-8" />

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/porteiro")}
                >
                  Voltar ao Início
                </Button>
                <Button className="flex-1 gap-2" onClick={handleNewPackage}>
                  <Package className="w-4 h-4" />
                  Nova Encomenda
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/porteiro")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Registrar Encomenda</h1>
            <p className="text-muted-foreground">
              Tire uma foto e selecione o destino
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Foto da Encomenda</CardTitle>
            </CardHeader>
            <CardContent>
              <CameraCapture
                onCapture={setCapturedImage}
                capturedImage={capturedImage}
                onClear={() => setCapturedImage(null)}
                className="aspect-[4/3]"
              />
            </CardContent>
          </Card>

          {/* Form Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Destino da Encomenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <CondominiumBlockApartmentSelect
                condominiumIds={condominiumIds}
                selectedCondominium={selectedCondominium}
                selectedBlock={selectedBlock}
                selectedApartment={selectedApartment}
                onCondominiumChange={setSelectedCondominium}
                onBlockChange={setSelectedBlock}
                onApartmentChange={setSelectedApartment}
                disabled={isSubmitting}
              />

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Ex: Caixa grande dos Correios, envelope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !capturedImage || !selectedApartment}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Registrar Encomenda
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
