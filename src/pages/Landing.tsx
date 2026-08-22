import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Bloom } from "@/components/illustrations/LineArt";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import { ArrowRight, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    num: "01",
    title: "Plans built per patient",
    description:
      "Diet charts generated from a patient's dosha, life stage, conditions and allergies — then edited by her practitioner, not shipped raw.",
  },
  {
    num: "02",
    title: "Tracking that earns its place",
    description:
      "Cycles, weight, skin and lifestyle logs, surfaced only for the care pathways a patient is actually on.",
  },
  {
    num: "03",
    title: "One shared record",
    description:
      "What a patient logs is what her doctor reviews. No re-typing, no screenshots passed back and forth.",
  },
  {
    num: "04",
    title: "Ayurveda, kept legible",
    description:
      "Vata, pitta and kapha stay first-class throughout, always paired with the plain-language reason behind a recommendation.",
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* ── Hero ──
          The brand shot: the floral photograph full-bleed, the butterfly mark
          and wordmark centred over it, everything else kept out of the way.
          The photograph is a `background-image` rather than an <img> so it can
          cover any viewport shape without a wrapper, and it lives in /public
          so a missing file degrades to the olive wash underneath instead of
          failing the build. */}
      {/* `isolate` is load-bearing: the photograph and its scrim sit at -z-20
          and -z-10, and without a stacking context here they paint *behind*
          the page's own `bg-background` and vanish entirely. */}
      <section className="relative isolate flex min-h-[92vh] flex-col overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[hsl(58_23%_13%)] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />
        {/* Two washes, not one: a flat scrim so cream type clears the pale
            blossoms, and a bottom-weighted gradient that hands off to the sand
            background below without a visible seam. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to bottom, hsl(58 23% 13% / 0.42) 0%, hsl(58 23% 13% / 0.28) 42%, hsl(58 23% 13% / 0.55) 78%, hsl(29 36% 92%) 100%)",
          }}
        />

        {/* ── Navigation ── */}
        <header className="relative z-20 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-7 md:py-9">
          {/* The badge artwork carries its own cream tile, which reads as a
              sticker over the photograph — the transparent mark doesn't. */}
          <Logo variant="butterfly" size="sm" alt="Prakriva" />
          <nav className="hidden items-center gap-x-7 font-mono text-[12px] uppercase tracking-[0.12em] text-white/70 sm:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#roles" className="transition-colors hover:text-white">Get started</a>
          </nav>
          <div className="flex items-center gap-2">
            {/* The switcher inherits the olive foreground by default, which is
                unreadable over the photograph. */}
            <LanguageSwitcher className="text-white/80 hover:bg-white/15 hover:text-white" />
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-white/35 bg-white/10 px-5 text-[13px] text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              onClick={() => navigate("/auth/patient")}
            >
              Sign in
            </Button>
          </div>
        </header>

        {/* ── Brand lockup ── */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center px-6 pb-24 pt-10 text-center md:pb-32">
          <Reveal>
            {/* Decorative: the wordmark directly below already carries the
                name, so this is `alt=""` rather than a second "Prakriva". */}
            <Logo
              variant="butterfly"
              alt=""
              className="h-14 drop-shadow-[0_2px_14px_hsl(58_23%_13%/0.55)] md:h-[4.5rem]"
            />
          </Reveal>

          <Reveal index={1}>
            {/* The artwork carries the name, so the heading is the image and
                the alt text is the wordmark — no duplicate "Prakriva" for a
                screen reader to read twice. */}
            <h1 className="mt-5">
              <Logo
                variant="wordmark"
                alt="Prakriva"
                className="h-[4.5rem] drop-shadow-[0_3px_18px_hsl(58_23%_13%/0.5)] sm:h-24 md:h-32 lg:h-40"
              />
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-7 max-w-xl text-body leading-relaxed text-white/85 drop-shadow-[0_1px_8px_hsl(58_23%_13%/0.6)]">
              Ayurvedic nutrition that follows every stage of life — profiled to
              your dosha, tracked where it matters, and reviewed by a
              practitioner.
            </p>
          </Reveal>

          {/* Button pair per the layout reference: one filled pill, one text
              button with an arrow that slides on hover. */}
          <Reveal index={3}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              <Button
                size="lg"
                className="group rounded-full bg-primary px-8 text-[13px] font-bold uppercase tracking-wide text-primary-foreground shadow-glow-gold hover:brightness-110"
                onClick={() => navigate("/auth/patient")}
              >
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
              <button
                onClick={() => navigate("/auth/doctor")}
                className="group flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:text-white/80"
              >
                I'm a practitioner
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </Reveal>

          <Reveal index={4}>
            <p className="quote mt-12 max-w-md !text-white/65">
              “Prakriti” — your constitution, the ground every plan here is
              built on.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Features (numbered grid) ── */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal>
            <span className="section-label">How it works</span>
          </Reveal>
          <Reveal index={1}>
            <h2 className="mt-4 max-w-2xl font-display text-display-md tracking-tight text-foreground">
              Built around how this care{" "}
              <span className="italic text-primary">actually</span> runs
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 md:mt-20">
            {features.map((feature, i) => (
              <Reveal key={feature.num} index={i} delay={120}>
                <div className="card-hover group h-full rounded-[22px] border border-foreground/[0.08] bg-card p-7 md:p-8">
                  <span className="font-mono text-[13px] tracking-[0.18em] text-primary/60">
                    {feature.num}
                  </span>
                  <h3 className="mt-4 font-display text-title2 text-foreground">{feature.title}</h3>
                  <p className="mt-2.5 text-footnote leading-relaxed text-foreground-secondary">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles (olive contrast block) ── */}
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
                className="card-hover group flex h-full w-full flex-col items-start rounded-[22px] border border-white/[0.1] bg-white/[0.05] p-8 text-left md:p-10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(3_34%_76%)]/15">
                  <Leaf className="h-6 w-6 text-[hsl(3_34%_82%)]" />
                </div>
                <h3 className="mt-6 font-display text-title2 text-white">For practitioners</h3>
                <p className="mt-3 text-footnote leading-relaxed text-white/60">
                  Build and adjust Ayurvedic diet charts, review screening results,
                  and follow a full patient list from one place.
                </p>
                <span className="mt-8 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[hsl(3_34%_76%)]">
                  Continue as a doctor
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            </Reveal>

            {/* Patient card */}
            <Reveal index={1} delay={120}>
              <button
                onClick={() => navigate("/auth/patient")}
                className="card-hover group flex h-full w-full flex-col items-start rounded-[22px] border border-white/[0.1] bg-white/[0.05] p-8 text-left md:p-10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(3_34%_76%)]/15">
                  <Bloom animate={false} className="h-6 w-6 text-[hsl(3_34%_82%)]" />
                </div>
                <h3 className="mt-6 font-display text-title2 text-white">For patients</h3>
                <p className="mt-3 text-footnote leading-relaxed text-white/60">
                  Follow a plan built around your dosha and your stage of life, and
                  log meals, cycles and symptoms as you go.
                </p>
                <span className="mt-8 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[hsl(3_34%_76%)]">
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
              <div className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-4">
                <Button
                  size="lg"
                  className="group rounded-full bg-primary px-8 text-[13px] font-bold uppercase tracking-wide text-primary-foreground shadow-glow-gold hover:brightness-110"
                  onClick={() => navigate("/auth/patient")}
                >
                  Get started
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
                <button
                  onClick={() => navigate("/auth/doctor")}
                  className="group flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-foreground transition-colors hover:text-primary"
                >
                  For practitioners
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-foreground/[0.08] py-10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6">
          <Logo size="sm" className="opacity-60" />
          <p className="font-mono text-caption2 uppercase tracking-[0.14em] text-foreground-tertiary">
            Prakriva · Ayurvedic wellness
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
