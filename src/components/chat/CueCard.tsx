import * as React from "react";
import {
  Book,
  Brain,
  Droplet,
  Heart,
  HelpCircle,
  Leaf,
  Moon,
  Sparkles,
  Sun,
  Target,
  Utensils,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CueCard as CueCardData, CueIcon, CueOption, CueTone } from "@/lib/companionCues";
import { CompanionCharacter } from "./CompanionCharacter";

/**
 * The companion's interactive card: a question with two to four tappable
 * answers, sitting inline in the transcript.
 *
 * It is shaped like a quiz but deliberately isn't one — this app has no right
 * answers about how a meal felt. Picking an option acknowledges the choice
 * ("Thanks for telling me — heaviness is worth acting on"), then offers
 * Continue, which sends that option's question to the assistant for the real
 * reply. That keeps the card a *way of asking* rather than a graded exercise.
 */

const ICONS: Record<CueIcon, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  leaf: Leaf,
  heart: Heart,
  brain: Brain,
  target: Target,
  book: Book,
  sun: Sun,
  moon: Moon,
  droplet: Droplet,
  utensils: Utensils,
};

/** Each option's icon takes one of the palette's meaning colours. */
const TONE_TEXT: Record<CueTone, string> = {
  primary: "text-primary",
  vata: "text-vata",
  pitta: "text-pitta",
  kapha: "text-kapha",
};

const TONE_SELECTED: Record<CueTone, string> = {
  primary: "border-primary/40 bg-primary/10",
  vata: "border-vata/40 bg-vata/10",
  pitta: "border-pitta/40 bg-pitta/10",
  kapha: "border-kapha/40 bg-kapha/10",
};

export interface CueCardProps {
  card: CueCardData;
  /** The option already chosen, when this card is being re-rendered from the transcript. */
  chosenId?: string;
  /** Chosen an option — the caller records it so the choice survives a re-render. */
  onChoose: (option: CueOption) => void;
  /** Continue — the caller sends the chosen option's question to the assistant. */
  onContinue: (option: CueOption) => void;
  /** Already continued: the card locks, and the Continue button goes away. */
  spent?: boolean;
  disabled?: boolean;
}

export const CueCard: React.FC<CueCardProps> = ({
  card,
  chosenId,
  onChoose,
  onContinue,
  spent,
  disabled,
}) => {
  const chosen = card.options.find((o) => o.id === chosenId) ?? null;

  return (
    <div className="relative ml-11 mt-2 max-w-[calc(100%-2.75rem)] animate-message-in">
      {/* The character leans on the corner of its own question — thinking
          while it waits, pleased once an answer lands. */}
      <CompanionCharacter
        mood={chosen ? "happy" : "thinking"}
        className="pointer-events-none absolute -right-1 -top-6 h-11 w-11 drop-shadow-sm"
      />

      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-caption1 font-medium text-foreground-secondary">
          <HelpCircle className="h-3.5 w-3.5" />
          {card.eyebrow}
        </div>

        <p className="mt-2 pr-8 text-subhead font-semibold leading-snug text-foreground">{card.prompt}</p>

        <div className={cn("mt-3 gap-2", card.options.length === 2 ? "grid grid-cols-2" : "flex flex-col")}>
          {card.options.map((option) => {
            const Icon = ICONS[option.icon];
            const isChosen = chosen?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !chosen && !disabled && onChoose(option)}
                disabled={disabled || Boolean(chosen)}
                aria-pressed={isChosen}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-footnote font-medium transition-all duration-200 ease-ios",
                  isChosen
                    ? TONE_SELECTED[option.tone]
                    : "border-border bg-background-elevated hover:border-border-strong hover:bg-muted",
                  !chosen && !disabled && "active:scale-[0.98]",
                  chosen && !isChosen && "opacity-45",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[option.tone])} />
                <span className="text-foreground">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {chosen && (
        <div className="mt-2.5 animate-message-in">
          <p className="text-footnote leading-relaxed text-foreground">{chosen.response}</p>
          {!spent && (
            <button
              type="button"
              onClick={() => onContinue(chosen)}
              disabled={disabled}
              // Accent, not the near-black of the reference design: this app is
              // light all the way through, and a black pill in a blush panel
              // reads as a piece of some other product.
              className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-caption1 font-semibold text-primary-foreground transition-all duration-200 ease-ios-spring hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              Continue
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CueCard;
