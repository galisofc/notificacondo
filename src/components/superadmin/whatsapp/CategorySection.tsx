import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TemplateCategory } from "./TemplateCategories";
import { TemplateCard } from "./TemplateCard";

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
}

interface CategorySectionProps {
  category: TemplateCategory;
  templates: LocalTemplate[];
  metaTemplates: MetaTemplate[];
  onEdit: (template: LocalTemplate) => void;
  onView: (template: LocalTemplate) => void;
  onSubmitToMeta: (template: LocalTemplate) => void;
  defaultOpen?: boolean;
}

export function CategorySection({
  category,
  templates,
  metaTemplates,
  onEdit,
  onView,
  onSubmitToMeta,
  defaultOpen = true,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const Icon = category.icon;
  
  const linkedCount = templates.filter(t => t.waba_template_name).length;
  
  const findMetaTemplate = (wabaName: string | null) => {
    if (!wabaName) return undefined;
    return metaTemplates.find(t => t.name === wabaName);
  };

  if (templates.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-xl border ${category.borderColor} overflow-hidden`}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-between h-auto p-4 rounded-none hover:bg-transparent ${category.bgColor}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-background/80 ${category.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-sm">{category.name}</h3>
                <p className="text-xs text-muted-foreground font-normal">
                  {category.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {templates.length} template{templates.length > 1 ? "s" : ""}
                </Badge>
                {linkedCount > 0 && (
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
                    {linkedCount} vinculado{linkedCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                metaTemplate={findMetaTemplate(template.waba_template_name)}
                onEdit={onEdit}
                onView={onView}
                onSubmitToMeta={onSubmitToMeta}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
