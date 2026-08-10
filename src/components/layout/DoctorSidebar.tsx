import { NavLink } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Plus,
  Search,
  ChefHat,
  FileText,
  Settings,
  User,
  LogOut,
  Stethoscope,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/doctor/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Patients",
    url: "/doctor/patients",
    icon: Users,
  },
  {
    title: "Add Patient",
    url: "/doctor/add-patient",
    icon: Plus,
  },
  {
    title: "Patient Analysis",
    url: "/doctor/patient-analysis",
    icon: Stethoscope,
  },
  {
    title: "Food Explorer",
    url: "/doctor/food-explorer",
    icon: Search,
  },
  {
    title: "Recipe Builder",
    url: "/doctor/recipes",
    icon: ChefHat,
  },
  {
    title: "Diet Charts",
    url: "/doctor/diet-charts",
    icon: FileText,
  },
];

const accountItems = [
  {
    title: "Profile",
    url: "/doctor/profile",
    icon: User,
  },
  {
    title: "Settings",
    url: "/doctor/settings",
    icon: Settings,
  },
];

interface DoctorSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function NavItem({
  title,
  url,
  Icon,
  collapsed,
  onNavigate,
}: {
  title: string;
  url: string;
  Icon: typeof LayoutDashboard;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <NavLink
      to={url}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-ios",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-accent-soft text-accent-soft-foreground"
            : "text-sidebar-foreground hover:bg-accent-soft/60",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{title}</span>}
    </NavLink>
  );

  if (!collapsed) {
    return <li>{link}</li>;
  }

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{title}</TooltipContent>
      </Tooltip>
    </li>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { user, setUser } = useApp();

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brand */}
      <div className="flex items-center justify-center border-b border-sidebar-border px-4 pb-4 pt-4">
        <NavLink to="/doctor/dashboard" className="flex items-center justify-center">
          <Logo size={collapsed ? "sm" : "lg"} />
        </NavLink>
      </div>

      {/* User Info */}
      {user && (
        <div className="border-b border-sidebar-border p-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "space-x-3")}>
            <Avatar className="h-10 w-10 bg-gradient-primary">
              <AvatarFallback className="bg-transparent">
                <User className="h-5 w-5 text-primary-foreground" />
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">Healthcare Provider</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
        <div className="flex flex-col gap-1">
          {!collapsed && (
            <div className="flex h-8 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
              Main Menu
            </div>
          )}
          <ul className="flex w-full min-w-0 flex-col gap-1">
            {navigationItems.map((item) => (
              <NavItem
                key={item.title}
                title={item.title}
                url={item.url}
                Icon={item.icon}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>

        {/* Account Settings */}
        <div className="flex flex-col gap-1">
          {!collapsed && (
            <div className="flex h-8 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
              Account
            </div>
          )}
          <ul className="flex w-full min-w-0 flex-col gap-1">
            {accountItems.map((item) => (
              <NavItem
                key={item.title}
                title={item.title}
                url={item.url}
                Icon={item.icon}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
            <li>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center justify-center gap-3 rounded-xl px-0 py-2.5 text-sm font-medium text-sidebar-foreground transition-all duration-150 ease-ios hover:bg-accent-soft/60"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground transition-all duration-150 ease-ios hover:bg-accent-soft/60"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Logout</span>
                </button>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DoctorSidebar({ collapsed, mobileOpen, onMobileOpenChange }: DoctorSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 md:block",
          collapsed ? "w-16" : "w-64",
          "transition-[width] duration-200 ease-ios",
        )}
      >
        <div className="glass m-3 flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl shadow-md">
          <SidebarBody collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground [&>button]:z-20">
          <SidebarBody collapsed={false} onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
