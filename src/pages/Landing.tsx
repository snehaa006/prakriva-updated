import { Button } from "@/components/ui/button";
import { FeatureCardStack } from "@/components/landing/FeatureCardStack";
import { Reveal } from "@/components/ui/reveal";
import { Bloom } from "@/components/illustrations/LineArt";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import { ArrowRight, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    // `overflow-x-clip`, not `-hidden`: hidden would make this a scroll
    // container, and the sticky stage inside FeatureCardStack would pin to it —
    // a container that never scrolls — instead of to the viewport.
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* ── Navigation ── */}
      <header className="relative z-20 mx-auto flex max-w-[1200px] items-center justify-between px-6 py-7 md:py-9">
        <Logo size="sm" />
        <nav className="hidden items-center gap-x-7 text-[13px] font-medium text-foreground-secondary sm:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#roles" className="transition-colors hover:text-foreground">Get started</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-5 text-[13px]"
            onClick={() => navigate("/auth/patient")}
          >
            Sign in
          </Button>
        </div>
      </header>

      {/* ── Hero ──
          Sythra-style massive typography with a warm cream background. The mark
          draws itself on load (Bloom). Generous whitespace. */}
      <section className="relative mx-auto max-w-[1200px] px-6 pb-28 pt-10 md:pb-36 md:pt-20">
        {/* Warm radial wash behind the hero */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(700px 500px at 20% 30%, hsl(158, 38%, 28% / 0.06) 0%, transparent 60%), radial-gradient(500px 400px at 85% 15%, hsl(20, 90%, 52% / 0.04) 0%, transparent 55%)",
          }}
        />

        <div className="grid items-end gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
          <div>
            <Reveal>
              <span className="section-label">Ayurvedic wellness platform</span>
            </Reveal>

            <Reveal index={1}>
              <h1 className="mt-5 font-display text-display-lg tracking-tight text-foreground">
                Nutrition that{" "}
                <span className="italic text-primary">follows</span>{" "}
                every stage of life.
              </h1>
            </Reveal>

            <Reveal index={2}>
              <p className="mt-7 max-w-lg text-body leading-relaxed text-foreground-secondary">
                Prakriva pairs Ayurvedic profiling with the tracking a pregnancy
                or a PCOS diagnosis actually needs — and puts a practitioner on
                the other side of it.
              </p>
            </Reveal>

            <Reveal index={3}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  className="rounded-full bg-accent px-7 text-[13px] font-bold uppercase tracking-wide text-accent-foreground shadow-glow-gold hover:brightness-110"
                  onClick={() => navigate("/auth/patient")}
                >
                  Get started
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-7 text-[13px] font-bold uppercase tracking-wide"
                  onClick={() => navigate("/auth/doctor")}
                >
                  I'm a practitioner
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Hero mark — Sythra puts one bold visual element here */}
          <Reveal index={2} className="hidden lg:flex lg:justify-center">
            <div className="relative flex h-72 w-72 items-center justify-center xl:h-80 xl:w-80">
              {/* Soft glow */}
              <span className="absolute inset-0 animate-pulse-soft rounded-full bg-primary/[0.06]" />
              <span className="absolute inset-8 rounded-full border border-foreground/[0.06]" />
              <Bloom delay={250} className="relative h-36 w-36 text-primary xl:h-40 xl:w-40" />
              {/* Floating dots (sythra's decorative language) */}
              <span className="absolute right-4 top-10 h-2.5 w-2.5 animate-float rounded-full bg-accent/50" />
              <span className="absolute bottom-14 left-4 h-2 w-2 animate-float rounded-full bg-primary/30" style={{ animationDelay: "1.5s" }} />
            </div>
          </Reveal>
        </div>
      </section>

      <FeatureCardStack />

      {/* ── Roles (dark section — sythra-style contrast) ── */}
      <section id="roles" className="section-dark py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal>
            <span className="section-label !text-white/40">Choose your path</span>
          </Reveal>
          <Reveal index={1}>
            <h2 className="mt-4 max-w-lg font-display text-display-md tracking-tight text-white">
              Two sides, one record.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 md:mt-20">
            {/* Practitioner card */}
            <Reveal index={0} delay={120}>
              <button
                onClick={() => navigate("/auth/doctor")}
                className="card-hover group flex w-full flex-col items-start rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-8 text-left md:p-10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08]">
                  <Leaf className="h-5 w-5 text-white/80" />
                </div>
                <h3 className="mt-6 font-display text-title2 text-white">For practitioners</h3>
                <p className="mt-3 text-footnote leading-relaxed text-white/55">
                  Build and adjust Ayurvedic diet charts, review screening results,
                  and follow a full patient list from one place.
                </p>
                <span className="mt-8 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-accent">
                  Continue as a doctor
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            </Reveal>

            {/* Patient card */}
            <Reveal index={1} delay={120}>
              <button
                onClick={() => navigate("/auth/patient")}
                className="card-hover group flex w-full flex-col items-start rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-8 text-left md:p-10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/[0.12]">
                  <Bloom animate={false} className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-6 font-display text-title2 text-white">For patients</h3>
                <p className="mt-3 text-footnote leading-relaxed text-white/55">
                  Follow a plan built around your dosha and your stage of life, and
                  log meals, cycles and symptoms as you go.
                </p>
                <span className="mt-8 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-accent">
                  Continue as a patient
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div>
              <Reveal>
                <h2 className="font-display text-display-sm tracking-tight text-foreground">
                  Ready to start?
                </h2>
              </Reveal>
              <Reveal index={1}>
                <p className="mt-2 text-body text-foreground-secondary">
                  Set up a patient account, or bring your practice onto Prakriva.
                </p>
              </Reveal>
            </div>
            <Reveal index={2}>
              <div className="flex shrink-0 gap-3">
                <Button
                  size="lg"
                  className="rounded-full bg-accent px-7 text-[13px] font-bold uppercase tracking-wide text-accent-foreground shadow-glow-gold hover:brightness-110"
                  onClick={() => navigate("/auth/patient")}
                >
                  Get started
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-7 text-[13px] font-bold uppercase tracking-wide"
                  onClick={() => navigate("/auth/doctor")}
                >
                  For practitioners
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-foreground/[0.06] py-10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6">
          <Logo size="sm" className="opacity-60" />
          <p className="text-caption1 text-foreground-tertiary">
            Prakriva · Ayurvedic wellness
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
