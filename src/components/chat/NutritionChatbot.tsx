import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowUp, ChevronDown, Maximize2, Minimize2, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  AnalysisUnavailableError,
  askChat,
  askDoctorChat,
  isAnalysisEnabled,
  type ChatTurn,
} from "@/services/analysisService";
import {
  fetchDoctorChatContext,
  fetchPatientChatContext,
  looksLikeRecipeRequest,
  maybeFetchRecipeCandidates,
  type DoctorChatContext,
  type PatientChatContext,
} from "@/services/chatAssistantService";
import {
  buildFollowUps,
  buildLeadUps,
  buildProactiveCues,
  greeting,
  nextUnseenCue,
  type CompanionCue,
  type CueCard as CueCardData,
  type CueOption,
  type CueSuggestion,
} from "@/lib/companionCues";
import { CompanionCharacter, CompanionMark, type CompanionMood } from "./CompanionCharacter";
import { CueCard } from "./CueCard";
import { RichText } from "./RichText";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  /** Chips offered under this message — lead-ups before a topic, follow-ups after one. */
  suggestions?: CueSuggestion[];
  /** An interactive question card (see CueCard) attached to this message. */
  card?: CueCardData;
  /** Which of the card's options she picked, so the choice survives a reload. */
  cardChoiceId?: string;
  /** Continue has been pressed — the card locks. */
  cardSpent?: boolean;
  /** The cue this message came from, so the same nudge isn't raised twice. */
  cueId?: string;
  /** A failure notice rather than a real reply — see `buildHistory`. */
  isError?: boolean;
  /** Why it failed, shown small under the bubble so it can be acted on. */
  detail?: string;
}

// Bumped from `_v2`: messages now carry cards, cue ids and suggestion chips,
// and a transcript saved by the old chat would render its `quickReplies` as
// nothing at all.
const STORAGE_KEY = "prakriva_chatbot_messages_v3";
/** Nudges already raised, so the companion doesn't repeat itself day to day. */
const SEEN_CUES_KEY = "prakriva_chatbot_seen_cues_v1";

const EMPTY_CONTEXT: PatientChatContext = {
  profile: {},
  activePlan: null,
  pantry: { atHome: [], toBuy: [] },
  mealAdherence: { days: [] },
  mealFeedback: [],
  lifestyle: { days: [] },
  screenings: [],
};

// --- How long the companion waits before speaking up on its own -------------
// All jittered: a nudge that arrives at exactly the same beat every session
// reads as a timer, and the point is that it reads as attention.

/** Panel closed: how long before the first popup teaser appears. */
const FIRST_TEASER_MS = 14_000;
/** Panel closed: the gap between one dismissed teaser and the next. */
const REPEAT_TEASER_MS = 4 * 60_000;
/** Panel open and quiet: how long before the companion raises something itself. */
const IDLE_CUE_MS = 75_000;
const JITTER_MS = 20_000;

const jitter = (base: number): number => base + Math.random() * JITTER_MS;

const msgId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const welcomeText = (ctx: PatientChatContext | DoctorChatContext | null, now: Date, mode: "patient" | "doctor"): string => {
  if (mode === "doctor") {
    const count = (ctx as DoctorChatContext | null)?.doctor?.patientCount;
    return (
      `${greeting(now)} — I'm your Prakriva clinical assistant. I can see your patient roster` +
      `${count ? ` (${count} patient${count !== 1 ? "s" : ""})` : ""}, their profiles, screening results and adherence data. ` +
      `Ask me to analyse a patient, suggest a diet modification, draft a screening summary, or anything else.`
    );
  }
  const name = (ctx as PatientChatContext | null)?.profile?.primaryDosha;
  return (
    `${greeting(now)} — I'm your Prakriva companion. I can see your diet plan, your pantry and everything ` +
    `you've been tracking${name ? `, and I know you lean ${name}` : ""}, so nothing you ask me starts from scratch.`
  );
};

/**
 * Last few turns, oldest first, in the shape Gemini expects.
 *
 * Failure notices ("I couldn't reach your assistant…") are left out: they were
 * never the assistant's answer, and replaying them as model turns teaches the
 * conversation that it is broken. Leading model turns go too — the transcript
 * opens with the companion's own greeting, and Gemini requires a conversation
 * to start with a user turn.
 */
