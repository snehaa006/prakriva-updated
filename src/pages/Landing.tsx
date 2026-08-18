import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Bloom } from "@/components/illustrations/LineArt";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import { Stethoscope, User, Brain, Heart, Users, Leaf, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const roles = [
  {
    icon: Stethoscope,
    title: "For practitioners",
    description:
      "Build and adjust Ayurvedic diet charts, review screening results, and follow a full patient list from one place.",
    action: "Continue as a doctor",
    href: "/auth/doctor",
  },
  {
    icon: User,
    title: "For patients",
    description:
      "Follow a plan built around your dosha and your stage of life, and log meals, cycles and symptoms as you go.",
    action: "Continue as a patient",
    href: "/auth/patient",
  },
];

const features = [
  {
    icon: Brain,
    title: "Plans built per patient",
    description:
      "Diet charts generated from a patient's dosha, life stage, conditions and allergies — then edited by her practitioner, not shipped raw.",
  },
  {
    icon: Heart,
    title: "Tracking that earns its place",
    description:
      "Cycles, weight, skin and lifestyle logs, surfaced only for the care pathways a patient is actually on.",
  },
  {
    icon: Users,
    title: "One shared record",
    description:
      "What a patient logs is what her doctor reviews. No re-typing, no screenshots passed back and forth.",
  },
  {
    icon: Leaf,
    title: "Ayurveda, kept legible",
    description:
      "Vata, pitta and kapha stay first-class throughout, always paired with the plain-language reason behind a recommendation.",
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Same blush wash the sign-in screen uses, so the first two screens of
          the app feel like one surface. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -10%, hsl(var(--primary) / 0.08) 0%, transparent 65%)",
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          {/* Language first, before sign-in: someone who cannot read the page
              cannot read the sign-in button either. */}
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth/patient")}>
            Sign in
          </Button>
        </div>
      </header>

      {/* ── Hero ──
          The mark is drawn rather than dropped in: the bloom animates its own
          strokes on load, which does the job the raster logo tile was doing
          badly — the PNG is a cream square, and floating it on a blush page
          read as a placeholder someone forgot to replace. */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 sm:pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            {/* Below `lg` the two-column hero collapses and the illustration
                column is dropped, so the mark comes inline above the heading
                instead — a phone shouldn't be the one place it never appears. */}
            <Reveal className="mb-7 lg:hidden">
              <Bloom delay={150} className="h-14 w-14 text-primary" />
            </Reveal>

            <Reveal>
              <p className="text-footnote font-medium uppercase tracking-[0.12em] text-foreground-tertiary">
                Ayurvedic care, kept in one record
              </p>
            </Reveal>

            <Reveal index={1}>
              <h1 className="mt-4 max-w-xl text-title1 text-foreground sm:text-large-title">
                Nutrition that follows a woman through every stage.
              </h1>
            </Reveal>

            <Reveal index={2}>
              <p className="mt-5 max-w-lg text-body text-foreground-secondary">
                Prakriva pairs Ayurvedic profiling with the tracking a pregnancy or a
                PCOS diagnosis actually needs, and puts a practitioner on the other
                side of it.
              </p>
            </Reveal>

            <Reveal index={3}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("/auth/patient")}>
                  Get started
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth/doctor")}>
                  I'm a practitioner
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal index={2} className="hidden justify-center lg:flex">
            <div className="relative flex h-72 w-72 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-accent-soft/70" />
              <span className="absolute inset-7 rounded-full border border-border" />
              <Bloom delay={250} className="relative h-40 w-40 text-primary" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="border-y border-border bg-accent-soft/40 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.map((role, i) => (
              <Reveal key={role.title} index={i} as="article" className="h-full">
                <button
                  onClick={() => navigate(role.href)}
                  className="group flex h-full w-full flex-col items-start gap-4 rounded-xl border border-border bg-card p-7 text-left transition-all duration-200 ease-ios hover:border-border-strong hover:shadow-md active:scale-[0.99]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-primary">
                    <role.icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-headline text-foreground">{role.title}</span>
                    <span className="mt-2 block text-footnote leading-relaxed text-foreground-secondary">
                      {role.description}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-footnote font-medium text-primary">
                    {role.action}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-ios group-hover:translate-x-0.5" />
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──
          A plain two-column list rather than four more bordered cards. The
          page was six near-identical card grids stacked; varying the density
          is most of what separates a designed page from a generated one. */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <h2 className="max-w-lg text-title2 text-foreground">
              Built around how this care actually runs
            </h2>
          </Reveal>

          <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {features.map((feature, i) => (
              <Reveal key={feature.title} index={i}>
                <dt className="flex items-center gap-3">
                  <feature.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-headline text-foreground">{feature.title}</span>
                </dt>
                <dd className="mt-2 pl-7 text-footnote leading-relaxed text-foreground-secondary">
                  {feature.description}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title3 text-foreground">Ready to start?</h2>
            <p className="mt-1.5 text-footnote text-foreground-secondary">
              Set up a patient account, or bring your practice onto Prakriva.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button onClick={() => navigate("/auth/patient")}>Get started</Button>
            <Button variant="outline" onClick={() => navigate("/auth/doctor")}>
              For practitioners
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
