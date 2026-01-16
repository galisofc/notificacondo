import { Package, PackageCheck, Clock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCard } from "@/components/packages/PackageCard";
import { usePackages } from "@/hooks/usePackages";
import { useUserRole } from "@/hooks/useUserRole";
import { PackageStatus } from "@/lib/packageConstants";
import { useState } from "react";

export default function ResidentPackages() {
  const { residentInfo } = useUserRole();
  const [activeTab, setActiveTab] = useState<"pendente" | "retirada" | "all">("pendente");

  const statusFilter = activeTab === "all" ? undefined : activeTab as PackageStatus;

  const { packages, loading } = usePackages({
    apartmentId: residentInfo?.apartment_id,
    status: statusFilter,
    realtime: true,
  });

  const pendingCount = packages.filter((p) => p.status === "pendente").length;

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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando retirada na portaria
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{packages.length}</div>
              <p className="text-xs text-muted-foreground">Encomendas registradas</p>
            </CardContent>
          </Card>
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
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {activeTab === "pendente"
                      ? "Nenhuma encomenda pendente"
                      : "Nenhuma encomenda"}
                  </h3>
                  <p className="text-muted-foreground text-center">
                    {activeTab === "pendente"
                      ? "Você não tem encomendas aguardando retirada"
                      : "Nenhuma encomenda foi registrada para seu apartamento"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    id={pkg.id}
                    photoUrl={pkg.photo_url}
                    pickupCode={pkg.pickup_code}
                    status={pkg.status}
                    apartmentNumber={pkg.apartment?.number || ""}
                    blockName={pkg.block?.name || ""}
                    receivedAt={pkg.received_at}
                    description={pkg.description || undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
