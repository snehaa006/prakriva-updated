import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { CompanionCharacter, CompanionMark } from "@/components/chat/CompanionCharacter";
import { Reveal } from "@/components/ui/reveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * One exchange in the scripted demo: the line the visitor can click, and what
 * the companion says back.
 *
 * Everything here has to be something the real companion can actually do —
 * it reads the active diet chart, the pantry and the meal log, and the doctor
 * sees the same record. A demo that promises more than that is a support
 * ticket later, not a marketing flourish. See "Landing page" in the README.
 */
interface DemoTurn {
  /** The visitor's line, shown as a chip before it is sent. */
  ask: string;
  /** The companion's reply. */
  reply: string;
}

const DEMO_TURNS: DemoTurn[] = [
  {
    ask: "What should I make for dinner?",
    reply:
      "Tonight your chart has millet khichdi with ghee — warm, easy to digest, and in step with the pitta-pacifying week your doctor set. Your pantry already has everything for it.",
  },
  {
    ask: "I'm out of millet.",
    reply:
      "Then take Thursday's soft rice pongal instead. Same warm, grounding profile, and it keeps the day's calories where your chart wants them. I've moved it forward for you.",
  },
  {
    ask: "How has my week gone?",
    reply:
      "Dinners have been your steadiest meal this week, and your evening symptom notes are calmer than last week's. Your doctor sees this same summary on her side — nothing to screenshot or re-type.",
  },
];

/** The companion's opening line, before the visitor has clicked anything. */
const GREETING =
  "Hi — I'm your Prakriva companion. I can see your diet chart, your pantry and everything you've been tracking, so nothing you ask starts from scratch.";

/** How long the companion "thinks" before a reply lands, in ms. */
const THINKING_MS = 900;

interface DemoMessage {
  role: "user" | "assistant";
  text: string;
}

/** The three dots shown while the companion is composing — the app's own. */
const TypingDots = () => (
  <span className="flex items-center gap-1.5 py-1.5" aria-label="Companion is typing">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-primary/60"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </span>
);

/**
 * A bubble in the app's own shapes — the mark on the left of a reply, the
 * berry pill on the right for the visitor. The opener is drawn without a fill,
 * exactly as the real panel draws it, so the embed and the app don't disagree
 * about what the companion looks like.
 */
const Bubble = ({ message, plain }: { message: DemoMessage; plain?: boolean }) =>
  message.role === "user" ? (
    <div className="flex animate-message-in justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primary/85 px-4 py-2.5 text-footnote leading-relaxed text-primary-foreground shadow-sm">
        {message.text}
      </p>
    </div>
  ) : (
    <div className="flex animate-message-in gap-3">
      <CompanionMark mood="idle" className="mt-0.5 h-10 w-10 shrink-0" />
      <p
        className={cn(
          "min-w-0 flex-1 rounded-2xl rounded-tl-md px-4 py-2.5 text-footnote leading-relaxed text-foreground",
          plain ? "bg-transparent" : "border border-pink-100/40 bg-pink-50/60",
        )}
      >
        {message.text}
      </p>
    </div>
  );

/**
 * The landing page's chatbot embed: the real companion's surface, running a
 * scripted conversation inside a browser frame.
 *
 * It is deliberately self-contained — no Supabase session, no model call, no
 * sign-in — because this sits above the fold of the decision to sign up. The
 * copy is fixed rather than generated so a visitor can never be shown a number
 * the app would then have to stand behind.
 */
