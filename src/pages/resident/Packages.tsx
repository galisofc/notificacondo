import { Package, PackageCheck, Clock, Eye, Calendar, MapPin, Info } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PackageCard } from "@/components/packages/PackageCard";
import { PickupCodeDisplay } from "@/components/packages/PickupCodeDisplay";
import { usePackages, Package as PackageType } from "@/hooks/usePackages";
import { useUserRole } from "@/hooks/useUserRole";
import { PackageStatus } from "@/lib/packageConstants";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ResidentPackages() {
  const { residentInfo } = useUserRole();
  const [activeTab, setActiveTab] = useState<"pendente" | "retirada" | "all">("pendente");
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const statusFilter = activeTab === "all" ? undefined : activeTab as PackageStatus;

  const { packages, loading } = usePackages({
    apartmentId: residentInfo?.apartment_id,
    status: statusFilter,
    realtime: true,
  });

  const pendingCount = packages.filter((p) => p.status === "pendente").length;
  const pickedUpCount = packages.filter((p) => p.status === "retirada").length;

  const handleViewDetails = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Minhas Encomendas</h1>
          <p className="text-muted-foreground">
            Acompanhe as encomendas do seu apartamento
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-yellow-200 dark:border-yellow-900 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando retirada na portaria
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retiradas</CardTitle>
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <PackageCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{pickedUpCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Encomendas já retiradas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <div className="p-2 rounded-full bg-muted">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{packages.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Encomendas registradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Package Alert */}
        {pendingCount > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Package className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  Você tem {pendingCount} encomenda{pendingCount > 1 ? "s" : ""} aguardando retirada!
                </p>
                <p className="text-sm text-muted-foreground">
                  Dirija-se à portaria com o código de retirada
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendente" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Pendentes</span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="retirada" className="gap-2">
              <PackageCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Retiradas</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Todas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Package className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    {activeTab === "pendente"
                      ? "Nenhuma encomenda pendente"
                      : activeTab === "retirada"
                      ? "Nenhuma encomenda retirada"
                      : "Nenhuma encomenda"}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    {activeTab === "pendente"
                      ? "Você não tem encomendas aguardando retirada. Quando uma encomenda chegar, você será notificado."
                      : activeTab === "retirada"
                      ? "Você ainda não retirou nenhuma encomenda."
                      : "Nenhuma encomenda foi registrada para seu apartamento ainda."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="relative group">
                    <PackageCard
                      id={pkg.id}
                      photoUrl={pkg.photo_url}
                      pickupCode={pkg.pickup_code}
                      status={pkg.status}
                      apartmentNumber={pkg.apartment?.number || ""}
                      blockName={pkg.block?.name || ""}
                      receivedAt={pkg.received_at}
                      description={pkg.description || undefined}
                      onViewDetails={() => handleViewDetails(pkg)}
                    />
                    {pkg.status === "pendente" && (
                      <Button
                        size="sm"
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-2"
                        onClick={() => handleViewDetails(pkg)}
                      >
                        <Info className="w-4 h-4" />
                        Ver Código
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Package Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Detalhes da Encomenda
            </DialogTitle>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-6">
              {/* Package Image */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                <img
                  src={selectedPackage.photo_url}
                  alt="Foto da encomenda"
                  className="w-full h-full object-cover"
                />
                <Badge
                  variant={selectedPackage.status === "pendente" ? "default" : "secondary"}
                  className="absolute top-3 right-3"
                >
                  {selectedPackage.status === "pendente" ? "Aguardando Retirada" : "Retirada"}
                </Badge>
              </div>

              {/* Pickup Code - Prominent for Pending */}
              {selectedPackage.status === "pendente" && (
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    Apresente este código na portaria
                  </p>
                  <PickupCodeDisplay code={selectedPackage.pickup_code} size="md" />
                </div>
              )}

              {/* Package Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recebida em</p>
                    <p className="font-medium">{formatDate(selectedPackage.received_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Destino</p>
                    <p className="font-medium">
                      {selectedPackage.block?.name} - Apto {selectedPackage.apartment?.number}
                    </p>
                  </div>
                </div>

                {selectedPackage.description && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-muted">
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">Descrição</p>
                      <p className="font-medium">{selectedPackage.description}</p>
                    </div>
                  </div>
                )}

                {selectedPackage.status === "retirada" && selectedPackage.picked_up_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <PackageCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">Retirada em</p>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {formatDate(selectedPackage.picked_up_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}