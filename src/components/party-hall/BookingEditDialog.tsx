import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidSession, isJwtExpiredError } from "@/lib/ensureAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays, parseISO, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guest_count: number | null;
  observations: string | null;
  resident: {
    id: string;
    full_name: string;
    apartment?: {
      number: string;
      block?: {
        name: string;
      };
    };
  };
  party_hall_setting: {
    id: string;
    name: string;
  };
  condominium: {
    id: string;
    name: string;
  };
}

interface BookingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
}

export default function BookingEditDialog({ open, onOpenChange, booking }: BookingEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedResident, setSelectedResident] = useState<string>(booking.resident.id);
  const [bookingDate, setBookingDate] = useState<Date>(parseISO(booking.booking_date));
  const [startTime, setStartTime] = useState(booking.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(booking.end_time.slice(0, 5));
  const [guestCount, setGuestCount] = useState<number>(booking.guest_count || 0);
  const [observations, setObservations] = useState(booking.observations || "");
  const [status, setStatus] = useState(booking.status);

  // Reset form when booking changes
  useEffect(() => {
    setSelectedResident(booking.resident.id);
    setBookingDate(parseISO(booking.booking_date));
    setStartTime(booking.start_time.slice(0, 5));
    setEndTime(booking.end_time.slice(0, 5));
    setGuestCount(booking.guest_count || 0);
    setObservations(booking.observations || "");
    setStatus(booking.status);
  }, [booking]);

  // Fetch party hall settings for the space
  const { data: spaceSettings } = useQuery({
    queryKey: ["party-hall-space-settings", booking.party_hall_setting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_settings")
        .select("id, name, check_in_time, check_out_time, max_guests, advance_days_required")
        .eq("id", booking.party_hall_setting.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing bookings for the selected space to block dates
  const { data: existingBookings = [] } = useQuery({
    queryKey: ["space-bookings-edit", booking.party_hall_setting.id, booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_bookings")
        .select("booking_date, status, id")
        .eq("party_hall_setting_id", booking.party_hall_setting.id)
        .neq("id", booking.id) // Exclude current booking
        .in("status", ["pendente", "confirmada", "em_uso"]);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Create a set of blocked dates for quick lookup
  const blockedDates = useMemo(() => {
    return existingBookings.map(b => startOfDay(parseISO(b.booking_date)));
  }, [existingBookings]);

  // Check if a date is blocked
  const isDateBlocked = (date: Date) => {
    return blockedDates.some(blockedDate => isSameDay(blockedDate, date));
  };

  // Fetch residents for the condominium
  const { data: residents = [] } = useQuery({
    queryKey: ["condominium-residents-edit", booking.condominium.id],
    queryFn: async () => {
      const run = async () => {
        // First get all blocks for this condominium
        const { data: blocks, error: blocksError } = await supabase
          .from("blocks")
          .select("id")
          .eq("condominium_id", booking.condominium.id);

        if (blocksError) throw blocksError;
        if (!blocks || blocks.length === 0) return [];

        const blockIds = blocks.map((b) => b.id);

        // Then get apartments in those blocks
        const { data: apartments, error: apartmentsError } = await supabase
          .from("apartments")
          .select("id")
          .in("block_id", blockIds);

        if (apartmentsError) throw apartmentsError;
        if (!apartments || apartments.length === 0) return [];

        const apartmentIds = apartments.map((a) => a.id);

        // Finally get residents in those apartments
        const { data, error } = await supabase
          .from("residents")
          .select(`
            id,
            full_name,
            apartment:apartments!inner(
              number,
              block:blocks!inner(
                name
              )
            )
          `)
          .in("apartment_id", apartmentIds)
          .order("full_name");

        if (error) throw error;
        return data;
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
    enabled: open,
  });

  const minDate = spaceSettings 
    ? addDays(new Date(), spaceSettings.advance_days_required || 1)
    : addDays(new Date(), 1);

  // For editing existing bookings, allow the current date even if it's in the past
  const isDateDisabled = (date: Date) => {
    const currentBookingDate = startOfDay(parseISO(booking.booking_date));
    if (isSameDay(date, currentBookingDate)) return false;
    return date < startOfDay(minDate) || isDateBlocked(date);
  };

  const guestCountExceedsMax = spaceSettings?.max_guests && guestCount > spaceSettings.max_guests;

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedResident || !bookingDate) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      // Double-check if date is still available (race condition prevention)
      const currentBookingDate = format(parseISO(booking.booking_date), "yyyy-MM-dd");
      const newBookingDate = format(bookingDate, "yyyy-MM-dd");
      
      if (currentBookingDate !== newBookingDate) {
        const { data: conflictCheck, error: checkError } = await supabase
          .from("party_hall_bookings")
          .select("id")
          .eq("party_hall_setting_id", booking.party_hall_setting.id)
          .eq("booking_date", newBookingDate)
          .neq("id", booking.id)
          .in("status", ["pendente", "confirmada", "em_uso"])
          .maybeSingle();

        if (checkError) throw checkError;
        if (conflictCheck) {
          throw new Error("Esta data já foi reservada. Por favor, escolha outra data.");
        }
      }

      // Validate guest count
      if (spaceSettings?.max_guests && guestCount > spaceSettings.max_guests) {
        throw new Error(`O número de convidados não pode exceder ${spaceSettings.max_guests}`);
      }

      const { error } = await supabase
        .from("party_hall_bookings")
        .update({
          resident_id: selectedResident,
          booking_date: format(bookingDate, "yyyy-MM-dd"),
          start_time: startTime,
          end_time: endTime,
          guest_count: guestCount || null,
          observations: observations || null,
          status,
        })
        .eq("id", booking.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["space-bookings"] });
      onOpenChange(false);
      toast({ title: "Reserva atualizada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar reserva", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Reserva</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Espaço</Label>
            <Input value={booking.party_hall_setting.name} disabled />
          </div>

          <div className="grid gap-2">
            <Label>Condomínio</Label>
            <Input value={booking.condominium.name} disabled />
          </div>

          <div className="grid gap-2">
            <Label>Morador</Label>
            <Input 
              value={`${booking.resident.full_name} - ${booking.resident.apartment?.block?.name || ''} / Apto ${booking.resident.apartment?.number || ''}`} 
              disabled 
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="confirmada">Confirmada</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="finalizada">Finalizada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Data da Reserva *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !bookingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {bookingDate ? format(bookingDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingDate}
                  onSelect={(date) => date && setBookingDate(date)}
                  disabled={isDateDisabled}
                  locale={ptBR}
                  initialFocus
                  modifiers={{
                    booked: blockedDates,
                  }}
                  modifiersClassNames={{
                    booked: "line-through text-muted-foreground bg-muted",
                  }}
                />
              </PopoverContent>
            </Popover>
            {blockedDates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 bg-muted rounded mr-1 align-middle" />
                Datas riscadas já possuem reserva
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_time">Horário Início</Label>
              <Input
                id="start_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_time">Horário Fim</Label>
              <Input
                id="end_time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="guest_count">Número de Convidados</Label>
            <Input
              id="guest_count"
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              placeholder="0"
            />
            {spaceSettings && (
              <p className={cn(
                "text-xs",
                guestCountExceedsMax ? "text-destructive" : "text-muted-foreground"
              )}>
                Capacidade máxima: {spaceSettings.max_guests} pessoas
                {guestCountExceedsMax && " (excedido!)"}
              </p>
            )}
          </div>

          {guestCountExceedsMax && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O número de convidados excede a capacidade máxima do espaço.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informações adicionais sobre a reserva..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => updateBookingMutation.mutate()}
            disabled={
              !selectedResident || 
              !bookingDate || 
              guestCountExceedsMax ||
              updateBookingMutation.isPending
            }
          >
            {updateBookingMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
