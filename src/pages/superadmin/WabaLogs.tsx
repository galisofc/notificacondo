import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WabaApprovedTemplates } from "@/components/superadmin/WabaApprovedTemplates";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Copy,
  Check,
  Clock,
  Phone,
  FileCode2,
  AlertTriangle,
  Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface WabaLogRow {
  id: string;
  created_at: string;
  function_name: string;
  package_id: string | null;
  resident_id: string | null;
  phone: string | null;
  template_name: string | null;
  template_language: string | null;
  request_payload: Record<string, unknown> | null;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  message_id: string | null;
  error_message: string | null;
  debug_info: Record<string, unknown> | null;
}

type FilterStatus = "all" | "success" | "error";

// Component to display formatted JSON with syntax highlighting
function JsonViewer({ data, maxHeight = "400px" }: { data: unknown; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);
  
  const jsonString = JSON.stringify(data, null, 2);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success("JSON copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting
  const highlightJson = (json: string) => {
    return json
      .replace(/"([^"]+)":/g, '<span class="text-blue-500 dark:text-blue-400">"$1"</span>:')
      .replace(/: "([^"]*)"(,?)/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>$2')
      .replace(/: (\d+)(,?)/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>$2')
      .replace(/: (true|false)(,?)/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>$2')
      .replace(/: (null)(,?)/g, ': <span class="text-gray-400">$1</span>$2');
  };

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={copyToClipboard}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <ScrollArea style={{ maxHeight }} className="w-full">
        <pre 
          className="text-xs font-mono p-4 bg-muted/50 rounded-lg overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: highlightJson(jsonString) }}
        />
      </ScrollArea>
    </div>
  );
}

