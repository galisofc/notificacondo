import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClipboardCheck, Calendar, User, CheckCircle2, AlertCircle, MinusCircle, Eye, MapPin, Camera, ExternalLink, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  concluida: { label: "Concluída", variant: "default", icon: CheckCircle2 },
  parcial: { label: "Parcial", variant: "secondary", icon: MinusCircle },
  nao_realizada: { label: "Não Realizada", variant: "destructive", icon: AlertCircle },
};

export default function ManutencoesHistorico() {
  const { user } = useAuth();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [detailExec, setDetailExec] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: condominiums = [] } = useQuery({
    queryKey: ["condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const condoIds = selectedCondominium === "all"
    ? condominiums.map((c) => c.id)
    : [selectedCondominium];

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ["maintenance-executions", condoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_executions")
        .select("*, maintenance_tasks(title, condominium_id, maintenance_type)")
        .in("condominium_id", condoIds)
        .order("executed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: condoIds.length > 0,
  });

  const openDetail = async (exec: any) => {
    setDetailExec(exec);
    setDetailOpen(true);
    setPhotoUrls([]);

    // Load signed URLs for photos
    if (exec.photos && exec.photos.length > 0) {
      setLoadingPhotos(true);
      const urls: string[] = [];
      for (const path of exec.photos) {
        const { data } = await supabase.storage
          .from("maintenance-photos")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setPhotoUrls(urls);
      setLoadingPhotos(false);
    }
  };

  const location = detailExec?.location as { lat: number; lng: number } | null;

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
        <SindicoBreadcrumbs
          items={[
            { label: "Manutenção", href: "/sindico/manutencoes" },
            { label: "Histórico" },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Histórico de Execuções</h2>
            <p className="text-muted-foreground">Acompanhe as manutenções realizadas</p>
          </div>
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os condomínios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {condominiums.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : executions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma execução registrada ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Executado por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Custo</TableHead>
                  <TableHead className="hidden lg:table-cell">Observações</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((exec: any) => {
                  const sConfig = statusConfig[exec.status] || statusConfig.concluida;
                  const StatusIcon = sConfig.icon;
                  const hasPhotos = exec.photos && exec.photos.length > 0;
                  const hasLocation = exec.location && typeof exec.location === "object" && exec.location.lat;
                  return (
                    <TableRow key={exec.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(parseISO(exec.executed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {exec.maintenance_tasks?.title || "—"}
                          {hasPhotos && <Camera className="h-3 w-3 text-muted-foreground" />}
                          {hasLocation && <MapPin className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={exec.maintenance_tasks?.maintenance_type === "corretiva" ? "destructive" : "default"} className="text-xs">
                          {exec.maintenance_tasks?.maintenance_type === "corretiva" ? "Corretiva" : "Preventiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{exec.executed_by_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {sConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {exec.cost ? `R$ ${Number(exec.cost).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                        {exec.observations || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openDetail(exec)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Execution Detail Modal */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Detalhes da Execução
              </DialogTitle>
              <DialogDescription>
                {detailExec?.maintenance_tasks?.title || "Manutenção"}
              </DialogDescription>
            </DialogHeader>

            {detailExec && (
              <div className="space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Data da Execução</span>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(parseISO(detailExec.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Executado por</span>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailExec.executed_by_name || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div>
                      {(() => {
                        const sc = statusConfig[detailExec.status] || statusConfig.concluida;
                        const Icon = sc.icon;
                        return (
                          <Badge variant={sc.variant} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {sc.label}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Custo</span>
                    <p className="text-sm font-medium">
                      {detailExec.cost ? `R$ ${Number(detailExec.cost).toFixed(2)}` : "Não informado"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Tipo</span>
                    <div>
                      <Badge
                        variant={detailExec.maintenance_tasks?.maintenance_type === "corretiva" ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {detailExec.maintenance_tasks?.maintenance_type === "corretiva" ? "Corretiva" : "Preventiva"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                {detailExec.observations && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Observações</span>
                    <p className="text-sm bg-muted/50 rounded-lg p-3">{detailExec.observations}</p>
                  </div>
                )}

                {/* Photos */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" />
                    Fotos ({detailExec.photos?.length || 0})
                  </span>
                  {loadingPhotos ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando fotos...
                    </div>
                  ) : photoUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {photoUrls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="relative group rounded-lg overflow-hidden border border-border aspect-square cursor-pointer"
                        >
                          <img
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma foto anexada</p>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Localização
                  </span>
                  {location ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </Badge>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir no Google Maps
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Localização não registrada</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Lightbox para foto em tela cheia */}
        <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Foto da manutenção</DialogTitle>
              <DialogDescription>Visualização ampliada da foto</DialogDescription>
            </DialogHeader>
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt="Foto ampliada"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
