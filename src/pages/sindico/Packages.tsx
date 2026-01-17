import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { useItemsPerPagePreference } from "@/hooks/useUserPreferences";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  PackageCheck,
  PackageX,
  Clock,
  Building2,
  Search,
  Filter,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import BlockApartmentDisplay from "@/components/common/BlockApartmentDisplay";
import { useNavigate } from "react-router-dom";

interface PackageWithRelations {
  id: string;
  status: "pendente" | "retirada" | "expirada";
  received_at: string;
  picked_up_at: string | null;
  pickup_code: string;
  photo_url: string;
  description: string | null;
  tracking_code: string | null;
  block: { id: string; name: string } | null;
  apartment: { id: string; number: string } | null;
  condominium: { id: string; name: string } | null;
  resident: { id: string; full_name: string; phone: string | null } | null;
  package_type: { id: string; name: string; icon: string | null } | null;
}

interface Condominium {
  id: string;
  name: string;
}

const STATUS_CONFIG = {
  pendente: {
    label: "Pendente",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  retirada: {
    label: "Retirada",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: PackageCheck,
  },
  expirada: {
    label: "Expirada",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: PackageX,
  },
};

const SindicoPackages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateTime: formatDateTime } = useDateFormatter();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [condominiumFilter, setCondominiumFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useItemsPerPagePreference("sindico-packages-items-per-page", 10);
  const [selectedPackage, setSelectedPackage] = useState<PackageWithRelations | null>(null);

  // Fetch condominiums
  const { data: condominiums = [] } = useQuery({
    queryKey: ["sindico-condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("name");
      if (error) throw error;
      return data as Condominium[];
    },
    enabled: !!user,
  });

  // Fetch packages
  const { data: packages = [], isLoading, refetch } = useQuery({
    queryKey: ["sindico-packages", user?.id, condominiumFilter],
    queryFn: async () => {
      const condoIds = condominiumFilter === "all"
        ? condominiums.map((c) => c.id)
        : [condominiumFilter];

      if (condoIds.length === 0) return [];

      const { data, error } = await supabase
        .from("packages")
        .select(`
          id,
          status,
          received_at,
          picked_up_at,
          pickup_code,
          photo_url,
          description,
          tracking_code,
          block:blocks(id, name),
          apartment:apartments(id, number),
          condominium:condominiums(id, name),
          resident:residents(id, full_name, phone),
          package_type:package_types(id, name, icon)
        `)
        .in("condominium_id", condoIds)
        .order("received_at", { ascending: false });

      if (error) throw error;
      return data as PackageWithRelations[];
    },
    enabled: !!user && condominiums.length > 0,
  });

  // Filter packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // Status filter
      if (statusFilter !== "all" && pkg.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const residentName = pkg.resident?.full_name?.toLowerCase() || "";
        const blockName = pkg.block?.name?.toLowerCase() || "";
        const aptNumber = pkg.apartment?.number?.toLowerCase() || "";
        const pickupCode = pkg.pickup_code?.toLowerCase() || "";
        const trackingCode = pkg.tracking_code?.toLowerCase() || "";

        if (
          !residentName.includes(query) &&
          !blockName.includes(query) &&
          !aptNumber.includes(query) &&
          !pickupCode.includes(query) &&
          !trackingCode.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [packages, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredPackages.length / itemsPerPage);
  const paginatedPackages = filteredPackages.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = useMemo(() => {
    const s = { total: 0, pendente: 0, retirada: 0, expirada: 0 };
    packages.forEach((pkg) => {
      s.total++;
      s[pkg.status]++;
    });
    return s;
  }, [packages]);

  const handleRefresh = () => {
    refetch();
    toast({ title: "Lista atualizada", description: "As encomendas foram atualizadas." });
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    onClick,
    isActive,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    onClick?: () => void;
    isActive?: boolean;
  }) => (
    <Card
      className={`cursor-pointer transition-all hover:scale-[1.02] ${
        isActive ? "ring-2 ring-primary" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <Helmet>
        <title>Gerenciar Encomendas | NotificaCondo</title>
        <meta name="description" content="Gerenciamento de encomendas dos condomínios" />
      </Helmet>

      <div className="space-y-6 animate-fade-up">
        <SindicoBreadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Encomendas" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <Package className="w-7 h-7 text-primary" />
              Gerenciar Encomendas
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize e gerencie as encomendas dos seus condomínios
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/sindico/packages/dashboard")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Estatísticas
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total"
            value={stats.total}
            icon={Package}
            color="bg-primary"
            onClick={() => setStatusFilter("all")}
            isActive={statusFilter === "all"}
          />
          <StatCard
            title="Pendentes"
            value={stats.pendente}
            icon={Clock}
            color="bg-amber-500"
            onClick={() => setStatusFilter("pendente")}
            isActive={statusFilter === "pendente"}
          />
          <StatCard
            title="Retiradas"
            value={stats.retirada}
            icon={PackageCheck}
            color="bg-emerald-500"
            onClick={() => setStatusFilter("retirada")}
            isActive={statusFilter === "retirada"}
          />
          <StatCard
            title="Expiradas"
            value={stats.expirada}
            icon={PackageX}
            color="bg-destructive"
            onClick={() => setStatusFilter("expirada")}
            isActive={statusFilter === "expirada"}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por morador, bloco, apartamento, código..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={condominiumFilter}
                onValueChange={(v) => {
                  setCondominiumFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Condomínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os condomínios</SelectItem>
                  {condominiums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="retirada">Retiradas</SelectItem>
                  <SelectItem value="expirada">Expiradas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma encomenda encontrada</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery
                    ? "Tente ajustar os filtros de busca"
                    : "As encomendas aparecerão aqui quando forem registradas"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Morador</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Condomínio</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Recebida</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPackages.map((pkg) => {
                        const statusConfig = STATUS_CONFIG[pkg.status];
                        const StatusIcon = statusConfig.icon;

                        return (
                          <TableRow key={pkg.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <div>
                                <p className="font-medium">{pkg.resident?.full_name || "N/A"}</p>
                                {pkg.resident?.phone && (
                                  <p className="text-xs text-muted-foreground">{pkg.resident.phone}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <BlockApartmentDisplay
                                blockName={pkg.block?.name}
                                apartmentNumber={pkg.apartment?.number}
                                variant="inline"
                              />
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{pkg.condominium?.name}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{pkg.package_type?.name || "Encomenda"}</span>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {pkg.pickup_code}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{formatDateTime(pkg.received_at)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(parseISO(pkg.received_at), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusConfig.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedPackage(pkg)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Exibindo</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(v) => {
                        setItemsPerPage(Number(v));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50, 100].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>de {filteredPackages.length} encomendas</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      {currentPage} / {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Package Details Dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Detalhes da Encomenda
            </DialogTitle>
            <DialogDescription>
              Código: {selectedPackage?.pickup_code}
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4">
              {/* Photo */}
              {selectedPackage.photo_url && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedPackage.photo_url}
                    alt="Foto da encomenda"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Morador</p>
                  <p className="font-medium">{selectedPackage.resident?.full_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unidade</p>
                  <BlockApartmentDisplay
                    blockName={selectedPackage.block?.name}
                    apartmentNumber={selectedPackage.apartment?.number}
                    variant="inline"
                    className="font-medium"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Condomínio</p>
                  <p className="font-medium">{selectedPackage.condominium?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium">{selectedPackage.package_type?.name || "Encomenda"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recebida em</p>
                  <p className="font-medium">{formatDateTime(selectedPackage.received_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_CONFIG[selectedPackage.status].color}>
                    {STATUS_CONFIG[selectedPackage.status].label}
                  </Badge>
                </div>
                {selectedPackage.picked_up_at && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Retirada em</p>
                    <p className="font-medium">{formatDateTime(selectedPackage.picked_up_at)}</p>
                  </div>
                )}
                {selectedPackage.tracking_code && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Código de Rastreio</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                      {selectedPackage.tracking_code}
                    </code>
                  </div>
                )}
                {selectedPackage.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="font-medium">{selectedPackage.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SindicoPackages;
