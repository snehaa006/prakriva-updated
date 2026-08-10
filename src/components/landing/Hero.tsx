// Full-bleed editorial hero.
//
// The background is built from three heavily blurred colour fields drifting on
// long, offset loops plus a film-grain overlay, rather than a photograph. That
// keeps the hero weightless (no image request, no layout shift) while still
// giving the "photograph of light" quality the brand leans on, and it inverts
// cleanly in dark mode because every field is a themed token.

import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParallaxLayer } from "@/hooks/useReveal";

const TRUST_BADGES = [
  { icon: Sparkles, label: "AI-guided plans" },
  { icon: Stethoscope, label: "Reviewed by doctors" },
  { icon: ShieldCheck, label: "Private by default" },
];

export const Hero = () => {
  const navigate = useNavigate();
  const fieldsRef = useParallaxLayer<HTMLDivElement>(0.18);
  const contentRef = useParallaxLayer<HTMLDivElement>(0.06);

  return (
    <section className="grain relative isolate flex min-h-[100svh] items-center overflow-hidden bg-gradient-cream pt-28 pb-20">
      {/* Colour fields */}
      <div ref={fieldsRef} className="absolute inset-0 -z-10">
        <div
          className="blush-field animate-drift left-[-10%] top-[-8%] h-[42rem] w-[42rem]"
          style={{ background: "hsl(var(--blush))" }}
        />
        <div
          className="blush-field animate-drift-slow right-[-14%] top-[6%] h-[38rem] w-[38rem]"
          style={{ background: "hsl(var(--petal))" }}
        />
        <div
          className="blush-field animate-drift bottom-[-18%] left-[28%] h-[34rem] w-[34rem]"
          style={{ background: "hsl(var(--apricot))", animationDelay: "-8s" }}
        />
        {/* Settles the bottom edge into the next section. */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div ref={contentRef} className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="glass-panel mx-auto mb-8 inline-flex animate-fade-in items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--rose-accent))]" />
            Women's health, reimagined
          </p>

          <h1 className="animate-fade-up font-display text-[clamp(2.75rem,8vw,5.5rem)] font-light leading-[1.02] tracking-[-0.02em] text-foreground">
            Care that begins
            <br />
            with <em className="font-normal italic text-gradient-rose">you</em>.
          </h1>

          <p
            className="mx-auto mt-7 max-w-xl animate-fade-up text-base leading-relaxed text-foreground/70 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Prakriva pairs Ayurvedic wisdom with modern AI to read your body's signals —
            nutrition, cycles, pregnancy and everyday wellbeing — and turns them into a plan
            your doctor can stand behind.
          </p>

          <div
            className="mt-10 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "220ms" }}
          >
            <Button
              size="lg"
              className="group h-14 w-full rounded-full bg-gradient-rose px-8 text-base text-white shadow-[0_16px_40px_-16px_hsl(345_50%_40%/0.7)] transition-transform hover:scale-[1.03] hover:opacity-95 sm:w-auto"
              onClick={() => navigate("/auth/patient")}
            >
              Begin your journey
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="glass-panel h-14 w-full rounded-full border-transparent px-8 text-base text-foreground hover:bg-foreground/5 sm:w-auto"
              onClick={() => navigate("/auth/doctor")}
            >
              I'm a practitioner
            </Button>
          </div>

          {/* Trust badges — the small stamped ovals from the brand references. */}
          <ul
            className="mt-14 flex animate-fade-up flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "320ms" }}
          >
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="glass-panel flex items-center gap-2 rounded-full px-4 py-2 text-[0.7rem] uppercase tracking-[0.14em] text-foreground/65"
              >
                <Icon className="h-3.5 w-3.5 text-[hsl(var(--rose-accent))]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Hero;
