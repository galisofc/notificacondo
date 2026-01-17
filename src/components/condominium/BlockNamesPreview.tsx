import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockNamesPreviewProps {
  blockNames: string[];
  className?: string;
}

export function BlockNamesPreview({ blockNames, className }: BlockNamesPreviewProps) {
  if (blockNames.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        Defina a quantidade de blocos
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Preview dos Blocos</span>
        <span className="font-medium text-foreground">{blockNames.length} blocos</span>
      </div>
      <div className="border border-border rounded-lg p-4 bg-secondary/30 max-h-[200px] overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {blockNames.map((name, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-md text-sm font-medium"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
