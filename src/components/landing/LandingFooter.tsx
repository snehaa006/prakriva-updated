import { ArrowRight, ArrowUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Reveal } from "@/components/ui/reveal";

/**
 * The links in the footer card. Everything here goes somewhere real — an
 * anchor on this page or one of the two sign-in routes. No placeholder
 * "Careers" or "Press" that lands on a 404.
 */
const FOOTER_LINKS: { label: string; to: string }[] = [
  { label: "How it works", to: "#features" },
  { label: "Companion", to: "#companion" },
  { label: "For patients", to: "/auth/patient" },
  { label: "For practitioners", to: "/auth/doctor" },
];

/**
 * The closing block: a dark call-to-action card on the sand background, then
 * the footer itself as a cream card floating on the second floral photograph.
 *
 * The photograph is a `background-image` on a decorative layer rather than an
 * `<img>`, and it lives in `/public` — a missing file degrades to the sand
 * wash underneath instead of failing the build. The band fades *out of* the
 * page background at the top for the same reason the hero fades *into* it:
 * a photograph that starts on a hard edge reads as a different page.
 */
export const LandingFooter = () => {
  const navigate = useNavigate();

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* ── Closing CTA ── */}
      <section className="px-6 pb-14 pt-20 md:pb-20 md:pt-28">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[26px] bg-[hsl(58_23%_13%)] px-8 py-12 md:px-14 md:py-16">
              {/* The floral, held right back — it is a texture on the card, not
                  a picture in it, so the type stays the loudest thing here. */}
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-cover bg-center opacity-[0.28]"
                style={{ backgroundImage: "url('/674e2b29-6de8-4865-a807-1e9b3f4e5b54.jpg')" }}
              />
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-gradient-to-r from-[hsl(58_23%_13%)] via-[hsl(58_23%_13%/0.85)] to-transparent"
              />

              <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
                <div className="max-w-md">
                  <h2 className="font-display text-display-sm tracking-tight text-white">
                    Ready to start?
                  </h2>
                  <p className="mt-3 text-footnote leading-relaxed text-white/65">
                    Set up a patient account, or bring your practice onto Prakriva.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                    <Button
                      size="lg"
                      className="group rounded-full bg-primary px-8 text-[13px] font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110"
                      onClick={() => navigate("/auth/patient")}
                    >
                      Get started
                      <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                    <button
                      onClick={() => navigate("/auth/doctor")}
                      className="group flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:text-white/75"
                    >
                      For practitioners
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>

                {/* The mark, large and quiet, on the far side of the card.
                    Hidden on a phone: stacked under the buttons it reads as a
                    stray graphic rather than as the card's counterweight. */}
                <Logo
                  tone="artwork"
                  alt=""
                  className="hidden h-28 shrink-0 opacity-90 md:block md:h-32"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer band ── */}
      <footer className="relative isolate overflow-hidden px-4 pb-4 pt-16 md:px-6 md:pb-6 md:pt-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[hsl(29_36%_92%)] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/ab9eadeb-60f7-4deb-995a-e90593218c18.jpg')" }}
        />
        {/* Fades out of the sand background rather than cutting into the
            photograph. Same-hue stops throughout: interpolating from a dark
            translucent colour to an opaque light one greys out in the middle
            and reads as a seam. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to bottom, hsl(29 36% 92%) 0%, hsl(29 36% 92% / 0.82) 18%, hsl(29 36% 92% / 0.35) 34%, hsl(29 36% 92% / 0) 52%)",
          }}
        />

        <div className="mx-auto flex max-w-[1200px] items-start justify-between gap-6 px-2 md:px-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/55 sm:text-caption2">
            Rooted in Ayurveda
          </span>
          {/* Dropped on a phone rather than wrapped: two mono labels wrapping
              into each other across the top of the photograph is noise. */}
          <span className="hidden text-right font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/55 sm:block sm:text-caption2">
            Built for every stage of life
          </span>
        </div>

        <div className="mx-auto mt-10 max-w-[1200px] overflow-hidden rounded-[28px] bg-[hsl(29_40%_97%/0.97)] px-6 pt-10 shadow-[0_30px_80px_-40px_hsl(58_23%_15%/0.45)] backdrop-blur-sm md:mt-14 md:pt-12">
          <div className="flex items-center justify-center gap-2.5 text-foreground">
            <Logo size="sm" alt="" className="h-7" />
            <Logo variant="wordmark" alt="Prakriva" className="h-4" />
          </div>

          <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-footnote text-foreground-secondary">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.to}
                onClick={
                  link.to.startsWith("#")
                    ? undefined
                    : (event) => {
                        event.preventDefault();
                        navigate(link.to);
                      }
                }
                className="transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={toTop}
              className="flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Back to top
            </button>
          </nav>

          {/* The name, set huge and clipped by the card's own bottom edge. It
              is decorative — the lockup above already carries the brand for a
              screen reader, so this one is silent.

              The clip is a negative margin rather than a fixed height, and a
              percentage margin resolves against this wrapper's *width*. The
              wordmark is 4344×1452, so its height is 33.4% of its width and
              `-12.7%` hides the bottom 38% of the letterforms — the same
              fraction at every viewport, which a `clamp()` height could never
              hold as the card grows. */}
          <div
            aria-hidden
            className="mx-auto mt-6 w-[min(64%,42rem)] overflow-hidden md:mt-8"
          >
            <Logo
              variant="wordmark"
              alt=""
              className="-mb-[12.7%] h-auto w-full text-foreground/[0.09]"
            />
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingFooter;
