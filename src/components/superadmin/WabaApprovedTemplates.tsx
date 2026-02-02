import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  AlertTriangle,
  Megaphone,
  Settings,
  Lock,
} from "lucide-react";

interface WabaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: { header_text?: string[] };
  }>;
  rejected_reason?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  APPROVED: { label: "Aprovado", variant: "default", icon: CheckCircle2 },
  PENDING: { label: "Pendente", variant: "secondary", icon: Clock },
  REJECTED: { label: "Rejeitado", variant: "destructive", icon: XCircle },
  DISABLED: { label: "Desativado", variant: "outline", icon: AlertTriangle },
};

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  UTILITY: { label: "Utilitário", icon: Settings },
  MARKETING: { label: "Marketing", icon: Megaphone },
  AUTHENTICATION: { label: "Autenticação", icon: Lock },
};

const qualityConfig: Record<string, { label: string; color: string }> = {
  HIGH: { label: "Alta", color: "text-green-600" },
  MEDIUM: { label: "Média", color: "text-yellow-600" },
  LOW: { label: "Baixa", color: "text-red-600" },
};

function TemplateCard({ template }: { template: WabaTemplate }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusInfo = statusConfig[template.status] || statusConfig.PENDING;
  const StatusIcon = statusInfo.icon;
  const categoryInfo = categoryConfig[template.category] || { label: template.category, icon: FileText };
  const CategoryIcon = categoryInfo.icon;
  const qualityInfo = template.quality_score ? qualityConfig[template.quality_score] : null;

  // Extract body text from components
  const bodyComponent = template.components?.find(c => c.type === "BODY");
  const headerComponent = template.components?.find(c => c.type === "HEADER");
  const footerComponent = template.components?.find(c => c.type === "FOOTER");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden bg-card hover:bg-muted/30 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-lg ${template.status === 'APPROVED' ? 'bg-green-500/10' : 'bg-muted'}`}>
                  <StatusIcon className={`h-4 w-4 ${template.status === 'APPROVED' ? 'text-green-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm font-mono">{template.name}</span>
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <CategoryIcon className="h-3 w-3" />
                      {categoryInfo.label}
                    </span>
                    <span>{template.language || "pt_BR"}</span>
                    {qualityInfo && (
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span className={qualityInfo.color}>Qualidade: {qualityInfo.label}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3 space-y-3">
            {headerComponent && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Header ({headerComponent.format || "TEXT"})</div>
                <div className="text-sm bg-muted/50 rounded p-2">
                  {headerComponent.text || headerComponent.example?.header_text?.[0] || `[${headerComponent.format}]`}
                </div>
              </div>
            )}
            
            {bodyComponent?.text && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Body</div>
                <div className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">
                  {bodyComponent.text}
                </div>
              </div>
            )}
            
            {footerComponent?.text && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Footer</div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {footerComponent.text}
                </div>
              </div>
            )}

            {template.rejected_reason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="text-xs font-medium text-destructive flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Motivo da Rejeição
                </div>
                <p className="text-xs text-destructive">{template.rejected_reason}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <span className="font-mono">ID: {template.id}</span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function WabaApprovedTemplates() {
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["waba-templates-meta"],
    queryFn: async () => {
      const { data: response, error } = await supabase.functions.invoke("list-waba-templates");
      
      if (error) throw error;
      if (!response?.success) {
        throw new Error(response?.error || "Erro ao listar templates");
      }
      
      return response.templates as WabaTemplate[];
    },
    staleTime: 60000, // 1 minute
  });

  const approvedCount = data?.filter(t => t.status === "APPROVED").length || 0;
  const pendingCount = data?.filter(t => t.status === "PENDING").length || 0;
  const rejectedCount = data?.filter(t => t.status === "REJECTED").length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates Aprovados na Meta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates Aprovados na Meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive font-medium">Erro ao carregar templates</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Templates na Meta
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-600">{approvedCount}</div>
            <div className="text-xs text-muted-foreground">Aprovados</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-xs text-muted-foreground">Rejeitados</div>
          </div>
        </div>

        {/* Template List */}
        {data && data.length > 0 ? (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2 pr-4">
              {data.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum template encontrado na Meta</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