export const CompanionDemo = () => {
  const reducedMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [turn, setTurn] = useState(0);
  const [messages, setMessages] = useState<DemoMessage[]>([
    { role: "assistant", text: GREETING },
  ]);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Keep the newest bubble in view inside the frame — but never scroll the
  // page itself, which `scrollIntoView` would do on the first render.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // jsdom has `scrollTop` but not `Element.scrollTo`, so the assignment is
    // the fallback rather than a nicety.
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, thinking, reducedMotion]);

  const send = useCallback(
    (index: number) => {
      const next = DEMO_TURNS[index];
      if (!next || thinking) return;
      setStarted(true);
      setMessages((prev) => [...prev, { role: "user", text: next.ask }]);
      setTurn(index + 1);

      const land = () => {
        setThinking(false);
        setMessages((prev) => [...prev, { role: "assistant", text: next.reply }]);
      };

      if (reducedMotion) {
        land();
        return;
      }
      setThinking(true);
      timer.current = setTimeout(land, THINKING_MS);
    },
    [reducedMotion, thinking],
  );

  const restart = () => {
    clearTimeout(timer.current);
    setThinking(false);
    setTurn(0);
    setMessages([{ role: "assistant", text: GREETING }]);
  };

  const nextAsk = DEMO_TURNS[turn];
  const finished = turn >= DEMO_TURNS.length && !thinking;
  /** Nothing has been asked yet — the panel still shows its welcome hero. */
  const fresh = messages.length <= 1 && !thinking;

  return (
    <section id="companion" className="section-dark py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="mx-auto max-w-[46rem] text-center">
          <Reveal>
            <span className="section-label !text-[hsl(3_34%_76%)]">Ask the companion</span>
          </Reveal>
          <Reveal index={1}>
            <h2 className="mt-4 font-display text-display-md leading-[1.1] tracking-tight text-white">
              It already knows <span className="italic text-[hsl(3_34%_76%)]">your</span> plan
            </h2>
          </Reveal>
          <Reveal index={2}>
            <p className="mx-auto mt-4 max-w-[52ch] text-footnote leading-relaxed text-white/60">
              The same assistant that sits inside the app, reading your chart, your
              pantry and your log. Try it here — nothing to sign in for.
            </p>
          </Reveal>
        </header>

        {/* ── The embed ──
            A browser frame around the companion's own surface, so it reads as
            the product rather than as an illustration of it. */}
        <Reveal index={3} delay={80}>
          <div className="relative mx-auto mt-12 w-full max-w-[46rem] md:mt-16">
            <div className="overflow-hidden rounded-[20px] bg-background-elevated shadow-[0_50px_120px_-40px_hsl(58_23%_5%/0.9)] ring-1 ring-white/10">
              {/* Chrome */}
              <div className="flex items-center gap-3 border-b border-foreground/[0.07] bg-background px-4 py-2.5">
                <span aria-hidden className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/[0.16]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/[0.16]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-foreground/[0.16]" />
                </span>
                <span className="truncate font-mono text-[11px] text-foreground-tertiary">
                  prakriva.app/companion
                </span>
                <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-tertiary sm:block">
                  Sample conversation
                </span>
              </div>

              {/* Transcript. The nudge is pinned to this box rather than to
                  the frame, so it lands over the conversation and never on top
                  of the chip it is asking the visitor to press. */}
              <div className="relative">
                <div
                  ref={scroller}
                  className={cn(
                    "scroll-area flex h-[19rem] flex-col overflow-y-auto px-4 py-5 sm:h-[21rem] sm:px-6",
                    // Room at the bottom for the nudge, so it never lands on
                    // top of the opener it is asking to be read.
                    !started && "pb-14",
                  )}
                >
                  {/* `mt-auto` rather than `justify-end`: a flex container that
                      justifies to the end clips its own overflow at the top in
                      every browser, and this one scrolls. */}
                  <div className="mt-auto flex flex-col gap-4">
                    {/* The app draws this hero above the opener while the
                        conversation is still fresh; the embed does the same. */}
                    {fresh && (
                      <div className="flex animate-message-in flex-col items-center pb-1 pt-2">
                        <CompanionCharacter mood="idle" className="mb-3 h-24 w-24" />
                        <p className="text-caption1 font-medium text-foreground-secondary">
                          Your wellness companion
                        </p>
                      </div>
                    )}

                    {messages.map((message, i) => (
                      <Bubble
                        key={`${message.role}-${i}`}
                        message={message}
                        plain={i === 0 && fresh}
                      />
                    ))}

                    {thinking && (
                      <div className="flex animate-message-in gap-3">
                        <CompanionMark mood="thinking" className="mt-0.5 h-10 w-10 shrink-0" />
                        <span className="rounded-2xl rounded-tl-md border border-pink-100/40 bg-pink-50/60 px-4 py-2.5">
                          <TypingDots />
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!started && (
                  <button
                    type="button"
                    onClick={() => send(0)}
                    className={cn(
                      "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(58_23%_13%)] px-4 py-2",
                      "font-mono text-[10px] uppercase tracking-[0.16em] text-white/90",
                      "shadow-lg ring-1 ring-white/15 transition-colors hover:bg-[hsl(58_23%_20%)]",
                    )}
                  >
                    Click to interact
                  </button>
                )}
              </div>

              {/* Composer. The field is a prop — the demo advances by chip, so
                  there is nothing to type and nothing to submit. */}
              <div className="border-t border-foreground/[0.07] px-4 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  {nextAsk ? (
                    <button
                      type="button"
                      onClick={() => send(turn)}
                      disabled={thinking}
                      className="rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-1.5 text-caption1 text-foreground transition-colors hover:bg-primary/[0.14] disabled:opacity-50"
                    >
                      {nextAsk.ask}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={restart}
                      className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-caption1 text-foreground-secondary transition-colors hover:bg-foreground/[0.06]"
                    >
                      Start over
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2.5">
                  <span
                    aria-hidden
                    className="flex-1 truncate font-sans text-footnote text-foreground-tertiary"
                  >
                    {finished
                      ? "In the app, ask it anything about your plan…"
                      : "Pick a question above…"}
                  </span>
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.12]"
                  >
                    <ArrowUp className="h-3.5 w-3.5 text-foreground/50" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default CompanionDemo;
