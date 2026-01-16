import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "super_admin" | "sindico" | "morador" | "porteiro" | null;

interface ResidentInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  apartment_id: string;
  apartment_number: string;
  block_name: string;
  condominium_name: string;
  condominium_id: string;
  is_owner: boolean;
  is_responsible: boolean;
}

interface ProfileInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface PorteiroCondominium {
  id: string;
  name: string;
}

interface UseUserRoleReturn {
  role: UserRole;
  loading: boolean;
  isResident: boolean;
  isSindico: boolean;
  isSuperAdmin: boolean;
  isPorteiro: boolean;
  residentInfo: ResidentInfo | null;
  allResidentProfiles: ResidentInfo[];
  switchApartment: (residentId: string) => void;
  profileInfo: ProfileInfo | null;
  refetchProfile: () => Promise<void>;
  porteiroCondominiums: PorteiroCondominium[];
}

const SELECTED_RESIDENT_KEY = "selected_resident_id";

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null);
  const [allResidentProfiles, setAllResidentProfiles] = useState<ResidentInfo[]>([]);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [porteiroCondominiums, setPorteiroCondominiums] = useState<PorteiroCondominium[]>([]);

  const fetchProfileInfo = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile info:", profileError);
      return;
    }

    if (profileData) {
      setProfileInfo({
        id: profileData.id,
        full_name: profileData.full_name,
        email: profileData.email,
        phone: profileData.phone,
        avatar_url: profileData.avatar_url,
      });
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (user && (role === "sindico" || role === "super_admin")) {
      await fetchProfileInfo(user.id);
    }
  }, [user, role, fetchProfileInfo]);

  const switchApartment = useCallback((residentId: string) => {
    const selected = allResidentProfiles.find(r => r.id === residentId);
    if (selected) {
      setResidentInfo(selected);
      localStorage.setItem(SELECTED_RESIDENT_KEY, residentId);
    }
  }, [allResidentProfiles]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setProfileInfo(null);
        setResidentInfo(null);
        setAllResidentProfiles([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch user role from user_roles table
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleError) {
          console.error("Error fetching user role:", roleError);
        }

        const userRole = roleData?.role as UserRole || "morador";
        setRole(userRole);

        // Fetch profile info for sindico, super_admin, and porteiro
        if (userRole === "sindico" || userRole === "super_admin" || userRole === "porteiro") {
          await fetchProfileInfo(user.id);
        }

        // Fetch porter's condominiums
        if (userRole === "porteiro") {
          const { data: userCondos } = await supabase
            .from("user_condominiums")
            .select("condominium_id, condominiums(id, name)")
            .eq("user_id", user.id);

          if (userCondos) {
            setPorteiroCondominiums(
              userCondos.map((uc: any) => ({
                id: uc.condominiums.id,
                name: uc.condominiums.name,
              }))
            );
          }
        }

        // If user is a resident, fetch all their resident records
        if (userRole === "morador") {
          const { data: residentData, error: residentError } = await supabase
            .from("residents")
            .select(`
              id,
              full_name,
              email,
              phone,
              apartment_id,
              is_owner,
              is_responsible,
              apartments!inner (
                number,
                blocks!inner (
                  name,
                  condominiums!inner (
                    id,
                    name
                  )
                )
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (residentError) {
            console.error("Error fetching resident info:", residentError);
          }

          if (residentData && residentData.length > 0) {
            // Map all resident records
            const allProfiles: ResidentInfo[] = residentData.map((resident) => {
              const apt = resident.apartments as any;
              return {
                id: resident.id,
                full_name: resident.full_name,
                email: resident.email,
                phone: resident.phone,
                apartment_id: resident.apartment_id,
                apartment_number: apt.number,
                block_name: apt.blocks.name,
                condominium_name: apt.blocks.condominiums.name,
                condominium_id: apt.blocks.condominiums.id,
                is_owner: resident.is_owner,
                is_responsible: resident.is_responsible,
              };
            });

            setAllResidentProfiles(allProfiles);

            // Check if there's a saved preference
            const savedResidentId = localStorage.getItem(SELECTED_RESIDENT_KEY);
            const savedResident = savedResidentId 
              ? allProfiles.find(r => r.id === savedResidentId) 
              : null;

            // Use saved preference or default to first
            setResidentInfo(savedResident || allProfiles[0]);
          }
        }
      } catch (error) {
        console.error("Error in useUserRole:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user, fetchProfileInfo]);

  // Subscribe to realtime profile updates
  useEffect(() => {
    if (!user || (role !== "sindico" && role !== "super_admin")) return;

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setProfileInfo({
              id: newData.id,
              full_name: newData.full_name,
              email: newData.email,
              phone: newData.phone,
              avatar_url: newData.avatar_url,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  return {
    role,
    loading,
    isResident: role === "morador",
    isSindico: role === "sindico",
    isSuperAdmin: role === "super_admin",
    isPorteiro: role === "porteiro",
    residentInfo,
    allResidentProfiles,
    switchApartment,
    profileInfo,
    refetchProfile,
    porteiroCondominiums,
  };
};
