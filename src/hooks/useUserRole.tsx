import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "super_admin" | "sindico" | "morador" | null;

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

interface UseUserRoleReturn {
  role: UserRole;
  loading: boolean;
  isResident: boolean;
  isSindico: boolean;
  isSuperAdmin: boolean;
  residentInfo: ResidentInfo | null;
  profileInfo: ProfileInfo | null;
  refetchProfile: () => Promise<void>;
}

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

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

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setProfileInfo(null);
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

        // Fetch profile info for sindico and super_admin
        if (userRole === "sindico" || userRole === "super_admin") {
          await fetchProfileInfo(user.id);
        }

        // If user is a resident, fetch their resident info
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
            .order("created_at", { ascending: false })
            .limit(1);

          if (residentError) {
            console.error("Error fetching resident info:", residentError);
          }

          const firstResident = residentData?.[0];

          if (firstResident) {
            const apt = firstResident.apartments as any;
            setResidentInfo({
              id: firstResident.id,
              full_name: firstResident.full_name,
              email: firstResident.email,
              phone: firstResident.phone,
              apartment_id: firstResident.apartment_id,
              apartment_number: apt.number,
              block_name: apt.blocks.name,
              condominium_name: apt.blocks.condominiums.name,
              condominium_id: apt.blocks.condominiums.id,
              is_owner: firstResident.is_owner,
              is_responsible: firstResident.is_responsible,
            });
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
    residentInfo,
    profileInfo,
    refetchProfile,
  };
};
