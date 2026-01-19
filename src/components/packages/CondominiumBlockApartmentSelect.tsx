import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Condominium {
  id: string;
  name: string;
}

interface Block {
  id: string;
  name: string;
  short_code: string | null;
}

interface Apartment {
  id: string;
  number: string;
}

interface CondominiumBlockApartmentSelectProps {
  condominiumIds?: string[];
  selectedCondominium: string;
  selectedBlock: string;
  selectedApartment: string;
  onCondominiumChange: (id: string) => void;
  onBlockChange: (id: string) => void;
  onApartmentChange: (id: string) => void;
  disabled?: boolean;
}

export function CondominiumBlockApartmentSelect({
  condominiumIds,
  selectedCondominium,
  selectedBlock,
  selectedApartment,
  onCondominiumChange,
  onBlockChange,
  onApartmentChange,
  disabled = false,
}: CondominiumBlockApartmentSelectProps) {
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loadingCondos, setLoadingCondos] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingApartments, setLoadingApartments] = useState(false);
  
  // Quick search state
  const [quickSearchCode, setQuickSearchCode] = useState("");
  const [quickSearchError, setQuickSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch condominiums
  useEffect(() => {
    const fetchCondominiums = async () => {
      setLoadingCondos(true);
      try {
        let query = supabase
          .from("condominiums")
          .select("id, name")
          .order("name");

        if (condominiumIds && condominiumIds.length > 0) {
          query = query.in("id", condominiumIds);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setCondominiums(data || []);
        
        // Auto-select if only one condominium
        if (data?.length === 1 && !selectedCondominium) {
          onCondominiumChange(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching condominiums:", error);
      } finally {
        setLoadingCondos(false);
      }
    };

    fetchCondominiums();
  }, [condominiumIds]);

  // Fetch blocks when condominium changes
  useEffect(() => {
    const fetchBlocks = async () => {
      if (!selectedCondominium) {
        setBlocks([]);
        return;
      }

      setLoadingBlocks(true);
      try {
        const { data, error } = await supabase
          .from("blocks")
          .select("id, name, short_code")
          .eq("condominium_id", selectedCondominium)
          .order("name");

        if (error) throw error;
        setBlocks(data || []);
        
        // Auto-select if only one block
        if (data?.length === 1 && !selectedBlock) {
          onBlockChange(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching blocks:", error);
      } finally {
        setLoadingBlocks(false);
      }
    };

    fetchBlocks();
    // Reset block and apartment selection when condominium changes
    if (selectedBlock) {
      onBlockChange("");
      onApartmentChange("");
    }
  }, [selectedCondominium]);

  // Fetch apartments when block changes
  useEffect(() => {
    const fetchApartments = async () => {
      if (!selectedBlock) {
        setApartments([]);
        return;
      }

      setLoadingApartments(true);
      try {
        const { data, error } = await supabase
          .from("apartments")
          .select("id, number")
          .eq("block_id", selectedBlock)
          .order("number");

        if (error) throw error;
        setApartments(data || []);
      } catch (error) {
        console.error("Error fetching apartments:", error);
      } finally {
        setLoadingApartments(false);
      }
    };

    fetchApartments();
    // Reset apartment selection when block changes
    if (selectedApartment) {
      onApartmentChange("");
    }
  }, [selectedBlock]);

  // Quick search handler - flexible format: 0344, A44, ARM44, etc.
  const handleQuickSearch = async () => {
    if (!selectedCondominium) {
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
        .eq("condominium_id", selectedCondominium);

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
      onBlockChange(matchedBlock.id);
      
      // Wait a bit for blocks to load before setting apartment
      setTimeout(() => {
        onApartmentChange(matchedApartment.id);
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

  // Get condominium name for display
  const selectedCondominiumName = condominiums.find(c => c.id === selectedCondominium)?.name || "";

  return (
    <div className="space-y-4">
      {/* Condominium Display (read-only) */}
      <div className="space-y-2">
        <Label htmlFor="condominium">Condomínio</Label>
        {loadingCondos ? (
          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-muted-foreground text-sm">Carregando...</span>
          </div>
        ) : (
          <div className="h-10 px-3 border rounded-md bg-muted flex items-center">
            <span className="text-sm font-medium">{selectedCondominiumName || "Nenhum condomínio vinculado"}</span>
          </div>
        )}
      </div>

      {/* Quick Search */}
      <div className="space-y-2">
        <Label htmlFor="quick-search" className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          Busca Rápida (Bloco + Apt)
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="quick-search"
              placeholder="Ex: 0344, A44, ARM44"
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
              disabled={disabled || !selectedCondominium}
              className={quickSearchError ? "border-destructive" : ""}
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
            disabled={disabled || !selectedCondominium || !quickSearchCode || isSearching}
            size="icon"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        {quickSearchError && (
          <p className="text-sm text-destructive">{quickSearchError}</p>
        )}
      </div>
    </div>
  );
}
