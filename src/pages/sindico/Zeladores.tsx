import { useState, useEffect, useCallback } from "react";
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
import { Wrench, Plus, Trash2, Building2, Mail, Phone, Search, Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Condominium {
  id: string;
  name: string;
}

interface Zelador {
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

export default function Zeladores() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [zeladores, setZeladores] = useState<Zelador[]>([]);
  const [selectedCondominium, setSelectedCondominium] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newZelador, setNewZelador] = useState({
    full_name: "",
    email: "",
    phone: "",
    condominium_id: "",
  });

  // Success state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    full_name: string;
    email: string;
    password?: string;
    is_new_user: boolean;
  } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Fetch condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      setCondominiums(data || []);
    };
    fetchCondominiums();
  }, [user]);

  // Fetch zeladores
  const fetchZeladores = useCallback(async () => {
    if (!user || condominiums.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const condoIds = condominiums.map((c) => c.id);

    // Get users with 'zelador' role
    const { data: zeladorRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "zelador");

    const zeladorUserIds = zeladorRoles?.map((r) => r.user_id) || [];

    if (zeladorUserIds.length === 0) {
      setZeladores([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("user_condominiums")
      .select(`id, user_id, condominium_id, created_at, condominium:condominiums(name)`)
      .in("condominium_id", condoIds)
      .in("user_id", zeladorUserIds);

    const userIds = data?.map((p) => p.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    setZeladores(
      (data || []).map((z) => ({
        ...z,
        profile: profileMap.get(z.user_id) || null,
        condominium: z.condominium as { name: string } | null,
      }))
    );
    setLoading(false);
  }, [user, condominiums]);

  useEffect(() => {
    fetchZeladores();
  }, [fetchZeladores]);

  const filteredZeladores = zeladores.filter((z) => {
    const matchesCondo = selectedCondominium === "all" || z.condominium_id === selectedCondominium;
    const matchesSearch =
      !searchTerm ||
      z.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      z.profile?.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCondo && matchesSearch;
  });

  const handleAddZelador = async () => {
    if (!newZelador.full_name || !newZelador.email || !newZelador.condominium_id) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, e-mail e condomínio", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-zelador", {
        body: {
          full_name: newZelador.full_name,
          email: newZelador.email,
          phone: newZelador.phone || null,
          condominium_id: newZelador.condominium_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.is_new_user && data.password) {
        setSuccessData({
          full_name: newZelador.full_name,
          email: newZelador.email,
          password: data.password,
          is_new_user: true,
        });
        setSuccessDialogOpen(true);
      } else {
        toast({ title: "Zelador vinculado!", description: "O usuário foi vinculado ao condomínio" });
      }

      setNewZelador({ full_name: "", email: "", phone: "", condominium_id: "" });
      setIsDialogOpen(false);
      fetchZeladores();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar zelador", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteZelador = async (zelador: Zelador) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-zelador", {
        body: {
          user_condominium_id: zelador.id,
          zelador_user_id: zelador.user_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Zelador removido", description: data.message });
      fetchZeladores();
    } catch (error: any) {
      toast({ title: "Erro ao remover zelador", description: error.message, variant: "destructive" });
    }
  };

  const handleCopyPassword = async () => {
    if (successData?.password) {
      await navigator.clipboard.writeText(successData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" />
              Zeladores
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie os zeladores dos seus condomínios</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Zelador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Zelador</DialogTitle>
                <DialogDescription>Cadastre um novo zelador para o condomínio</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Condomínio *</Label>
                  <Select
                    value={newZelador.condominium_id}
                    onValueChange={(v) => setNewZelador((prev) => ({ ...prev, condominium_id: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o condomínio" /></SelectTrigger>
                    <SelectContent>
                      {condominiums.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome completo *</Label>
                  <Input
                    value={newZelador.full_name}
                    onChange={(e) => setNewZelador((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Nome do zelador"
                  />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={newZelador.email}
                    onChange={(e) => setNewZelador((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="zelador@email.com"
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={newZelador.phone}
                    onChange={(e) => setNewZelador((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddZelador} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
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
                  {condominiums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>Zeladores cadastrados</CardTitle>
            <CardDescription>
              {filteredZeladores.length} zelador{filteredZeladores.length !== 1 ? "es" : ""} encontrado{filteredZeladores.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredZeladores.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum zelador encontrado</h3>
                <p className="text-muted-foreground mt-2">Cadastre o primeiro zelador clicando no botão acima</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Condomínio</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredZeladores.map((zelador) => (
                      <TableRow key={zelador.id}>
                        <TableCell className="font-medium">
                          {zelador.profile?.full_name || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {zelador.profile?.email || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {zelador.profile?.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {zelador.profile.phone}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Building2 className="w-3 h-3" />
                            {zelador.condominium?.name || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(zelador.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
                                <AlertDialogTitle>Remover zelador</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover <strong>{zelador.profile?.full_name}</strong> do condomínio <strong>{zelador.condominium?.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteZelador(zelador)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

        {/* Success Dialog */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zelador cadastrado com sucesso! ✅</DialogTitle>
              <DialogDescription>
                Anote as credenciais de acesso do zelador
              </DialogDescription>
            </DialogHeader>
            {successData && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <p><strong>Nome:</strong> {successData.full_name}</p>
                  <p><strong>E-mail:</strong> {successData.email}</p>
                  {successData.password && (
                    <div className="flex items-center gap-2">
                      <p><strong>Senha:</strong> {successData.password}</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyPassword}>
                        {passwordCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  ⚠️ Envie essas credenciais ao zelador. Ele poderá alterá-las no primeiro acesso.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setSuccessDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
