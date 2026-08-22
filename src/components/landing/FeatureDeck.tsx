import * as React from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  ChefHat,
  Droplets,
  MessageCircleHeart,
  Stethoscope,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** How long a card holds the front of the deck before the next one takes over. */
const HOLD_MS = 5200;
/** Must match the transition duration on a card, so the two never fight. */
const GLIDE_MS = 700;

interface DeckCard {
  num: string;
  /** Who the surface belongs to — patients or their practitioner. */
  audience: string;
  title: string;
  description: string;
  /** Three short facts; these are the details a landing page usually drops. */
  points: string[];
  Icon: LucideIcon;
}

/**
 * Every card describes a surface that actually ships — the wording tracks the
 * behaviour documented in the README rather than a marketing paraphrase of it.
 */
const CARDS: DeckCard[] = [
  {
    num: "01",
    audience: "For patients",
    title: "An Ayurvedic profile, taken once",
    description:
      "A five-part assessment sets your prakriti. Anything that shifts week to week — stress, sleep, cravings — stays out of it and lives in the trackers instead.",
    points: ["5 sections", "Vata · pitta · kapha", "Read back on your profile"],
    Icon: Droplets,
  },
  {
    num: "02",
    audience: "For patients",
    title: "Today, on a single screen",
    description:
      "What is planned for each meal, and the logging for it in the same place. Deciding what to eat and recording that you ate it is one task, not two screens.",
    points: ["Meals and water", "Logged where it is planned", "No separate diary"],
    Icon: Sun,
  },
  {
    num: "03",
    audience: "For patients",
    title: "The week, and the kitchen it needs",
    description:
      "Your plan, how it is going, and the shopping it implies sit as tabs of one screen — with the ingredients you already have at home feeding the match.",
    points: ["Weekly chart", "Progress", "Kitchen list"],
    Icon: CalendarRange,
  },
  {
    num: "04",
    audience: "For patients",
    title: "One daily check-in, not four",
    description:
      "Movement, hydration, sleep and how closely the plan was followed, all in one pass. Saved on the device first and mirrored to your account after.",
    points: ["Local-first saves", "Today never breaks a streak", "Adherence, not a game"],
    Icon: Activity,
  },
  {
    num: "05",
    audience: "For patients",
    title: "Screening that knows its limits",
    description:
      "Maternal health checks read measurements, blood work and thyroid results — and stay hidden for patients the models were never trained on.",
    points: ["Five conditions", "Matched exercise plan", "Full past-check history"],
    Icon: Stethoscope,
  },
  {
    num: "06",
    audience: "For practitioners",
    title: "Generate a chart, then edit it by hand",
    description:
      "Build from a patient's dosha, targets and restrictions or start from scratch — both land on the same board, with her screening analysis open beside it.",
    points: ["Dosha-aware", "Drag and drop", "Analysis in view"],
    Icon: ChefHat,
  },
  {
    num: "07",
    audience: "For both",
    title: "A companion that has read the file",
    description:
      "Answers grounded in your own dosha, plan, pantry and logs — so a question about tonight's dinner is answered against tonight's actual plan.",
    points: ["Your data, not the internet", "Gentle nudges", "25 languages"],
    Icon: MessageCircleHeart,
  },
];

/** True while the OS asks for less motion; kept live, users toggle it mid-session. */
function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/**
 * Where a card sits in the deck, given how far it is from the front.
 *
 * The card that just left the front is the one at `total - 1`: it lifts up and
 * out rather than sliding down through the stack, so an advance reads as one
 * card handing over to the next instead of the whole pile shuffling.
 */
function positionStyle(pos: number, total: number): React.CSSProperties {
  if (pos === 0) {
    return { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1, zIndex: 40 };
  }
  if (total > 3 && pos === total - 1) {
    return { transform: "translate3d(0, -64px, 0) scale(0.98)", opacity: 0, zIndex: 10 };
  }
  if (pos === 1) {
    return { transform: "translate3d(0, 26px, 0) scale(0.95)", opacity: 0.85, zIndex: 30 };
  }
  if (pos === 2) {
    return { transform: "translate3d(0, 48px, 0) scale(0.9)", opacity: 0.5, zIndex: 20 };
  }
  return { transform: "translate3d(0, 56px, 0) scale(0.88)", opacity: 0, zIndex: 10 };
}

/**
 * The landing page's feature deck: a stack of cards where the front one glides
 * away and the next rises to take its place, on a timer or on demand.
 *
 * The timer stops whenever the section is off-screen, the tab is hidden, or a
 * pointer or keyboard focus is inside it — an animation nobody is watching is
 * just battery, and one that moves while someone is reading it is worse.
 */
