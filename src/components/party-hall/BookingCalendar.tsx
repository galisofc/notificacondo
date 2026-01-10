import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  resident: {
    full_name: string;
    apartment: {
      number: string;
      block: {
        name: string;
      };
    };
  };
  party_hall_setting: {
    name: string;
  };
  condominium: {
    name: string;
  };
}

interface BookingCalendarProps {
  bookings: Booking[];
  onDateSelect?: (date: Date) => void;
  onBookingClick?: (booking: Booking) => void;
}

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500",
  confirmada: "bg-green-500",
  em_uso: "bg-blue-500",
  finalizada: "bg-gray-400",
  cancelada: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  em_uso: "Em Uso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export default function BookingCalendar({ bookings, onDateSelect, onBookingClick }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Get bookings for selected date
  const selectedDateBookings = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter(b => isSameDay(parseISO(b.booking_date), selectedDate));
  }, [bookings, selectedDate]);

  // Get days with bookings for the current month
  const daysWithBookings = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    return days.reduce((acc, day) => {
      const dayBookings = bookings.filter(b => isSameDay(parseISO(b.booking_date), day));
      if (dayBookings.length > 0) {
        acc[format(day, "yyyy-MM-dd")] = dayBookings;
      }
      return acc;
    }, {} as Record<string, Booking[]>);
  }, [bookings, currentMonth]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && onDateSelect) {
      onDateSelect(date);
    }
  };

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  // Custom day render to show booking indicators
  const modifiers = useMemo(() => {
    const booked: Date[] = [];
    const pending: Date[] = [];
    const confirmed: Date[] = [];
    const inUse: Date[] = [];

    Object.entries(daysWithBookings).forEach(([dateStr, dayBookings]) => {
      const date = parseISO(dateStr);
      booked.push(date);
      
      if (dayBookings.some(b => b.status === "pendente")) {
        pending.push(date);
      }
      if (dayBookings.some(b => b.status === "confirmada")) {
        confirmed.push(date);
      }
      if (dayBookings.some(b => b.status === "em_uso")) {
        inUse.push(date);
      }
    });

    return { booked, pending, confirmed, inUse };
  }, [daysWithBookings]);

  const modifiersStyles = {
    booked: {
      fontWeight: "bold" as const,
    },
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendário de Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={currentMonth}
            onMonthChange={handleMonthChange}
            locale={ptBR}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border pointer-events-auto w-full"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
              month: "space-y-4 w-full",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-base font-semibold",
              nav: "space-x-1 flex items-center",
              nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-md",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md flex-1 font-medium text-sm py-2",
              row: "flex w-full mt-1",
              cell: cn(
                "relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20",
                "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
              ),
              day: cn(
                "h-10 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                "focus:bg-accent focus:text-accent-foreground"
              ),
              day_range_end: "day-range-end",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent/50 text-accent-foreground font-bold",
              day_outside: "day-outside text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_hidden: "invisible",
            }}
            components={{
              DayContent: ({ date }) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const dayBookings = daysWithBookings[dateStr] || [];
                const hasBookings = dayBookings.length > 0;
                
                return (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <span>{date.getDate()}</span>
                    {hasBookings && (
                      <div className="absolute bottom-0.5 flex gap-0.5">
                        {dayBookings.slice(0, 3).map((booking, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              statusColors[booking.status] || "bg-gray-400"
                            )}
                          />
                        ))}
                        {dayBookings.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayBookings.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn("w-2.5 h-2.5 rounded-full", statusColors[status])} />
                {label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {selectedDate ? (
              <span className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-primary" />
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            ) : (
              "Selecione uma data"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDate ? (
            selectedDateBookings.length > 0 ? (
              <ScrollArea className="h-[400px] pr-3">
                <div className="space-y-3">
                  {selectedDateBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={cn(
                        "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                        onBookingClick && "cursor-pointer"
                      )}
                      onClick={() => onBookingClick?.(booking)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm">{booking.party_hall_setting.name}</h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs border-0 text-white",
                            statusColors[booking.status]
                          )}
                        >
                          {statusLabels[booking.status]}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Horário:</span>{" "}
                          {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Morador:</span>{" "}
                          {booking.resident.full_name}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Unidade:</span>{" "}
                          {booking.resident.apartment.block.name} - {booking.resident.apartment.number}
                        </p>
                        <p className="text-xs opacity-70">
                          {booking.condominium.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma reserva para esta data
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                Clique em uma data para ver as reservas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
