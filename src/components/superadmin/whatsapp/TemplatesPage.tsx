import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  RefreshCw,
  Link2,
  LinkIcon,
  Zap,
  MessageSquare,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { TEMPLATE_CATEGORIES, getCategoryForSlug } from "./TemplateCategories";
import { CategorySection } from "./CategorySection";
import { TemplateCard } from "./TemplateCard";
import { TemplateDetailSheet } from "./TemplateDetailSheet";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { WabaTemplateSubmitDialog } from "./WabaTemplateSubmitDialog";

interface ButtonConfig {
  type: "url" | "quick_reply" | "call";
  text: string;
  url_base?: string;
  has_dynamic_suffix?: boolean;
}

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
  params_order?: string[] | null;
  button_config?: ButtonConfig | null;
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

export function TemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"categories" | "list">("categories");
  const [filterStatus, setFilterStatus] = useState<"all" | "linked" | "unlinked">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<LocalTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<LocalTemplate | null>(null);
  const [submittingTemplate, setSubmittingTemplate] = useState<LocalTemplate | null>(null);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Query local templates
  const { data: localTemplates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as unknown as LocalTemplate[];
    },
  });

  // Auto-load Meta templates on mount
  useEffect(() => {
    const fetchMetaTemplates = async () => {
      try {
        setIsLoadingMeta(true);
        const { data, error } = await supabase.functions.invoke("list-waba-templates");
        if (error) throw error;
        if (data?.success) {
          setMetaTemplates(data.templates || []);
        }
      } catch (err) {
        console.error("Error loading Meta templates:", err);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    
    fetchMetaTemplates();
  }, []);

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
      const { data, error } = await supabase.functions.invoke("list-waba-templates");
      if (error) throw error;
      
      const freshMeta = data?.templates || [];
      setMetaTemplates(freshMeta);
      
      const approvedMeta = freshMeta.filter((t: MetaTemplate) => t.status === "APPROVED");
      const localUnlinked = localTemplates?.filter(t => !t.waba_template_name) || [];
      
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
      
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-page"] });
      
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
    
    // Filter by status
    if (filterStatus === "linked") {
      templates = templates.filter(t => t.waba_template_name);
    } else if (filterStatus === "unlinked") {
      templates = templates.filter(t => !t.waba_template_name);
    }
    
    return templates;
  }, [localTemplates, search, filterStatus]);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, LocalTemplate[]> = {};
    
    TEMPLATE_CATEGORIES.forEach(cat => {
      grouped[cat.id] = filteredTemplates.filter(t => cat.slugs.includes(t.slug));
    });
    
    // Templates not in any category
    const allCategorySlugs = TEMPLATE_CATEGORIES.flatMap(c => c.slugs);
    grouped["other"] = filteredTemplates.filter(t => !allCategorySlugs.includes(t.slug));
    
    return grouped;
  }, [filteredTemplates]);

  // Stats
  const linkedCount = localTemplates?.filter(t => t.waba_template_name).length || 0;
  const unlinkedCount = localTemplates?.filter(t => !t.waba_template_name).length || 0;
  const totalCount = localTemplates?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card 
          className={`cursor-pointer transition-all ${filterStatus === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${filterStatus === "linked" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setFilterStatus("linked")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Link2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{linkedCount}</p>
                <p className="text-xs text-muted-foreground">Vinculados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${filterStatus === "unlinked" ? "ring-2 ring-amber-500" : ""}`}
          onClick={() => setFilterStatus("unlinked")}
        >
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{metaTemplates.length}</p>
                <p className="text-xs text-muted-foreground">Na Meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "categories" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setViewMode("categories")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Categorias</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>

          {/* Actions */}
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

      {/* Filter indicator */}
      {filterStatus !== "all" && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary" className="gap-1">
            {filterStatus === "linked" ? "Vinculados" : "Não vinculados"}
            <button
              onClick={() => setFilterStatus("all")}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              ×
            </button>
          </Badge>
        </div>
      )}

      {/* Content */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum template encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou busca</p>
        </div>
      ) : viewMode === "categories" ? (
        <div className="space-y-4">
          {TEMPLATE_CATEGORIES.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              templates={templatesByCategory[category.id] || []}
              metaTemplates={metaTemplates}
              onEdit={setEditingTemplate}
              onView={setSelectedTemplate}
              onSubmitToMeta={setSubmittingTemplate}
            />
          ))}
          
          {/* Uncategorized templates */}
          {templatesByCategory["other"]?.length > 0 && (
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Outros Templates
                <Badge variant="secondary" className="text-xs ml-2">
                  {templatesByCategory["other"].length}
                </Badge>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templatesByCategory["other"].map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    metaTemplate={findMetaTemplate(template.waba_template_name)}
                    onEdit={setEditingTemplate}
                    onView={setSelectedTemplate}
                    onSubmitToMeta={setSubmittingTemplate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              metaTemplate={findMetaTemplate(template.waba_template_name)}
              onEdit={setEditingTemplate}
              onView={setSelectedTemplate}
              onSubmitToMeta={setSubmittingTemplate}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <TemplateDetailSheet
        template={selectedTemplate}
        metaTemplate={selectedTemplate ? findMetaTemplate(selectedTemplate.waba_template_name) : undefined}
        onClose={() => setSelectedTemplate(null)}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-page"] });
          loadMetaTemplates();
        }}
        onEdit={(template) => {
          setSelectedTemplate(null);
          setEditingTemplate(template as LocalTemplate);
        }}
        onSubmitToMeta={(template) => {
          setSelectedTemplate(null);
          setSubmittingTemplate(template as LocalTemplate);
        }}
      />

      {/* Template Editor Dialog (Modal) */}
      <TemplateEditorDialog
        template={editingTemplate}
        onClose={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates-page"] });
          setEditingTemplate(null);
        }}
      />

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
    </div>
  );
}
