import { useMemo, useState, type ComponentType } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { showsCycleTracking, showsDiseaseDetection } from "@/lib/healthTrack";
import { Heart, HeartPulse, CalendarHeart, Sparkles } from "lucide-react";
import LifestyleTracker from "./LifestyleTracker";
import HealthRisks from "./HealthRisks";
import PeriodTracker from "./PeriodTracker";
import SkinTracker from "./SkinTracker";

/**
 * One destination for everything trackable, instead of a separate sidebar
 * item per tracker. The individual routes (/patient/health-check,
 * /patient/period-tracker, /patient/skin-tracker, /patient/lifestyle-tracker)
 * still work standalone for deep links — this just gives day-to-day
 * navigation a single "Track" entry instead of four.
 */
const TrackerHub = () => {
  const { healthTracks } = useApp();

  const tabs = useMemo(() => {
    const list: { id: string; label: string; icon: typeof Heart; Content: ComponentType }[] = [
      { id: "lifestyle", label: "Lifestyle", icon: Heart, Content: LifestyleTracker },
    ];
    if (healthTracks && showsDiseaseDetection(healthTracks)) {
      list.push({ id: "health-check", label: "Health Check", icon: HeartPulse, Content: HealthRisks });
    }
    if (healthTracks && showsCycleTracking(healthTracks)) {
      list.push({ id: "period", label: "Period", icon: CalendarHeart, Content: PeriodTracker });
      list.push({ id: "skin", label: "Skin & Acne", icon: Sparkles, Content: SkinTracker });
    }
    return list;
  }, [healthTracks]);

  const [active, setActive] = useState(tabs[0]?.id ?? "lifestyle");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  if (!activeTab) return null;

  return (
    <div>
      {tabs.length > 1 && (
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-border bg-background-elevated/95 px-4 pb-3 pt-4 backdrop-blur sm:mx-0 sm:mt-0 sm:border-none sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none">
          <Tabs value={active} onValueChange={setActive}>
            {/* Below `sm`, 4 icon+label tabs don't fit a `w-full` flex row
                without squeezing each label — let the list scroll horizontally
                instead of wrapping or truncating. */}
            <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:w-auto sm:justify-center">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 sm:flex-none sm:py-1.5"
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Each tab renders its full standalone page — same component used by
          the individual deep-link routes, unmodified. */}
      <div className={tabs.length > 1 ? "mt-5" : undefined}>
        <activeTab.Content />
      </div>
    </div>
  );
};

export default TrackerHub;