// Component for a single log item
function LogItem({ log }: { log: WabaLogRow }) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract image URL from payload if present
  const getImageUrl = (): string | null => {
    try {
      const payload = log.request_payload as Record<string, unknown>;
      const templateData = payload?.templateData as Record<string, unknown>;
      const template = templateData?.template as Record<string, unknown>;
      const components = template?.components as Array<Record<string, unknown>>;
      const headerComponent = components?.find((c) => c.type === "header");
      const parameters = headerComponent?.parameters as Array<Record<string, unknown>>;
      const imageParam = parameters?.find((p) => p.type === "image");
      const image = imageParam?.image as Record<string, string>;
      return image?.link || null;
    } catch {
      return null;
    }
  };

  // Extract body parameters from payload
  const getBodyParams = (): string[] => {
    try {
      const payload = log.request_payload as Record<string, unknown>;
      const templateData = payload?.templateData as Record<string, unknown>;
      const template = templateData?.template as Record<string, unknown>;
      const components = template?.components as Array<Record<string, unknown>>;
      const bodyComponent = components?.find((c) => c.type === "body");
      const parameters = bodyComponent?.parameters as Array<Record<string, unknown>>;
      return parameters?.map((p) => String(p.text || "")) || [];
    } catch {
      return [];
    }
  };

  const imageUrl = getImageUrl();
  const bodyParams = getBodyParams();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div 
        className={`border rounded-lg overflow-hidden transition-all ${
          log.success 
            ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10' 
            : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
        }`}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {log.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {log.template_name || "Template desconhecido"}
                    </span>
                    {log.response_status && (
                      <Badge 
                        variant={log.response_status < 400 ? "outline" : "destructive"} 
                        className="text-xs font-mono"
                      >
                        HTTP {log.response_status}
                      </Badge>
                    )}
                    {imageUrl && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Image className="h-3 w-3" />
                        Com imagem
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {log.phone || "N/A"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCode2 className="h-3 w-3" />
                      {log.function_name}
                    </span>
                  </div>
                  
                  {!log.success && log.error_message && (
                    <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <span className="text-xs text-destructive font-medium line-clamp-2">
                        {log.error_message.substring(0, 200)}
                        {log.error_message.length > 200 && "..."}
                      </span>
                    </div>
                  )}
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
          <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data/Hora</div>
                <div className="text-sm font-medium mt-0.5">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Idioma</div>
                <div className="text-sm font-medium mt-0.5">{log.template_language || "N/A"}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Message ID</div>
                <div className="text-xs font-mono mt-0.5 truncate">{log.message_id || "N/A"}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Package ID</div>
                <div className="text-xs font-mono mt-0.5 truncate">{log.package_id || "N/A"}</div>
              </div>
            </div>

            {/* Image Preview if present */}
            {imageUrl && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" />
                  Imagem do Header
                </div>
                <div className="flex items-start gap-4">
                  <img 
                    src={imageUrl} 
                    alt="Header da encomenda" 
                    className="w-24 h-24 object-cover rounded-lg border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">URL</div>
                    <code className="text-xs bg-muted p-2 rounded block break-all">{imageUrl}</code>
                  </div>
                </div>
              </div>
            )}

            {/* Body Parameters Preview */}
            {bodyParams.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Parâmetros do Body ({bodyParams.length})</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {bodyParams.map((param, idx) => (
                    <div key={idx} className="bg-muted/50 rounded px-2 py-1.5 text-xs">
                      <span className="text-muted-foreground font-mono">#{idx + 1}:</span>{" "}
                      <span className="font-medium">{param || "(vazio)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs for detailed views */}
            <Tabs defaultValue="payload" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="payload" className="text-xs">
                  Request Payload
                </TabsTrigger>
                <TabsTrigger value="response" className="text-xs">
                  Response
                </TabsTrigger>
                <TabsTrigger value="debug" className="text-xs">
                  Debug Info
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="payload" className="mt-3">
                {log.request_payload ? (
                  <JsonViewer data={log.request_payload} />
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhum payload disponível
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="response" className="mt-3 space-y-3">
                {log.response_body ? (
                  <>
                    <div className="text-xs font-medium text-muted-foreground">Response Body</div>
                    <div className="relative group">
                      <ScrollArea className="max-h-[300px]">
                        <pre className="text-xs font-mono p-4 bg-muted/50 rounded-lg whitespace-pre-wrap break-all">
                          {log.response_body}
                        </pre>
                      </ScrollArea>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhuma resposta disponível
                  </div>
                )}

                {log.error_message && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <div className="text-xs font-medium text-destructive mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Mensagem de Erro Completa
                    </div>
                    <ScrollArea className="max-h-[200px]">
                      <pre className="text-xs text-destructive whitespace-pre-wrap break-all font-mono">
                        {log.error_message}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="debug" className="mt-3">
                {log.debug_info ? (
                  <JsonViewer data={log.debug_info} />
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhuma informação de debug disponível
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function WabaLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  
  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["waba-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as WabaLogRow[];
    },
    refetchInterval: 15000,
  });

  // Filter logs based on search and status
  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = searchTerm === "" || 
      log.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.phone?.includes(searchTerm) ||
      log.error_message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.function_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "success" && log.success) ||
      (statusFilter === "error" && !log.success);
    
    return matchesSearch && matchesStatus;
  }) || [];

  const successCount = logs?.filter(l => l.success).length || 0;
  const failCount = logs?.filter(l => !l.success).length || 0;

  return (
    <DashboardLayout>
      <Helmet>
        <title>Logs WABA | Super Admin</title>
      </Helmet>
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        <SuperAdminBreadcrumbs items={[
          { label: "Logs", href: "/superadmin/logs" },
          { label: "WABA (WhatsApp Business)" }
        ]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl md:text-3xl font-bold text-foreground">Logs WABA</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Histórico de notificações via WhatsApp Business API
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Templates aprovados da Meta */}
        <WabaApprovedTemplates />

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'success' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'success' ? 'all' : 'success')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Enviados com sucesso</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'error' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'error' ? 'all' : 'error')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{failCount}</div>
                  <div className="text-xs text-muted-foreground">Falhas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por template, telefone, erro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">Apenas sucesso</SelectItem>
                  <SelectItem value="error">Apenas erros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Logs de Envio WABA
              </span>
              <Badge variant="secondary" className="font-normal">
                {filteredLogs.length} de {logs?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum log encontrado</p>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => setSearchTerm("")}
                    className="mt-2"
                  >
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <LogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
