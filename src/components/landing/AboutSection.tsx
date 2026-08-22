import * as React from "react";

import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";

import { BrandButterfly } from "./BrandMark";
import { STATS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";

/**
 * One figure, counted up the first time it is seen.
 *
 * `useCountUp` only animates *upward* and always lands on the exact value, so
 * holding the display at 0 until the tile is in view is what makes the count
 * happen at the right moment rather than silently before the visitor arrives.
 */
function StatTile({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, inView } = useInView({ threshold: 0.4 });
  const display = useCountUp(inView ? value : 0, { duration: 1100 });

  return (
    <div ref={ref} className="rounded-[24px] border border-lp-cream-hi/12 bg-lp-cream-hi/[0.06] p-6 backdrop-blur-md">
      <p className="font-display text-4xl font-light leading-none text-lp-cream-hi tabular-nums sm:text-5xl">
        {display.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="mt-3 text-sm leading-snug text-lp-cream/55">{label}</p>
    </div>
  );
}

/**
 * About us: what the product is for, and who it is for.
 *
 * On the deep plum ground so it reads as a pause between two light sections,
 * and because the cream mark only looks like the logo artwork against plum.
 */
export function AboutSection() {
  return (
    <section id="about" className="lp-deep lp-grain relative isolate scroll-mt-20 overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
          <div>
            <ScrollReveal>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-petal/70">
                About Prakriva
              </p>
              <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-cream-hi sm:text-5xl">
                Named for prakriti — the constitution you were born with
              </h2>
            </ScrollReveal>

            <ScrollReveal index={1}>
              <p className="mt-6 text-lg leading-relaxed text-lp-cream/65">
                Prakriva began as a maternal nutrition tool and kept running into the
                same wall: the women using it were not only pregnant. They had PCOS. They
                had a diagnosis that changed what a safe plan looked like. They had a
                doctor who could not see any of it.
              </p>
            </ScrollReveal>

            <ScrollReveal index={2}>
              <p className="mt-5 leading-relaxed text-lp-cream/55">
                So the product was rebuilt around care pathways rather than a single
                assumption, with one rule holding it together: nothing restrictive ever
                reaches a pregnancy, and nothing reaches a patient at all until a
                practitioner has read it. Ayurveda gives the reasoning, a clinician gives
                the sign-off, and the patient gets both in language she chose.
              </p>
            </ScrollReveal>

            <ScrollReveal index={3}>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {STATS.map((stat) => (
                  <StatTile key={stat.label} {...stat} />
                ))}
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal index={2} className="relative flex justify-center">
            <div className="relative flex aspect-square w-full max-w-md items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-[6%] animate-lp-halo rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle at 40% 36%, hsl(var(--lp-mauve) / 0.7) 0%, hsl(var(--lp-plum) / 0.5) 48%, transparent 74%)",
                }}
              />
              {[0, 1, 2].map((ring) => (
                <span
                  key={ring}
                  aria-hidden="true"
                  className="absolute rounded-full border border-lp-cream-hi/10"
                  style={{ inset: `${10 + ring * 9}%` }}
                />
              ))}
              <BrandButterfly tone="cream" className="relative h-auto w-[56%]" />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;
