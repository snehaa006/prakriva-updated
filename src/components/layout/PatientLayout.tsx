import { useState } from "react";
import { Outlet } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { PatientSidebar } from "./PatientSidebar";
import { PatientBottomNav } from "./PatientBottomNav";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import NutritionChatbot from "@/components/chat/NutritionChatbot";

const PatientLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* Soft warm wash instead of a flat background — a companion app should
          feel a little less clinical than a settings screen. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% -10%, hsl(var(--accent-soft)) 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, hsl(var(--vata) / 0.08) 0%, transparent 50%)",
        }}
      />
      <PatientSidebar collapsed={collapsed} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-14 items-center border-b border-border px-4 lg:px-6">
          {/* Primary phone navigation moved to the bottom tab bar — this is
              just the brand mark and, on larger screens, the collapse toggle. */}
          <Logo size="sm" className="md:hidden" />

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 md:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>

          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-auto p-4 pb-28 md:p-6 md:pb-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <PatientBottomNav onMoreClick={() => setMobileOpen(true)} onAIClick={() => setChatOpen(true)} />
      <NutritionChatbot open={chatOpen} onOpenChange={setChatOpen} hideTrigger />
    </div>
  );
};

export default PatientLayout;
