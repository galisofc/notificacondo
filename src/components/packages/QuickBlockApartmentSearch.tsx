import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickBlockApartmentSearchProps {
  condominiumId: string;
  onBlockFound: (blockId: string) => void;
  onApartmentFound: (apartmentId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function QuickBlockApartmentSearch({
  condominiumId,
  onBlockFound,
  onApartmentFound,
  disabled = false,
  className,
  placeholder = "Ex: 0344, A44, ARM44",
}: QuickBlockApartmentSearchProps) {
  const [quickSearchCode, setQuickSearchCode] = useState("");
  const [quickSearchError, setQuickSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Quick search handler - flexible format: 0344, A44, ARM44, etc.
  const handleQuickSearch = async () => {
    if (!condominiumId) {
      setQuickSearchError("Selecione o condomínio primeiro");
      return;
    }

    const code = quickSearchCode.trim().toUpperCase();
    if (code.length < 2) {
      setQuickSearchError("Digite pelo menos 2 caracteres");
      return;
    }

    // Parse: separate block part from apartment part
    // Formats supported: "0344" (numeric), "A44" (letter+num), "ARM44" (text+num)
    const match = code.match(/^([A-Z]+|\d{1,2})(\d+)$/);
    
    if (!match) {
      setQuickSearchError("Formato inválido. Ex: 0344, A44, ARM44");
      return;
    }

    const blockSearch = match[1];
    const apartmentSearch = match[2];

    if (!apartmentSearch) {
      setQuickSearchError("Inclua o número do apartamento");
      return;
    }

    setIsSearching(true);
    setQuickSearchError("");

    try {
      // Fetch all blocks for this condominium
      const { data: blocksData, error: blocksError } = await supabase
        .from("blocks")
        .select("id, name, short_code")
        .eq("condominium_id", condominiumId);

      if (blocksError) throw blocksError;

      // Find block with flexible matching strategy (priority order)
      const matchedBlock = blocksData?.find((block) => {
        const blockName = block.name.toUpperCase();
        const shortCode = block.short_code?.toUpperCase() || "";
        
        // 1. Exact short_code match (highest priority)
        if (shortCode && shortCode === blockSearch) return true;
        
        // 2. Exact block name match
        if (blockName === blockSearch) return true;
        
        // 3. Short code starts with search term
        if (shortCode && shortCode.startsWith(blockSearch)) return true;
        
        // 4. Block name starts with search term
        if (blockName.startsWith(blockSearch)) return true;
        
        // 5. Numeric match (for "BLOCO 03", "03", etc.)
        const numericPart = blockName.replace(/\D/g, "");
        if (numericPart && /^\d+$/.test(blockSearch)) {
          return numericPart.padStart(2, "0") === blockSearch.padStart(2, "0");
        }
        
        return false;
      });

      if (!matchedBlock) {
        setQuickSearchError(`Bloco "${blockSearch}" não encontrado`);
        setIsSearching(false);
        return;
      }

      // Search for apartment in that block
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from("apartments")
        .select("id, number")
        .eq("block_id", matchedBlock.id);

      if (apartmentsError) throw apartmentsError;

      // Find apartment that matches
      const matchedApartment = apartmentsData?.find((apt) => {
        const aptNumber = apt.number.replace(/\D/g, "");
        return aptNumber === apartmentSearch || 
               aptNumber.padStart(2, "0") === apartmentSearch.padStart(2, "0") ||
               aptNumber.padStart(3, "0") === apartmentSearch.padStart(3, "0");
      });

      if (!matchedApartment) {
        setQuickSearchError(`Apartamento "${apartmentSearch}" não encontrado no ${matchedBlock.name}`);
        setIsSearching(false);
        return;
      }

      // Set the selections
      onBlockFound(matchedBlock.id);
      
      // Wait a bit for blocks to load before setting apartment
      setTimeout(() => {
        onApartmentFound(matchedApartment.id);
      }, 100);

      setQuickSearchCode("");
    } catch (error) {
      console.error("Quick search error:", error);
      setQuickSearchError("Erro na busca");
    } finally {
      setIsSearching(false);
    }
  };

  const clearQuickSearch = () => {
    setQuickSearchCode("");
    setQuickSearchError("");
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={quickSearchCode}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
              setQuickSearchCode(val);
              setQuickSearchError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleQuickSearch();
              }
            }}
            disabled={disabled || !condominiumId}
            className={cn("pl-10 pr-8", quickSearchError ? "border-destructive" : "")}
            maxLength={10}
          />
          {quickSearchCode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={clearQuickSearch}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          onClick={handleQuickSearch}
          disabled={disabled || !condominiumId || !quickSearchCode || isSearching}
          size="icon"
          variant="secondary"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>
      {quickSearchError && (
        <p className="text-xs text-destructive">{quickSearchError}</p>
      )}
    </div>
  );
}
