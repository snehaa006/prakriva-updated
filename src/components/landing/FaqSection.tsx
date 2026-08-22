import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { FAQS } from "./landingContent";
import ScrollReveal from "./ScrollReveal";

/**
 * Frequently asked questions.
 *
 * Built on the app's own `Accordion` primitive rather than hand-rolled
 * disclosure markup, so keyboard behaviour and `aria-expanded` come for free
 * and the page cannot drift from the product's interaction patterns.
 *
 * The first item is open by default: an accordion where everything is closed
 * asks the visitor to guess which question is worth the click, and the first
 * one here is the one that decides whether she keeps reading.
 */
export function FaqSection() {
  return (
    <section id="faq" className="relative scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <ScrollReveal>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
              Questions
            </p>
            <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
              The ones worth asking first
            </h2>
            <p className="mt-4 leading-relaxed text-lp-plum/65">
              Still unsure about something?{" "}
              <a
                href="#contact"
                className="font-medium text-lp-mauve underline underline-offset-4 transition-colors hover:text-lp-plum"
              >
                Write to us
              </a>{" "}
              — a person answers.
            </p>
          </ScrollReveal>

          <ScrollReveal index={1}>
            <Accordion type="single" collapsible defaultValue="faq-0" className="w-full">
              {FAQS.map((faq, index) => (
                <AccordionItem
                  key={faq.q}
                  value={`faq-${index}`}
                  className="border-b border-lp-cream-lo/60"
                >
                  <AccordionTrigger className="py-5 text-left font-display text-lg font-normal text-lp-plum hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-[15px] leading-relaxed text-lp-plum/65">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default FaqSection;
