import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, MailOpen, Trash2, Eye, Phone, Calendar, MessageSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const ContactMessages = () => {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContactMessage[];
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_messages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Mensagem excluída com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir mensagem");
    },
  });

  const handleOpenMessage = (message: ContactMessage) => {
    setSelectedMessage(message);
    if (!message.is_read) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const unreadCount = messages?.filter((m) => !m.is_read).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SuperAdminBreadcrumbs
          items={[{ label: "Mensagens de Contato" }]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mensagens de Contato</h1>
            <p className="text-muted-foreground">
              Gerencie as mensagens recebidas pelo formulário de contato
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} não lida{unreadCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : messages?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma mensagem
              </h3>
              <p className="text-muted-foreground">
                Você ainda não recebeu mensagens pelo formulário de contato.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages?.map((message) => (
              <Card
                key={message.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  !message.is_read ? "border-primary/50 bg-primary/5" : ""
                }`}
                onClick={() => handleOpenMessage(message)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-full ${message.is_read ? "bg-muted" : "bg-primary/10"}`}>
                        {message.is_read ? (
                          <MailOpen className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Mail className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold truncate ${!message.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                            {message.name}
                          </h3>
                          {!message.is_read && (
                            <Badge variant="default" className="text-xs">Nova</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1 truncate">
                          {message.subject}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {message.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span>{message.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenMessage(message)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A mensagem será permanentemente excluída.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(message.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Message Detail Dialog */}
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedMessage?.subject}</DialogTitle>
              <DialogDescription>
                Recebida em {selectedMessage && format(new Date(selectedMessage.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Nome: </span>
                    <span className="font-medium">{selectedMessage?.name}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <a href={`mailto:${selectedMessage?.email}`} className="font-medium text-primary hover:underline">
                      {selectedMessage?.email}
                    </a>
                  </span>
                </div>
                {selectedMessage?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Telefone: </span>
                      <a href={`tel:${selectedMessage.phone}`} className="font-medium text-primary hover:underline">
                        {selectedMessage.phone}
                      </a>
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-background border rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedMessage?.message}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button asChild variant="outline">
                  <a href={`mailto:${selectedMessage?.email}?subject=Re: ${selectedMessage?.subject}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    Responder por Email
                  </a>
                </Button>
                {selectedMessage?.phone && (
                  <Button asChild variant="default">
                    <a href={`https://wa.me/${selectedMessage.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Phone className="w-4 h-4 mr-2" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ContactMessages;
