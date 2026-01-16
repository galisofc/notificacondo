import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Package, PackagePlus, Search, PackageCheck, X, Building2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCard } from "@/components/packages/PackageCard";
import { PackagePickupDialog } from "@/components/packages/PackagePickupDialog";
import { PackageDetailsDialog } from "@/components/packages/PackageDetailsDialog";
import { Package as PackageType } from "@/hooks/usePackages";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PackageStatus } from "@/lib/packageConstants";

interface ApartmentInfo {
  id: string;
  number: string;
  blockId: string;
  blockName: string;
  condominiumId: string;
  condominiumName: string;
}

export default function PorteiroPackages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [condominiumIds, setCondominiumIds] = useState<string[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<ApartmentInfo | null>(null);
  
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pendente" | "retirada" | "all">("pendente");
  
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isPickupDialogOpen, setIsPickupDialogOpen] = useState(false);
  const [detailsPackage, setDetailsPackage] = useState<PackageType | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

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

  // Fetch packages when apartment is selected
  const fetchPackages = useCallback(async (apartmentId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("packages")
        .select(`
          *,
          apartment:apartments(id, number),
          block:blocks(id, name),
          condominium:condominiums(id, name),
          package_type:package_types(id, name, icon)
        `)
        .eq("apartment_id", apartmentId)
        .order("received_at", { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error("Error fetching packages:", error);
      toast({
        title: "Erro ao buscar encomendas",
        description: "Não foi possível carregar as encomendas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Search apartment by code (BBAA format)
  const handleSearch = async () => {
    if (condominiumIds.length === 0) {
      setSearchError("Nenhum condomínio vinculado");
      return;
    }

    const code = searchCode.trim();
    if (code.length < 3 || code.length > 6) {
      setSearchError("Digite de 3 a 6 dígitos (ex: 0344)");
      return;
    }

    if (!/^\d+$/.test(code)) {
      setSearchError("Digite apenas números");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      // Parse code - first 2 digits = block, rest = apartment
      const blockCode = code.substring(0, 2);
      const apartmentCode = code.substring(2);

      // Search for blocks in user's condominiums
      const { data: blocksData, error: blocksError } = await supabase
        .from("blocks")
        .select("id, name, condominium_id, condominiums(name)")
        .in("condominium_id", condominiumIds);

      if (blocksError) throw blocksError;

      // Find block that matches the code
      const matchedBlock = blocksData?.find((block) => {
        const blockName = block.name.toLowerCase();
        const numericPart = blockName.replace(/\D/g, "");
        return numericPart === blockCode || 
               numericPart.padStart(2, "0") === blockCode ||
               blockCode === numericPart.padStart(2, "0");
      });

      if (!matchedBlock) {
        setSearchError(`Bloco "${blockCode}" não encontrado`);
        setIsSearching(false);
        return;
      }

      // Search for apartment in that block
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from("apartments")
        .select("id, number")
        .eq("block_id", matchedBlock.id);

      if (apartmentsError) throw apartmentsError;

      // Find apartment that matches
      const matchedApartment = apartmentsData?.find((apt) => {
        const aptNumber = apt.number.replace(/\D/g, "");
        return aptNumber === apartmentCode || 
               aptNumber.padStart(2, "0") === apartmentCode.padStart(2, "0");
      });

      if (!matchedApartment) {
        setSearchError(`Apartamento "${apartmentCode}" não encontrado no ${matchedBlock.name}`);
        setIsSearching(false);
        return;
      }

      // Set selected apartment
      const condoData = matchedBlock.condominiums as { name: string } | null;
      setSelectedApartment({
        id: matchedApartment.id,
        number: matchedApartment.number,
        blockId: matchedBlock.id,
        blockName: matchedBlock.name,
        condominiumId: matchedBlock.condominium_id,
        condominiumName: condoData?.name || "",
      });

      // Fetch packages for this apartment
      await fetchPackages(matchedApartment.id);
      
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("Erro na busca");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchCode("");
    setSearchError("");
    setSelectedApartment(null);
    setPackages([]);
  };

  const handlePackageClick = (pkg: PackageType) => {
    if (pkg.status === "pendente") {
      setSelectedPackage(pkg);
      setIsPickupDialogOpen(true);
    }
  };

  const handleViewDetails = (pkg: PackageType) => {
    setDetailsPackage(pkg);
    setIsDetailsDialogOpen(true);
  };

  const handleConfirmPickup = async () => {
    if (!selectedPackage || !user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    try {
      const { error } = await supabase
        .from("packages")
        .update({
          status: "retirada" as PackageStatus,
          picked_up_at: new Date().toISOString(),
          picked_up_by: user.id,
        })
        .eq("id", selectedPackage.id);

      if (error) throw error;

      toast({
        title: "Encomenda retirada!",
        description: "Retirada confirmada com sucesso.",
      });

      // Refresh packages
      if (selectedApartment) {
        await fetchPackages(selectedApartment.id);
      }

      setSelectedPackage(null);
      return { success: true };
    } catch (error) {
      console.error("Error marking pickup:", error);
      return { success: false, error: "Erro ao confirmar retirada" };
    }
  };

  // Filter packages by tab
  const filteredPackages = packages.filter((pkg) => {
    if (activeTab === "all") return true;
    return pkg.status === activeTab;
  });

  const pendingCount = packages.filter((p) => p.status === "pendente").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Encomendas</h1>
            <p className="text-muted-foreground">
              Busque por unidade para ver as encomendas
            </p>
          </div>
          <Button onClick={() => navigate("/porteiro/registrar")} className="gap-2">
            <PackagePlus className="w-4 h-4" />
            Nova Encomenda
          </Button>
        </div>

        {/* Quick Search by Code */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-code" className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Buscar Unidade (Bloco + Apartamento)
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Input
                      id="search-code"
                      placeholder="Ex: 0344 = Bloco 03, Apto 44"
                      value={searchCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setSearchCode(val);
                        setSearchError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      disabled={isSearching}
                      className={searchError ? "border-destructive" : ""}
                      maxLength={6}
                    />
                    {searchCode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={clearSearch}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !searchCode}
                    className="gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Buscar
                  </Button>
                </div>
                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}
              </div>

              {/* Selected Apartment Display */}
              {selectedApartment && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg uppercase">
                          {selectedApartment.blockName} - APTO {selectedApartment.number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedApartment.condominiumName}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearSearch}>
                      <X className="w-4 h-4 mr-1" />
                      Limpar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Packages List - Only shown when apartment is selected */}
        {selectedApartment && (
          <>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="pendente" className="gap-2">
                  <Package className="w-4 h-4" />
                  Pendentes
                  {pendingCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="retirada" className="gap-2">
                  <PackageCheck className="w-4 h-4" />
                  Retiradas
                </TabsTrigger>
                <TabsTrigger value="all">Todas</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {loading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-64 rounded-xl" />
                    ))}
                  </div>
                ) : filteredPackages.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Package className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        {activeTab === "pendente"
                          ? "Nenhuma encomenda pendente"
                          : activeTab === "retirada"
                          ? "Nenhuma encomenda retirada"
                          : "Nenhuma encomenda"}
                      </h3>
                      <p className="text-muted-foreground text-center">
                        Não há encomendas {activeTab !== "all" ? activeTab + "s" : ""} para esta unidade
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPackages.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        id={pkg.id}
                        photoUrl={pkg.photo_url}
                        pickupCode={pkg.pickup_code}
                        status={pkg.status}
                        apartmentNumber={pkg.apartment?.number || ""}
                        blockName={pkg.block?.name || ""}
                        condominiumName={pkg.condominium?.name}
                        receivedAt={pkg.received_at}
                        description={pkg.description || undefined}
                        onClick={() => handlePackageClick(pkg)}
                        onViewDetails={() => handleViewDetails(pkg)}
                        showCondominium={false}
                        showPickupCode={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Initial State - No apartment selected */}
        {!selectedApartment && !isSearching && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Busque uma unidade
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Digite o código da unidade no formato BBAA (ex: 0344 para Bloco 03, Apto 44) para ver as encomendas
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pickup Confirmation Dialog */}
      <PackagePickupDialog
        open={isPickupDialogOpen}
        onOpenChange={setIsPickupDialogOpen}
        package_={selectedPackage}
        onConfirm={handleConfirmPickup}
        revealPickupCode={false}
      />

      {/* Package Details Dialog */}
      <PackageDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        package_={detailsPackage}
        showPickupCode={false}
      />
    </DashboardLayout>
  );
}
