import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const superAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/superadmin", icon: LayoutDashboard },
  { title: "Síndicos", url: "/superadmin/sindicos", icon: Users },
  { title: "Condomínios", url: "/superadmin/condominiums", icon: Building2 },
  { title: "Assinaturas", url: "/superadmin/subscriptions", icon: CreditCard },
  { title: "Logs", url: "/superadmin/logs", icon: FileText },
  { title: "WhatsApp", url: "/superadmin/whatsapp", icon: MessageCircle },
];

const sindicoNavItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Condomínios", url: "/condominiums", icon: Building2 },
  { title: "Ocorrências", url: "/occurrences", icon: FileText },
  { title: "Notificações", url: "/notifications", icon: Bell },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Configurações", url: "/sindico/settings", icon: Settings },
];

const residentNavItems: NavItem[] = [
  { title: "Dashboard", url: "/resident", icon: LayoutDashboard },
  { title: "Minhas Ocorrências", url: "/resident/occurrences", icon: FileText },
  { title: "Meu Perfil", url: "/resident/profile", icon: User },
];

function SidebarNavigation() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, residentInfo, loading } = useUserRole();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Até logo!", description: "Você saiu da sua conta." });
    navigate("/");
  };

  const navItems =
    role === "super_admin"
      ? superAdminNavItems
      : role === "sindico"
      ? sindicoNavItems
      : residentNavItems;

  const getRoleConfig = () => {
    switch (role) {
      case "super_admin":
        return {
          title: "Super Admin",
          subtitle: "Administração",
          icon: Shield,
          gradient: "from-red-500 to-orange-500",
        };
      case "sindico":
        return {
          title: "NotificaCondo",
          subtitle: "Gestão Condominial",
          icon: Building2,
          gradient: "from-primary to-accent",
        };
      default:
        return {
          title: "NotificaCondo",
          subtitle: "Área do Morador",
          icon: Home,
          gradient: "from-blue-500 to-cyan-500",
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
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const getUserName = () => {
    if (residentInfo?.full_name) {
      return residentInfo.full_name;
    }
    return user?.email || "Usuário";
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[260px]"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="p-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div
            className={cn(
              "rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0",
              config.gradient,
              collapsed ? "w-9 h-9" : "w-10 h-10"
            )}
          >
            <Icon className={cn("text-white", collapsed ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <span className="font-display text-lg font-bold text-sidebar-foreground block truncate">
                {config.title}
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                {config.subtitle}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto bg-sidebar-border" />

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "w-full transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/superadmin" || item.url === "/dashboard" || item.url === "/resident"}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                        activeClassName=""
                      >
                        <item.icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-5 h-5")} />
                        {!collapsed && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto">
        <Separator className="mb-4 bg-sidebar-border" />
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50",
            collapsed && "justify-center p-2"
          )}
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {getUserName()}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {role === "super_admin"
                  ? "Administrador"
                  : role === "sindico"
                  ? "Síndico"
                  : "Morador"}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-2"
          )}
        >
          <LogOut className={cn("w-4 h-4", !collapsed && "mr-2")} />
          {!collapsed && "Sair"}
        </Button>
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
          <header className="sticky top-0 z-40 h-14 border-b border-border/50 bg-background/80 backdrop-blur-lg flex items-center px-4 gap-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </header>
          <div className="flex-1 overflow-auto p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
