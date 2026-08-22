import * as React from "react";
import { ArrowRight, PlayCircle, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { Bokeh, MuhlyField } from "./Atmosphere";
import { BrandButterfly } from "./BrandMark";
import { CARE_TRACKS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";

/**
 * The hero.
 *
 * Composed in three layers, back to front: the bokeh drifting behind
 * everything, the muhly grass field rooted along the bottom edge, and the
 * copy on top. The grass is *behind* the text but *in front of* the bokeh,
 * which is what gives the section depth rather than the flat "gradient with
 * words on it" that most of this genre settles for.
 *
 * The headline is set in the display serif at a size the rest of the page
 * never reaches again. One element gets to be the largest thing on a page;
 * spending it anywhere but here is a waste.
 */
export function Hero() {
  const navigate = useNavigate();

  return (
    <section id="top" className="lp-grain relative isolate overflow-hidden pb-0 pt-28 sm:pt-36">
      <Bokeh />

      {/* A hairline vignette at the very top, so the fixed header has
          something to sit against before it frosts. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--lp-cream-hi) / 0.85), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="relative z-10 max-w-2xl">
            {/* Below `lg` the second column is dropped, so the mark comes
                inline above the headline instead — a phone should not be the
                one place the brand never appears. */}
            <ScrollReveal className="mb-7 lg:hidden">
              <BrandButterfly tone="plum" animate delay={120} className="h-14 w-auto" />
            </ScrollReveal>

            <ScrollReveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-lp-plum/15 bg-lp-cream-hi/70 py-1.5 pl-1.5 pr-4 text-sm text-lp-plum backdrop-blur-md">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-plum px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-lp-cream-hi">
                  <Sparkles className="h-3 w-3" />
                  Ayurveda
                </span>
                <span className="text-lp-plum/75">for every stage a woman moves through</span>
              </span>
            </ScrollReveal>

            <ScrollReveal index={1}>
              <h1 className="mt-7 font-display text-[3.25rem] font-light leading-[0.98] tracking-[-0.015em] sm:text-7xl lg:text-[5.25rem]">
                <span className="lp-ink-gradient block">Nutrition that</span>
                <span className="lp-ink-gradient block">follows her,</span>
                <span className="block italic text-lp-mauve">not the average.</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal index={2}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-lp-plum/75 sm:text-xl">
                Prakriva pairs Ayurvedic constitution with the tracking a pregnancy or a
                PCOS diagnosis actually needs — and puts a verified practitioner on the
                other side of the same record.
              </p>
            </ScrollReveal>

            <ScrollReveal index={3}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth/patient")}
                  className="group h-[3.25rem] gap-2 rounded-full bg-lp-plum px-7 text-base text-lp-cream-hi shadow-lg shadow-lp-plum/20 hover:bg-lp-plum/90"
                >
                  Start your profile
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-ios group-hover:translate-x-0.5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-[3.25rem] gap-2 rounded-full border-lp-plum/20 bg-lp-cream-hi/60 px-7 text-base text-lp-plum backdrop-blur-md hover:bg-lp-cream-hi"
                >
                  <a href="#demo">
                    <PlayCircle className="h-4 w-4" />
                    See it working
                  </a>
                </Button>
              </div>
            </ScrollReveal>

            <ScrollReveal index={4}>
              <ul className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-lp-plum/65">
                <li className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-lp-mauve" />
                  Every plan reviewed by a practitioner
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-lp-mauve" />
                  Row-level secured records
                </li>
              </ul>
            </ScrollReveal>
          </div>

          {/* The mark, given room to breathe. Below `lg` the two columns
              collapse and this is dropped rather than squeezed — a shrunken
              version under the headline would just be a logo twice. */}
          <ScrollReveal index={2} className="relative hidden justify-center lg:flex">
            <div className="relative flex aspect-square w-full max-w-[30rem] items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-[8%] animate-lp-halo rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 42% 38%, hsl(var(--lp-cream-hi) / 0.95) 0%, hsl(var(--lp-petal) / 0.65) 45%, transparent 72%)",
                }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-[14%] rounded-full border border-lp-cream-lo/50"
              />
              <span
                aria-hidden="true"
                className="absolute inset-[24%] rounded-full border border-lp-cream-lo/35"
              />
              <BrandButterfly
                tone="plum"
                animate
                delay={250}
                className="relative h-auto w-[58%] drop-shadow-[0_18px_36px_hsl(var(--lp-plum)/0.28)]"
              />
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* The field. Tall enough to be a horizon rather than a border. Its
          `ground` matches the strip below so the blades bed into it instead of
          stopping dead on the seam. */}
      <MuhlyField className="relative mt-16 h-44 w-full sm:h-56 lg:-mt-10 lg:h-64" />

      {/* Care pathways, on the band the grass grows out of. This is the slot a
          SaaS page fills with customer logos; there are none to show, and a
          row of invented ones would be the first lie on the page. No top
          border — the field's ground gradient is the transition. */}
      <div className="relative border-b border-lp-cream-lo/40 bg-lp-cream-hi/70 backdrop-blur-md">
        <div className="mx-auto max-w-7xl overflow-hidden px-5 py-5 sm:px-8">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-lp-plum/45">
            Care pathways the platform is built around
          </p>
          {/* Two copies of the list, so the -50% loop lands on a seam that
              does not exist. The second is hidden from assistive tech. */}
          <div className="relative">
            <div className="lp-marquee gap-3">
              {[0, 1].map((copy) => (
                <ul
                  key={copy}
                  aria-hidden={copy === 1 ? "true" : undefined}
                  className="flex shrink-0 items-center gap-3 pr-3"
                >
                  {CARE_TRACKS.map((track) => (
                    <li
                      key={`${copy}-${track.label}`}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-lp-cream-lo/60 bg-lp-cream-hi px-4 py-2 text-sm text-lp-plum/80"
                    >
                      <track.icon className="h-3.5 w-3.5 text-lp-mauve" />
                      {track.label}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
            {/* Fade the strip into the page at both ends rather than cutting
                it off mid-pill. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-16"
              style={{ background: "linear-gradient(to right, hsl(var(--lp-cream-hi)), transparent)" }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-16"
              style={{ background: "linear-gradient(to left, hsl(var(--lp-cream-hi)), transparent)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
