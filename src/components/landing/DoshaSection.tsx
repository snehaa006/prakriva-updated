import * as React from "react";

import { cn } from "@/lib/utils";

import { DOSHAS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";
import SpotlightCard from "./SpotlightCard";

/**
 * The three doshas.
 *
 * The one place on the page where colour outside the brand family is allowed:
 * `--vata` / `--pitta` / `--kapha` are domain colours that carry clinical
 * meaning throughout the product, and re-tinting them pink here would teach a
 * visitor the wrong association before she ever signs in.
 *
 * Every card names its dosha and its elements in words, so the distinction
 * never rests on hue — the same rule the app follows internally.
 */
export function DoshaSection() {
  return (
    <section id="doshas" className="relative scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
          <ScrollReveal className="lg:sticky lg:top-28">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
              Prakriti
            </p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
              Three constitutions, kept first-class
            </h2>
            <p className="mt-4 leading-relaxed text-lp-plum/65">
              Vata, pitta and kapha are not a quiz result the app files away. They decide
              which foods a plan reaches for, what it avoids, and the sentence of
              plain-language reasoning attached to every recommendation.
            </p>
            <p className="mt-4 leading-relaxed text-lp-plum/65">
              Your balance is re-read whenever your body changes — a pregnancy, a
              diagnosis, a season.
            </p>
          </ScrollReveal>

          <div className="space-y-4">
            {DOSHAS.map((dosha, index) => (
              <ScrollReveal key={dosha.name} index={index}>
                <SpotlightCard className="rounded-[24px]" intensity={4}>
                  <article className="lp-card rounded-[24px] p-7">
                    <div className="flex items-start gap-4">
                      <span
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
                          dosha.swatch,
                        )}
                      >
                        <dosha.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h3 className="font-display text-2xl text-lp-plum">{dosha.name}</h3>
                          <span className={cn("text-xs font-medium uppercase tracking-wider", dosha.text)}>
                            {dosha.element}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-lp-plum/65">{dosha.body}</p>
                        <ul className="mt-4 flex flex-wrap gap-1.5">
                          {dosha.favours.map((item) => (
                            <li
                              key={item}
                              className="rounded-full border border-lp-cream-lo/60 bg-lp-cream-hi/70 px-3 py-1 text-xs text-lp-plum/70"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                </SpotlightCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default DoshaSection;
