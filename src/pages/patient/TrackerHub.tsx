import { useMemo, useState, type ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { showsCycleTracking } from "@/lib/healthTrack";
import { CalendarHeart, Sparkles } from "lucide-react";
import PeriodTracker from "./PeriodTracker";
import SkinTracker from "./SkinTracker";

/**
 * Cycle and skin logging, together.
 *
 * This used to hold every tracker — lifestyle, health check, period and skin —
 * behind one "Track" tab, which meant a patient logging her water intake and a
 * patient running a maternal screening both landed on the same tab picker
 * first. Those two now have their own navigation entries
 * (`/patient/lifestyle-tracker` and `/patient/health-check`).
 *
 * What is left is the pair that really is one routine: a PCOS patient logging
 * a cycle usually logs her skin in the same sitting, and the analyses read
 * each other's data. A patient who isn't on the cycle track has nothing here,
 * so she goes to her daily tracker instead of an empty page.
 */
const TrackerHub = () => {
  const { healthTracks } = useApp();

  const tabs = useMemo(() => {
    const list: {
      id: string;
      label: string;
      icon: typeof CalendarHeart;
      Content: ComponentType;
    }[] = [];

    if (healthTracks && showsCycleTracking(healthTracks)) {
      list.push({ id: "period", label: "Period", icon: CalendarHeart, Content: PeriodTracker });
      list.push({ id: "skin", label: "Skin & Acne", icon: Sparkles, Content: SkinTracker });
    }
    return list;
  }, [healthTracks]);

  const [active, setActive] = useState("period");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  // Still loading her tracks — render nothing rather than redirecting a
  // patient who does belong here.
  if (healthTracks === null) return null;
  if (!activeTab) return <Navigate to="/patient/lifestyle-tracker" replace />;

  return (
    <div>
      {tabs.length > 1 && (
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-border bg-background-elevated/95 px-4 pb-3 pt-4 backdrop-blur sm:mx-0 sm:mt-0 sm:border-none sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-none">
          <Tabs value={activeTab.id} onValueChange={setActive}>
            <TabsList className="scroll-area flex w-full justify-start gap-1 overflow-x-auto sm:w-auto sm:justify-center">
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
