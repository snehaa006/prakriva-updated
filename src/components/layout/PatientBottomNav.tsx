import { NavLink } from "react-router-dom";
import { Home, ChefHat, Activity, MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Today", url: "/patient/today", icon: Home },
  // Plans, plan creation, progress and the kitchen list — one destination.
  { title: "Plan", url: "/patient/plans", icon: ChefHat },
];

// The daily tracker, not the old combined "Track" tab: lifestyle logging is
// the one thing a patient opens every day, so it gets the thumb-reachable
// slot. The health check and the cycle trackers are one tap further, under
// "More" (and in the sidebar's main menu on a larger screen).
const tabsAfterAI = [
  { title: "Lifestyle", url: "/patient/lifestyle-tracker", icon: Activity },
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
 * App-style phone navigation: a floating pill bar with a raised AI button dead
 * center — tap it to talk to the wellness companion instead of navigating
 * anywhere. "Community" and everything else lives under "More".
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

        {/* Center AI button — raised above the bar. Stays inside the accent
            family (a burgundy-to-blush fade) rather than fading out to the
            pitta orange, which read as an alert badge against the rest of the
            palette; and it sits still, since a pulsing glow above the thumb is
            hard to ignore on a screen meant to feel calm. */}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={onAIClick}
            aria-label="Talk to your wellness companion"
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow-gold ring-4 ring-background/80 transition-all duration-200 ease-ios-spring hover:scale-105 hover:brightness-110 active:scale-95"
          >
            <Sparkles className="h-6 w-6" />
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
