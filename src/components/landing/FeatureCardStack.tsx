import { useCallback, useEffect, useRef, useState } from "react";
import { FEATURE_CARDS, type FeatureCard } from "@/components/landing/featureCards";
import { Reveal } from "@/components/ui/reveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Viewport heights of scrolling spent on each card. The sticky stage is one
 * viewport tall, so `count * STEP_VH` is the section's full height and
 * `(count - 1) * STEP_VH` is what actually scrolls past it.
 */
const STEP_VH = 80;

/**
 * The fraction of one step the cards spend moving. The remaining 38% is a hold,
 * so a card sits still and readable before the next one takes over — a stack
 * that animates across the whole step never lets anyone finish a sentence.
 */
const TRANSITION = 0.62;

/**
 * How far a card travels, as a percentage of its own height: in from below the
 * stage, and back as it is covered.
 *
 * Nothing here fades. Cards are opaque and sit exactly on top of one another,
 * so any cross-dissolve puts two sets of headings and body copy half-visible in
 * the same place — which reads as a rendering fault, not a transition, however
 * briefly it lasts. Instead an arriving card starts fully below the stage's clip
 * line and slides up over the one it replaces, covering it the way one sheet of
 * paper covers another. `ENTER_PCT` has to clear the card's own height plus the
 * slack beneath it, or the card shows itself before it moves.
 */
const ENTER_PCT = 115;
const EXIT_PCT = -5;

/**
 * Gap between the bottom of a card and the stage's clip line (`bottom-8`, 2rem).
 * The clip has to fall below the card, or it takes the card's drop shadow with
 * it and the resting card looks sheared off along the bottom edge.
 */
const CARD_BOTTOM_SLACK = "bottom-8";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Decelerating: a card arrives quickly and settles, rather than drifting in. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Symmetric, for the card being pushed back — it neither snaps nor lingers. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Splits a card title so its one accented word can be set in italic serif. */
const CardTitle = ({ title, accent }: Pick<FeatureCard, "title" | "accent">) => {
  const at = title.indexOf(accent);
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="italic text-primary">{accent}</span>
      {title.slice(at + accent.length)}
    </>
  );
};

const CardFace = ({ card }: { card: FeatureCard }) => (
  <div className="grid h-full gap-6 rounded-[28px] border border-foreground/[0.07] bg-background-elevated p-7 shadow-lg [@media(max-height:760px)]:p-6 sm:p-9 md:grid-cols-[1.15fr_0.85fr] md:gap-10 md:p-10">
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
          {card.icon}
        </span>
        <span className="section-label">{card.eyebrow}</span>
        <span className="ml-auto font-display text-title2 text-foreground/[0.14] tabular-nums">
          {card.num}
        </span>
      </div>

      <h3 className="mt-6 font-display text-display-sm tracking-tight text-foreground [@media(max-height:760px)]:mt-4">
        <CardTitle title={card.title} accent={card.accent} />
      </h3>

      <p className="mt-4 max-w-md text-subhead leading-relaxed text-foreground-secondary sm:text-body">
        {card.description}
      </p>

      <ul className="mt-6 flex flex-wrap gap-2 [@media(max-height:760px)]:mt-4">
        {card.points.map((point) => (
          <li
            key={point}
            className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-caption1 text-foreground-secondary"
          >
            {point}
          </li>
        ))}
      </ul>
    </div>

    {/* The preview is decoration for a sighted reader — the copy beside it
        already says everything it shows, so it stays out of the reading order. */}
    <div aria-hidden className="hidden md:flex md:items-center">{card.preview}</div>
  </div>
);

const SectionHeading = () => (
  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
    <div>
      <Reveal>
        <span className="section-label">How it works</span>
      </Reveal>
      <Reveal index={1}>
        <h2 className="mt-3 max-w-xl font-display text-display-md tracking-tight text-foreground [@media(max-height:760px)]:text-display-sm">
          Built around how this care{" "}
          <span className="italic text-primary">actually</span> runs
        </h2>
      </Reveal>
    </div>
  </div>
);

/**
 * The landing page's feature section: one card at a time, each dissolving into
 * the next as the section scrolls past a pinned stage.
 *
 * The whole thing is driven by a single number — `position`, the fractional
 * index of the front card — recomputed from the track's `getBoundingClientRect`
 * on scroll and read back by every card. Cards are never mounted or unmounted
 * as they change, so nothing re-lays-out mid-animation; only `opacity` and
 * `transform` change, which the compositor handles without touching layout.
 *
 * Under `prefers-reduced-motion` this renders as a plain stacked list instead.
 * The CSS guard in `index.css` cannot help here — scroll-linked movement isn't
 * a transition, it's a new style on every frame — so the fallback has to be a
 * different tree, not a shorter duration.
 */
