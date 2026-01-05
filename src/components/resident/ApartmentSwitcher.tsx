import { useUserRole } from "@/hooks/useUserRole";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Home } from "lucide-react";

const ApartmentSwitcher = () => {
  const { residentInfo, allResidentProfiles, switchApartment } = useUserRole();

  // Only show if user has multiple apartments
  if (allResidentProfiles.length <= 1) {
    return null;
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <Building2 className="w-3 h-3" />
        <span>Alternar Apartamento</span>
      </div>
      <Select
        value={residentInfo?.id || ""}
        onValueChange={(value) => switchApartment(value)}
      >
        <SelectTrigger className="w-full bg-secondary/50 border-border/50 h-auto py-2">
          <SelectValue>
            {residentInfo && (
              <div className="flex items-center gap-2 text-left">
                <Home className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {residentInfo.block_name} - APTO {residentInfo.apartment_number}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {residentInfo.condominium_name}
                  </span>
                </div>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allResidentProfiles.map((profile) => (
            <SelectItem 
              key={profile.id} 
              value={profile.id}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {profile.block_name} - APTO {profile.apartment_number}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {profile.condominium_name}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ApartmentSwitcher;