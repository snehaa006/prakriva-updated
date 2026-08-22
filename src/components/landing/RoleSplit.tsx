import * as React from "react";
import { ArrowRight, Check, Stethoscope, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import ScrollReveal from "./ScrollReveal";
import SpotlightCard from "./SpotlightCard";

/**
 * The two doors into the product.
 *
 * This is the only decision the landing page actually asks a visitor to make,
 * so it gets a section of its own rather than a pair of buttons in the hero.
 * The patient side is the visually dominant of the two — it is the larger
 * audience — but both are real cards with their own list, because a
 * practitioner who cannot see what she gets will not sign up either.
 */
const ROLES = [
  {
    icon: User,
    eyebrow: "For patients",
    title: "A plan for the body you have today",
    points: [
      "A dosha profile in about four minutes",
      "Meals matched to your stage, conditions and allergies",
      "Cycle, weight, skin and lifestyle logs — only where they apply",
      "A practitioner reading the same record you are",
    ],
    action: "Create a patient account",
    href: "/auth/patient",
    emphasis: true,
  },
  {
    icon: Stethoscope,
    eyebrow: "For practitioners",
    title: "Your whole patient list, in one place",
    points: [
      "Draft, edit and approve diet charts before they ship",
      "Risk screening surfaced against the patients it concerns",
      "Appointments, alerts, messaging and feedback",
      "Licence-verified accounts and team management",
    ],
    action: "Join as a practitioner",
    href: "/auth/doctor",
    emphasis: false,
  },
] as const;

export function RoleSplit() {
  const navigate = useNavigate();

  return (
    <section id="roles" className="relative scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-mauve">
            Two sides
          </p>
          <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-plum sm:text-5xl">
            Which side are you on?
          </h2>
        </ScrollReveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {ROLES.map((role, index) => (
            <ScrollReveal key={role.href} index={index} className="h-full">
              <SpotlightCard className="h-full rounded-[28px]" intensity={5}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[28px] p-8 sm:p-10",
                    role.emphasis
                      ? "lp-deep lp-grain text-lp-cream-hi"
                      : "lp-card text-lp-plum",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl",
                      role.emphasis
                        ? "bg-lp-cream-hi/15 text-lp-cream-hi"
                        : "bg-lp-blush text-lp-plum",
                    )}
                  >
                    <role.icon className="h-5 w-5" />
                  </span>

                  <p
                    className={cn(
                      "mt-6 text-xs font-medium uppercase tracking-[0.18em]",
                      role.emphasis ? "text-lp-petal/80" : "text-lp-mauve",
                    )}
                  >
                    {role.eyebrow}
                  </p>
                  <h3
                    className={cn(
                      "mt-3 font-display text-2xl font-normal leading-snug sm:text-3xl",
                      role.emphasis ? "text-lp-cream-hi" : "text-lp-plum",
                    )}
                  >
                    {role.title}
                  </h3>

                  <ul className="mt-7 flex-1 space-y-3">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm leading-relaxed">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            role.emphasis ? "text-lp-petal" : "text-lp-mauve",
                          )}
                        />
                        <span className={role.emphasis ? "text-lp-cream/75" : "text-lp-plum/70"}>
                          {point}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    onClick={() => navigate(role.href)}
                    className={cn(
                      "group mt-9 h-12 w-full justify-between rounded-full px-6 text-base",
                      role.emphasis
                        ? "bg-lp-cream-hi text-lp-plum-deep hover:bg-lp-cream"
                        : "bg-lp-plum text-lp-cream-hi hover:bg-lp-plum/90",
                    )}
                  >
                    {role.action}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-ios group-hover:translate-x-0.5" />
                  </Button>
                </article>
              </SpotlightCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RoleSplit;
