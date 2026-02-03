import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { TemplateEditor } from "./TemplateEditor";

interface ButtonConfig {
  type: "url" | "quick_reply" | "call";
  text: string;
  url_base?: string;
  has_dynamic_suffix?: boolean;
}

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
  button_config?: ButtonConfig | null;
}

interface TemplateEditorDialogProps {
  template: Template | null;
  onClose: () => void;
}

export function TemplateEditorDialog({ template, onClose }: TemplateEditorDialogProps) {
  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
        {template && (
          <TemplateEditor
            template={template}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
