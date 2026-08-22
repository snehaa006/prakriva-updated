import * as React from "react";
import { cn } from "@/lib/utils";

export type CompanionMood = "idle" | "thinking" | "reading" | "happy";

const MOOD_IMAGE: Record<CompanionMood, string> = {
  idle: "/chatbot/idle.png",
  thinking: "/chatbot/thinking.png",
  reading: "/chatbot/thinking.png",
  happy: "/chatbot/responding.png",
};

export interface CompanionCharacterProps {
  mood?: CompanionMood;
  still?: boolean;
  className?: string;
}

export const CompanionCharacter: React.FC<CompanionCharacterProps> = ({
  mood = "idle",
  still = false,
  className,
}) => (
  <img
    src={MOOD_IMAGE[mood]}
    alt={`Companion ${mood}`}
    draggable={false}
    className={cn(
      "h-16 w-16 select-none object-contain drop-shadow-md",
      !still && mood === "idle" && "animate-companion-bob",
      !still && mood === "thinking" && "animate-companion-think-bounce",
      !still && mood === "reading" && "animate-companion-think-bounce",
      !still && mood === "happy" && "animate-companion-celebrate",
      className,
    )}
  />
);

export const CompanionMark: React.FC<{ className?: string; mood?: CompanionMood }> = ({
  className,
  mood = "idle",
}) => <CompanionCharacter mood={mood} still className={cn("h-8 w-8", className)} />;

export default CompanionCharacter;
