import { useState, useEffect } from "react";
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
}

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

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
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileError) {
            console.error("Error fetching profile info:", profileError);
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
            .maybeSingle();

          if (residentError) {
            console.error("Error fetching resident info:", residentError);
          }

          if (residentData) {
            const apt = residentData.apartments as any;
            setResidentInfo({
              id: residentData.id,
              full_name: residentData.full_name,
              email: residentData.email,
              phone: residentData.phone,
              apartment_id: residentData.apartment_id,
              apartment_number: apt.number,
              block_name: apt.blocks.name,
              condominium_name: apt.blocks.condominiums.name,
              condominium_id: apt.blocks.condominiums.id,
              is_owner: residentData.is_owner,
              is_responsible: residentData.is_responsible,
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
  }, [user]);

  return {
    role,
    loading,
    isResident: role === "morador",
    isSindico: role === "sindico",
    isSuperAdmin: role === "super_admin",
    residentInfo,
    profileInfo,
  };
};
