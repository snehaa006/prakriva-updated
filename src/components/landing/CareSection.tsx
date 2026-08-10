// "What Prakriva does" — the product's real features, told as care rather
// than as a feature grid. Every card here maps to a route that exists:
// health check, meal logging, pantry, lifestyle tracker, food compatibility
// and the consult flow.

import {
  Activity,
  Apple,
  HeartPulse,
  Moon,
  Salad,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Column span on large screens; the default is a single column. */
  span?: "two" | "full";
}

const FEATURES: Feature[] = [
  {
    icon: HeartPulse,
    title: "Health checks built for women",
    body: "Screening for anaemia, thyroid, gestational diabetes, preeclampsia and perinatal mental health — scored by trained models, with the trend of every past check kept beside it.",
    span: "two",
  },
  {
    icon: Salad,
    title: "Diet plans in your prakriti",
    body: "Meals matched to your Vata, Pitta and Kapha balance and to what your body needs this week.",
  },
  {
    icon: Activity,
    title: "Dosha balance, tracked",
    body: "Watch your constitution shift over time instead of guessing at it.",
  },
  {
    icon: Apple,
    title: "Kitchen that keeps up",
    body: "A living pantry and shopping list, so the plan matches what's actually on the shelf.",
  },
  {
    icon: Moon,
    title: "Sleep, movement, mood",
    body: "Small daily logs that turn into the pattern behind how you feel.",
  },
  {
    icon: Stethoscope,
    title: "Your doctor, in the loop",
    body: "Request a consultation and share your plan, adherence and results — no re-explaining your history at every visit.",
    span: "full",
  },
];

export const CareSection = () => {
  const ref = useReveal<HTMLElement>();

  return (
    <section id="care" ref={ref} className="relative py-24 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-[hsl(var(--rose-accent))]">
            The care
          </p>
          <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.08] tracking-[-0.02em]">
            Everything your body has been
            <em className="italic"> trying to tell you</em>.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-foreground/65">
            One place for the things that usually live in six — screenings, nutrition,
            daily habits and the doctor who reads them.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, span }, i) => (
            <article
              key={title}
              className={`reveal lift group rounded-4xl border border-border/60 bg-card/70 p-8 backdrop-blur-sm ${
                span === "two" ? "lg:col-span-2" : span === "full" ? "sm:col-span-2 lg:col-span-3" : ""
              }`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-blush text-foreground/80 transition-transform duration-500 group-hover:scale-110">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-normal tracking-[-0.01em]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/65">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CareSection;
