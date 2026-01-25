import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useViewModePreference } from "@/hooks/useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Loader2, Search, MessageCircle, Info, LayoutGrid, List, Upload } from "lucide-react";
import { TEMPLATE_CATEGORIES, getCategoryForSlug, type TemplateCategory } from "./TemplateCategories";
import { TemplateCard } from "./TemplateCard";
import { TemplateEditor } from "./TemplateEditor";
import { WabaTemplateSubmitDialog } from "./WabaTemplateSubmitDialog";
interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  waba_template_name?: string | null;
  waba_language?: string | null;
  params_order?: string[] | null;
}

export function TemplatesList() {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showWabaDialog, setShowWabaDialog] = useState(false);
  const [viewMode, setViewMode] = useViewModePreference("whatsappTemplatesViewMode", "grid" as "grid" | "list");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Template[];
    },
  });

  // Filter templates
  const filteredTemplates = templates?.filter((template) => {
    // Category filter
    if (selectedCategory !== "all") {
      const category = TEMPLATE_CATEGORIES.find(c => c.id === selectedCategory);
      if (category && !category.slugs.includes(template.slug)) {
        return false;
      }
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group templates by category
  const groupedTemplates = TEMPLATE_CATEGORIES.reduce((acc, category) => {
    const categoryTemplates = filteredTemplates?.filter(t => 
      category.slugs.includes(t.slug)
    ) || [];
    if (categoryTemplates.length > 0) {
      acc[category.id] = categoryTemplates;
    }
    return acc;
  }, {} as Record<string, Template[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Templates de Mensagem</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Gerencie os templates enviadas via WhatsApp
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWabaDialog(true)}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gerenciar</span> WABA
              </Button>
              <Badge variant="secondary">
                {templates?.length || 0} templates
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          {/* Info Banner - collapsible on mobile */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2 sm:gap-3">
            <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-medium text-blue-500 mb-1">Como usar variáveis</p>
              <p className="text-muted-foreground">
                Use <code className="bg-muted px-1 rounded text-xs">{"{nome}"}</code> para dados dinâmicos e <code className="bg-muted px-1 rounded text-xs">*texto*</code> para negrito.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 sm:h-10"
              />
            </div>
            <div className="flex gap-2 self-end">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category Tabs - Wrapping layout */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex flex-wrap h-auto gap-1.5 sm:gap-2 bg-transparent p-0">
              <TabsTrigger 
                value="all" 
                className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
              >
                Todos
              </TabsTrigger>
              {TEMPLATE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const count = templates?.filter(t => category.slugs.includes(t.slug)).length || 0;
                return (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
                  >
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>{category.name}</span>
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="mt-4 sm:mt-6">
              {/* Show grouped by category */}
              <div className="space-y-6 sm:space-y-8">
                {TEMPLATE_CATEGORIES.map((category) => {
                  const categoryTemplates = groupedTemplates[category.id];
                  if (!categoryTemplates?.length) return null;

                  const Icon = category.icon;
                  return (
                    <div key={category.id}>
                      <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                        <div className={`p-1.5 rounded-lg ${category.bgColor}`}>
                          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${category.color}`} />
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base">{category.name}</h3>
                        <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                          {category.description}
                        </span>
                      </div>
                      <div className={viewMode === "grid" 
                        ? "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2" 
                        : "space-y-3"
                      }>
                        {categoryTemplates.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onEdit={setEditingTemplate}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Individual category tabs */}
            {TEMPLATE_CATEGORIES.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-4 sm:mt-6">
                <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                  <div className={`p-1.5 rounded-lg ${category.bgColor}`}>
                    <category.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${category.color}`} />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base">{category.name}</h3>
                  <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                    {category.description}
                  </span>
                </div>
                <div className={viewMode === "grid" 
                  ? "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2" 
                  : "space-y-3"
                }>
                  {groupedTemplates[category.id]?.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={setEditingTemplate}
                    />
                  ))}
                </div>
                {!groupedTemplates[category.id]?.length && (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                    Nenhum template encontrado nesta categoria
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Template Editor Sheet */}
      <Sheet open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <SheetContent side="right" className="w-full max-w-full sm:max-w-2xl lg:max-w-4xl p-0">
          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate}
              onClose={() => setEditingTemplate(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* WABA Template Dialog */}
      <WabaTemplateSubmitDialog
        open={showWabaDialog}
        onOpenChange={setShowWabaDialog}
        onTemplateLinked={(name, language) => {
          // If editing a template, update the WABA fields
          if (editingTemplate) {
            setEditingTemplate({
              ...editingTemplate,
              waba_template_name: name,
              waba_language: language,
            });
          }
        }}
      />
    </>
  );
}
