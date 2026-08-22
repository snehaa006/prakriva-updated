import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, PanelLeft } from "lucide-react";
import { DoctorSidebar } from "./DoctorSidebar";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import NutritionChatbot from "@/components/chat/NutritionChatbot";

const DoctorLayout = () => {
  // See PatientLayout: keyed on the path so each route replays the entrance.
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <DoctorSidebar collapsed={collapsed} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-14 items-center border-b border-border px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          {/* The sidebar is off-canvas on small screens, so keep the brand here. */}
          <Logo size="sm" className="ml-2 text-primary md:hidden" />

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

          <LanguageSwitcher />
        </header>
        <main key={pathname} className="flex-1 animate-page-in overflow-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Kuchu Puchu in clinical mode — same chatbot component, doctor mode */}
      <NutritionChatbot mode="doctor" />
    </div>
  );
};

export default DoctorLayout;
