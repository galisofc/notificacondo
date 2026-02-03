import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  LinkIcon,
  Pencil,
  Send,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  MessageSquare,
} from "lucide-react";
import { getCategoryForSlug } from "./TemplateCategories";

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

interface TemplateCardProps {
  template: LocalTemplate;
  metaTemplate?: MetaTemplate;
  onEdit: (template: LocalTemplate) => void;
  onView: (template: LocalTemplate) => void;
  onSubmitToMeta: (template: LocalTemplate) => void;
}

export function TemplateCard({ 
  template, 
  metaTemplate,
  onEdit, 
  onView,
  onSubmitToMeta 
}: TemplateCardProps) {
  const category = getCategoryForSlug(template.slug);
  const CategoryIcon = category?.icon || MessageSquare;
  const isLinked = !!template.waba_template_name;
  
  const getQualityIcon = () => {
    if (!metaTemplate?.quality_score) return null;
    
    const config = {
      GREEN: { icon: ShieldCheck, color: "text-green-500" },
      YELLOW: { icon: ShieldAlert, color: "text-yellow-500" },
      RED: { icon: ShieldX, color: "text-red-500" },
    }[metaTemplate.quality_score];
    
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  const getStatusBadge = () => {
    if (!template.waba_template_name) {
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <LinkIcon className="h-3 w-3" />
          Não vinculado
        </Badge>
      );
    }
    
    if (!metaTemplate) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
          <CheckCircle className="h-3 w-3" />
          WABA
        </Badge>
      );
    }
    
    // Status: PENDING - aguardando aprovação inicial
    if (metaTemplate.status === "PENDING") {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs gap-1">
          <Clock className="h-3 w-3 animate-pulse" />
          Em Análise
        </Badge>
      );
    }
    
    // Status: IN_APPEAL - em recurso após rejeição
    if (metaTemplate.status === "IN_APPEAL") {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs gap-1">
          <Clock className="h-3 w-3 animate-pulse" />
          Em Recurso
        </Badge>
      );
    }
    
    // Status: REJECTED
    if (metaTemplate.status === "REJECTED") {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Rejeitado
        </Badge>
      );
    }
    
    // Status: DISABLED
    if (metaTemplate.status === "DISABLED") {
      return (
        <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Desativado
        </Badge>
      );
    }
    
    // Status: APPROVED (default para status válidos)
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
        <CheckCircle className="h-3 w-3" />
        Aprovado
      </Badge>
    );
  };

  return (
    <Card className={`group transition-all duration-200 hover:shadow-lg ${
      isLinked 
        ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent" 
        : "hover:border-primary/30"
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`
            shrink-0 p-2.5 rounded-xl transition-transform group-hover:scale-110
            ${category ? `${category.bgColor}` : "bg-muted"}
          `}>
            <CategoryIcon className={`h-5 w-5 ${category?.color || "text-muted-foreground"}`} />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{template.name}</h3>
              {getQualityIcon()}
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {template.description || template.content.slice(0, 80) + "..."}
            </p>
            
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {getStatusBadge()}
              {template.waba_template_name && (
                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                  {template.waba_template_name}
                </span>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(template);
                }}
              >
                <Eye className="h-3 w-3" />
                Ver
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
              >
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
              {!isLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSubmitToMeta(template);
                  }}
                >
                  <Send className="h-3 w-3" />
                  Meta
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
