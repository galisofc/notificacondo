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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import ApartmentSwitcher from "@/components/resident/ApartmentSwitcher";
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
  ChevronDown,
  Clock,
  PartyPopper,
  Mail,
  Package,
  PackageCheck,
  PackagePlus,
  DoorOpen,
  Wrench,
  Wallet,
  ClipboardList,
  Cog,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/logo.png";
import logoIcon from "@/assets/logo-icon.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

type NavStructure = (NavItem | NavGroup)[];

const isNavGroup = (item: NavItem | NavGroup): item is NavGroup => {
  return 'items' in item;
};

const getBaseSuperAdminNavItems = (): NavStructure => [
  { title: "Início", url: "/superadmin", icon: Home },
  {
    title: "Gestão",
    icon: Users,
    items: [
      { title: "Síndicos", url: "/superadmin/sindicos", icon: Users },
      { title: "Condomínios", url: "/superadmin/condominiums", icon: Building2 },
      { title: "Transferências", url: "/superadmin/transfers", icon: Scale },
    ],
  },
  { title: "Mensagens", url: "/superadmin/contact-messages", icon: Mail },
  {
    title: "Assinaturas",
    icon: CreditCard,
    items: [
      { title: "Assinantes", url: "/superadmin/subscriptions", icon: Users },
      { title: "Faturas", url: "/superadmin/invoices", icon: Receipt },
    ],
  },
  {
    title: "WhatsApp",
    icon: MessageCircle,
    items: [
      { title: "Templates", url: "/superadmin/whatsapp", icon: BarChart3 },
      { title: "Configurações", url: "/superadmin/whatsapp/config", icon: Cog },
    ],
  },
  {
    title: "Configurações",
    icon: Settings,
    items: [
      { title: "Geral", url: "/superadmin/settings", icon: Cog },
      { title: "Tipos de Encomenda", url: "/superadmin/package-types", icon: Package },
      { title: "Logs", url: "/superadmin/logs", icon: FileText },
      { title: "Cron Jobs", url: "/superadmin/cron-jobs", icon: Clock },
    ],
  },
];

const residentNavItems: NavStructure = [
  { title: "Início", url: "/resident", icon: Home },
  { title: "Minhas Ocorrências", url: "/resident/occurrences", icon: FileText },
  { title: "Minhas Encomendas", url: "/resident/packages", icon: Package },
  { title: "Meu Perfil", url: "/resident/profile", icon: User },
];

const getPorteiroNavItems = (pendingPackages: number): NavStructure => [
  { title: "Início", url: "/porteiro", icon: Home },
  { title: "Condomínio", url: "/porteiro/condominio", icon: Building2 },
  { title: "Registrar Encomenda", url: "/porteiro/registrar", icon: PackagePlus },
  { title: "Retirar Encomenda", url: "/porteiro/encomendas", icon: PackageCheck, badge: pendingPackages },
  { title: "Histórico", url: "/porteiro/historico", icon: FileText },
  { title: "Configurações", url: "/porteiro/configuracoes", icon: Settings },
];

