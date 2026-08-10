// Marketing landing page.
//
// Composition only — each section owns its own layout and motion, and every
// call to action still lands on the same two routes the previous landing page
// used (`/auth/patient`, `/auth/doctor`). Nothing else in the app changed.

import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import CareSection from "@/components/landing/CareSection";
import AssistantSection from "@/components/landing/AssistantSection";
import CommunitySection from "@/components/landing/CommunitySection";
import PractitionerSection from "@/components/landing/PractitionerSection";
import LandingFooter from "@/components/landing/LandingFooter";

const Landing = () => (
  <div className="min-h-screen overflow-x-clip bg-background antialiased">
    <LandingNav />
    <main>
      <Hero />
      <CareSection />
      <AssistantSection />
      <CommunitySection />
      <PractitionerSection />
    </main>
    <LandingFooter />
  </div>
);

export default Landing;
