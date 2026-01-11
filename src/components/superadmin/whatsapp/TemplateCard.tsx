import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Eye } from "lucide-react";
import { TEMPLATE_COLORS, VARIABLE_EXAMPLES } from "./TemplateCategories";

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
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
    .slice(0, 120);

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={colorClass} variant="outline">
                {template.name}
              </Badge>
              {!template.is_active && (
                <Badge variant="secondary" className="text-xs">Inativo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
              {template.description}
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs font-mono text-muted-foreground line-clamp-2">
                {previewText}...
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {template.variables.slice(0, 4).map((variable) => (
                <Badge key={variable} variant="outline" className="text-xs py-0">
                  {`{${variable}}`}
                </Badge>
              ))}
              {template.variables.length > 4 && (
                <Badge variant="outline" className="text-xs py-0">
                  +{template.variables.length - 4}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(template)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
