import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDateFormatter } from "@/hooks/useFormattedDate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Eye,
  Loader2,
  Search,
  FileWarning,
  Bell,
  DollarSign,
  Building2,
  Calendar,
} from "lucide-react";
import BlockApartmentDisplay from "@/components/common/BlockApartmentDisplay";

interface Condominium {
  id: string;
  name: string;
}

interface Block {
  id: string;
  condominium_id: string;
  name: string;
}

interface Apartment {
  id: string;
  block_id: string;
  number: string;
}

interface OccurrenceRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  occurred_at: string;
  blocks?: { name: string } | null;
  apartments?: { number: string } | null;
  residents?: { full_name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  registrada: "Registrada",
  notificado: "Notificado",
  em_defesa: "Em Defesa",
  arquivada: "Arquivada",
  advertido: "Advertido",
  multado: "Multado",
};

const STATUS_STYLES: Record<string, string> = {
  registrada: "bg-blue-500/10 text-blue-500",
  notificado: "bg-amber-500/10 text-amber-500",
  em_defesa: "bg-purple-500/10 text-purple-500",
  arquivada: "bg-muted text-muted-foreground",
  advertido: "bg-orange-500/10 text-orange-500",
  multado: "bg-red-500/10 text-red-500",
};

const TYPE_LABELS: Record<string, string> = {
  advertencia: "Advertência",
  notificacao: "Notificação",
  multa: "Multa",
};

const TYPE_STYLES: Record<string, string> = {
  advertencia: "bg-amber-500/10 text-amber-500",
  notificacao: "bg-blue-500/10 text-blue-500",
  multa: "bg-red-500/10 text-red-500",
};

export default function UnitHistoryTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { date: formatDate } = useDateFormatter();

  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedCondo, setSelectedCondo] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [selectedApartment, setSelectedApartment] = useState<string>("");
  const [occurrences, setOccurrences] = useState<OccurrenceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch condos, blocks, apartments
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: condos } = await supabase
        .from("condominiums")
        .select("id, name")
        .eq("owner_id", user.id);
      setCondominiums(condos || []);

      if (condos && condos.length > 0) {
        const condoIds = condos.map((c) => c.id);
        const { data: blocksData } = await supabase
          .from("blocks")
          .select("id, condominium_id, name")
          .in("condominium_id", condoIds);
        setBlocks(blocksData || []);

        if (blocksData && blocksData.length > 0) {
          const blockIds = blocksData.map((b) => b.id);
          const { data: aptsData } = await supabase
            .from("apartments")
            .select("id, block_id, number")
            .in("block_id", blockIds);
          setApartments(aptsData || []);
        }
      }
      setInitialLoading(false);
    })();
  }, [user]);

  const filteredBlocks = useMemo(
    () => blocks.filter((b) => b.condominium_id === selectedCondo),
    [blocks, selectedCondo]
  );

  const filteredApartments = useMemo(
    () => apartments.filter((a) => a.block_id === selectedBlock),
    [apartments, selectedBlock]
  );

  // Fetch occurrences when apartment is selected
  useEffect(() => {
    if (!selectedApartment) {
      setOccurrences([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("occurrences")
        .select(`
          id, title, type, status, created_at, occurred_at,
          blocks(name),
          apartments(number),
          residents(full_name)
        `)
        .eq("apartment_id", selectedApartment)
        .order("created_at", { ascending: false });
      setOccurrences(data || []);
      setLoading(false);
    })();
  }, [selectedApartment]);

  // Counters
  const counts = useMemo(() => {
    const c = { advertencia: 0, notificacao: 0, multa: 0, total: 0 };
    occurrences.forEach((o) => {
      c.total++;
      if (o.type in c) c[o.type as keyof Omit<typeof c, "total">]++;
    });
    return c;
  }, [occurrences]);

  const handleCondoChange = (val: string) => {
    setSelectedCondo(val);
    setSelectedBlock("");
    setSelectedApartment("");
    setOccurrences([]);
  };

  const handleBlockChange = (val: string) => {
    setSelectedBlock(val);
    setSelectedApartment("");
    setOccurrences([]);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            Consultar Unidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={selectedCondo} onValueChange={handleCondoChange}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o condomínio" />
              </SelectTrigger>
              <SelectContent>
                {condominiums.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedBlock}
              onValueChange={handleBlockChange}
              disabled={!selectedCondo}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o bloco" />
              </SelectTrigger>
              <SelectContent>
                {filteredBlocks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedApartment}
              onValueChange={setSelectedApartment}
              disabled={!selectedBlock}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {filteredApartments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>Unidade {a.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedApartment && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{counts.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Advertências</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.advertencia}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notificações</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.notificacao}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Multas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.multa}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* No apartment selected */}
      {!selectedApartment && !loading && (
        <div className="text-center py-8 md:py-12 px-4 rounded-2xl bg-card border border-border shadow-card">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 md:w-8 md:h-8 text-primary" />
          </div>
          <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
            Selecione uma unidade
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Escolha o condomínio, bloco e unidade para consultar o histórico de ocorrências.
          </p>
        </div>
      )}

      {/* Results Table */}
      {selectedApartment && !loading && occurrences.length === 0 && (
        <div className="text-center py-8 md:py-12 px-4 rounded-2xl bg-card border border-border shadow-card">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <FileWarning className="w-7 h-7 md:w-8 md:h-8 text-emerald-500" />
          </div>
          <h3 className="font-display text-lg md:text-xl font-semibold text-foreground mb-2">
            Nenhuma ocorrência
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Esta unidade não possui nenhuma ocorrência registrada.
          </p>
        </div>
      )}

      {selectedApartment && !loading && occurrences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ocorrências da Unidade
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {occurrences.length} registro{occurrences.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile view */}
            <div className="block md:hidden space-y-3 p-4">
              {occurrences.map((occ) => (
                <div
                  key={occ.id}
                  className="p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[occ.type]}`}>
                      {TYPE_LABELS[occ.type] || occ.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[occ.status]}`}>
                      {STATUS_LABELS[occ.status] || occ.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate mb-1">{occ.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(occ.occurred_at)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => navigate(`/occurrences/${occ.id}`)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Ver
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Morador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occurrences.map((occ) => (
                    <TableRow key={occ.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(occ.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[occ.type]}`}>
                          {TYPE_LABELS[occ.type] || occ.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {occ.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {occ.residents?.full_name || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[occ.status]}`}>
                          {STATUS_LABELS[occ.status] || occ.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => navigate(`/occurrences/${occ.id}`)}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
