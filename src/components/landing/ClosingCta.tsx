import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { MuhlyField } from "./Atmosphere";
import { BrandButterfly } from "./BrandMark";
import ScrollReveal from "./ScrollReveal";

/**
 * The last ask.
 *
 * Deliberately the quietest section on the page — one line, two buttons, and
 * the field again. A visitor who has scrolled this far has read the argument;
 * repeating it here in a louder voice is the point at which a landing page
 * starts nagging.
 *
 * The grass returns so the page closes on the image it opened with.
 */
export function ClosingCta() {
  const navigate = useNavigate();

  return (
    <section className="lp-deep lp-grain relative isolate overflow-hidden">
      <div className="relative mx-auto max-w-4xl px-5 pb-56 pt-24 text-center sm:px-8 sm:pb-64 sm:pt-32">
        <ScrollReveal className="flex justify-center">
          <BrandButterfly tone="cream" className="h-16 w-auto opacity-90" />
        </ScrollReveal>

        <ScrollReveal index={1}>
          <h2 className="mt-8 font-display text-4xl font-light leading-tight text-lp-cream-hi sm:text-6xl">
            Start where your body actually is
          </h2>
        </ScrollReveal>

        <ScrollReveal index={2}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-lp-cream/60">
            A profile takes about four minutes. Everything after it is built from your
            answers and read by a practitioner before it reaches you.
          </p>
        </ScrollReveal>

        <ScrollReveal index={3}>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/auth/patient")}
              className="group h-[3.25rem] gap-2 rounded-full bg-lp-cream-hi px-8 text-base text-lp-plum-deep hover:bg-lp-cream"
            >
              Create your account
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-ios group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth/doctor")}
              className="h-[3.25rem] rounded-full border-lp-cream-hi/25 bg-transparent px-8 text-base text-lp-cream-hi hover:bg-lp-cream-hi/10 hover:text-lp-cream-hi"
            >
              I'm a practitioner
            </Button>
          </div>
        </ScrollReveal>
      </div>

      {/* The field again, closing the page on the image it opened with. Its
          ground is the deep plum this section is painted in, so the blades
          bed into the footer edge rather than stopping on it. */}
      <MuhlyField
        ground="var(--lp-plum-deep)"
        className="absolute inset-x-0 bottom-0 h-44 opacity-50 sm:h-52"
      />
    </section>
  );
}

export default ClosingCta;