const buildHistory = (messages: ChatMessage[], limit = 8): ChatTurn[] => {
  const turns = messages
    .filter((m) => !m.isError)
    .slice(-limit)
    .map((m): ChatTurn => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

  const firstUser = turns.findIndex((t) => t.role === "user");
  return firstUser === -1 ? [] : turns.slice(firstUser);
};

const readSeenCues = (): string[] => {
  try {
    const raw = localStorage.getItem(SEEN_CUES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as string[]) : [];
  } catch {
    return [];
  }
};

// ──────────────────────────────────────────────
// The companion's stage: where it stands, and how it feels
// ──────────────────────────────────────────────

/**
 * The character is not decoration in a corner — it acts out the state of the
 * conversation, which is the one thing a chat UI otherwise only says in a
 * spinner:
 *
 *   idle       resting on the left, nothing happening
 *   typing     she's writing — it leans in and thinks
 *   reading    her message just landed — it crosses to her side and reads it
 *   answering  back on its own side, thinking, while the reply is fetched
 *   delighted  the answer arrived
 */
type Stage = "idle" | "typing" | "reading" | "answering" | "delighted";

const STAGE_MOOD: Record<Stage, CompanionMood> = {
  idle: "idle",
  typing: "thinking",
  reading: "reading",
  answering: "thinking",
  delighted: "happy",
};

/** Which end of the strip the character stands at. */
const STAGE_SIDE: Record<Stage, "left" | "right"> = {
  idle: "left",
  typing: "left",
  reading: "right",
  answering: "left",
  delighted: "left",
};

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  typing: "Listening…",
  reading: "Reading that…",
  answering: "Thinking it through…",
  delighted: "All yours",
};

/** How long the character stays on her side reading before it walks back. */
const READING_MS = 1_100;
/** How long it looks pleased after an answer lands. */
const DELIGHT_MS = 1_800;

const CompanionStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const side = STAGE_SIDE[stage];
  const label = STAGE_LABEL[stage];

  return (
    <div className="relative h-16 shrink-0 px-4" aria-hidden>
      <div
        className="absolute top-0 transition-[left,transform] duration-700 ease-ios-spring"
        style={{
          left: side === "right" ? "100%" : "0%",
          transform: side === "right" ? "translateX(-100%)" : "none",
        }}
      >
        <CompanionCharacter mood={STAGE_MOOD[stage]} className="h-14 w-14" />
      </div>

      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-caption1 font-medium text-foreground-tertiary transition-opacity duration-300",
          label ? "opacity-100" : "opacity-0",
          side === "right" ? "right-16" : "left-16",
        )}
      >
        {label}
      </span>
    </div>
  );
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
  /** "patient" (default) for the wellness companion, "doctor" for the clinical assistant. */
  mode?: "patient" | "doctor";
}

