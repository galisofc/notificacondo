import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  Check,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";

interface WabaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  components?: any[];
}

interface WabaTemplateSelectorProps {
  currentTemplateName: string | null;
  onSelect: (templateName: string, language: string) => void;
  disabled?: boolean;
}

const getStatusBadge = (status: string) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Aprovado
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs gap-1">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Rejeitado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
};

export function WabaTemplateSelector({
  currentTemplateName,
  onSelect,
  disabled,
}: WabaTemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["waba-templates-list"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("list-waba-templates", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) {
        throw new Error(response.data?.error || "Erro ao listar templates");
      }

      return response.data.templates as WabaTemplate[];
    },
    enabled: open,
    staleTime: 60000, // 1 minute
  });

  // Filter templates based on search
  const filteredTemplates = data?.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Group by status
  const approvedTemplates = filteredTemplates.filter(
    (t) => t.status?.toUpperCase() === "APPROVED"
  );

  const handleSelect = (template: WabaTemplate) => {
    onSelect(template.name, template.language);
    setOpen(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          {currentTemplateName ? (
            <>
              <ArrowRight className="h-4 w-4" />
              Trocar Template
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Selecionar da Meta
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Selecionar Template WABA
            {currentTemplateName && (
              <Badge variant="secondary" className="font-mono text-xs">
                Atual: {currentTemplateName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Escolha um template aprovado na Meta para vincular a este template local.
            Apenas templates com status "Aprovado" podem ser utilizados para envio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Erro ao carregar templates"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4"
              >
                Tentar novamente
              </Button>
            </div>
          ) : approvedTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Nenhum template aprovado encontrado com este nome"
                  : "Nenhum template aprovado disponível"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {approvedTemplates.map((template) => {
                const isCurrentTemplate = template.name === currentTemplateName;
                
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isCurrentTemplate
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium truncate">
                            {template.name}
                          </span>
                          {isCurrentTemplate && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {template.language}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {template.category}
                          </Badge>
                          {template.quality_score && (
                            <Badge variant="outline" className="text-[10px]">
                              Qualidade: {template.quality_score}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(template.status)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {data && data.length > approvedTemplates.length && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Mostrando apenas {approvedTemplates.length} templates aprovados de {data.length} total
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
