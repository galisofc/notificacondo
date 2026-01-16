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
          .select("id, name")
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

  // Quick search handler - format BBAA (Block + Apartment)
  const handleQuickSearch = async () => {
    if (!selectedCondominium) {
      setQuickSearchError("Selecione o condomínio primeiro");
      return;
    }

    const code = quickSearchCode.trim();
    if (code.length < 3 || code.length > 6) {
      setQuickSearchError("Digite de 3 a 6 dígitos (ex: 0344)");
      return;
    }

    if (!/^\d+$/.test(code)) {
      setQuickSearchError("Digite apenas números");
      return;
    }

    setIsSearching(true);
    setQuickSearchError("");

    try {
      // Parse code - first 2 digits = block, rest = apartment
      const blockCode = code.substring(0, 2);
      const apartmentCode = code.substring(2);

      // Search for block by name containing the block code
      const { data: blocksData, error: blocksError } = await supabase
        .from("blocks")
        .select("id, name")
        .eq("condominium_id", selectedCondominium);

      if (blocksError) throw blocksError;

      // Find block that matches the code (e.g., "03" matches "Bloco 03" or just "03")
      const matchedBlock = blocksData?.find((block) => {
        const blockName = block.name.toLowerCase();
        const numericPart = blockName.replace(/\D/g, "");
        return numericPart === blockCode || 
               numericPart.padStart(2, "0") === blockCode ||
               blockCode === numericPart.padStart(2, "0");
      });

      if (!matchedBlock) {
        setQuickSearchError(`Bloco "${blockCode}" não encontrado`);
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
        return aptNumber === apartmentCode || 
               aptNumber.padStart(2, "0") === apartmentCode.padStart(2, "0");
      });

      if (!matchedApartment) {
        setQuickSearchError(`Apartamento "${apartmentCode}" não encontrado no ${matchedBlock.name}`);
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

  return (
    <div className="space-y-4">
      {/* Quick Search */}
      <div className="space-y-2">
        <Label htmlFor="quick-search" className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          Busca Rápida (BBAA)
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="quick-search"
              placeholder="Ex: 0344 = Bloco 03, Ap 44"
              value={quickSearchCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
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
              maxLength={6}
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
        {!selectedCondominium && (
          <p className="text-xs text-muted-foreground">Selecione o condomínio para usar a busca rápida</p>
        )}
      </div>

      {/* Condominium Select */}
      <div className="space-y-2">
        <Label htmlFor="condominium">Condomínio</Label>
        <Select
          value={selectedCondominium}
          onValueChange={onCondominiumChange}
          disabled={disabled || loadingCondos}
        >
          <SelectTrigger id="condominium">
            {loadingCondos ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Selecione o condomínio" />
            )}
          </SelectTrigger>
          <SelectContent>
            {condominiums.map((condo) => (
              <SelectItem key={condo.id} value={condo.id}>
                {condo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
