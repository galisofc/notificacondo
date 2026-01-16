import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PackageStatus } from "@/lib/packageConstants";

export interface Package {
  id: string;
  condominium_id: string;
  block_id: string;
  apartment_id: string;
  resident_id: string | null;
  received_by: string;
  pickup_code: string;
  description: string | null;
  photo_url: string;
  status: PackageStatus;
  received_at: string;
  picked_up_at: string | null;
  picked_up_by: string | null;
  expires_at: string | null;
  created_at: string;
  // Joined data
  condominium?: { name: string };
  block?: { name: string };
  apartment?: { number: string };
}

interface UsePackagesOptions {
  condominiumIds?: string[];
  apartmentId?: string;
  status?: PackageStatus | PackageStatus[];
  limit?: number;
  realtime?: boolean;
}

export function usePackages(options: UsePackagesOptions = {}) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("packages")
        .select(`
          *,
          condominium:condominiums(name),
          block:blocks(name),
          apartment:apartments(number)
        `)
        .order("received_at", { ascending: false });

      // Filter by condominium IDs
      if (options.condominiumIds && options.condominiumIds.length > 0) {
        query = query.in("condominium_id", options.condominiumIds);
      }

      // Filter by apartment ID
      if (options.apartmentId) {
        query = query.eq("apartment_id", options.apartmentId);
      }

      // Filter by status
      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in("status", options.status);
        } else {
          query = query.eq("status", options.status);
        }
      }

      // Limit results
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      setPackages((data as Package[]) || []);
    } catch (err) {
      console.error("Error fetching packages:", err);
      setError("Erro ao carregar encomendas");
    } finally {
      setLoading(false);
    }
  }, [options.condominiumIds, options.apartmentId, options.status, options.limit]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Setup realtime subscription
  useEffect(() => {
    if (!options.realtime) return;

    const channel = supabase
      .channel("packages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "packages",
        },
        () => {
          fetchPackages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.realtime, fetchPackages]);

  const markAsPickedUp = useCallback(async (packageId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("packages")
        .update({
          status: "retirada" as PackageStatus,
          picked_up_at: new Date().toISOString(),
          picked_up_by: userId,
        })
        .eq("id", packageId);

      if (error) throw error;

      // Refresh packages
      await fetchPackages();
      return { success: true };
    } catch (err) {
      console.error("Error marking package as picked up:", err);
      return { success: false, error: "Erro ao marcar encomenda como retirada" };
    }
  }, [fetchPackages]);

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
    markAsPickedUp,
  };
}
