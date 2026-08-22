import * as React from "react";

import { SCENARIOS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";
import SpotlightCard from "./SpotlightCard";

/**
 * Three care pathways, described.
 *
 * This is the slot a landing page normally fills with testimonials, and it
 * deliberately does not. Prakriva has no users to quote yet; a row of invented
 * names and five-star faces would be the first dishonest thing on the page,
 * and a visitor deciding whether to trust a health product with her cycle
 * history deserves better than that. What she actually wants to know at this
 * point is "what happens on *my* pathway", which is what these answer.
 */
export function Scenarios() {
  return (
    <section id="scenarios" className="relative scroll-mt-20 py-24 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 100%, hsl(var(--lp-blush) / 0.85) 0%, transparent 72%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
            Care pathways
          </p>
          <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
            The same platform behaves differently for each of you
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-lp-plum/65">
            Pathways are a set, not a choice — pregnancy and PCOS routinely coexist, and
            a patient does not stop having one the month the other begins.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((scenario, index) => (
            <ScrollReveal key={scenario.tag} index={index} className="h-full">
              <SpotlightCard className="h-full rounded-[24px]">
                <article className="lp-card flex h-full flex-col rounded-[24px] p-7">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lp-blush text-lp-plum">
                      <scenario.icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-lp-mauve">
                      {scenario.tag}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-normal leading-snug text-lp-plum">
                    {scenario.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-lp-plum/65">{scenario.body}</p>
                </article>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Scenarios;
