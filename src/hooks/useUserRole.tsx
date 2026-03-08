import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "super_admin" | "sindico" | "morador" | "porteiro" | "zelador" | null;

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
  isZelador: boolean;
  residentInfo: ResidentInfo | null;
  allResidentProfiles: ResidentInfo[];
  switchApartment: (residentId: string) => void;
  profileInfo: ProfileInfo | null;
  refetchProfile: () => Promise<void>;
  porteiroCondominiums: PorteiroCondominium[];
}

const SELECTED_RESIDENT_KEY = "selected_resident_id";

const UserRoleContext = createContext<UseUserRoleReturn | null>(null);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const value = useUserRoleInternal();
  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = (): UseUserRoleReturn => {
  const context = useContext(UserRoleContext);
  if (context) return context;
  // Fallback for components outside provider (should not happen in practice)
  return useUserRoleInternal();
};

const useUserRoleInternal = (): UseUserRoleReturn => {
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
        const { data: rolesData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (roleError) {
          console.error("Error fetching user role:", roleError);
          setLoading(false);
          return;
        }

        const rolePriority: Record<string, number> = {
          super_admin: 5,
          porteiro: 4,
          zelador: 3,
          sindico: 2,
          morador: 1,
        };

        let userRole: UserRole = null;

        if (rolesData && rolesData.length > 0) {
          const sortedRoles = rolesData.sort(
            (a, b) => (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0)
          );
          userRole = sortedRoles[0].role as UserRole;
        } else {
          userRole = "morador";
        }
        
        setRole(userRole);

        if (userRole === "sindico" || userRole === "super_admin" || userRole === "porteiro" || userRole === "zelador") {
          await fetchProfileInfo(user.id);
        }

        if (userRole === "porteiro" || userRole === "zelador") {
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

            const savedResidentId = localStorage.getItem(SELECTED_RESIDENT_KEY);
            const savedResident = savedResidentId 
              ? allProfiles.find(r => r.id === savedResidentId) 
              : null;

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

  return {
    role,
    loading,
    isResident: role === "morador",
    isSindico: role === "sindico",
    isSuperAdmin: role === "super_admin",
    isPorteiro: role === "porteiro",
    isZelador: role === "zelador",
    residentInfo,
    allResidentProfiles,
    switchApartment,
    profileInfo,
    refetchProfile,
    porteiroCondominiums,
  };
};
