import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, PackagePlus, Search, PackageCheck } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCard } from "@/components/packages/PackageCard";
import { PackagePickupDialog } from "@/components/packages/PackagePickupDialog";
import { PackageDetailsDialog } from "@/components/packages/PackageDetailsDialog";
import { usePackages, Package as PackageType } from "@/hooks/usePackages";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PackageStatus } from "@/lib/packageConstants";

export default function PorteiroPackages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [condominiumIds, setCondominiumIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  const statusFilter = activeTab === "all" ? undefined : activeTab as PackageStatus;

  const { packages, loading, markAsPickedUp, refetch } = usePackages({
    condominiumIds,
    status: statusFilter,
    realtime: true,
  });

  // Filter by search term
  const filteredPackages = packages.filter((pkg) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pkg.apartment?.number?.toLowerCase().includes(search) ||
      pkg.block?.name?.toLowerCase().includes(search) ||
      pkg.description?.toLowerCase().includes(search)
    );
  });

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

    const result = await markAsPickedUp(selectedPackage.id, user.id);

    if (result.success) {
      toast({
        title: "Encomenda retirada!",
        description: "Retirada confirmada com sucesso.",
      });
      setSelectedPackage(null);
    }

    return result;
  };

  const pendingCount = packages.filter((p) => p.status === "pendente").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Encomendas</h1>
            <p className="text-muted-foreground">
              Gerencie todas as encomendas do condomínio
            </p>
          </div>
          <Button onClick={() => navigate("/porteiro/registrar")} className="gap-2">
            <PackagePlus className="w-4 h-4" />
            Nova Encomenda
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, apartamento ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

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
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {searchTerm
                      ? "Nenhuma encomenda encontrada"
                      : activeTab === "pendente"
                      ? "Nenhuma encomenda pendente"
                      : "Nenhuma encomenda"}
                  </h3>
                  <p className="text-muted-foreground text-center">
                    {searchTerm
                      ? "Tente buscar por outro termo"
                      : "Registre uma nova encomenda"}
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
                    showCondominium={condominiumIds.length > 1}
                    showPickupCode={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Pickup Confirmation Dialog */}
      <PackagePickupDialog
        open={isPickupDialogOpen}
        onOpenChange={setIsPickupDialogOpen}
        package_={selectedPackage}
        onConfirm={handleConfirmPickup}
        revealPickupCode={false}
      />

      {/* Package Details Dialog with Resend Notification */}
      <PackageDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        package_={detailsPackage}
        showPickupCode={false}
      />
    </DashboardLayout>
  );
}
