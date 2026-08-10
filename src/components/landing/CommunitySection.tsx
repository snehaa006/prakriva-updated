// Community + testimonials.
//
// NOTE FOR WHOEVER SHIPS THIS: the quotes below are placeholder marketing copy
// written to show the layout, not real patient statements. Swap them for
// consented, attributable quotes (and real numbers in the stat row) before
// this page goes in front of the public — invented testimonials on a health
// product are a legal and ethical problem, not just a content gap.

import { Quote } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const STATS = [
  { value: "12k+", label: "Women guided" },
  { value: "340", label: "Practitioners" },
  { value: "8", label: "Conditions screened" },
  { value: "4.9", label: "Average rating" },
];

const TESTIMONIALS = [
  {
    quote:
      "The plan finally accounted for my cycle instead of treating every week the same. Three months in, my energy is unrecognisable.",
    name: "Ananya R.",
    role: "Bengaluru · 8 months on Prakriva",
  },
  {
    quote:
      "I came in for anaemia and left understanding my whole constitution. My doctor could see everything I'd logged — no repeating myself.",
    name: "Meera S.",
    role: "Pune · 1 year on Prakriva",
  },
  {
    quote:
      "As a practitioner, the screening trends save me an entire consultation. I arrive already knowing what changed.",
    name: "Dr. Kavitha Iyer",
    role: "Ayurvedic physician, Chennai",
  },
];

export const CommunitySection = () => {
  const ref = useReveal<HTMLElement>();

  return (
    <section id="community" ref={ref} className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[hsl(var(--rose-accent))]">
            The community
          </p>
          <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.08] tracking-[-0.02em]">
            Thousands of women,
            <em className="italic"> one thread</em>.
          </h2>
        </div>

        <dl className="reveal mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-4xl border border-border/60 bg-card/60 px-6 py-8 text-center"
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block font-display text-4xl font-light tracking-[-0.02em] text-gradient-rose">
                  {stat.value}
                </span>
                <span className="mt-2 block text-xs uppercase tracking-[0.14em] text-foreground/55">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={t.name}
              className="reveal lift flex flex-col rounded-4xl border border-border/60 bg-gradient-blush p-8"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <Quote
                className="mb-5 h-6 w-6 text-[hsl(var(--rose-accent))] opacity-60"
                aria-hidden
              />
              <blockquote className="font-display text-lg font-light leading-snug tracking-[-0.01em] text-foreground/85">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-auto pt-6 text-sm">
                <span className="block font-medium">{t.name}</span>
                <span className="block text-foreground/55">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CommunitySection;
