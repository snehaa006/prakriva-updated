import * as React from "react";
import { Check } from "lucide-react";

import CardStack from "./CardStack";
import { JOURNEY_STEPS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";

/**
 * The four steps of a patient's journey, as a stack of cards that build up as
 * you scroll.
 *
 * The stacking is doing real work rather than decoration: these steps are
 * cumulative — a plan rests on a constitution, logs rest on a plan, a
 * practitioner's edit rests on the logs — and a pile where the earlier cards
 * stay visible along the top edge says that in a way four cards in a row
 * cannot.
 *
 * The section is tall on purpose (`min-h` per card): the stack needs scroll
 * distance to move through, and a short section would snap between states.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
            How it works
          </p>
          <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
            Constitution first. Calories second.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-lp-plum/65">
            Four steps, in the order a patient actually meets them — and each one rests
            on the one beneath it.
          </p>
        </ScrollReveal>

        <CardStack className="mt-14" offset={112} radius="28px">
          {JOURNEY_STEPS.map((step) => (
            <article
              key={step.step}
              className="lp-card overflow-hidden rounded-[28px] p-7 sm:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lp-plum text-lp-cream-hi">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-sm uppercase tracking-[0.2em] text-lp-mauve">
                      {step.eyebrow}
                    </span>
                    <span className="ml-auto font-display text-4xl font-light leading-none text-lp-plum/15 sm:text-5xl">
                      {step.step}
                    </span>
                  </div>

                  <h3 className="mt-6 max-w-lg font-display text-2xl font-normal leading-snug text-lp-plum sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-xl leading-relaxed text-lp-plum/65">{step.body}</p>
                </div>

                <ul className="space-y-3 lg:pt-4">
                  {step.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/60 px-4 py-3 text-sm text-lp-plum/75"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-mauve" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </CardStack>

        {/* The stack needs somewhere to travel. Without this the last card
            un-sticks the instant it arrives and the pile never resolves. */}
        <div aria-hidden="true" className="h-[42vh]" />
      </div>
    </section>
  );
}

export default HowItWorks;
