import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Clock, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PackageStatusBadge } from "./PackageStatusBadge";
import { PickupCodeDisplay } from "./PickupCodeDisplay";
import { PackageStatus } from "@/lib/packageConstants";
import { cn } from "@/lib/utils";

interface PackageCardProps {
  id: string;
  photoUrl: string;
  pickupCode: string;
  status: PackageStatus;
  apartmentNumber: string;
  blockName: string;
  condominiumName?: string;
  receivedAt: string;
  description?: string;
  onClick?: () => void;
  showCondominium?: boolean;
  compact?: boolean;
}

export function PackageCard({
  id,
  photoUrl,
  pickupCode,
  status,
  apartmentNumber,
  blockName,
  condominiumName,
  receivedAt,
  description,
  onClick,
  showCondominium = false,
  compact = false,
}: PackageCardProps) {
  const formattedDate = format(new Date(receivedAt), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  if (compact) {
    return (
      <Card
        className={cn(
          "overflow-hidden transition-all hover:shadow-md",
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
            <img
              src={photoUrl}
              alt="Encomenda"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-sm text-primary">
                {pickupCode}
              </span>
              <PackageStatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {blockName} - Apto {apartmentNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {formattedDate}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all hover:shadow-lg",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="aspect-video relative overflow-hidden bg-muted">
        <img
          src={photoUrl}
          alt="Encomenda"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <PackageStatusBadge status={status} />
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-lg text-primary tracking-wider">
            {pickupCode}
          </span>
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span>
              {blockName} - Apto {apartmentNumber}
              {showCondominium && condominiumName && ` • ${condominiumName}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
