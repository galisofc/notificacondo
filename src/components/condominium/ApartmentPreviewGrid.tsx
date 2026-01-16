import { cn } from "@/lib/utils";

interface ApartmentPreview {
  number: string;
  floor: number | null;
}

interface ApartmentPreviewGridProps {
  apartments: ApartmentPreview[];
  className?: string;
}

export function ApartmentPreviewGrid({ apartments, className }: ApartmentPreviewGridProps) {
  // Group apartments by floor
  const groupedByFloor = apartments.reduce((acc, apt) => {
    const floor = apt.floor ?? 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(apt);
    return acc;
  }, {} as Record<number, ApartmentPreview[]>);

  const floors = Object.keys(groupedByFloor)
    .map(Number)
    .sort((a, b) => b - a); // Descending order (higher floors first)

  if (apartments.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        Digite os números dos apartamentos separados por vírgula
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Preview dos Apartamentos</span>
        <span className="font-medium text-foreground">{apartments.length} apartamentos</span>
      </div>
      <div className="border border-border rounded-lg p-4 bg-secondary/30 max-h-[200px] overflow-y-auto">
        {floors.length > 1 ? (
          // Show grouped by floor
          <div className="space-y-3">
            {floors.map((floor) => (
              <div key={floor} className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {floor === 0 ? "Térreo" : `${floor}º Andar`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupedByFloor[floor].map((apt, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium"
                    >
                      {apt.number}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Show flat grid
          <div className="flex flex-wrap gap-2">
            {apartments.map((apt, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium"
              >
                {apt.number}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
