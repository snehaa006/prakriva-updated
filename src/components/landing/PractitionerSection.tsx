// The doctor half of the platform, and the closing call to action.
//
// Both entry points that the old landing page offered (patient sign-up and
// doctor sign-up) still live here — this is the section that carries the
// doctor route, so the two audiences each get a real front door.

import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck, ClipboardList, LineChart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";

const TOOLS = [
  { icon: Users, label: "Patient roster with live adherence" },
  { icon: ClipboardList, label: "Diet chart builder and recipe library" },
  { icon: LineChart, label: "Screening results and risk trends" },
  { icon: CalendarCheck, label: "Consultations, alerts and messaging" },
];

export const PractitionerSection = () => {
  const ref = useReveal<HTMLElement>();
  const navigate = useNavigate();

  return (
    <section id="doctors" ref={ref} className="pb-24 sm:pb-32">
      <div className="container mx-auto px-4">
        <div className="reveal grain relative isolate overflow-hidden rounded-5xl border border-border/60 px-6 py-16 sm:px-14 sm:py-20">
          <div className="absolute inset-0 -z-10 bg-gradient-blush" />
          <div
            className="blush-field animate-drift-slow right-[-6%] top-[-20%] h-[26rem] w-[26rem]"
            style={{ background: "hsl(var(--blush-deep))", opacity: 0.6 }}
          />

          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.22em] text-foreground/60">
                For practitioners
              </p>
              <h2 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] font-light leading-[1.08] tracking-[-0.02em]">
                Your clinic, with the
                <em className="italic"> paperwork gone</em>.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/70">
                Build Ayurvedic diet charts, watch adherence between visits, and open every
                consultation already knowing what changed.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="group h-14 rounded-full bg-foreground px-8 text-base text-background transition-transform hover:scale-[1.03] hover:bg-foreground/90"
                  onClick={() => navigate("/auth/doctor")}
                >
                  Join as a practitioner
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="glass-panel h-14 rounded-full border-transparent px-8 text-base text-foreground hover:bg-foreground/5"
                  onClick={() => navigate("/auth/patient")}
                >
                  I'm looking for care
                </Button>
              </div>
            </div>

            <ul className="grid gap-3">
              {TOOLS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="glass-panel flex items-center gap-4 rounded-3xl px-5 py-4 text-sm text-foreground/80"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/60">
                    <Icon className="h-4 w-4 text-[hsl(var(--rose-accent))]" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PractitionerSection;
