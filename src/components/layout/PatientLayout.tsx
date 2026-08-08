import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PatientSidebar } from "./PatientSidebar";
import { Outlet } from "react-router-dom";
import { Logo } from "@/components/ui/logo";
import NutritionChatbot from "@/components/chat/NutritionChatbot";

const PatientLayout = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <PatientSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="lg:hidden" />
            {/* The sidebar is off-canvas on small screens, so keep the brand here. */}
            <Logo size="sm" className="ml-2 lg:hidden" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <NutritionChatbot />
    </SidebarProvider>
  );
};

export default PatientLayout;