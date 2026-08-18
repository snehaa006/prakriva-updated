import { useState } from "react";
import { Outlet } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { PatientSidebar } from "./PatientSidebar";
import { PatientBottomNav } from "./PatientBottomNav";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import NutritionChatbot from "@/components/chat/NutritionChatbot";
import { LanguageSwitcher } from "@/components/LanguageSelect";

const PatientLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* Soft warm wash instead of a flat background — a companion app should
          feel a little less clinical than a settings screen. Both layers are
          tinted accents at single-digit alpha, so the wash reads as light
          falling on the page rather than as a coloured background. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 620px at 12% -8%, hsl(var(--primary) / 0.07) 0%, transparent 60%), radial-gradient(900px 520px at 100% 2%, hsl(var(--vata) / 0.05) 0%, transparent 55%)",
        }}
      />
      <PatientSidebar collapsed={collapsed} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Deliberately thin: on a phone the brand mark, on a desktop just the
            sidebar toggle. Nothing else belongs up here, so it shouldn't take
            a full toolbar's height. */}
        <header className="glass sticky top-0 z-30 flex h-12 items-center border-b border-border px-4 lg:px-6">
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

          {/* The language is changeable from every screen, not only from
              Settings — that is the difference between "the app has a language
              setting" and "the app is multilingual". */}
          <LanguageSwitcher />
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
