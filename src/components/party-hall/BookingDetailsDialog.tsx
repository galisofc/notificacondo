import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, User, Building2, Users, MessageCircle, ClipboardCheck, Check, X, AlertCircle } from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guest_count: number | null;
  observations: string | null;
  notification_sent_at: string | null;
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
  };
  condominium: {
    id: string;
    name: string;
  };
}

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  confirmada: { label: "Confirmada", variant: "default" },
  em_uso: { label: "Em Uso", variant: "secondary" },
  finalizada: { label: "Finalizada", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function BookingDetailsDialog({ open, onOpenChange, booking }: BookingDetailsDialogProps) {
  // Fetch checklists for this booking
  const { data: checklists = [] } = useQuery({
    queryKey: ["booking-checklists", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_checklists")
        .select(`
          id,
          type,
          checked_at,
          general_observations,
          items:party_hall_checklist_items(
            id,
            item_name,
            category,
            is_ok,
            observation
          )
        `)
        .eq("booking_id", booking.id)
        .order("checked_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const entryChecklist = checklists.find((c: any) => c.type === "entrada");
  const exitChecklist = checklists.find((c: any) => c.type === "saida");

  const renderChecklist = (checklist: any, title: string) => {
    if (!checklist) return null;

    const groupedItems = checklist.items?.reduce((acc: any, item: any) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, any[]>) || {};

    const issuesCount = checklist.items?.filter((i: any) => !i.is_ok).length || 0;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {issuesCount > 0 ? (
                <Badge variant="destructive">{issuesCount} problema(s)</Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-600">Tudo OK</Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Realizado em {format(parseISO(checklist.checked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(groupedItems).map(([category, items]: [string, any]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
              <div className="space-y-1">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    {item.is_ok ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={item.is_ok ? "" : "text-destructive font-medium"}>{item.item_name}</span>
                      {item.observation && (
                        <p className="text-xs text-muted-foreground">{item.observation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {checklist.general_observations && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
              <p className="text-sm">{checklist.general_observations}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{booking.party_hall_setting.name}</DialogTitle>
            <Badge variant={statusConfig[booking.status]?.variant || "outline"}>
              {statusConfig[booking.status]?.label || booking.status}
            </Badge>
          </div>
          <DialogDescription>
            {booking.condominium.name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Booking Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(parseISO(booking.booking_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="font-medium">{booking.start_time.slice(0,5)} - {booking.end_time.slice(0,5)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Resident Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Morador
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{booking.resident.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unidade</p>
                  <p className="font-medium">
                    {booking.resident.apartment.block.name} - {booking.resident.apartment.number}
                  </p>
                </div>
                {booking.resident.phone && (
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium">{booking.resident.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{booking.resident.email}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {booking.guest_count && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Convidados</p>
                    <p className="font-medium">{booking.guest_count} pessoas</p>
                  </div>
                </div>
              )}
              {booking.notification_sent_at && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Notificação</p>
                    <p className="font-medium">
                      Enviada em {format(parseISO(booking.notification_sent_at), "dd/MM 'às' HH:mm")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {booking.observations && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Observações da Reserva</h3>
                  <p className="text-sm text-muted-foreground">{booking.observations}</p>
                </div>
              </>
            )}

            {/* Checklists */}
            {(entryChecklist || exitChecklist) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Checklists</h3>
                  {renderChecklist(entryChecklist, "Checklist de Entrada")}
                  {renderChecklist(exitChecklist, "Checklist de Saída")}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}