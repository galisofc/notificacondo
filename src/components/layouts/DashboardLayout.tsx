import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Building2,
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  MessageCircle,
  Bell,
  BarChart3,
  Home,
  User,
  Scale,
  Receipt,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const superAdminNavItems: NavItem[] = [
  { title: "Início", url: "/superadmin", icon: Home },
  { title: "Síndicos", url: "/superadmin/sindicos", icon: Users },
  { title: "Condomínios", url: "/superadmin/condominiums", icon: Building2 },
  { title: "Assinaturas", url: "/superadmin/subscriptions", icon: CreditCard },
  { title: "Faturas", url: "/superadmin/invoices", icon: Receipt },
  { title: "Logs", url: "/superadmin/logs", icon: FileText },
  { title: "WhatsApp", url: "/superadmin/whatsapp", icon: MessageCircle },
  { title: "Configurações", url: "/superadmin/settings", icon: Settings },
];

const residentNavItems: NavItem[] = [
  { title: "Início", url: "/resident", icon: Home },
  { title: "Minhas Ocorrências", url: "/resident/occurrences", icon: FileText },
  { title: "Meu Perfil", url: "/resident/profile", icon: User },
];

function SidebarNavigation() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, residentInfo, profileInfo, loading } = useUserRole();
  const { toast } = useToast();
  const [pendingDefenses, setPendingDefenses] = useState(0);
  const [condoIds, setCondoIds] = useState<string[]>([]);
  const prevPendingDefensesRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
      
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, []);

  useEffect(() => {
    const fetchPendingDefenses = async () => {
      if (!user || role !== "sindico") return;

      try {
        const { data: condos } = await supabase
          .from("condominiums")
          .select("id")
          .eq("owner_id", user.id);

        const ids = condos?.map((c) => c.id) || [];
        setCondoIds(ids);

        if (ids.length > 0) {
          const { count } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", ids)
            .eq("status", "em_defesa");

          setPendingDefenses(count || 0);
        }
      } catch (error) {
        console.error("Error fetching pending defenses:", error);
      }
    };

    fetchPendingDefenses();
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "sindico" || condoIds.length === 0) return;

    const channel = supabase
      .channel("occurrences-status-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "occurrences",
        },
        async (payload) => {
          const { count } = await supabase
            .from("occurrences")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", condoIds)
            .eq("status", "em_defesa");

          const newCount = count || 0;
          
          if (newCount > prevPendingDefensesRef.current) {
            playNotificationSound();
          }
          
          prevPendingDefensesRef.current = newCount;
          setPendingDefenses(newCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, condoIds, playNotificationSound]);

  useEffect(() => {
    prevPendingDefensesRef.current = pendingDefenses;
  }, [pendingDefenses]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Até logo!", description: "Você saiu da sua conta." });
    navigate("/");
  };

  const getSindicoNavItems = (): NavItem[] => [
    { title: "Início", url: "/dashboard", icon: Home },
    { title: "Condomínios", url: "/condominiums", icon: Building2 },
    { title: "Ocorrências", url: "/occurrences", icon: FileText },
    { title: "Análise de Defesas", url: "/defenses", icon: Scale, badge: pendingDefenses },
    { title: "Notificações", url: "/notifications", icon: Bell },
    { title: "Relatórios", url: "/reports", icon: BarChart3 },
    { title: "Assinaturas", url: "/sindico/subscriptions", icon: CreditCard },
    { title: "Faturas", url: "/sindico/invoices", icon: Receipt },
    { title: "Configurações", url: "/sindico/settings", icon: Settings },
  ];

  const navItems =
    role === "super_admin"
      ? superAdminNavItems
      : role === "sindico"
      ? getSindicoNavItems()
      : residentNavItems;

  const getRoleConfig = () => {
    switch (role) {
      case "super_admin":
        return {
          title: "ADMIN",
          subtitle: "Super Admin",
          icon: Shield,
        };
      case "sindico":
        return {
          title: "NOTIFICA",
          subtitle: "Gestão Condominial",
          icon: Building2,
        };
      default:
        return {
          title: "NOTIFICA",
          subtitle: "Área do Morador",
          icon: Home,
        };
    }
  };

  const config = getRoleConfig();
  const Icon = config.icon;

  const getUserInitials = () => {
    if (residentInfo?.full_name) {
      return residentInfo.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (profileInfo?.full_name) {
      return profileInfo.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const getUserName = () => {
    if (residentInfo?.full_name) {
      return residentInfo.full_name.split(" ")[0].toUpperCase();
    }
    if (profileInfo?.full_name) {
      return profileInfo.full_name.split(" ")[0].toUpperCase();
    }
    return user?.email?.split("@")[0]?.toUpperCase() || "USUÁRIO";
  };

  const getRoleLabel = () => {
    switch (role) {
      case "super_admin":
        return "Administrador";
      case "sindico":
        return "Síndico";
      default:
        return "Morador";
    }
  };

  return (
    <Sidebar
      className={cn(
        "border-r-0 transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[260px]"
      )}
      collapsible="icon"
    >
      {/* Header with Logo */}
      <SidebarHeader className="p-4 pb-6">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="rounded-xl bg-sidebar-primary/20 p-2.5 shrink-0">
            <Icon className="w-6 h-6 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-display text-xl font-bold text-sidebar-foreground block tracking-tight">
                {config.title}
              </span>
              <span className="text-xs text-sidebar-primary font-semibold uppercase tracking-wider">
                {config.subtitle}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "w-full h-11 transition-all duration-200 rounded-lg",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/superadmin" || item.url === "/dashboard" || item.url === "/resident"}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 w-full",
                          collapsed && "justify-center px-0"
                        )}
                        activeClassName=""
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="font-medium flex-1 text-sm">{item.title}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                {item.badge > 99 ? "99+" : item.badge}
                              </span>
                            )}
                            {isActive && (
                              <ChevronRight className="w-4 h-4 text-sidebar-primary" />
                            )}
                          </>
                        )}
                        {collapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="p-3 mt-auto">
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/30",
            collapsed && "justify-center p-2"
          )}
        >
          <Avatar className="h-10 w-10 shrink-0 border-2 border-sidebar-accent">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground truncate">
                {getUserName()}
              </p>
              <p className="text-xs text-sidebar-muted truncate">
                {getRoleLabel()}
              </p>
            </div>
          )}
          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate("/notifications")}
                className="p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {collapsed && (
          <button
            onClick={handleSignOut}
            className="w-full mt-2 p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors flex justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarNavigation />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/80 backdrop-blur-lg flex items-center justify-between px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <ThemeToggle />
          </header>
          <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
