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
 * The fraction of one step the reel spends moving. The remaining 38% is a hold,
 * so a card sits still and readable before the next one takes over — a reel
 * that animates across the whole step never lets anyone finish a sentence.
 */
const TRANSITION = 0.62;

/**
 * Gap between cards in the reel, in px, visible while one hands over to the
 * next. It has to clear the cards' drop shadow as well as the cards, or at rest
 * the neighbour's shadow shows inside the clip as a phantom edge.
 */
const REEL_GAP = 36;

/**
 * How far either side of its own step a label stays legible. Labels cross-fade
 * across the gutters while the reel moves, so this is deliberately shorter than
 * `TRANSITION`: the outgoing one is gone before the incoming one is readable,
 * and two sentences are never half-visible at once.
 */
const LABEL_FADE = 0.42;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Decelerating: the reel arrives quickly and settles, rather than drifting in. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Turns the linear scroll position into the reel's own: it advances briskly
 * across the first `TRANSITION` of each step, then holds on the whole number
 * for the rest. Easing the section end to end instead would make the reel race
 * at the top and crawl at the bottom, and never sit still anywhere.
 */
const stepped = (raw: number) => {
  const card = Math.floor(raw);
  return card + easeOut(clamp01((raw - card) / TRANSITION));
};

/** Splits a card title so its one accented word can be set in italic. */
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

/** The text beside the reel: a rose figure, a serif line, two lines of body. */
const CardLabel = ({ card }: { card: FeatureCard }) => (
  <article className={cn("max-w-[24ch]", card.side === "right" && "md:ml-auto md:text-right")}>
    <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-primary">
      {card.num}
    </span>
    <h3 className="mt-2 font-display text-title2 leading-tight tracking-tight text-foreground sm:text-title1">
      <CardTitle title={card.title} accent={card.accent} />
    </h3>
    <p className="mt-3 text-footnote leading-relaxed text-foreground-secondary">
      {card.description}
    </p>
  </article>
);

/** One frame of the reel: a scene mixed from the palette, with a panel floating on it. */
const CardScene = ({ card }: { card: FeatureCard }) => (
  <div
    className="relative h-full w-full overflow-hidden rounded-[26px] shadow-xl ring-1 ring-inset ring-foreground/[0.10]"
    style={{ backgroundImage: card.scene }}
  >
    <span
      aria-hidden
      className="absolute -bottom-8 -right-6 h-40 w-40 text-background-elevated/20 sm:h-52 sm:w-52"
    >
      {card.mark}
    </span>
    {/* Settles the top of the scene so the white panel always has something
        darker to sit against, whatever the card's own cast. */}
    <span
      aria-hidden
      className="absolute inset-0 bg-gradient-to-b from-foreground/[0.14] via-transparent to-foreground/[0.10]"
    />
    <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-7">
      <div className="w-full max-w-[20rem]">{card.panel}</div>
    </div>
  </div>
);

const SectionHeading = () => (
  <header className="text-center">
    <Reveal>
      <span className="section-label !text-primary">How it works</span>
    </Reveal>
    <Reveal index={1}>
      <h2 className="mx-auto mt-4 max-w-[22ch] font-display text-display-md leading-[1.1] tracking-tight text-foreground">
        Built around how this care <span className="italic text-primary">actually</span> runs
      </h2>
    </Reveal>
    <Reveal index={2}>
      <p className="mx-auto mt-4 max-w-[52ch] text-footnote leading-relaxed text-foreground-secondary">
        Six jobs the app owns end to end — so nothing is screenshotted, re-typed
        or lost between her kitchen and her doctor's screen.
      </p>
    </Reveal>
  </header>
);

