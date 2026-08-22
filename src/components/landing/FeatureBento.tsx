import * as React from "react";

import { cn } from "@/lib/utils";

import { FEATURES } from "./landingContent";
import ScrollReveal from "./ScrollReveal";
import SpotlightCard from "./SpotlightCard";

/**
 * The feature grid.
 *
 * A bento rather than a uniform grid of cards, because the features are not
 * equally important and a grid that pretends otherwise makes the reader do the
 * ranking. Two `lg:col-span-3` cards open and close the block; the four in
 * between are `lg:col-span-2` and read as supporting detail.
 *
 * Every card is a `SpotlightCard`, so the whole section responds to the
 * cursor as one surface — which is the effect that makes a page like this feel
 * built rather than assembled.
 */
export function FeatureBento() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24 sm:py-28">
      {/* A blush wash behind the grid so it separates from the stacked cards
          above without a hard rule. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 0%, hsl(var(--lp-blush) / 0.9) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
            What is inside
          </p>
          <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
            Built around how this care actually runs
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-lp-plum/65">
            Not a meal-plan generator with a doctor bolted on. The clinical side and the
            daily side are the same product.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              // Cap the stagger: the seventh card should not wait 600ms.
              index={Math.min(index, 3)}
              className={cn("h-full", feature.span)}
            >
              <SpotlightCard className="h-full rounded-[24px]">
                <div
                  className={cn(
                    "lp-card flex h-full flex-col rounded-[24px] p-7",
                    feature.tone === "feature" && "sm:p-8",
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lp-blush text-lp-plum">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3
                    className={cn(
                      "mt-5 font-display font-normal leading-snug text-lp-plum",
                      feature.tone === "feature" ? "text-2xl" : "text-xl",
                    )}
                  >
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-lp-plum/65">{feature.body}</p>
                </div>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeatureBento;
