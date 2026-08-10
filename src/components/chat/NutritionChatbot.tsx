import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  AnalysisUnavailableError,
  askChat,
  isAnalysisEnabled,
  type ChatTurn,
} from "@/services/analysisService";
import {
  fetchPatientChatContext,
  looksLikeRecipeRequest,
  maybeFetchRecipeCandidates,
  type PatientChatContext,
} from "@/services/chatAssistantService";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  quickReplies?: { label: string; value: string }[];
  timestamp: number;
  /** A failure notice rather than a real reply — see `buildHistory`. */
  isError?: boolean;
  /** Why it failed, shown small under the bubble so it can be acted on. */
  detail?: string;
}

// Bumped from the old `nourish_chatbot_*` keys: this version's messages have a
// different shape (no `options`/`recipe` fields), and the assistant no longer
// answers only from `disease_screenings` — a stale cached transcript under the
// old key would otherwise render oddly or reference a profile flow that no
// longer exists.
const STORAGE_KEY = "prakriva_chatbot_messages_v2";

const EMPTY_CONTEXT: PatientChatContext = {
  profile: {},
  activePlan: null,
  pantry: { atHome: [], toBuy: [] },
  mealAdherence: { days: [] },
  mealFeedback: [],
  lifestyle: { days: [] },
  screenings: [],
};

const QUICK_REPLIES = [
  { label: "Suggest a recipe", value: "Can you suggest a recipe for me right now?" },
  { label: "How am I doing this week?", value: "How have I been doing over the last 7 days? Am I improving?" },
  { label: "Ayurvedic tips for me", value: "What Ayurvedic tips would help me right now?" },
  { label: "I'm craving something sweet", value: "I'm craving something sweet. What can I make?" },
];

const WELCOME_TEXT =
  "Namaste! I'm your Prakriva wellness companion. I can see your diet plan, pantry, and tracked " +
  "history, so ask me anything — a recipe idea, how your week's going, or an Ayurvedic question.";

const msgId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const welcomeMessage = (): ChatMessage => ({
  id: msgId(),
  role: "assistant",
  text: WELCOME_TEXT,
  quickReplies: QUICK_REPLIES,
  timestamp: Date.now(),
});

/**
 * Last few turns, oldest first, in the shape Gemini expects.
 *
 * Failure notices ("I couldn't reach your assistant…") are left out: they were
 * never the assistant's answer, and replaying them as model turns teaches the
 * conversation that it is broken. Leading model turns go too — the transcript
 * opens with the canned welcome, and Gemini requires a conversation to start
 * with a user turn.
 */
