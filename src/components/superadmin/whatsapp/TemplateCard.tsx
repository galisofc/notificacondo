import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Link2, LinkIcon } from "lucide-react";
import { TEMPLATE_COLORS, VARIABLE_EXAMPLES } from "./TemplateCategories";

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
  waba_template_name?: string | null;
}

interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
}

export function TemplateCard({ template, onEdit }: TemplateCardProps) {
  const colorClass = TEMPLATE_COLORS[template.slug] || "bg-muted text-muted-foreground";

  // Get a preview of the message (first 100 chars with variables replaced)
  const previewText = template.content
    .replace(/\{(\w+)\}/g, (match, variable) => VARIABLE_EXAMPLES[variable] || match)
    .slice(0, 100);

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer active:scale-[0.99]"
      onClick={() => onEdit(template)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <Badge className={`${colorClass} text-[10px] sm:text-xs`} variant="outline">
                {template.name}
              </Badge>
              {template.waba_template_name ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] sm:text-xs gap-1">
                  <Link2 className="h-2.5 w-2.5" />
                  WABA
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] sm:text-xs gap-1">
                  <LinkIcon className="h-2.5 w-2.5" />
                  Não vinculado
                </Badge>
              )}
              {!template.is_active && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs">Inativo</Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-1">
              {template.description}
            </p>
            <div className="p-2 sm:p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-[10px] sm:text-xs font-mono text-muted-foreground line-clamp-2">
                {previewText}...
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
              {template.variables.slice(0, 3).map((variable) => (
                <Badge key={variable} variant="outline" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5">
                  {`{${variable}}`}
                </Badge>
              ))}
              {template.variables.length > 3 && (
                <Badge variant="outline" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5">
                  +{template.variables.length - 3}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 h-8 px-2 sm:px-3"
          >
            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
