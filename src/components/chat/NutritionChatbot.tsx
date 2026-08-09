import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { askChat, isAnalysisEnabled, type ChatTurn } from "@/services/analysisService";
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

/** Last few turns, oldest first, in the shape Gemini expects. */
const buildHistory = (messages: ChatMessage[], limit = 8): ChatTurn[] =>
  messages.slice(-limit).map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const NutritionChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
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
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setMessages((prev) => (prev.length === 0 ? [welcomeMessage()] : prev));
  }, []);

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
        if (!assistantEnabled) {
          throw new Error("assistant not configured");
        }
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
        const fallback = assistantEnabled
          ? "I couldn't reach your assistant just now — please try again in a moment."
          : "Your wellness assistant isn't available right now. Please check back later.";
        setMessages((prev) => [...prev, { id: msgId(), role: "assistant", text: fallback, timestamp: Date.now() }]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, assistantEnabled, context]
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
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
          aria-label="Open wellness chatbot"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-coral-400 border-2 border-white animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-600 to-rose-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Prakriva Assistant</h3>
                <p className="text-[10px] text-rose-100">Your Ayurvedic wellness companion</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Reset chat"
                title="Start over"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Minimize chat"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
            {statusChecked && !assistantEnabled && (
              <div className="rounded-lg border border-coral-200 bg-coral-50 px-3 py-2 text-xs text-coral-800">
                The wellness assistant isn't configured on this deployment yet, so it can't answer right now.
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-rose-600 text-white rounded-br-md"
                        : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {msg.quickReplies && msg.id === messages[messages.length - 1]?.id && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {msg.quickReplies.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleQuickReply(opt.value)}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 rounded-full border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-colors disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t bg-white px-3 py-2.5">
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
                placeholder={isLoading ? "Please wait..." : "Ask me anything..."}
                disabled={isLoading}
                className="flex-1 text-sm rounded-full border border-gray-200 bg-gray-50 px-4 py-2 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 disabled:opacity-50 transition-colors"
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                size="sm"
                className="rounded-full h-9 w-9 p-0 bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              Not medical advice. Always consult your healthcare provider.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default NutritionChatbot;