const buildHistory = (messages: ChatMessage[], limit = 8): ChatTurn[] => {
  const turns = messages
    .filter((m) => !m.isError)
    .slice(-limit)
    .map((m): ChatTurn => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

  const firstUser = turns.findIndex((t) => t.role === "user");
  return firstUser === -1 ? [] : turns.slice(firstUser);
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface NutritionChatbotProps {
  /** Optionally controlled from a parent, so the bottom-tab-bar's center AI
   *  button can open the same conversation this component's own (desktop)
   *  launcher does. Falls back to internal state when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide this component's own floating launcher button — used on phone,
   *  where the bottom nav's center button is the entry point instead. */
  hideTrigger?: boolean;
}

const NutritionChatbot: React.FC<NutritionChatbotProps> = ({ open, onOpenChange, hideTrigger }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [context, setContext] = useState<PatientChatContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Whether Gemini is configured, and — only then — her own data to chat
  // over. Both failures are silent: an unconfigured assistant or an
  // unreachable Supabase just means the chat says so when she tries to send.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const enabled = await isAnalysisEnabled();
      if (cancelled) return;
      setAssistantEnabled(enabled);
      setStatusChecked(true);
      if (!enabled) return;

      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled || !data.user) return;
        const ctx = await fetchPatientChatContext(data.user.id);
        if (!cancelled) setContext(ctx);
      } catch (error) {
        console.error("Could not load chat context:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Restore any saved conversation.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[]);
    } catch {
      // ignore parse errors — start fresh
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 100);
    // Seed the welcome message however the panel got opened — the launcher
    // below and the bottom-tab-bar's center AI button both just flip `isOpen`.
    setMessages((prev) => (prev.length === 0 ? [welcomeMessage()] : prev));
  }, [isOpen]);

  const handleOpen = useCallback(() => setIsOpen(true), [setIsOpen]);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([welcomeMessage()]);
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isLoading) return;

      const history = buildHistory(messages);
      const userMessage: ChatMessage = { id: msgId(), role: "user", text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Deliberately not gated on `assistantEnabled`: that flag is still
        // false while the status check is in flight, and refusing to send
        // meant the first message of a session was answered with "isn't
        // available" even on a perfectly healthy deployment. An unconfigured
        // backend answers this call with a 503 that says so.
        const baseContext = context ?? EMPTY_CONTEXT;
        const recipeCandidates = looksLikeRecipeRequest(text)
          ? await maybeFetchRecipeCandidates(text, baseContext.pantry.atHome, baseContext.profile.dietaryPreference)
          : [];

        const answer = await askChat(text, history, { ...baseContext, recipeCandidates });
        setMessages((prev) => [
          ...prev,
          { id: msgId(), role: "assistant", text: answer, timestamp: Date.now() },
        ]);
      } catch (error) {
        console.error("Chat message failed:", error);
        const unavailable = error instanceof AnalysisUnavailableError;
        setMessages((prev) => [
          ...prev,
          {
            id: msgId(),
            role: "assistant",
            text: unavailable
              ? "Your wellness assistant isn't available right now. Please try again shortly."
              : "I couldn't reach your assistant just now — please try again in a moment.",
            // Kept visible rather than only in the console: on a deployed
            // frontend this line is the only clue whether the backend is
            // unreachable, out of Gemini quota, or misconfigured.
            detail: error instanceof Error ? error.message : String(error),
            isError: true,
            quickReplies: [{ label: "Try again", value: text }],
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, context]
  );

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText);
    setInputText("");
  };

  const handleQuickReply = (value: string) => {
    if (isLoading) return;
    sendMessage(value);
  };

  return (
    <>
      {/* On phone the bottom-tab-bar's center AI button is the entry point
          instead — this floating launcher only shows on larger screens (or
          everywhere, if a caller doesn't set hideTrigger). */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 ease-ios-spring hover:scale-105 hover:shadow-xl active:scale-95 group",
            hideTrigger && "hidden md:flex",
          )}
          aria-label="Open wellness companion"
        >
          <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-success ring-2 ring-background" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-x-3 bottom-20 z-50 flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-border glass shadow-glass animate-in slide-in-from-bottom-4 duration-300 ease-ios-spring md:inset-x-auto md:bottom-6 md:right-6 md:h-[600px] md:max-h-[calc(100vh-4rem)] md:w-[400px]">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-subhead font-semibold leading-tight text-foreground">Your wellness companion</h3>
                  <p className="flex items-center gap-1.5 text-caption1 text-foreground-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Here for you, anytime
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReset}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Reset chat"
                  title="Start over"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Minimize chat"
                  title="Minimize"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close chat"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-area">
            {statusChecked && !assistantEnabled && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-footnote text-foreground">
                Your companion isn't configured on this deployment yet, so it can't answer right now.
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-footnote leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-card text-card-foreground shadow-xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {msg.detail && (
                  <p className="ml-1 mt-1 break-words text-caption2 text-foreground-tertiary">{msg.detail}</p>
                )}

                {msg.quickReplies && msg.id === messages[messages.length - 1]?.id && (
                  <div className="ml-1 mt-2.5 flex flex-wrap gap-1.5">
                    {msg.quickReplies.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleQuickReply(opt.value)}
                        disabled={isLoading}
                        className="rounded-full border border-border bg-accent-soft px-3.5 py-1.5 text-caption1 font-medium text-accent-soft-foreground transition-colors hover:bg-accent-soft/70 disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5 shadow-xs">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground-tertiary [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground-tertiary [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground-tertiary" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-border bg-background-elevated px-3.5 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isLoading ? "Thinking…" : "Ask me anything…"}
                disabled={isLoading}
                className="flex-1 rounded-full border border-input bg-muted px-4 py-2.5 text-footnote text-foreground outline-none transition-colors placeholder:text-foreground-tertiary focus:border-ring focus:bg-background-elevated focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                size="sm"
                className="h-10 w-10 shrink-0 rounded-full p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-caption2 text-foreground-tertiary">
              Not medical advice. Always consult your healthcare provider.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default NutritionChatbot;
