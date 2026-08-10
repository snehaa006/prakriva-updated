// The AI assistant, shown rather than described.
//
// The panel is a faithful still of the in-app assistant (the floating chat in
// PatientLayout): same voice, same kind of answer, grounded in the patient's
// own plan and pantry. It is presentational only — no model call from the
// marketing page — but the transcript is written to match what the real
// assistant can actually do, so the page doesn't promise anything the product
// won't deliver.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/useReveal";

const TRANSCRIPT = [
  {
    role: "user" as const,
    text: "I'm 22 weeks pregnant and my iron came back low. What should I eat this week?",
  },
  {
    role: "assistant" as const,
    text: "Your last check flagged mild anaemia, so let's lean iron-rich and Pitta-gentle. I've put moong dal khichdi, sesame-date ladoos and steamed amaranth greens into your plan — all from what's already in your pantry.",
  },
  {
    role: "assistant" as const,
    text: "Pair the greens with a squeeze of lemon; the vitamin C roughly doubles what your body absorbs. I've flagged this for Dr. Iyer to review at Thursday's consult.",
  },
];

const CAPABILITIES = [
  "Reads your plan, pantry and past screenings",
  "Suggests recipes from what you already have",
  "Hands anything clinical back to your doctor",
];

export const AssistantSection = () => {
  const ref = useReveal<HTMLElement>();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Type the transcript in one bubble at a time, but only once the panel is on
  // screen — otherwise the whole conversation has already "happened" by the
  // time anyone scrolls to it.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;

    const reveal = () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setVisible(TRANSCRIPT.length);
        return;
      }
      TRANSCRIPT.forEach((_, i) => {
        window.setTimeout(() => setVisible(i + 1), i * 900);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      setVisible(TRANSCRIPT.length);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        reveal();
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="assistant"
      ref={ref}
      className="grain relative isolate overflow-hidden py-24 sm:py-32"
    >
      {/* Colour wash behind the glass, so the panel has something to frost. */}
      <div className="absolute inset-0 -z-10 bg-gradient-cream">
        <div
          className="blush-field animate-drift-slow left-[-8%] top-[10%] h-[34rem] w-[34rem]"
          style={{ background: "hsl(var(--blush-deep))", opacity: 0.55 }}
        />
        <div
          className="blush-field animate-drift right-[-10%] bottom-[-10%] h-[30rem] w-[30rem]"
          style={{ background: "hsl(var(--petal))", opacity: 0.5 }}
        />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="reveal">
            <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[hsl(var(--rose-accent))]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              The assistant
            </p>
            <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-[1.08] tracking-[-0.02em]">
              An answer that knows
              <em className="italic"> your history</em>.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/65">
              Not a search box. Prakriva's assistant reads the same record your doctor does —
              your diet plan, your pantry, what you logged this week, what your last screening
              found — and answers from it.
            </p>

            <ul className="mt-8 space-y-3">
              {CAPABILITIES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground/75">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-blush">
                    <Check className="h-3 w-3 text-foreground/70" aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="group mt-9 h-14 rounded-full bg-gradient-rose px-8 text-base text-white shadow-[0_16px_40px_-16px_hsl(345_50%_40%/0.7)] transition-transform hover:scale-[1.03] hover:opacity-95"
              onClick={() => navigate("/auth/patient")}
            >
              Ask your first question
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Glass chat panel */}
          <div ref={panelRef} className="reveal">
            <div className="glass-panel animate-float rounded-5xl p-3 sm:p-4">
              <div className="rounded-[1.75rem] bg-card/60 p-5 sm:p-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-rose">
                    <Sparkles className="h-4 w-4 text-white" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Prakriva Assistant</p>
                    <p className="text-xs text-foreground/50">Grounded in your health record</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-foreground/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--rose-accent))]" />
                    Online
                  </span>
                </div>

                <div className="space-y-3 pt-5" aria-live="polite">
                  {TRANSCRIPT.slice(0, visible).map((message, i) => (
                    <div
                      key={i}
                      className={`flex animate-fade-up ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <p
                        className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "rounded-br-lg bg-gradient-rose text-white"
                            : "rounded-bl-lg bg-background/70 text-foreground/80"
                        }`}
                      >
                        {message.text}
                      </p>
                    </div>
                  ))}

                  {visible < TRANSCRIPT.length && (
                    <div className="flex justify-start">
                      <span className="flex gap-1 rounded-3xl rounded-bl-lg bg-background/70 px-4 py-4">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="h-1.5 w-1.5 animate-float rounded-full bg-foreground/35"
                            style={{ animationDelay: `${d * 150}ms`, animationDuration: "1.2s" }}
                          />
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-3">
                  <span className="text-sm text-foreground/40">Ask about your plan…</span>
                  <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-gradient-rose">
                    <ArrowRight className="h-3.5 w-3.5 text-white" aria-hidden />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AssistantSection;
