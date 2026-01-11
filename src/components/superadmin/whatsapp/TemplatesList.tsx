import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Loader2, Search, MessageCircle, Info, LayoutGrid, List } from "lucide-react";
import { TEMPLATE_CATEGORIES, getCategoryForSlug, type TemplateCategory } from "./TemplateCategories";
import { TemplateCard } from "./TemplateCard";
import { TemplateEditor } from "./TemplateEditor";

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
}

export function TemplatesList() {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Templates de Mensagem</CardTitle>
                <CardDescription>
                  Gerencie os templates de mensagens enviadas via WhatsApp
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {templates?.length || 0} templates
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Banner */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-500 mb-1">Como usar variáveis</p>
              <p className="text-muted-foreground">
                Use variáveis entre chaves para inserir dados dinâmicos. Ex:{" "}
                <code className="bg-muted px-1 rounded">{"{nome}"}</code> será substituído pelo nome do morador.
                Use <code className="bg-muted px-1 rounded">*texto*</code> para negrito.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
                    className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{category.name}</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {/* Show grouped by category */}
              <div className="space-y-8">
                {TEMPLATE_CATEGORIES.map((category) => {
                  const categoryTemplates = groupedTemplates[category.id];
                  if (!categoryTemplates?.length) return null;

                  const Icon = category.icon;
                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`p-1.5 rounded-lg ${category.bgColor}`}>
                          <Icon className={`h-4 w-4 ${category.color}`} />
                        </div>
                        <h3 className="font-semibold">{category.name}</h3>
                        <span className="text-sm text-muted-foreground">
                          {category.description}
                        </span>
                      </div>
                      <div className={viewMode === "grid" 
                        ? "grid gap-4 sm:grid-cols-2" 
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
              <TabsContent key={category.id} value={category.id} className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-1.5 rounded-lg ${category.bgColor}`}>
                    <category.icon className={`h-4 w-4 ${category.color}`} />
                  </div>
                  <h3 className="font-semibold">{category.name}</h3>
                  <span className="text-sm text-muted-foreground">
                    {category.description}
                  </span>
                </div>
                <div className={viewMode === "grid" 
                  ? "grid gap-4 sm:grid-cols-2" 
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
                  <div className="text-center py-8 text-muted-foreground">
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
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0">
          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate}
              onClose={() => setEditingTemplate(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