/**
 * The landing page's feature section: one card at a time on a pinned stage,
 * with its label alternating across the gutters beside it.
 *
 * The whole thing is driven by a single number — `position`, the fractional
 * index of the front card — recomputed from the track's `getBoundingClientRect`
 * on scroll and read back by every card and label. Cards are never mounted or
 * unmounted as they change, so nothing re-lays-out mid-animation; only
 * `transform` and `opacity` change, which the compositor handles without
 * touching layout.
 *
 * Under `prefers-reduced-motion` this renders as a plain stacked list instead.
 * The CSS guard in index.css cannot help here — scroll-linked movement isn't a
 * transition, it's a new style on every frame — so the fallback has to be a
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

  const reelPosition = stepped(position);
  // Counted off the reel, not the raw scroll, so the figure on the rail never
  // disagrees with the label the reader is looking at.
  const activeIndex = Math.min(Math.max(Math.round(reelPosition), 0), lastIndex);

  /**
   * How present a label is, 0 to 1. The window is shorter than the reel's
   * travel on purpose: the outgoing label clears before the incoming one is
   * readable, so two sentences are never half-visible over each other.
   */
  const labelPresence = (index: number) =>
    clamp01(1 - Math.abs(reelPosition - index) / LABEL_FADE);

  if (reducedMotion) {
    return (
      <section id="features" className="border-t border-foreground/[0.06] py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionHeading />
          <div className="mt-14 flex flex-col gap-14 md:mt-20">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.num}
                className="grid items-center gap-7 md:grid-cols-[1fr_1.1fr] md:gap-12"
              >
                <div className={cn(card.side === "right" && "md:order-2 md:justify-self-end")}>
                  <CardLabel card={card} />
                </div>
                <div aria-hidden className="aspect-[4/3] w-full max-w-[24rem] justify-self-center">
                  <CardScene card={card} />
                </div>
              </div>
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
        <div className="mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-8 px-6 py-12 [@media(max-height:760px)]:gap-4 [@media(max-height:760px)]:py-6">
          <SectionHeading />

          {/* Reel and labels. A phone stacks them — reel, then the label
              under it — while md and up takes the label layer out of the flow
              and hangs each one in a gutter beside the reel. Either way each
              card's copy exists exactly once in the DOM; the reel is a mock, so
              it carries no reading order at all. */}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 md:flex-row">
            {/* Clipped to a plain rectangle a little taller than one card: the
                corners stay round as a card slides through, and the neighbour
                waiting its turn stays outside, shadow and all. */}
            <div
              aria-hidden
              className="relative h-[min(17rem,34svh)] w-full max-w-[34rem] shrink-0 overflow-hidden md:h-full md:max-h-[min(23rem,50svh)]"
            >
              {FEATURE_CARDS.map((card, index) => {
                // Offsets are a percentage of the card's own height plus the
                // gap in px, so the reel keeps its rhythm at any card size
                // without measuring anything in JS.
                const offset = index - reelPosition;
                return (
                  <div
                    key={card.num}
                    className="absolute inset-x-0 top-1/2 h-[min(15rem,30svh)] will-change-transform md:h-[min(22rem,42svh)]"
                    style={{
                      transform: `translate3d(0, calc(-50% + ${offset * 100}% + ${offset * REEL_GAP}px), 0)`,
                    }}
                  >
                    <CardScene card={card} />
                  </div>
                );
              })}
            </div>

            <div className="relative h-[10rem] w-full shrink-0 md:pointer-events-none md:absolute md:inset-0 md:h-auto md:w-auto">
              {FEATURE_CARDS.map((card, index) => (
                <div
                  key={card.num}
                  className={cn(
                    "absolute inset-x-0 top-0 md:inset-x-auto md:top-1/2 md:w-[clamp(12rem,22vw,17rem)] md:-translate-y-1/2",
                    card.side === "left" ? "md:left-0" : "md:right-0",
                  )}
                >
                  <div
                    className="w-full will-change-[transform,opacity]"
                    style={{
                      opacity: labelPresence(index),
                      transform: `translate3d(0, ${(reelPosition - index) * -16}px, 0)`,
                    }}
                  >
                    <CardLabel card={card} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress rail — also the control for jumping between cards. */}
          <div className="relative z-10 mx-auto flex w-full max-w-[26rem] items-center gap-4">
            <span className="font-mono text-[11px] tabular-nums text-foreground-tertiary">
              {FEATURE_CARDS[activeIndex].num}
              <span className="text-foreground/[0.28]"> / {FEATURE_CARDS[lastIndex].num}</span>
            </span>
            <span aria-hidden className="h-px flex-1 overflow-hidden bg-foreground/[0.12]">
              <span
                className="block h-full bg-primary/70"
                style={{ width: `${(reelPosition / lastIndex) * 100}%` }}
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
                    "h-1.5 rounded-full transition-all duration-300 ease-ios",
                    index === activeIndex
                      ? "w-5 bg-primary"
                      : "w-1.5 bg-foreground/[0.2] hover:bg-foreground/[0.35]",
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