const NutritionChatbot: React.FC<NutritionChatbotProps> = ({ open, onOpenChange, hideTrigger, mode = "patient" }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [context, setContext] = useState<PatientChatContext | null>(null);
  const [seenCues, setSeenCues] = useState<string[]>(readSeenCues);
  const [teaser, setTeaser] = useState<CompanionCue | null>(null);
  const [stage, setStage] = useState<Stage>("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasLoading = useRef(false);
  const teaserCount = useRef(0);
  // Read inside `setMessages` updaters and timers, where depending on the
  // state itself would re-run the effect that just changed it.
  const seenCuesRef = useRef(seenCues);
  seenCuesRef.current = seenCues;

  /** Everything the companion could raise right now, most useful first.
   *  Proactive cues are patient-only — doctors don't need unsolicited nudges. */
  const cues = useMemo(() => (mode === "patient" ? buildProactiveCues(context) : []), [context, mode]);

  // Whether Gemini is configured, and — only then — data to chat over.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const statusPromise = isAnalysisEnabled();
      const contextPromise = (async () => {
        try {
          const { data } = await supabase.auth.getUser();
          if (!data.user) return null;
          return mode === "doctor"
            ? await fetchDoctorChatContext(data.user.id)
            : await fetchPatientChatContext(data.user.id);
        } catch (error) {
          console.error("Could not load chat context:", error);
          return null;
        }
      })();

      const [enabled, ctx] = await Promise.all([statusPromise, contextPromise]);
      if (cancelled) return;
      setAssistantEnabled(enabled);
      setStatusChecked(true);
      if (ctx) setContext(ctx);
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

  const markCueSeen = useCallback((id: string) => {
    setSeenCues((prev) => {
      if (prev.includes(id)) return prev;
      // Only the last few matter — an id is date-stamped, so old ones can
      // never match again anyway.
      const next = [...prev, id].slice(-40);
      try {
        localStorage.setItem(SEEN_CUES_KEY, JSON.stringify(next));
      } catch {
        // A full localStorage just means a nudge may repeat. Not worth failing.
      }
      return next;
    });
  }, []);

  // --- The opening message ---------------------------------------------------
  // Seeded however the panel got opened (this component's launcher, or the
  // bottom tab bar's center button). It starts generic, then upgrades itself
  // the moment her real context lands: the greeting names her constitution,
  // the chips come from her own plan and pantry, and the top proactive cue —
  // a new health check, meals logged without feedback — arrives as a card
  // attached to it rather than as a second message she has to wait for.
  const doctorSuggestions: CueSuggestion[] = [
    { label: "Summarise my patients", value: "Give me a summary of all my patients, their conditions and adherence" },
    { label: "Diet for pregnant patient", value: "Suggest an Ayurvedic diet plan for a pregnant patient in her second trimester" },
    { label: "Screening analysis tips", value: "What should I look for when reviewing maternal health screenings?" },
    { label: "PCOS nutrition guide", value: "What are the key Ayurvedic nutrition principles for managing PCOS?" },
  ];

  const makeOpener = useCallback((): ChatMessage => {
    const now = new Date();
    const cue = mode === "patient" ? nextUnseenCue(cues, seenCuesRef.current) : null;
    return {
      id: `welcome_${now.getTime()}`,
      role: "assistant",
      text: cue ? `${welcomeText(context, now, mode)}\n\n${cue.message}` : welcomeText(context, now, mode),
      suggestions: cue?.suggestions ?? (mode === "doctor" ? doctorSuggestions : buildLeadUps(context)),
      card: cue?.card,
      cueId: cue?.id,
      timestamp: now.getTime(),
    };
  }, [cues, context]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 100);

    setMessages((prev) => {
      // Only ever replace a lone, un-upgraded greeting: once she has said
      // anything — or the greeting has already claimed a cue — the transcript
      // belongs to the conversation, not to this effect.
      if (prev.length > 1 || prev[0]?.cueId) return prev;
      return [makeOpener()];
    });
  }, [isOpen, makeOpener]);

  // The opener's cue counts as raised — otherwise the same nudge comes back
  // as an unprompted message a minute later.
  useEffect(() => {
    const opener = messages[0];
    if (opener?.cueId && !seenCues.includes(opener.cueId)) markCueSeen(opener.cueId);
  }, [messages, seenCues, markCueSeen]);

  const handleOpen = useCallback(() => {
    setTeaser(null);
    setIsOpen(true);
  }, [setIsOpen]);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([makeOpener()]);
  }, [makeOpener]);

  // --- Sending ---------------------------------------------------------------

  // Ref so sendMessage always sees the latest messages without re-creating the callback.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const contextRef = useRef(context);
  contextRef.current = context;
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isLoading || sendingRef.current) return;
      sendingRef.current = true;

      const history = buildHistory(messagesRef.current);
      const userMessage: ChatMessage = { id: msgId(), role: "user", text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const baseContext = contextRef.current ?? EMPTY_CONTEXT;
        let answer: string;

        if (mode === "doctor") {
          // Doctor mode: send to doctor-specific endpoint, no recipe grounding
          answer = await askDoctorChat(text, history, baseContext as Record<string, unknown>);
        } else {
          // Patient mode: recipe grounding + patient chat endpoint
          let recipeCandidates: Awaited<ReturnType<typeof maybeFetchRecipeCandidates>> = [];
          if (looksLikeRecipeRequest(text)) {
            const patientCtx = baseContext as PatientChatContext;
            const recipePromise = maybeFetchRecipeCandidates(
              text, patientCtx.pantry?.atHome ?? [], patientCtx.profile?.dietaryPreference,
            );
            const timeout = new Promise<typeof recipeCandidates>((resolve) =>
              setTimeout(() => resolve([]), 4_000),
            );
            recipeCandidates = await Promise.race([recipePromise, timeout]);
          }
          answer = await askChat(text, history, { ...baseContext, recipeCandidates });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: msgId(),
            role: "assistant",
            text: answer,
            suggestions: mode === "doctor" ? undefined : buildFollowUps(text, contextRef.current),
            timestamp: Date.now(),
          },
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
            detail: error instanceof Error ? error.message : String(error),
            isError: true,
            suggestions: [{ label: "Try again", value: text }],
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
        sendingRef.current = false;
      }
    },
    [isLoading],
  );

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText);
    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleSuggestion = (value: string) => {
    if (isLoading) return;
    sendMessage(value);
  };

  // --- Cards -----------------------------------------------------------------

  const handleCardChoice = useCallback((messageId: string, option: CueOption) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, cardChoiceId: option.id } : m)),
    );
  }, []);

  const handleCardContinue = useCallback(
    (messageId: string, option: CueOption) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, cardSpent: true } : m)));
      sendMessage(option.value);
    },
    [sendMessage],
  );

  // --- The character's state machine ----------------------------------------

  useEffect(() => {
    if (isLoading && !wasLoading.current) {
      wasLoading.current = true;
      setStage("reading");
      const t = setTimeout(() => setStage("answering"), READING_MS);
      return () => clearTimeout(t);
    }
    if (!isLoading && wasLoading.current) {
      wasLoading.current = false;
      setStage("delighted");
      const t = setTimeout(() => setStage("idle"), DELIGHT_MS);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  // Typing only colours the resting state — it must never interrupt a reply
  // that is already in flight.
  const visibleStage: Stage = stage === "idle" && inputText.trim() ? "typing" : stage;

  // --- Speaking up unprompted ------------------------------------------------

  /** Raise a cue as a message from the companion, mid-conversation. */
  const postCue = useCallback(
    (cue: CompanionCue) => {
      markCueSeen(cue.id);
      setMessages((prev) => {
        if (prev.some((m) => m.cueId === cue.id)) return prev;
        return [
          ...prev,
          {
            id: msgId(),
            role: "assistant",
            text: cue.message,
            card: cue.card,
            suggestions: cue.suggestions,
            cueId: cue.id,
            timestamp: Date.now(),
          },
        ];
      });
    },
    [markCueSeen],
  );

  // Panel open, but nothing has happened for a while: rather than sitting
  // there, the companion raises the next thing worth raising.
  useEffect(() => {
    if (!isOpen || isLoading || cues.length === 0) return;
    const cue = nextUnseenCue(cues, seenCues);
    if (!cue) return;

    const t = setTimeout(() => {
      // Re-check on the way out: the panel may have raised this cue itself
      // (or she may have asked about it) while the timer ran.
      const stillUnseen = nextUnseenCue(cues, seenCuesRef.current);
      if (stillUnseen) postCue(stillUnseen);
    }, jitter(IDLE_CUE_MS));
    return () => clearTimeout(t);
  }, [isOpen, isLoading, cues, seenCues, messages.length, postCue]);

  // Panel closed: the same cue arrives as a small popup beside the launcher,
  // which is the only way she'd ever learn a new health report has landed
  // without going looking for it.
  useEffect(() => {
    if (isOpen || teaser || cues.length === 0) return;
    const cue = nextUnseenCue(cues, seenCues);
    if (!cue) return;

    const delay = jitter(teaserCount.current === 0 ? FIRST_TEASER_MS : REPEAT_TEASER_MS);
    const t = setTimeout(() => {
      teaserCount.current += 1;
      setTeaser(cue);
    }, delay);
    return () => clearTimeout(t);
  }, [isOpen, teaser, cues, seenCues]);

  const dismissTeaser = useCallback(() => {
    if (teaser) markCueSeen(teaser.id);
    setTeaser(null);
  }, [teaser, markCueSeen]);

  const openTeaser = useCallback(() => {
    if (teaser) postCue(teaser);
    setTeaser(null);
    setIsOpen(true);
  }, [teaser, postCue, setIsOpen]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <>
      {/* On phone the bottom-tab-bar's center AI button is the entry point
          instead — this floating launcher only shows on larger screens (or
          everywhere, if a caller doesn't set hideTrigger). */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "group fixed bottom-6 right-6 z-50 flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all duration-300 ease-ios-spring hover:scale-110 active:scale-95",
            hideTrigger && "hidden md:flex",
          )}
          aria-label="Open wellness companion"
          style={{ filter: "drop-shadow(0 4px 12px rgba(236,107,139,0.4))" }}
        >
          <CompanionCharacter mood={teaser ? "happy" : "idle"} className="h-[72px] w-[72px]" />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full ring-2 ring-background transition-colors",
              teaser ? "bg-primary animate-pulse-soft" : "bg-success",
            )}
          />
        </button>
      )}

      {/* The unprompted popup: one line, and two ways out of it. */}
      {!isOpen && teaser && (
        <div
          className={cn(
            "fixed z-50 w-[min(22rem,calc(100vw-2rem))] animate-nudge-in rounded-2xl border border-pink-200/60 bg-background-elevated p-4 shadow-xl",
            "bottom-[5.5rem] right-4 md:right-6",
          )}
          role="status"
        >
          <button
            onClick={dismissTeaser}
            className="absolute right-2.5 top-2.5 rounded-full p-1 text-foreground-tertiary transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-start gap-3">
            <CompanionCharacter mood="happy" still className="h-14 w-14 shrink-0" />
            <div className="min-w-0 pt-0.5">
              <p className="pr-5 text-footnote leading-snug text-foreground">{teaser.teaser}</p>
              <button
                onClick={openTeaser}
                className="mt-2.5 rounded-full bg-gradient-to-r from-pink-400 to-pink-500 px-4 py-1.5 text-caption1 font-semibold text-white shadow-sm transition-all duration-200 ease-ios-spring hover:shadow-md hover:brightness-105 active:scale-95"
              >
                Show me
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-pink-200/40 bg-background shadow-xl animate-in slide-in-from-bottom-4 duration-300 ease-ios-spring",
            expanded
              ? "inset-x-3 bottom-20 top-6 md:inset-6 md:bottom-6 md:top-6"
              : "inset-x-3 bottom-20 h-[calc(100vh-9rem)] md:inset-x-auto md:bottom-6 md:right-6 md:h-[640px] md:max-h-[calc(100vh-4rem)] md:w-[420px]",
          )}
        >
          <header className="relative shrink-0 overflow-hidden bg-gradient-to-r from-pink-100 via-pink-50 to-coral-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <CompanionCharacter
                  mood="idle"
                  still
                  className="h-12 w-12 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold leading-tight text-foreground">
                    {mode === "doctor" ? "Clinical Assistant" : "Prakriva Companion"}
                  </h3>
                  <p className="flex items-center gap-1.5 text-caption2 text-foreground-secondary">
                    <span className={cn("h-1.5 w-1.5 rounded-full", isLoading ? "bg-gold animate-pulse-soft" : "bg-success")} />
                    {isLoading ? "Thinking..." : mode === "doctor" ? "Patient analysis & guidance" : "Here for you, anytime"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReset}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-white/60 hover:text-foreground"
                  aria-label="Start a new chat"
                  title="New chat"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="hidden rounded-full p-2 text-foreground-secondary transition-colors hover:bg-white/60 hover:text-foreground md:inline-flex"
                  aria-label={expanded ? "Shrink chat" : "Expand chat"}
                  title={expanded ? "Shrink" : "Expand"}
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-white/60 hover:text-foreground md:hidden"
                  aria-label="Minimize chat"
                  title="Minimize"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-foreground-secondary transition-colors hover:bg-white/60 hover:text-foreground"
                  aria-label="Close chat"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <div className="scroll-area flex-1 overflow-y-auto">
            <div className={cn("mx-auto space-y-4 px-4 py-4", expanded ? "max-w-2xl" : "max-w-none")}>
              {statusChecked && !assistantEnabled && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-footnote text-foreground">
                  Your companion isn't configured on this deployment yet, so it can't answer right now.
                </div>
              )}

              {/* Welcome hero — shown only when the conversation is fresh (just the opener). */}
              {messages.length <= 1 && !isLoading && (
                <div className="flex flex-col items-center py-4 animate-message-in">
                  <CompanionCharacter mood="idle" className="h-32 w-32 mb-3" />
                  <p className="text-center text-caption1 font-medium text-foreground-secondary">
                    {mode === "doctor" ? "Your clinical AI assistant" : "Your wellness companion"}
                  </p>
                </div>
              )}

              {messages.map((msg, index) => {
                const startsGroup = index === 0 || messages[index - 1].role !== msg.role;
                const isLast = msg.id === lastMessageId;
                const isWelcome = index === 0 && messages.length <= 1;

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end animate-message-in">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primary/85 px-4 py-2.5 text-footnote leading-relaxed text-primary-foreground shadow-sm">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="animate-message-in">
                    <div className="flex gap-3">
                      {startsGroup ? (
                        <CompanionMark
                          mood={msg.isError ? "thinking" : "idle"}
                          className="mt-0.5 h-10 w-10 shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0" aria-hidden />
                      )}
                      <div className={cn(
                        "min-w-0 flex-1 rounded-2xl rounded-tl-md px-4 py-2.5 text-footnote leading-relaxed",
                        msg.isError
                          ? "bg-red-50 text-red-800 border border-red-100"
                          : isWelcome
                            ? "bg-transparent text-foreground"
                            : "bg-pink-50/60 text-foreground border border-pink-100/40",
                      )}>
                        <RichText text={msg.text} />
                        {msg.detail && (
                          <p className="mt-1 break-words text-caption2 text-foreground-tertiary">{msg.detail}</p>
                        )}
                      </div>
                    </div>

                    {msg.card && (
                      <CueCard
                        card={msg.card}
                        chosenId={msg.cardChoiceId}
                        spent={msg.cardSpent}
                        disabled={isLoading}
                        onChoose={(option) => handleCardChoice(msg.id, option)}
                        onContinue={(option) => handleCardContinue(msg.id, option)}
                      />
                    )}

                    {msg.suggestions && isLast && !isLoading && (
                      <div className="ml-[52px] mt-2.5 flex flex-wrap gap-1.5">
                        {msg.suggestions.map((suggestion, i) => (
                          <button
                            key={suggestion.value}
                            onClick={() => handleSuggestion(suggestion.value)}
                            disabled={isLoading}
                            className="animate-message-in rounded-full border border-pink-200/60 bg-white/80 px-3.5 py-1.5 text-caption1 font-medium text-foreground shadow-sm transition-all duration-200 ease-ios hover:border-pink-300 hover:bg-pink-50 hover:shadow active:scale-95 disabled:opacity-50"
                            style={{ animationDelay: `${i * 60}ms` }}
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 animate-message-in ml-[52px]">
                  <div className="flex items-center gap-2 rounded-2xl bg-pink-50/60 border border-pink-100/40 px-4 py-3">
                    <span className="text-caption1 text-foreground-secondary mr-1">Thinking</span>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-pink-400"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className={cn("mx-auto w-full shrink-0 border-t border-pink-100/40 bg-gradient-to-t from-pink-50/30 px-3.5 pb-3 pt-2", expanded ? "max-w-2xl" : "max-w-none")}>
            <CompanionStage stage={visibleStage} />

            <div className="flex items-end gap-2 rounded-[22px] border border-pink-200/50 bg-white/80 p-1.5 pl-4 shadow-sm transition-colors focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-200/30">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isLoading ? "Thinking..." : "Ask me anything..."}
                disabled={isLoading}
                className="max-h-[120px] flex-1 resize-none bg-transparent py-2 text-footnote leading-relaxed text-foreground outline-none placeholder:text-foreground-tertiary disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-sm transition-all duration-200 ease-ios-spring hover:shadow-md hover:brightness-105 active:scale-90 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 disabled:shadow-none"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
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