export const FeatureCardStack = () => {
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);

  const lastIndex = FEATURE_CARDS.length - 1;

  /** Scrollable distance of the track: its height less the one viewport that stays pinned. */
  const scrollableHeight = useCallback(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return 0;
    return track.offsetHeight - stage.offsetHeight;
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setPosition(0);
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;
      const track = trackRef.current;
      const scrollable = scrollableHeight();
      if (!track || scrollable <= 0) return;
      const travelled = clamp01(-track.getBoundingClientRect().top / scrollable);
      setPosition(travelled * lastIndex);
    };

    // Coalesce a burst of scroll events into one measurement per frame.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reducedMotion, lastIndex, scrollableHeight]);

  /** Scrolls so card `index` is the one at rest. */
  const goTo = (index: number) => {
    const track = trackRef.current;
    const scrollable = scrollableHeight();
    if (!track || scrollable <= 0) return;
    // A card rests across [index - (1 - TRANSITION), index]; aim for the middle
    // of that window so it is settled rather than just starting to leave.
    const target = Math.min(Math.max(index - (1 - TRANSITION) / 2, 0), lastIndex);
    window.scrollTo({
      top: window.scrollY + track.getBoundingClientRect().top + (target / lastIndex) * scrollable,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const activeIndex = Math.min(Math.max(Math.round(position), 0), lastIndex);

  if (reducedMotion) {
    return (
      <section id="features" className="border-t border-foreground/[0.06] py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionHeading />
          <div className="mt-14 flex flex-col gap-5 md:mt-20">
            {FEATURE_CARDS.map((card) => (
              <article key={card.num}>
                <CardFace card={card} />
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="features"
      ref={trackRef}
      className="relative border-t border-foreground/[0.06]"
      style={{ height: `${FEATURE_CARDS.length * STEP_VH}svh` }}
    >
      <div ref={stageRef} className="sticky top-0 h-svh overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-7 px-6 py-14 [@media(max-height:760px)]:gap-4 [@media(max-height:760px)]:py-6 md:gap-10">
          <SectionHeading />

          {/* The cards all occupy this box; only their transform differs. The
              clip opens upwards and sideways so the deck's top edge and every
              card's shadow survive, and closes flush at the bottom so a card
              waiting its turn is genuinely offstage rather than overlapping the
              progress rail. */}
          <div
            className="relative min-h-[412px] flex-1 [@media(max-height:760px)]:min-h-[300px] sm:min-h-[432px] md:max-h-[482px]"
            style={{ clipPath: "inset(-120px -120px 0 -120px)" }}
          >
            {FEATURE_CARDS.map((card, index) => {
              // Card `index + 1` rises over card `index` across the same window
              // that card `index` is pushed back in — one deck, not a dissolve.
              // A card that has been passed simply parks behind the front one,
              // its top edge left showing so it reads as "there is more here".
              const entering = easeOut(clamp01((position - (index - 1)) / TRANSITION));
              const leaving = easeInOut(clamp01((position - index) / TRANSITION));

              return (
                <article
                  key={card.num}
                  className={cn("absolute left-0 right-0 top-0 will-change-transform", CARD_BOTTOM_SLACK)}
                  style={{
                    transform: `translate3d(0, ${
                      (1 - entering) * ENTER_PCT + leaving * EXIT_PCT
                    }%, 0) scale(${1 - leaving * 0.07})`,
                    zIndex: index,
                    // Only the card in front should take a click or a hover.
                    pointerEvents: entering > 0.99 && leaving < 0.5 ? "auto" : "none",
                  }}
                >
                  <CardFace card={card} />
                </article>
              );
            })}
          </div>

          {/* Progress rail — also the control for jumping between cards. */}
          <div className="relative z-10 flex items-center gap-4">
            <span className="font-display text-footnote tabular-nums text-foreground-tertiary">
              {FEATURE_CARDS[activeIndex].num}
              <span className="text-foreground/[0.25]"> / {FEATURE_CARDS[lastIndex].num}</span>
            </span>
            <span aria-hidden className="h-px flex-1 overflow-hidden bg-foreground/[0.10]">
              <span
                className="block h-full bg-primary/70"
                style={{ width: `${(position / lastIndex) * 100}%` }}
              />
            </span>
            <span className="flex items-center gap-1.5">
              {FEATURE_CARDS.map((card, index) => (
                <button
                  key={card.num}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Go to ${card.title}`}
                  aria-current={index === activeIndex}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300 ease-ios",
                    index === activeIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-foreground/[0.18] hover:bg-foreground/[0.32]",
                  )}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
