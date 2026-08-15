import { NavLink } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Bell,
  ShoppingCart,
  ShoppingBag,
  Settings,
  User,
  LogOut,
  Heart,
  ChefHat,
  Users,
  Stethoscope,
  Utensils,
  MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useApp } from "@/context/AppContext";
import { describeHealthTracks, type HealthTrack } from "@/lib/healthTrack";
import { cn } from "@/lib/utils";

/**
 * Items every patient sees, plus the ones that only apply to a care pathway.
 * `tracks` is the whitelist: absent means "everyone", and an item shows when
 * the patient is on *any* of its tracks.
 *
 * Health Check is the maternal disease screening, so it is pregnancy-only —
 * the models behind it are trained on pregnancy conditions and would score a
 * patient who is not pregnant against conditions her answers were never about.
 * A PCOS patient gets the period and skin trackers in its place; a patient who
 * is both pregnant and has PCOS gets all three, because both are true of her.
 */
const navigationItems: {
  title: string;
  url: string;
  icon: typeof Home;
  tracks?: HealthTrack[];
}[] = [
  {
    title: "Dashboard",
    url: "/patient/dashboard",
    icon: Home,
  },
  {
    title: "Meal Logging",
    url: "/patient/meal-logging",
    icon: ChefHat,
  },
  {
    title: "Track",
    url: "/patient/tracker",
    icon: Heart,
  },
  {
    title: "Community",
    url: "/patient/community",
    icon: Users,
  },
  {
    title: "Shop",
    url: "/patient/shop",
    icon: ShoppingBag,
  },
];

/**
 * Everything else — used less often than the four above, so it lives under
 * "More" instead of competing for space in the primary list. Individual
 * routes still exist and still work when linked to directly.
 */
const moreItems: {
  title: string;
  url: string;
  icon: typeof Home;
  tracks?: HealthTrack[];
}[] = [
  {
    title: "Consult Doctor",
    url: "/patient/consult-doctor",
    icon: Stethoscope,
  },
  {
    title: "My Kitchen",
    url: "/patient/pantry",
    icon: ShoppingCart,
  },
  {
    title: "Food Compatibility",
    url: "/patient/food-compatibility",
    icon: Utensils,
  },
  {
    title: "Reminders",
    url: "/patient/reminders",
    icon: Bell,
  },
];

const accountItems = [
  {
    title: "Profile",
    url: "/patient/profile",
    icon: User,
  },
  {
    title: "Settings",
    url: "/patient/settings",
    icon: Settings,
  },
];

interface PatientSidebarProps {
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
  Icon: typeof Home;
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
  const { user, setUser, healthTracks } = useApp();

  // Until the tracks have loaded, show only the items that apply to everyone —
  // better a menu that fills in than one that shows a maternal health check to
  // a PCOS patient for a second and then takes it away.
  const visibleItems = navigationItems.filter(
    (item) =>
      !item.tracks ||
      (healthTracks !== null && item.tracks.some((t) => healthTracks.includes(t))),
  );

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border px-4 pb-4 pt-4",
          collapsed ? "justify-center" : "justify-center",
        )}
      >
        <NavLink to="/patient/dashboard" className="flex items-center justify-center">
          <Logo size={collapsed ? "sm" : "lg"} />
        </NavLink>
      </div>

      {/* User Info */}
      {user && (
        <div className="border-b border-sidebar-border p-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "space-x-3")}>
            <Avatar className="h-10 w-10 bg-gradient-secondary">
              <AvatarFallback className="bg-transparent">
                <User className="h-5 w-5 text-secondary-foreground" />
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">
                  {healthTracks ? describeHealthTracks(healthTracks) : "Patient"}
                </p>
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
            {visibleItems.map((item) => (
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

        {/* More */}
        <div className="flex flex-col gap-1">
          {!collapsed && (
            <div className="flex h-8 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
              More
            </div>
          )}
          <ul className="flex w-full min-w-0 flex-col gap-1">
            {moreItems
              .filter(
                (item) =>
                  !item.tracks ||
                  (healthTracks !== null && item.tracks.some((t) => healthTracks.includes(t))),
              )
              .map((item) => (
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

export function PatientSidebar({ collapsed, mobileOpen, onMobileOpenChange }: PatientSidebarProps) {
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
