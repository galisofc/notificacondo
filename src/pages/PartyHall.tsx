import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession, isJwtExpiredError } from "@/lib/ensureAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import TrialBanner from "@/components/sindico/TrialBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, PartyPopper, Settings, Plus, Check, X, ClipboardList, MessageCircle, Eye, CalendarDays, LayoutGrid, Pencil } from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import BookingFormDialog from "@/components/party-hall/BookingFormDialog";
import ChecklistFormDialog from "@/components/party-hall/ChecklistFormDialog";
import BookingDetailsDialog from "@/components/party-hall/BookingDetailsDialog";
import BookingCalendar from "@/components/party-hall/BookingCalendar";
import BookingEditDialog from "@/components/party-hall/BookingEditDialog";
import BlockApartmentDisplay from "@/components/common/BlockApartmentDisplay";
import { useNavigate } from "react-router-dom";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guest_count: number | null;
  observations: string | null;
  notification_sent_at: string | null;
  created_at: string;
  resident: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string;
    apartment: {
      number: string;
      block: {
        name: string;
      };
    };
  };
  party_hall_setting: {
    id: string;
    name: string;
    rules: string | null;
  };
  condominium: {
    id: string;
    name: string;
  };
  checklists: {
    id: string;
    type: string;
  }[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  confirmada: { label: "Confirmada", variant: "default" },
  em_uso: { label: "Em Uso", variant: "secondary" },
  finalizada: { label: "Finalizada", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function PartyHall() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [checklistType, setChecklistType] = useState<"entrada" | "saida">("entrada");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Fetch condominiums
  const { data: condominiums = [] } = useQuery({
    queryKey: ["condominiums", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["party-hall-bookings", user?.id, selectedCondominium, selectedStatus],
    queryFn: async () => {
      const run = async () => {
        let query = supabase
          .from("party_hall_bookings")
          .select(`
            id,
            booking_date,
            start_time,
            end_time,
            status,
            guest_count,
            observations,
            notification_sent_at,
            created_at,
            resident:residents!inner(
              id,
              full_name,
              phone,
              email,
              apartment:apartments!inner(
                number,
                block:blocks!inner(
                  name
                )
              )
            ),
            party_hall_setting:party_hall_settings!inner(
              id,
              name,
              rules
            ),
            condominium:condominiums!inner(
              id,
              name
            ),
            checklists:party_hall_checklists(
              id,
              type
            )
          `)
          .order("booking_date", { ascending: false });

        if (selectedCondominium !== "all") {
          query = query.eq("condominium_id", selectedCondominium);
        } else {
          const condoIds = condominiums.map((c) => c.id);
          if (condoIds.length > 0) {
            query = query.in("condominium_id", condoIds);
          }
        }

        if (selectedStatus !== "all") {
          query = query.eq("status", selectedStatus);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as unknown as Booking[];
      };

      try {
        return await run();
      } catch (err) {
        if (isJwtExpiredError(err)) {
          await ensureValidSession();
          return await run();
        }
        throw err;
      }
    },
    enabled: !!user?.id && condominiums.length > 0,
  });

  // Update booking status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from("party_hall_bookings")
        .update({ status })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-bookings"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async (booking: Booking) => {
      const { error } = await supabase.functions.invoke("send-party-hall-notification", {
        body: { bookingId: booking.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-bookings"] });
      toast({ title: "Notificação enviada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar notificação", variant: "destructive" });
    },
  });

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const handleApprove = (booking: Booking) => {
    updateStatusMutation.mutate({ bookingId: booking.id, status: "confirmada" });
  };

  const handleReject = (booking: Booking) => {
    updateStatusMutation.mutate({ bookingId: booking.id, status: "cancelada" });
  };

  const handleStartUse = (booking: Booking) => {
    updateStatusMutation.mutate({ bookingId: booking.id, status: "em_uso" });
  };

  const handleFinish = (booking: Booking) => {
    updateStatusMutation.mutate({ bookingId: booking.id, status: "finalizada" });
  };

  const handleChecklist = (booking: Booking, type: "entrada" | "saida") => {
    setSelectedBooking(booking);
    setChecklistType(type);
    setChecklistDialogOpen(true);
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsDialogOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setEditDialogOpen(true);
  };

  const hasChecklist = (booking: Booking, type: string) => {
    return booking.checklists?.some(c => c.type === type);
  };

  const upcomingBookings = bookings.filter(b => 
    ["pendente", "confirmada"].includes(b.status) && 
    (isToday(parseISO(b.booking_date)) || isFuture(parseISO(b.booking_date)))
  );
  
  const activeBookings = bookings.filter(b => b.status === "em_uso");
  const pastBookings = bookings.filter(b => 
    ["finalizada", "cancelada"].includes(b.status) || 
    (isPast(parseISO(b.booking_date)) && !isToday(parseISO(b.booking_date)))
  );

  const renderBookingCard = (booking: Booking) => (
    <Card key={booking.id} className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-primary" />
              {booking.party_hall_setting.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {booking.condominium.name}
            </CardDescription>
          </div>
          <Badge variant={statusConfig[booking.status]?.variant || "outline"}>
            {statusConfig[booking.status]?.label || booking.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Data</p>
            <p className="font-medium">{getDateLabel(booking.booking_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Horário</p>
            <p className="font-medium">{booking.start_time.slice(0,5)} - {booking.end_time.slice(0,5)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Morador</p>
            <p className="font-medium">{booking.resident.full_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unidade</p>
            <BlockApartmentDisplay
              blockName={booking.resident.apartment.block.name}
              apartmentNumber={booking.resident.apartment.number}
              variant="default"
              className="font-medium"
            />
          </div>
          {booking.guest_count && (
            <div>
              <p className="text-muted-foreground">Convidados</p>
              <p className="font-medium">{booking.guest_count}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => handleViewDetails(booking)}>
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>

          {booking.status !== "finalizada" && booking.status !== "cancelada" && (
            <Button size="sm" variant="outline" onClick={() => handleEditBooking(booking)}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}

          {booking.status === "pendente" && (
            <>
              <Button size="sm" variant="default" onClick={() => handleApprove(booking)}>
                <Check className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleReject(booking)}>
                <X className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </>
          )}

          {booking.status === "confirmada" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => handleStartUse(booking)}>
                Iniciar Uso
              </Button>
              {!booking.notification_sent_at && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => sendNotificationMutation.mutate(booking)}
                  disabled={sendNotificationMutation.isPending}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Notificar
                </Button>
              )}
            </>
          )}

          {booking.status === "em_uso" && (
            <>
              {!hasChecklist(booking, "entrada") && (
                <Button size="sm" variant="outline" onClick={() => handleChecklist(booking, "entrada")}>
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Checklist Entrada
                </Button>
              )}
              {hasChecklist(booking, "entrada") && !hasChecklist(booking, "saida") && (
                <Button size="sm" variant="outline" onClick={() => handleChecklist(booking, "saida")}>
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Checklist Saída
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => handleFinish(booking)}>
                Finalizar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 pt-6">
        <SindicoBreadcrumbs items={[{ label: "Salão de Festas" }]} />
        <TrialBanner />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Salão de Festas</h2>
            <p className="text-muted-foreground">
              Gerencie reservas e checklists dos espaços
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex border rounded-lg p-1 bg-muted/50">
              <Button 
                variant={viewMode === "list" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
              <Button 
                variant={viewMode === "calendar" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="gap-1.5"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Calendário</span>
              </Button>
            </div>
            <Button variant="outline" onClick={() => navigate("/party-hall/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button onClick={() => setBookingFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nova Reserva</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos os condomínios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os condomínios</SelectItem>
              {condominiums.map((condo) => (
                <SelectItem key={condo.id} value={condo.id}>
                  {condo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="em_uso">Em Uso</SelectItem>
              <SelectItem value="finalizada">Finalizada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" ? (
          <BookingCalendar 
            bookings={bookings} 
            onBookingClick={handleViewDetails}
          />
        ) : (
          /* List View - Tabs */
          <Tabs defaultValue="upcoming" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Próximas</span>
                {upcomingBookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{upcomingBookings.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <PartyPopper className="h-4 w-4" />
                <span className="hidden sm:inline">Em Uso</span>
                {activeBookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{activeBookings.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : upcomingBookings.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma reserva futura</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingBookings.map(renderBookingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-4">
              {activeBookings.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum espaço em uso no momento</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeBookings.map(renderBookingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {pastBookings.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma reserva no histórico</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pastBookings.map(renderBookingCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Dialogs */}
        <BookingFormDialog 
          open={bookingFormOpen} 
          onOpenChange={setBookingFormOpen}
          condominiums={condominiums}
        />

        {selectedBooking && (
          <>
            <ChecklistFormDialog
              open={checklistDialogOpen}
              onOpenChange={setChecklistDialogOpen}
              booking={selectedBooking}
              type={checklistType}
            />
            <BookingDetailsDialog
              open={detailsDialogOpen}
              onOpenChange={setDetailsDialogOpen}
              booking={selectedBooking}
            />
            <BookingEditDialog
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              booking={selectedBooking}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}