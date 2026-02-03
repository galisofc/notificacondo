import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  LinkIcon,
  Settings,
  ChevronRight,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  MessageSquare,
} from "lucide-react";
import { TEMPLATE_CATEGORIES, getCategoryForSlug } from "./TemplateCategories";
import { TemplateDetailSheet } from "./TemplateDetailSheet";
import { WabaTemplateSubmitDialog } from "./WabaTemplateSubmitDialog";
import { TemplateEditor } from "./TemplateEditor";

interface LocalTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  waba_template_name: string | null;
  waba_language: string | null;
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  quality_score?: string;
  rejected_reason?: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; text?: string; url?: string }>;
  }>;
}

export function TemplateGrid() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<LocalTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<LocalTemplate | null>(null);
  const [submittingTemplate, setSubmittingTemplate] = useState<LocalTemplate | null>(null);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Query local templates
  const { data: localTemplates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates-grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as LocalTemplate[];
    },
  });

  // Load Meta templates
  const loadMetaTemplates = async () => {
    setIsLoadingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      if (data?.success) {
        setMetaTemplates(data.templates || []);
        toast({
          title: "Templates atualizados",
          description: `${data.templates?.length || 0} templates carregados da Meta`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao carregar templates",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingMeta(false);
    }
  };

  // Auto-sync templates
  const handleAutoSync = async () => {
    setIsSyncing(true);
    try {
      // First load fresh meta templates
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      
      const freshMeta = data?.templates || [];
      setMetaTemplates(freshMeta);
      
      const approvedMeta = freshMeta.filter((t: MetaTemplate) => t.status === "APPROVED");
      const localUnlinked = localTemplates?.filter(t => !t.waba_template_name) || [];
      
      // Mapeamento explícito
      const TEMPLATE_MAPPING: Record<string, string> = {
        "package_arrival": "encomenda_management_5",
        "notification_occurrence": "notificacao_ocorrencia",
        "notify_sindico_defense": "nova_defesa",
      };
      
      let successCount = 0;
      for (const local of localUnlinked) {
        const explicitMapping = TEMPLATE_MAPPING[local.slug];
        let matchedMeta: MetaTemplate | undefined;
        
        if (explicitMapping) {
          matchedMeta = approvedMeta.find((m: MetaTemplate) => m.name === explicitMapping);
        }
        
        if (!matchedMeta) {
          matchedMeta = approvedMeta.find((meta: MetaTemplate) => {
            const metaName = meta.name.toLowerCase();
            const slug = local.slug.toLowerCase();
            return metaName === slug || metaName.includes(slug) || slug.includes(metaName);
          });
        }
        
        if (matchedMeta) {
          const { error: updateError } = await supabase
            .from("whatsapp_templates")
            .update({
              waba_template_name: matchedMeta.name,
              waba_language: matchedMeta.language,
            })
            .eq("id", local.id);
          
          if (!updateError) successCount++;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
      
      toast({
        title: "✅ Sincronização concluída!",
        description: successCount > 0 
          ? `${successCount} template(s) vinculado(s) automaticamente`
          : "Nenhum novo template para vincular",
      });
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Find Meta template
  const findMetaTemplate = (wabaName: string | null): MetaTemplate | undefined => {
    if (!wabaName) return undefined;
    return metaTemplates.find(t => t.name === wabaName);
  };

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let templates = localTemplates || [];
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.slug.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by tab
    if (activeTab === "linked") {
      templates = templates.filter(t => t.waba_template_name);
    } else if (activeTab === "unlinked") {
      templates = templates.filter(t => !t.waba_template_name);
    } else if (activeTab !== "all") {
      const category = TEMPLATE_CATEGORIES.find(c => c.id === activeTab);
      if (category) {
        templates = templates.filter(t => category.slugs.includes(t.slug));
      }
    }
    
    return templates;
  }, [localTemplates, search, activeTab]);

  // Stats
  const linkedCount = localTemplates?.filter(t => t.waba_template_name).length || 0;
  const unlinkedCount = localTemplates?.filter(t => !t.waba_template_name).length || 0;
  const totalCount = localTemplates?.length || 0;

  const getStatusIcon = (template: LocalTemplate) => {
    const meta = findMetaTemplate(template.waba_template_name);
    if (!template.waba_template_name) {
      return <LinkIcon className="h-4 w-4 text-muted-foreground" />;
    }
    if (!meta) {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    if (meta.status === "APPROVED") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (meta.status === "PENDING") {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getQualityBadge = (template: LocalTemplate) => {
    const meta = findMetaTemplate(template.waba_template_name);
    if (!meta?.quality_score) return null;
    
    const config = {
      GREEN: { icon: ShieldCheck, color: "text-green-600 border-green-500/30 bg-green-500/10", label: "Alta" },
      YELLOW: { icon: ShieldAlert, color: "text-yellow-600 border-yellow-500/30 bg-yellow-500/10", label: "Média" },
      RED: { icon: ShieldX, color: "text-red-600 border-red-500/30 bg-red-500/10", label: "Baixa" },
    }[meta.quality_score];
    
    if (!config) return null;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total de Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Link2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{linkedCount}</p>
                <p className="text-xs text-muted-foreground">Vinculados à Meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <LinkIcon className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{unlinkedCount}</p>
                <p className="text-xs text-muted-foreground">Não Vinculados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{metaTemplates.length}</p>
                <p className="text-xs text-muted-foreground">Templates na Meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Gerenciar Templates
              </CardTitle>
              <CardDescription>
                Configure e vincule templates de mensagens WhatsApp
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMetaTemplates}
                disabled={isLoadingMeta}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingMeta ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar Meta</span>
              </Button>
              <Button
                size="sm"
                onClick={handleAutoSync}
                disabled={isSyncing}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Tabs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="all" className="gap-2">
                Todos
                <Badge variant="secondary" className="ml-1">{totalCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="linked" className="gap-2">
                Vinculados
                <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600">{linkedCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="unlinked" className="gap-2">
                Não Vinculados
                <Badge variant="secondary" className="ml-1 bg-amber-500/20 text-amber-600">{unlinkedCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum template encontrado</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredTemplates.map((template) => {
                    const category = getCategoryForSlug(template.slug);
                    const meta = findMetaTemplate(template.waba_template_name);
                    const CategoryIcon = category?.icon;
                    
                    return (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`
                          group relative flex items-center gap-4 p-4 rounded-lg border cursor-pointer
                          transition-all duration-200 hover:shadow-md
                          ${template.waba_template_name 
                            ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50" 
                            : "border-border hover:border-primary/30 hover:bg-muted/30"
                          }
                        `}
                      >
                        {/* Category Icon */}
                        <div className={`
                          shrink-0 p-2.5 rounded-lg
                          ${category ? `${category.bgColor} ${category.color}` : "bg-muted text-muted-foreground"}
                        `}>
                          {CategoryIcon ? <CategoryIcon className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{template.name}</span>
                            {template.waba_template_name ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                                WABA
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Não vinculado
                              </Badge>
                            )}
                            {meta?.status === "PENDING" && (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs gap-1">
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                            {meta?.status === "REJECTED" && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs gap-1">
                                <XCircle className="h-3 w-3" />
                                Rejeitado
                              </Badge>
                            )}
                            {getQualityBadge(template)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {template.description || template.content.slice(0, 60) + "..."}
                          </p>
                          {template.waba_template_name && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              Meta: {template.waba_template_name}
                            </p>
                          )}
                        </div>

                        {/* Status Icon */}
                        <div className="shrink-0 flex items-center gap-2">
                          {getStatusIcon(template)}
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <TemplateDetailSheet
        template={selectedTemplate}
        metaTemplate={selectedTemplate ? findMetaTemplate(selectedTemplate.waba_template_name) : undefined}
        onClose={() => setSelectedTemplate(null)}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
          loadMetaTemplates();
        }}
        onEdit={(template) => {
          setSelectedTemplate(null);
          setEditingTemplate(template);
        }}
        onSubmitToMeta={(template) => {
          setSelectedTemplate(null);
          setSubmittingTemplate(template);
        }}
      />

      {/* Template Editor Sheet */}
      <Sheet open={!!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
          setEditingTemplate(null);
        }
      }}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-hidden"
        >
          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate}
              onClose={() => {
                queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-grid"] });
                setEditingTemplate(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Submit to Meta Dialog */}
      <WabaTemplateSubmitDialog
        open={!!submittingTemplate}
        onOpenChange={(open) => !open && setSubmittingTemplate(null)}
        onTemplateLinked={() => {
          setSubmittingTemplate(null);
          loadMetaTemplates();
          handleAutoSync();
        }}
      />
    </>
  );
}
