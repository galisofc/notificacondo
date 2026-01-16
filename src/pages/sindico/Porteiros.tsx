import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DoorOpen, Plus, Trash2, Building2, Mail, Phone, Search, UserPlus, MessageCircle, Copy, Check, Key, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Condominium {
  id: string;
  name: string;
}

interface Porter {
  id: string;
  user_id: string;
  condominium_id: string;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  condominium: {
    name: string;
  } | null;
}

export default function Porteiros() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [porters, setPorters] = useState<Porter[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // New porter form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPorter, setNewPorter] = useState({
    full_name: "",
    email: "",
    phone: "",
    condominium_id: "",
  });
  
  // Success dialog state (shows password if WhatsApp failed)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    full_name: string;
    email: string;
    password?: string;
    whatsapp_sent: boolean;
    is_new_user: boolean;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Fetch síndico's condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");

      if (error) {
        console.error("Error fetching condominiums:", error);
        return;
      }

      setCondominiums(data || []);
    };

    fetchCondominiums();
  }, [user]);

  // Fetch porters
  useEffect(() => {
    const fetchPorters = async () => {
      if (!user || condominiums.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const condoIds = condominiums.map((c) => c.id);

      // First, get all users with 'porteiro' role
      const { data: porterRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "porteiro");

      const porterUserIds = porterRoles?.map((r) => r.user_id) || [];

      if (porterUserIds.length === 0) {
        setPorters([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_condominiums")
        .select(`
          id,
          user_id,
          condominium_id,
          created_at,
          condominium:condominiums(name)
        `)
        .in("condominium_id", condoIds)
        .in("user_id", porterUserIds);

      if (error) {
        console.error("Error fetching porters:", error);
        setLoading(false);
        return;
      }

      // Fetch profiles for each user
      const userIds = data?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const portersWithProfiles = (data || []).map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        condominium: p.condominium as { name: string } | null,
      }));

      setPorters(portersWithProfiles);
      setLoading(false);
    };

    fetchPorters();
  }, [user, condominiums]);

  const filteredPorters = porters.filter((porter) => {
    const matchesCondominium =
      selectedCondominium === "all" || porter.condominium_id === selectedCondominium;
    const matchesSearch =
      !searchTerm ||
      porter.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      porter.profile?.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCondominium && matchesSearch;
  });

  const handleAddPorter = async () => {
    if (!newPorter.full_name || !newPorter.email || !newPorter.condominium_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, e-mail e condomínio",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Call edge function to create porter
      const { data, error } = await supabase.functions.invoke("create-porteiro", {
        body: {
          full_name: newPorter.full_name,
          email: newPorter.email,
          phone: newPorter.phone || null,
          condominium_id: newPorter.condominium_id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Show success feedback
      if (data.is_new_user && !data.whatsapp_sent && data.password) {
        // WhatsApp failed, show password dialog
        setSuccessData({
          full_name: newPorter.full_name,
          email: newPorter.email,
          password: data.password,
          whatsapp_sent: false,
          is_new_user: true,
        });
        setSuccessDialogOpen(true);
      } else if (data.is_new_user && data.whatsapp_sent) {
        // WhatsApp sent successfully
        toast({
          title: "Porteiro cadastrado! ✅",
          description: (
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span>Credenciais enviadas via WhatsApp</span>
            </div>
          ),
        });
      } else {
        // Existing user linked
        toast({
          title: "Porteiro vinculado!",
          description: "O usuário já existente foi vinculado ao condomínio",
        });
      }

      // Reset form and close dialog
      setNewPorter({ full_name: "", email: "", phone: "", condominium_id: "" });
      setIsDialogOpen(false);

      // Refetch porters
      const condoIds = condominiums.map((c) => c.id);
      const { data: portersData } = await supabase
        .from("user_condominiums")
        .select(`
          id,
          user_id,
          condominium_id,
          created_at,
          condominium:condominiums(name)
        `)
        .in("condominium_id", condoIds);

      const userIds = portersData?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const portersWithProfiles = (portersData || []).map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        condominium: p.condominium as { name: string } | null,
      }));

      setPorters(portersWithProfiles);
    } catch (error: any) {
      console.error("Error adding porter:", error);
      toast({
        title: "Erro ao adicionar porteiro",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (successData?.password) {
      await navigator.clipboard.writeText(successData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const handleRemovePorter = async (porterId: string, porterUserId: string, porterName: string) => {
    try {
      // Call edge function to completely delete the porter
      const { data, error } = await supabase.functions.invoke("delete-porteiro", {
        body: {
          user_condominium_id: porterId,
          porter_user_id: porterUserId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setPorters((prev) => prev.filter((p) => p.id !== porterId));

      toast({
        title: data?.user_deleted ? "Porteiro excluído" : "Porteiro removido",
        description: data?.user_deleted 
          ? `${porterName} foi excluído completamente do sistema`
          : `${porterName} foi removido do condomínio`,
      });
    } catch (error: any) {
      console.error("Error removing porter:", error);
      toast({
        title: "Erro ao remover porteiro",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DoorOpen className="w-6 h-6 text-primary" />
              Gestão de Porteiros
            </h1>
            <p className="text-muted-foreground">
              Gerencie os porteiros dos seus condomínios
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Adicionar Porteiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Porteiro</DialogTitle>
                <DialogDescription>
                  O porteiro receberá um e-mail para acessar o sistema
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="condominium">Condomínio *</Label>
                  <Select
                    value={newPorter.condominium_id}
                    onValueChange={(value) =>
                      setNewPorter((prev) => ({ ...prev, condominium_id: value }))
                    }
                  >
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

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Nome do porteiro"
                    value={newPorter.full_name}
                    onChange={(e) =>
                      setNewPorter((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="porteiro@email.com"
                    value={newPorter.email}
                    onChange={(e) =>
                      setNewPorter((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={newPorter.phone}
                    onChange={(e) =>
                      setNewPorter((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAddPorter} disabled={isSubmitting}>
                  {isSubmitting ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedCondominium} onValueChange={setSelectedCondominium}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Filtrar por condomínio" />
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
            </div>
          </CardContent>
        </Card>

        {/* Porters List */}
        <Card>
          <CardHeader>
            <CardTitle>Porteiros Cadastrados</CardTitle>
            <CardDescription>
              {filteredPorters.length} porteiro(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredPorters.length === 0 ? (
              <div className="text-center py-12">
                <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum porteiro encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  {porters.length === 0
                    ? "Adicione porteiros para gerenciar as encomendas"
                    : "Tente ajustar os filtros de busca"}
                </p>
                {porters.length === 0 && (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeiro Porteiro
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPorters.map((porter) => (
                      <TableRow key={porter.id}>
                        <TableCell>
                          <div className="font-medium">
                            {porter.profile?.full_name || "Nome não informado"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              {porter.profile?.email || "-"}
                            </div>
                            {porter.profile?.phone && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="w-3.5 h-3.5" />
                                {porter.profile.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Building2 className="w-3 h-3" />
                            {porter.condominium?.name || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(porter.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover porteiro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {porter.profile?.full_name} será removido do condomínio{" "}
                                  {porter.condominium?.name}. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemovePorter(
                                      porter.id,
                                      porter.user_id,
                                      porter.profile?.full_name || "Porteiro"
                                    )
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog with Password */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Porteiro Cadastrado
            </DialogTitle>
            <DialogDescription>
              O WhatsApp não foi enviado. Anote as credenciais abaixo para informar ao porteiro.
            </DialogDescription>
          </DialogHeader>

          {successData && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Atenção</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  {successData.password 
                    ? "Não foi possível enviar as credenciais via WhatsApp. Anote a senha abaixo!"
                    : "O porteiro foi vinculado ao condomínio."}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-muted">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{successData.email}</p>
                  </div>
                </div>

                {successData.password && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-muted-foreground">Senha</p>
                      <div className="flex items-center gap-2">
                        <code className="text-lg font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded">
                          {successData.password}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyPassword}
                          className="gap-1"
                        >
                          {passwordCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={() => {
                setSuccessDialogOpen(false);
                setSuccessData(null);
                setPasswordCopied(false);
              }}
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
