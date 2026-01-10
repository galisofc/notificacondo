import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condominiums: { id: string; name: string }[];
}

export default function BookingFormDialog({ open, onOpenChange, condominiums }: BookingFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCondominium, setSelectedCondominium] = useState<string>("");
  const [selectedSpace, setSelectedSpace] = useState<string>("");
  const [selectedResident, setSelectedResident] = useState<string>("");
  const [bookingDate, setBookingDate] = useState<Date>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [guestCount, setGuestCount] = useState<number>(0);
  const [observations, setObservations] = useState("");

  // Fetch party hall settings for selected condominium
  const { data: spaces = [] } = useQuery({
    queryKey: ["party-hall-spaces", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("party_hall_settings")
        .select("id, name, check_in_time, check_out_time, max_guests, advance_days_required")
        .eq("condominium_id", selectedCondominium)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCondominium,
  });

  // Fetch residents for selected condominium
  const { data: residents = [] } = useQuery({
    queryKey: ["condominium-residents", selectedCondominium],
    queryFn: async () => {
      if (!selectedCondominium) return [];
      const { data, error } = await supabase
        .from("residents")
        .select(`
          id,
          full_name,
          apartment:apartments!inner(
            number,
            block:blocks!inner(
              name,
              condominium_id
            )
          )
        `)
        .eq("apartment.block.condominium_id", selectedCondominium)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCondominium,
  });

  // Update times when space is selected
  useEffect(() => {
    const space = spaces.find(s => s.id === selectedSpace);
    if (space) {
      setStartTime(space.check_in_time?.slice(0, 5) || "08:00");
      setEndTime(space.check_out_time?.slice(0, 5) || "22:00");
    }
  }, [selectedSpace, spaces]);

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCondominium || !selectedSpace || !selectedResident || !bookingDate) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      const { error } = await supabase
        .from("party_hall_bookings")
        .insert({
          condominium_id: selectedCondominium,
          party_hall_setting_id: selectedSpace,
          resident_id: selectedResident,
          booking_date: format(bookingDate, "yyyy-MM-dd"),
          start_time: startTime,
          end_time: endTime,
          guest_count: guestCount || null,
          observations: observations || null,
          status: "pendente",
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-hall-bookings"] });
      onOpenChange(false);
      resetForm();
      toast({ title: "Reserva criada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar reserva", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedCondominium("");
    setSelectedSpace("");
    setSelectedResident("");
    setBookingDate(undefined);
    setStartTime("08:00");
    setEndTime("22:00");
    setGuestCount(0);
    setObservations("");
  };

  const selectedSpaceData = spaces.find(s => s.id === selectedSpace);
  const minDate = selectedSpaceData 
    ? addDays(new Date(), selectedSpaceData.advance_days_required || 1)
    : addDays(new Date(), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Reserva</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="condominium">Condomínio *</Label>
            <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o condomínio" />
              </SelectTrigger>
              <SelectContent>
                {condominiums.map((condo) => (
                  <SelectItem key={condo.id} value={condo.id}>
                    {condo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="space">Espaço *</Label>
            <Select value={selectedSpace} onValueChange={setSelectedSpace} disabled={!selectedCondominium}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o espaço" />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="resident">Morador *</Label>
            <Select value={selectedResident} onValueChange={setSelectedResident} disabled={!selectedCondominium}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o morador" />
              </SelectTrigger>
              <SelectContent>
                {residents.map((resident: any) => (
                  <SelectItem key={resident.id} value={resident.id}>
                    {resident.full_name} - {resident.apartment?.block?.name} {resident.apartment?.number}
                  </SelectItem>
                ))}
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
                  onSelect={setBookingDate}
                  disabled={(date) => date < minDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedSpaceData && (
              <p className="text-xs text-muted-foreground">
                Antecedência mínima: {selectedSpaceData.advance_days_required} dia(s)
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
            {selectedSpaceData && (
              <p className="text-xs text-muted-foreground">
                Capacidade máxima: {selectedSpaceData.max_guests} pessoas
              </p>
            )}
          </div>

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
            onClick={() => createBookingMutation.mutate()}
            disabled={!selectedCondominium || !selectedSpace || !selectedResident || !bookingDate || createBookingMutation.isPending}
          >
            Criar Reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}