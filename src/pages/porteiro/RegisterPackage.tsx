import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, CheckCircle2, Loader2, MessageCircle, AlertCircle, MapPin, User, Phone, UserPlus } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from "@/components/packages/CameraCapture";
import { CondominiumBlockApartmentSelect } from "@/components/packages/CondominiumBlockApartmentSelect";
import { generatePickupCode } from "@/lib/packageConstants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PackageType {
  id: string;
  name: string;
  icon: string | null;
}

type RegistrationStep = "form" | "success";

interface NotificationResult {
  sent: boolean;
  count: number;
  message?: string;
}

interface DestinationPreview {
  condominiumName: string;
  blockName: string;
  apartmentNumber: string;
  residentName?: string;
  residentPhone?: string;
  hasResidents: boolean;
}

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
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);
  const [destinationPreview, setDestinationPreview] = useState<DestinationPreview | null>(null);
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);
  const [selectedPackageType, setSelectedPackageType] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [showResidentForm, setShowResidentForm] = useState(false);
  const [newResidentName, setNewResidentName] = useState("");
  const [newResidentPhone, setNewResidentPhone] = useState("");
  const [newResidentEmail, setNewResidentEmail] = useState("");
  const [isSavingResident, setIsSavingResident] = useState(false);

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

  // Fetch package types
  useEffect(() => {
    const fetchPackageTypes = async () => {
      const { data, error } = await supabase
        .from("package_types")
        .select("id, name, icon")
        .eq("is_active", true)
        .order("display_order");

      if (data && !error) {
        setPackageTypes(data);
      }
    };

    fetchPackageTypes();
  }, []);

  // Fetch destination preview when selections change
  useEffect(() => {
    const fetchDestinationPreview = async () => {
      if (!selectedCondominium || !selectedBlock || !selectedApartment) {
        setDestinationPreview(null);
        setShowResidentForm(false);
        return;
      }

      try {
        const [condoRes, blockRes, aptRes, residentsRes] = await Promise.all([
          supabase.from("condominiums").select("name").eq("id", selectedCondominium).single(),
          supabase.from("blocks").select("name").eq("id", selectedBlock).single(),
          supabase.from("apartments").select("number").eq("id", selectedApartment).single(),
          supabase.from("residents").select("full_name, phone").eq("apartment_id", selectedApartment),
        ]);

        const residents = residentsRes.data || [];
        const responsibleResident = residents.find(r => r.phone) || residents[0];
        const hasResidents = residents.length > 0;

        if (condoRes.data && blockRes.data && aptRes.data) {
          setDestinationPreview({
            condominiumName: condoRes.data.name,
            blockName: blockRes.data.name,
            apartmentNumber: aptRes.data.number,
            residentName: responsibleResident?.full_name || undefined,
            residentPhone: responsibleResident?.phone || undefined,
            hasResidents,
          });

          // Show resident form if no residents
          if (!hasResidents) {
            setShowResidentForm(true);
          } else {
            setShowResidentForm(false);
          }
        }
      } catch (error) {
        console.error("Error fetching destination preview:", error);
      }
    };

    fetchDestinationPreview();
  }, [selectedCondominium, selectedBlock, selectedApartment]);

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

    if (!selectedPackageType) {
      toast({
        title: "Tipo obrigatório",
        description: "Selecione o tipo de encomenda",
        variant: "destructive",
      });
      return;
    }

    if (!trackingCode.trim()) {
      toast({
        title: "Código de rastreio obrigatório",
        description: "Digite o código de rastreio da encomenda",
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
      const { data: packageData, error: insertError } = await supabase
        .from("packages")
        .insert({
          condominium_id: selectedCondominium,
          block_id: selectedBlock,
          apartment_id: selectedApartment,
          received_by: user.id,
          pickup_code: pickupCode,
          description: description || null,
          photo_url: urlData.publicUrl,
          status: "pendente",
          package_type_id: selectedPackageType || null,
          tracking_code: trackingCode || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Send WhatsApp notification (non-blocking)
      let notifResult: NotificationResult = { sent: false, count: 0 };
      try {
        const { data: notifyData, error: notifyError } = await supabase.functions.invoke(
          "notify-package-arrival",
          {
            body: {
              package_id: packageData.id,
              apartment_id: selectedApartment,
              pickup_code: pickupCode,
              photo_url: urlData.publicUrl,
            },
          }
        );

        if (notifyError) {
          console.warn("Failed to send package notification:", notifyError);
          notifResult = { sent: false, count: 0, message: "Erro ao enviar notificação" };
        } else if (notifyData) {
          notifResult = { 
            sent: notifyData.notifications_sent > 0, 
            count: notifyData.notifications_sent || 0,
            message: notifyData.message 
          };
        }
      } catch (notifyErr) {
        console.warn("Error calling notification function:", notifyErr);
        notifResult = { sent: false, count: 0, message: "Erro de conexão" };
      }

      setNotificationResult(notifResult);
      setRegisteredCode(pickupCode);
      setStep("success");

      toast({
        title: "Encomenda registrada!",
        description: notifResult.sent
          ? "Morador(es) notificado(s) via WhatsApp."
          : "Encomenda salva. Notificação não enviada.",
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
    setSelectedPackageType("");
    setTrackingCode("");
    setNotificationResult(null);
    setDestinationPreview(null);
    setShowResidentForm(false);
    setNewResidentName("");
    setNewResidentPhone("");
    setNewResidentEmail("");
    setStep("form");
  };

  const handleSaveResident = async () => {
    if (!newResidentName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome do morador",
        variant: "destructive",
      });
      return;
    }

    if (!newResidentPhone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Digite o telefone do morador para notificação",
        variant: "destructive",
      });
      return;
    }

    setIsSavingResident(true);

    try {
      const { data, error } = await supabase
        .from("residents")
        .insert({
          apartment_id: selectedApartment,
          full_name: newResidentName.trim(),
          phone: newResidentPhone.replace(/\D/g, ''),
          email: newResidentEmail.trim() || `morador_${Date.now()}@temp.com`,
          is_responsible: true,
          is_owner: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update destination preview with new resident
      if (destinationPreview) {
        setDestinationPreview({
          ...destinationPreview,
          residentName: data.full_name,
          residentPhone: data.phone || undefined,
          hasResidents: true,
        });
      }

      setShowResidentForm(false);
      setNewResidentName("");
      setNewResidentPhone("");
      setNewResidentEmail("");

      toast({
        title: "Morador cadastrado!",
        description: "Agora você pode registrar a encomenda",
      });
    } catch (error) {
      console.error("Error saving resident:", error);
      toast({
        title: "Erro ao cadastrar",
        description: "Não foi possível cadastrar o morador",
        variant: "destructive",
      });
    } finally {
      setIsSavingResident(false);
    }
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
              <p className="text-muted-foreground text-center mb-4">
                O morador deve apresentar o código no app para confirmar a retirada
              </p>

              {/* Notification Status */}
              {notificationResult && (
                <div className="w-full mb-6">
                  {notificationResult.sent ? (
                    <Badge 
                      variant="secondary" 
                      className="w-full justify-center py-2 gap-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {notificationResult.count} morador{notificationResult.count !== 1 ? "es" : ""} notificado{notificationResult.count !== 1 ? "s" : ""} via WhatsApp
                    </Badge>
                  ) : (
                    <Badge 
                      variant="secondary" 
                      className="w-full justify-center py-2 gap-2 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {notificationResult.message || "Nenhum morador com telefone cadastrado"}
                    </Badge>
                  )}
                </div>
              )}

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

              {/* Destination Preview */}
              {destinationPreview && (
                <div className={`p-4 rounded-lg border ${destinationPreview.hasResidents ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${destinationPreview.hasResidents ? 'bg-primary/20' : 'bg-destructive/20'}`}>
                      <MapPin className={`w-5 h-5 ${destinationPreview.hasResidents ? 'text-primary' : 'text-destructive'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Destino selecionado</p>
                      <p className="font-semibold text-lg uppercase">
                        {destinationPreview.blockName} - APTO {destinationPreview.apartmentNumber}
                      </p>
                      {destinationPreview.residentName ? (
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {destinationPreview.residentName}
                          </p>
                          {destinationPreview.residentPhone && (
                            <a 
                              href={`tel:${destinationPreview.residentPhone}`}
                              className="text-sm text-primary flex items-center gap-1 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {destinationPreview.residentPhone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Nenhum morador cadastrado
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Resident Registration Form */}
              {showResidentForm && destinationPreview && !destinationPreview.hasResidents && (
                <div className="p-4 rounded-lg bg-muted border border-border space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Cadastrar Morador
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cadastre pelo menos um morador para poder registrar encomendas nesta unidade.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="resident-name" className="text-xs">Nome Completo *</Label>
                      <Input
                        id="resident-name"
                        placeholder="Ex: João da Silva"
                        value={newResidentName}
                        onChange={(e) => setNewResidentName(e.target.value)}
                        disabled={isSavingResident}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="resident-phone" className="text-xs">Telefone (WhatsApp) *</Label>
                      <MaskedInput
                        id="resident-phone"
                        mask="phone"
                        value={newResidentPhone}
                        onChange={setNewResidentPhone}
                        disabled={isSavingResident}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="resident-email" className="text-xs">E-mail (opcional)</Label>
                      <Input
                        id="resident-email"
                        type="email"
                        placeholder="Ex: morador@email.com"
                        value={newResidentEmail}
                        onChange={(e) => setNewResidentEmail(e.target.value)}
                        disabled={isSavingResident}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveResident}
                    disabled={isSavingResident || !newResidentName.trim() || !newResidentPhone.trim()}
                    className="w-full gap-2"
                    size="sm"
                  >
                    {isSavingResident ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Cadastrar Morador
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Package Type Select */}
              <div className="space-y-2">
                <Label htmlFor="package-type">Tipo de Encomenda *</Label>
                <Select
                  value={selectedPackageType}
                  onValueChange={setSelectedPackageType}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="package-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {packageTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tracking Code */}
              <div className="space-y-2">
                <Label htmlFor="tracking-code">Código de Rastreio *</Label>
                <Input
                  id="tracking-code"
                  placeholder="Ex: AA123456789BR"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
              </div>

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

              {/* Show warning if no residents */}
              {destinationPreview && !destinationPreview.hasResidents && (
                <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Cadastre um morador acima para poder registrar a encomenda
                  </p>
                </div>
              )}

              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !capturedImage || !selectedApartment || !selectedPackageType || !trackingCode.trim() || (destinationPreview && !destinationPreview.hasResidents)}
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
