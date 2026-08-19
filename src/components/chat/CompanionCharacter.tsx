import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Prakriva's chat companion — a small lotus-bud character with a face.
 *
 * Deliberately a different family of marks from `components/illustrations`:
 * those are faceless pictograms of a patient's own situation, where a cartoon
 * stand-in would be presumptuous. This one is not the patient — it's the
 * assistant itself, and a chat assistant reads better as a character you can
 * watch think than as an abstract glyph.
 *
 * House rules, so a new mood drops in without redrawing anything:
 *
 * - One 64×64 viewBox, one body path, one face plate. Moods only move the
 *   eyes, the mouth and the small accessory above the head — never the body,
 *   so switching moods is a transition rather than a swap.
 * - Colour comes from the palette: the body is the accent gradient, the face
 *   plate is the elevated surface, the eyes are the foreground. It stays
 *   correct if the palette moves.
 * - Everything that moves is decoration. `prefers-reduced-motion` (see
 *   src/index.css) switches all of it off and the character still reads —
 *   mood is carried by eye/mouth *shape*, not by motion.
 */

export type CompanionMood =
  /** Resting: nothing is happening, the transcript is static. */
  | "idle"
  /** The patient is typing, or her answer is being composed. */
  | "thinking"
  /** Her message just landed — the companion is taking it in. */
  | "reading"
  /** An answer arrived, or she got something right. */
  | "happy";

export interface CompanionCharacterProps {
  mood?: CompanionMood;
  /** Rendered small next to a message: no bob, no accessory, no blink. */
  still?: boolean;
  className?: string;
}

/** Where each mood points the pupils, as a translation inside the eye. */
const PUPIL_OFFSET: Record<CompanionMood, { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  // Up and off to one side — the universal "working on it" glance.
  thinking: { x: -1.6, y: -1.8 },
  // Down at the page it is reading.
  reading: { x: 0, y: 1.8 },
  happy: { x: 0, y: -0.4 },
};

const Eye: React.FC<{ cx: number; mood: CompanionMood; still?: boolean }> = ({ cx, mood, still }) => {
  const offset = PUPIL_OFFSET[mood] ?? PUPIL_OFFSET.idle;

  // Happy closes the eyes into arcs — the one mood the pupils can't express.
  if (mood === "happy") {
    return (
      <path
        d={`M${cx - 4.6} 39.4 q4.6 -5.4 9.2 0`}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    );
  }

  return (
    <g>
      <ellipse
        cx={cx}
        cy={37.6}
        rx={4.6}
        ry={mood === "reading" ? 3.6 : 4.8}
        fill="hsl(var(--foreground))"
        className={cn(
          "origin-center transition-all duration-300 ease-ios-spring",
          !still && "animate-companion-blink",
        )}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {/* Catchlight, offset by mood so the gaze direction reads at 24px too. */}
      <circle
        cx={cx + offset.x + 1.5}
        cy={37.6 + offset.y - 1.4}
        r={1.5}
        fill="hsl(var(--background-elevated))"
        className={cn(
          "transition-all duration-300 ease-ios-spring",
          !still && mood === "reading" && "animate-companion-scan",
        )}
      />
    </g>
  );
};

const Mouth: React.FC<{ mood: CompanionMood }> = ({ mood }) => {
  const d =
    mood === "happy"
      ? "M27 46.5 q5 5.5 10 0"
      : mood === "thinking"
        ? "M28.5 47 q3.5 -2.4 7 0"
        : mood === "reading"
          ? "M29 47 h6"
          : "M28 46.4 q4 3 8 0";

  return (
    <path
      d={d}
      fill="none"
      stroke="hsl(var(--foreground))"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="transition-all duration-300 ease-ios"
      opacity={0.85}
    />
  );
};

/** The small thing above the head: dots while thinking, sparkles when happy. */
const Accessory: React.FC<{ mood: CompanionMood }> = ({ mood }) => {
  if (mood === "thinking") {
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={40 + i * 5}
            cy={9 - i * 2}
            r={1.6 + i * 0.4}
            fill="hsl(var(--primary))"
            className="animate-companion-think"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </g>
    );
  }

  if (mood === "reading") {
    return (
      <g stroke="hsl(var(--primary))" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* A little open page held up in front of the face. */}
        <path d="M20 52 q6 -3 12 0 q6 -3 12 0 v7 q-6 -3 -12 0 q-6 -3 -12 0 z" fill="hsl(var(--background-elevated))" />
        <path d="M32 52 v7" />
      </g>
    );
  }

  if (mood === "happy") {
    return (
      <g fill="hsl(var(--primary))" className="animate-companion-sparkle">
        <path d="M46 8 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" />
        <path d="M15 14 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" opacity={0.7} />
      </g>
    );
  }

  return null;
};

/**
 * The character itself. Size it from the caller with a `className`
 * (`h-16 w-16`, `h-8 w-8`, …) — it fills whatever box it is given.
 */
export const CompanionCharacter: React.FC<CompanionCharacterProps> = ({
  mood = "idle",
  still = false,
  className,
}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    role="img"
    aria-label={`Your wellness companion, ${mood}`}
    className={cn("h-16 w-16 select-none", !still && "animate-companion-bob", className)}
  >
    <defs>
      <linearGradient id="companion-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" />
        <stop offset="100%" stopColor="hsl(340 40% 54%)" />
      </linearGradient>
    </defs>

    <Accessory mood={mood} />

    {/* Two leaves, the sprout this thing grew from. */}
    <g stroke="hsl(var(--kapha))" strokeWidth={2} strokeLinecap="round" fill="none">
      <path d="M32 12 q-7 -4 -9 -9 q7 0 9 6" />
      <path d="M32 12 q7 -5 10 -9 q-1 7 -7 8" opacity={0.75} />
    </g>

    {/* Body — a lotus bud. */}
    <path
      d="M32 10 C 42 20, 53 27, 53 40 C 53 52, 43 60, 32 60 C 21 60, 11 52, 11 40 C 11 27, 22 20, 32 10 Z"
      fill="url(#companion-body)"
    />

    {/* Face plate. */}
    <ellipse cx={32} cy={40} rx={17} ry={14} fill="hsl(var(--background-elevated))" opacity={0.96} />

    <Eye cx={25.5} mood={mood} still={still} />
    <Eye cx={38.5} mood={mood} still={still} />
    <Mouth mood={mood} />
  </svg>
);

/** Message-list avatar: the same face, held still. */
export const CompanionMark: React.FC<{ className?: string; mood?: CompanionMood }> = ({
  className,
  mood = "idle",
}) => <CompanionCharacter mood={mood} still className={cn("h-8 w-8", className)} />;

export default CompanionCharacter;