export function FeatureDeck() {
  const total = CARDS.length;
  const [active, setActive] = React.useState(0);
  const [engaged, setEngaged] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const [pageVisible, setPageVisible] = React.useState(true);
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const go = React.useCallback(
    (next: number) => setActive(((next % total) + total) % total),
    [total],
  );

  React.useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const playing = inView && pageVisible && !engaged && !reducedMotion;

  React.useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(active + 1), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [playing, active, go]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      go(active + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      go(active - 1);
    }
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="border-t border-foreground/[0.06] py-20 md:py-28"
    >
      <div
        className="mx-auto grid max-w-[1200px] gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16"
        onMouseEnter={() => setEngaged(true)}
        onMouseLeave={() => setEngaged(false)}
        onFocusCapture={() => setEngaged(true)}
        onBlurCapture={() => setEngaged(false)}
      >
        {/* ── Left: heading, and the deck's contents as a live index ── */}
        <div className="lg:pt-2">
          <span className="section-label">Inside Prakriva</span>
          <h2 className="mt-4 max-w-md font-display text-display-md tracking-tight text-foreground">
            Every screen earns{" "}
            <span className="italic text-primary">its place</span>
          </h2>
          <p className="mt-6 max-w-md text-body leading-relaxed text-foreground-secondary">
            Seven surfaces, patient and practitioner, each doing one job
            properly rather than a menu of half-built ones.
          </p>

          {/* On wide screens the index doubles as navigation; on narrow ones the
              dots under the deck do that job instead. */}
          <ul className="mt-10 hidden lg:block">
            {CARDS.map((card, i) => {
              const current = i === active;
              return (
                <li key={card.num}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={current ? "true" : undefined}
                    className="group flex w-full items-baseline gap-4 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "font-display text-caption1 tabular-nums transition-colors duration-300",
                        current ? "text-accent" : "text-foreground-tertiary",
                      )}
                    >
                      {card.num}
                    </span>
                    <span className="flex-1">
                      <span
                        className={cn(
                          "text-footnote transition-colors duration-300",
                          current
                            ? "font-semibold text-foreground"
                            : "text-foreground-tertiary group-hover:text-foreground-secondary",
                        )}
                      >
                        {card.title}
                      </span>
                      <span className="mt-2 block h-px w-full bg-foreground/[0.08]">
                        <span
                          key={`${i}-${active}-${playing}`}
                          className={cn(
                            "block h-px origin-left bg-accent transition-transform duration-500 ease-ios",
                            current ? "scale-x-100" : "scale-x-0",
                          )}
                          style={
                            current && playing
                              ? { animation: `deck-progress ${HOLD_MS + GLIDE_MS}ms linear both` }
                              : undefined
                          }
                        />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Right: the deck itself ── */}
        <div className="lg:self-center">
          <div
            role="group"
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-roledescription="carousel"
            aria-label="Prakriva features"
            className="relative grid rounded-[26px] pb-14 outline-none ring-offset-4 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {CARDS.map((card, i) => {
              const pos = (i - active + total) % total;
              const current = pos === 0;
              const { Icon } = card;
              return (
                <article
                  key={card.num}
                  aria-hidden={!current}
                  style={positionStyle(pos, total)}
                  className={cn(
                    "col-start-1 row-start-1 flex flex-col justify-between",
                    "rounded-[26px] border border-foreground/[0.07] bg-card p-8 md:p-10",
                    "transition-[transform,opacity,box-shadow] duration-[700ms] ease-ios will-change-transform",
                    current
                      ? "shadow-[0_36px_90px_-28px_hsl(24_14%_11%/0.18),0_10px_28px_-12px_hsl(24_14%_11%/0.08)]"
                      : "pointer-events-none shadow-[0_18px_44px_-26px_hsl(24_14%_11%/0.22)]",
                  )}
                >
                  {/* Warm wash, strongest on the card at the front */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[26px] transition-opacity duration-[700ms]"
                    style={{
                      opacity: current ? 1 : 0,
                      background:
                        "radial-gradient(420px 260px at 88% 0%, hsl(20 90% 52% / 0.07) 0%, transparent 62%), radial-gradient(360px 300px at 0% 100%, hsl(158 38% 28% / 0.06) 0%, transparent 60%)",
                    }}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-display-sm leading-none text-foreground/[0.10]">
                        {card.num}
                      </span>
                    </div>

                    <span className="section-label mt-7 block">{card.audience}</span>
                    <h3 className="mt-3 max-w-sm font-display text-title2 tracking-tight text-foreground">
                      {card.title}
                    </h3>
                    <p className="mt-3.5 max-w-md text-footnote leading-relaxed text-foreground-secondary">
                      {card.description}
                    </p>
                  </div>

                  <ul className="relative mt-6 flex flex-wrap gap-2">
                    {card.points.map((point) => (
                      <li
                        key={point}
                        className="rounded-full border border-foreground/[0.07] bg-background/60 px-3 py-1.5 text-caption1 text-foreground-secondary"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          {/* ── Controls ── */}
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {CARDS.map((card, i) => (
                <button
                  key={card.num}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${card.title}`}
                  aria-current={i === active ? "true" : undefined}
                  className="group py-2"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all duration-500 ease-ios",
                      i === active
                        ? "w-7 bg-accent"
                        : "w-1.5 bg-foreground/20 group-hover:bg-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(active - 1)}
                aria-label="Previous feature"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.10] text-foreground-secondary transition-colors duration-300 hover:border-foreground/20 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => go(active + 1)}
                aria-label="Next feature"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.10] text-foreground-secondary transition-colors duration-300 hover:border-foreground/20 hover:text-foreground"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Screen readers get the change as text; they should not have to
              infer it from cards moving. */}
          <p className="sr-only" aria-live="polite">
            {`${CARDS[active].title} — feature ${active + 1} of ${total}`}
          </p>
        </div>
      </div>
    </section>
  );
}

export default FeatureDeck;
