import { NavLink } from "react-router-dom";
import { Home, ChefHat, Heart, MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Home", url: "/patient/dashboard", icon: Home },
  { title: "Meals", url: "/patient/meal-logging", icon: ChefHat },
];

const tabsAfterAI = [
  { title: "Track", url: "/patient/tracker", icon: Heart },
];

function TabLink({ tab }: { tab: (typeof tabs)[number] }) {
  return (
    <NavLink
      to={tab.url}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-caption2 font-medium transition-all duration-150 ease-ios active:scale-90",
          isActive ? "text-primary" : "text-foreground-tertiary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <tab.icon className={cn("h-5 w-5", isActive && "fill-primary/15")} />
          {tab.title}
        </>
      )}
    </NavLink>
  );
}

/**
 * App-style phone navigation: a floating pill bar with a raised, glowing AI
 * button dead center — tap it to talk to the wellness companion instead of
 * navigating anywhere. "Community" and everything else lives under "More".
 */
export function PatientBottomNav({
  onMoreClick,
  onAIClick,
}: {
  onMoreClick: () => void;
  onAIClick: () => void;
}) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 md:hidden">
      <div className="glass relative flex items-stretch rounded-[28px] border border-border shadow-lg">
        {tabs.map((tab) => (
          <TabLink key={tab.title} tab={tab} />
        ))}

        {/* Center AI button — raised above the bar, with a soft glow. */}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={onAIClick}
            aria-label="Talk to your wellness companion"
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-pitta text-primary-foreground shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.5)] transition-all duration-200 ease-ios-spring hover:scale-105 active:scale-95"
          >
            <Sparkles className="h-6 w-6" />
            <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/30 blur-md" />
          </button>
        </div>

        {tabsAfterAI.map((tab) => (
          <TabLink key={tab.title} tab={tab} />
        ))}

        <button
          onClick={onMoreClick}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-caption2 font-medium text-foreground-tertiary transition-all duration-150 ease-ios active:scale-90"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
