import AboutSection from "@/components/landing/AboutSection";
import ClosingCta from "@/components/landing/ClosingCta";
import ContactSection from "@/components/landing/ContactSection";
import DoshaSection from "@/components/landing/DoshaSection";
import FaqSection from "@/components/landing/FaqSection";
import FeatureBento from "@/components/landing/FeatureBento";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingNav from "@/components/landing/LandingNav";
import ProductDemo from "@/components/landing/ProductDemo";
import RoleSplit from "@/components/landing/RoleSplit";
import Scenarios from "@/components/landing/Scenarios";

/**
 * The public landing page.
 *
 * Thin by design: every section owns its own copy, layout and behaviour under
 * `@/components/landing`, and this file is only the running order. That
 * ordering is the one decision worth making here, and it follows the
 * questions a visitor asks in sequence — what is this, show me, how does it
 * work, what is in it, what is a dosha, which door is mine, does it fit my
 * situation, who are you, what about…, how do I reach you, alright then.
 *
 * `scroll-smooth` is set on the wrapper rather than globally so it applies to
 * the in-page anchors here and nowhere in the app; the reduced-motion guard in
 * `src/index.css` overrides it back to `auto` for anyone who asked for that.
 *
 * `LandingNav` is fixed and floats over the hero on purpose — the bokeh runs
 * up under it — so the hero, not this wrapper, carries the top padding that
 * keeps the badge clear of the logo.
 */
const Landing = () => (
  <div className="lp-surface relative min-h-screen scroll-smooth overflow-x-hidden font-sans antialiased">
    <LandingNav />

    <main>
      <Hero />
      <ProductDemo />
      <HowItWorks />
      <FeatureBento />
      <DoshaSection />
      <RoleSplit />
      <Scenarios />
      <AboutSection />
      <FaqSection />
      <ContactSection />
      <ClosingCta />
    </main>

    <LandingFooter />
  </div>
);

export default Landing;
