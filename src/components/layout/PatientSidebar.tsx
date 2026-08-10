import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  Home, 
  Calendar, 
  TrendingUp, 
  Bell,
  ShoppingCart,
  Settings,
  User,
  LogOut,
  Heart,
  ChefHat,
  Activity,
  Users,
  Stethoscope,
  HeartPulse,
  CalendarHeart,
  Sparkles
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useApp } from "@/context/AppContext";
import { describeHealthTracks, type HealthTrack } from "@/lib/healthTrack";

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
    title: "Consult Doctor",
    url: "/patient/consult-doctor",
    icon: Stethoscope,
  },
  // {
  //   title: "Today's Plan",
  //   url: "/patient/meal-plan",
  //   icon: Calendar,
  // },
  {
    title: "Meal Logging",
    url: "/patient/meal-logging",
    icon: ChefHat,
  },
  {
    title: "My Kitchen",
    url: "/patient/pantry",
    icon: ShoppingCart,
  },
  {
    title: "Health Check",
    url: "/patient/health-check",
    icon: HeartPulse,
    tracks: ["pregnancy"],
  },
  {
    title: "Period Tracker",
    url: "/patient/period-tracker",
    icon: CalendarHeart,
    tracks: ["pcos"],
  },
  {
    title: "Skin & Acne",
    url: "/patient/skin-tracker",
    icon: Sparkles,
    tracks: ["pcos"],
  },
  // {
  //   title: "Symptom Tracking",
  //   url: "/patient/symptom-tracking",
  //   icon: Activity,
  // },
  {
    title: "Social Support",
    url: "/patient/social-support",
    icon: Users,
  },
  {
    title: "Reminders",
    url: "/patient/reminders",
    icon: Bell,
  },
  {
    title: "Tracker",
    url: "/patient/lifestyle-tracker",
    icon: Heart,
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

export function PatientSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, setUser, healthTracks } = useApp();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  // Until the tracks have loaded, show only the items that apply to everyone —
  // better a menu that fills in than one that shows a maternal health check to
  // a PCOS patient for a second and then takes it away.
  const visibleItems = navigationItems.filter(
    (item) =>
      !item.tracks ||
      (healthTracks !== null && item.tracks.some((t) => healthTracks.includes(t)))
  );

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "hover:bg-sidebar-accent/50";

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />
      
      <SidebarContent>
        {/* Brand */}
        <div className="px-4 pb-4 border-b border-sidebar-border">
          <NavLink to="/patient/dashboard" className="flex items-center justify-center">
            <Logo size={isCollapsed ? "sm" : "lg"} />
          </NavLink>
        </div>

        {/* User Info */}
        {!isCollapsed && user && (
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  {healthTracks ? describeHealthTracks(healthTracks) : "Patient"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  {!isCollapsed && <span>Logout</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}