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
import { Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-4">
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

      {/* Block Select */}
      <div className="space-y-2">
        <Label htmlFor="block">Bloco</Label>
        <Select
          value={selectedBlock}
          onValueChange={onBlockChange}
          disabled={disabled || !selectedCondominium || loadingBlocks}
        >
          <SelectTrigger id="block">
            {loadingBlocks ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Selecione o bloco" />
            )}
          </SelectTrigger>
          <SelectContent>
            {blocks.map((block) => (
              <SelectItem key={block.id} value={block.id}>
                {block.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Apartment Select */}
      <div className="space-y-2">
        <Label htmlFor="apartment">Apartamento</Label>
        <Select
          value={selectedApartment}
          onValueChange={onApartmentChange}
          disabled={disabled || !selectedBlock || loadingApartments}
        >
          <SelectTrigger id="apartment">
            {loadingApartments ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Selecione o apartamento" />
            )}
          </SelectTrigger>
          <SelectContent>
            {apartments.map((apt) => (
              <SelectItem key={apt.id} value={apt.id}>
                {apt.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