function SidebarNavigation() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  // In mobile, sidebar is shown as a Sheet and should always show text labels
  const collapsed = isMobile ? false : state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, residentInfo, profileInfo, loading } = useUserRole();
  const { toast } = useToast();
  const [pendingDefenses, setPendingDefenses] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingPackages, setPendingPackages] = useState(0);
  const [condoIds, setCondoIds] = useState<string[]>([]);
  const [porteiroCondoIds, setPorteiroCondoIds] = useState<string[]>([]);
  const prevPendingDefensesRef = useRef<number>(0);
  const prevUnreadMessagesRef = useRef<number>(0);
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

  // Fetch pending defenses for sindicos
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

  // Fetch unread contact messages for super_admin
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!user || role !== "super_admin") return;

      try {
        const { count } = await supabase
          .from("contact_messages")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false);

        setUnreadMessages(count || 0);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    };

    fetchUnreadMessages();
  }, [user, role]);

  // Realtime subscription for contact messages (super_admin)
  useEffect(() => {
    if (!user || role !== "super_admin") return;

    const channel = supabase
      .channel("contact-messages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_messages",
        },
        async () => {
          const { count } = await supabase
            .from("contact_messages")
            .select("*", { count: "exact", head: true })
            .eq("is_read", false);

          const newCount = count || 0;
          
          if (newCount > prevUnreadMessagesRef.current) {
            playNotificationSound();
          }
          
          prevUnreadMessagesRef.current = newCount;
          setUnreadMessages(newCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, playNotificationSound]);

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

  useEffect(() => {
    prevUnreadMessagesRef.current = unreadMessages;
  }, [unreadMessages]);

  // Fetch pending packages for porteiro
  useEffect(() => {
    const fetchPendingPackages = async () => {
      if (!user || role !== "porteiro") return;

      try {
        const { data: userCondos } = await supabase
          .from("user_condominiums")
          .select("condominium_id")
          .eq("user_id", user.id);

        const ids = userCondos?.map((c) => c.condominium_id) || [];
        setPorteiroCondoIds(ids);

        if (ids.length > 0) {
          const { count } = await supabase
            .from("packages")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", ids)
            .eq("status", "pendente");

          setPendingPackages(count || 0);
        }
      } catch (error) {
        console.error("Error fetching pending packages:", error);
      }
    };

    fetchPendingPackages();
  }, [user, role]);

  // Realtime subscription for packages (porteiro)
  useEffect(() => {
    if (!user || role !== "porteiro" || porteiroCondoIds.length === 0) return;

    const channel = supabase
      .channel("packages-status-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "packages",
        },
        async () => {
          const { count } = await supabase
            .from("packages")
            .select("*", { count: "exact", head: true })
            .in("condominium_id", porteiroCondoIds)
            .eq("status", "pendente");

          setPendingPackages(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, porteiroCondoIds]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Até logo!", description: "Você saiu da sua conta." });
    navigate("/");
  };

  const getSuperAdminNavItems = (): NavStructure => {
    // Deep clone while preserving icon references
    const items: NavStructure = getBaseSuperAdminNavItems().map(item => {
      if (isNavGroup(item)) {
        return {
          ...item,
          items: item.items.map(subItem => ({ ...subItem }))
        };
      }
      // Add badge to Mensagens item if there are unread messages
      if (!isNavGroup(item) && item.url === "/superadmin/contact-messages" && unreadMessages > 0) {
        return { ...item, badge: unreadMessages };
      }
      return { ...item };
    });
    
    return items;
  };

  const getSindicoNavItems = (): NavStructure => [
    { title: "Início", url: "/dashboard", icon: Home },
    {
      title: "Gestão",
      icon: ClipboardList,
      items: [
        { title: "Condomínios", url: "/condominiums", icon: Building2 },
        { title: "Ocorrências", url: "/occurrences", icon: FileText },
        { title: "Análise de Defesas", url: "/defenses", icon: Scale, badge: pendingDefenses },
      ],
    },
    {
      title: "Serviços",
      icon: Package,
      items: [
        { title: "Encomendas", url: "/sindico/encomendas", icon: Package },
        { title: "Salão de Festas", url: "/party-hall", icon: PartyPopper },
        { title: "Porteiros", url: "/sindico/porteiros", icon: DoorOpen },
      ],
    },
    { title: "Notificações", url: "/notifications", icon: Bell },
    { title: "Relatórios", url: "/reports", icon: BarChart3 },
    {
      title: "Assinaturas",
      icon: Wallet,
      items: [
        { title: "Assinaturas", url: "/sindico/subscriptions", icon: CreditCard },
        { title: "Faturas", url: "/sindico/invoices", icon: Receipt },
      ],
    },
    { title: "Configurações", url: "/sindico/settings", icon: Settings },
  ];

  const navItems: NavStructure =
    role === "super_admin"
      ? getSuperAdminNavItems()
      : role === "sindico"
      ? getSindicoNavItems()
      : role === "porteiro"
      ? getPorteiroNavItems(pendingPackages)
      : residentNavItems;

  const getRoleConfig = () => {
    switch (role) {
      case "super_admin":
        return {
          title: "NOTIFICACONDO",
          subtitle: "Super Admin",
          icon: Shield,
        };
      case "sindico":
        return {
          title: "NOTIFICACONDO",
          subtitle: "Gestão Condominial",
          icon: Building2,
        };
      case "porteiro":
        return {
          title: "NOTIFICACONDO",
          subtitle: "Portaria",
          icon: DoorOpen,
        };
      default:
        return {
          title: "NOTIFICACONDO",
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
      case "porteiro":
        return "Porteiro";
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
      variant="sidebar"
    >
      {/* Header with Logo */}
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center justify-center w-full">
          <img 
            src={collapsed ? logoIcon : logoImage} 
            alt="NotificaCondo" 
            className={cn(
              "object-contain transition-all duration-200",
              collapsed ? "w-full h-14" : "w-full h-auto max-h-28"
            )} 
          />
        </div>
      </SidebarHeader>

      {/* Apartment Switcher for Residents */}
      {role === "morador" && !collapsed && <ApartmentSwitcher />}

      {/* Navigation */}
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                if (isNavGroup(item)) {
                  // Check if any child is active
                  const hasActiveChild = item.items.some(child => location.pathname === child.url);
                  const groupBadgeCount = item.items.reduce((acc, child) => acc + (child.badge || 0), 0);
                  
                  return (
                    <Collapsible key={item.title} defaultOpen={hasActiveChild} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={collapsed ? item.title : undefined}
                            className={cn(
                              "w-full h-11 rounded-full transition-all duration-300 ease-out",
                              hasActiveChild
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary hover:scale-[1.01]"
                            )}
                          >
                            <div className={cn(
                              "flex w-full items-center py-2.5",
                              collapsed ? "justify-center px-0 gap-0" : "gap-3 px-3"
                            )}>
                              <item.icon className={cn("w-5 h-5 shrink-0", collapsed && "mx-auto")} />
                              {!collapsed && (
                                <>
                                  <span className="font-medium flex-1 text-sm">{item.title}</span>
                                  {groupBadgeCount > 0 && (
                                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold mr-1">
                                      {groupBadgeCount > 99 ? "99+" : groupBadgeCount}
                                    </span>
                                  )}
                                  <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                </>
                              )}
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className={cn("mt-1 space-y-1", collapsed && "hidden")}>
                          {item.items.map((subItem) => {
                            const isSubActive = location.pathname === subItem.url;
                            return (
                              <SidebarMenuButton
                                key={subItem.title}
                                asChild
                                isActive={isSubActive}
                                className={cn(
                                  "w-full h-10 rounded-full transition-all duration-300 ease-out ml-4",
                                  isSubActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                )}
                              >
                                <NavLink
                                  to={subItem.url}
                                  className="flex w-full items-center gap-3 px-3 py-2"
                                  activeClassName=""
                                  onClick={() => isMobile && setOpenMobile(false)}
                                >
                                  <subItem.icon className="w-4 h-4 shrink-0" />
                                  <span className="font-medium flex-1 text-sm">{subItem.title}</span>
                                  {subItem.badge !== undefined && subItem.badge > 0 && (
                                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                                      {subItem.badge > 99 ? "99+" : subItem.badge}
                                    </span>
                                  )}
                                  {isSubActive && (
                                    <ChevronRight className="w-4 h-4 text-sidebar-primary" />
                                  )}
                                </NavLink>
                              </SidebarMenuButton>
                            );
                          })}
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                
                // Regular nav item
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "w-full h-11 rounded-full transition-all duration-300 ease-out",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary hover:scale-[1.01]"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/superadmin" || item.url === "/dashboard" || item.url === "/resident"}
                        className={cn(
                          "flex w-full items-center py-2.5",
                          collapsed
                            ? "justify-center px-0 gap-0"
                            : "gap-3 px-3"
                        )}
                        activeClassName=""
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <item.icon className={cn("w-5 h-5 shrink-0", collapsed && "mx-auto")} />
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
            {profileInfo?.avatar_url && (
              <AvatarImage 
                src={profileInfo.avatar_url} 
                alt={getUserName()}
                className="object-cover"
              />
            )}
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              <User className="w-5 h-5" />
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/notifications")}
                    className="relative p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    {pendingDefenses > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse">
                        {pendingDefenses > 9 ? "9+" : pendingDefenses}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{pendingDefenses > 0 ? `${pendingDefenses} defesa(s) pendente(s)` : "Nenhuma notificação pendente"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Sair da conta</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        {collapsed && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/notifications")}
                  className="relative p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {pendingDefenses > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse">
                      {pendingDefenses > 9 ? "9+" : pendingDefenses}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{pendingDefenses > 0 ? `${pendingDefenses} defesa(s) pendente(s)` : "Notificações"}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Sair</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarNavigation />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden w-full">
          <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/80 backdrop-blur-lg flex items-center justify-between px-3 md:px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <ThemeToggle />
          </header>
          <div className="flex-1 overflow-auto p-3 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
