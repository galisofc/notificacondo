import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SindicoBreadcrumbs from "@/components/sindico/SindicoBreadcrumbs";
import TrialBanner from "@/components/sindico/TrialBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, CheckCircle, XCircle, Clock, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  booking_id: string;
  condominium_id: string;
  resident_id: string;
  notification_type: string;
  phone: string;
  message_content: string;
  message_id: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  created_at: string;
  booking: {
    booking_date: string;
    start_time: string;
    end_time: string;
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
  };
  condominium: {
    name: string;
  };
}

const notificationTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  reminder: { label: "Lembrete", icon: <Clock className="h-4 w-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  cancelled: { label: "Cancelamento", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  confirmed: { label: "Confirmação", icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Enviada", variant: "default" },
  delivered: { label: "Entregue", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
};

export default function PartyHallNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

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

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["party-hall-notifications", user?.id, selectedCondominium, selectedType],
    queryFn: async () => {
      let query = supabase
        .from("party_hall_notifications")
        .select(`
          *,
          booking:party_hall_bookings!inner(
            booking_date,
            start_time,
            end_time,
            resident:residents!inner(
              full_name,
              apartment:apartments!inner(
                number,
                block:blocks!inner(name)
              )
            ),
            party_hall_setting:party_hall_settings!inner(name)
          ),
          condominium:condominiums!inner(name)
        `)
        .order("sent_at", { ascending: false });

      if (selectedCondominium !== "all") {
        query = query.eq("condominium_id", selectedCondominium);
      } else {
        // Filter by user's condominiums
        const condoIds = condominiums.map(c => c.id);
        if (condoIds.length > 0) {
          query = query.in("condominium_id", condoIds);
        }
      }

      if (selectedType !== "all") {
        query = query.eq("notification_type", selectedType);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as unknown as Notification[];
    },
    enabled: !!user?.id && condominiums.length > 0,
  });

  const handleViewDetails = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailsDialogOpen(true);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TrialBanner />
        
        <SindicoBreadcrumbs
          items={[
            { label: "Salão de Festas", href: "/party-hall" },
            { label: "Histórico de Notificações" },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Histórico de Notificações
            </h1>
            <p className="text-muted-foreground">
              Acompanhe todas as notificações WhatsApp enviadas para reservas do salão de festas
            </p>
          </div>
          
          <Button variant="outline" onClick={() => navigate("/party-hall")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Reservas
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Notificações Enviadas</CardTitle>
                <CardDescription>
                  {notifications.length} notificações encontradas
                </CardDescription>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filtrar por condomínio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Condomínios</SelectItem>
                    {condominiums.map((condo) => (
                      <SelectItem key={condo.id} value={condo.id}>
                        {condo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="reminder">Lembrete</SelectItem>
                    <SelectItem value="cancelled">Cancelamento</SelectItem>
                    <SelectItem value="confirmed">Confirmação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma notificação encontrada</h3>
                <p className="text-muted-foreground">
                  As notificações enviadas aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Morador</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Reserva</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notification) => {
                      const typeConfig = notificationTypeConfig[notification.notification_type] || notificationTypeConfig.reminder;
                      const status = statusConfig[notification.status] || statusConfig.sent;
                      
                      return (
                        <TableRow key={notification.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="font-medium">
                              {format(parseISO(notification.sent_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(parseISO(notification.sent_at), "HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeConfig.color}`}>
                              {typeConfig.icon}
                              {typeConfig.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{notification.booking.resident.full_name}</div>
                            <div className="text-sm text-muted-foreground uppercase">
                              {notification.booking.resident.apartment.block.name} - APTO {notification.booking.resident.apartment.number}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatPhone(notification.phone)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {format(parseISO(notification.booking.booking_date), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {notification.booking.party_hall_setting.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(notification)}
                            >
                              Ver Mensagem
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Detalhes da Notificação
              </DialogTitle>
              <DialogDescription>
                Mensagem enviada em {selectedNotification && format(parseISO(selectedNotification.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            
            {selectedNotification && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Destinatário:</span>
                    <p className="font-medium">{selectedNotification.booking.resident.full_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Telefone:</span>
                    <p>{formatPhone(selectedNotification.phone)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Tipo:</span>
                    <p className="capitalize">{notificationTypeConfig[selectedNotification.notification_type]?.label || selectedNotification.notification_type}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Status:</span>
                    <Badge variant={statusConfig[selectedNotification.status]?.variant || "default"}>
                      {statusConfig[selectedNotification.status]?.label || selectedNotification.status}
                    </Badge>
                  </div>
                  {selectedNotification.message_id && (
                    <div className="col-span-2">
                      <span className="font-medium text-muted-foreground">ID da Mensagem:</span>
                      <p className="font-mono text-xs">{selectedNotification.message_id}</p>
                    </div>
                  )}
                  {selectedNotification.error_message && (
                    <div className="col-span-2">
                      <span className="font-medium text-muted-foreground">Erro:</span>
                      <p className="text-destructive">{selectedNotification.error_message}</p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="font-medium text-muted-foreground text-sm">Conteúdo da Mensagem:</span>
                  <ScrollArea className="mt-2 h-[300px] rounded-md border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {selectedNotification.message_content}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
