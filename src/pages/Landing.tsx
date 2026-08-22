import { Button } from "@/components/ui/button";
import { CompanionDemo } from "@/components/landing/CompanionDemo";
import { FeatureCardStack } from "@/components/landing/FeatureCardStack";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Reveal } from "@/components/ui/reveal";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    // `overflow-x-clip`, not `-hidden`: hidden would make this a scroll
    // container, and the sticky stage inside FeatureCardStack would pin to it —
    // a container that never scrolls — instead of to the viewport.
    <div className="relative min-h-screen overflow-x-clip bg-background">
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
        {/* Two washes, and they must stay two.
            The scrim is olive and fades to *nothing*; the handoff is sand and
            fades in from nothing. Written as one gradient — olive at 55%
            opacity straight into opaque sand — the browser interpolates
            between a dark translucent colour and a light opaque one, and every
            midpoint comes out grey. That grey band across the bottom of the
            photograph was what made the hero look cut off from the page rather
            than continuous with it. Each layer now interpolates within its own
            hue and its own alpha, so the photograph dissolves into the sand
            background instead of hitting an edge.
            The last stop is exactly `--background`; change the page background
            and it has to move with it. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: [
              // Sand handoff, painted over the scrim: nothing for the first
              // two thirds, then a long ramp to the page's own background.
              "linear-gradient(to bottom," +
                " hsl(29 36% 92% / 0) 60%," +
                " hsl(29 36% 92% / 0.14) 74%," +
                " hsl(29 36% 92% / 0.52) 86%," +
                " hsl(29 36% 92% / 0.86) 95%," +
                " hsl(29 36% 92%) 100%)",
              // Olive scrim, so cream type clears the pale blossoms. Gone by
              // the time the sand arrives, so the two never mix.
              "linear-gradient(to bottom," +
                " hsl(58 23% 13% / 0.46) 0%," +
                " hsl(58 23% 13% / 0.30) 40%," +
                " hsl(58 23% 13% / 0.36) 66%," +
                " hsl(58 23% 13% / 0) 92%)",
            ].join(","),
          }}
        />

        {/* ── Navigation ── */}
        <header className="relative z-20 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-7 md:py-9">
          {/* `artwork` over the photograph: the supplied cream mark already
              reads against it, and painting it in `currentColor` would take
              the header's own translucent white instead. */}
          <Logo tone="artwork" size="sm" alt="Prakriva" />
          <nav className="hidden items-center gap-x-7 font-mono text-[12px] uppercase tracking-[0.12em] text-white/70 sm:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#companion" className="transition-colors hover:text-white">Companion</a>
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
        {/* The bottom padding is doing real work: it lifts the lockup clear of
            the sand handoff below, so no cream type is ever read through it. */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center px-6 pb-32 pt-10 text-center md:pb-44">
          <Reveal>
            {/* Decorative: the wordmark directly below already carries the
                name, so this is `alt=""` rather than a second "Prakriva". */}
            <Logo
              tone="artwork"
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
                tone="artwork"
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
            <p className="quote mt-12 max-w-md !text-white/70 drop-shadow-[0_1px_8px_hsl(58_23%_13%/0.6)]">
              “Prakriti” — your constitution, the ground every plan here is
              built on.
            </p>
          </Reveal>
        </div>
      </section>

      <FeatureCardStack />

      <CompanionDemo />

      <LandingFooter />

    </div>
  );
};

export default Landing;
