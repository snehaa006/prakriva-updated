import type { ReactNode } from "react";
import { Bloom, Cycle, Expecting, Plate } from "@/components/illustrations/LineArt";
import { Languages, LineChart } from "lucide-react";
import {
  DoshaPreview,
  LanguagePreview,
  PlanPreview,
  RecordPreview,
  ScreeningPreview,
  TrackPreview,
} from "@/components/landing/FeaturePreviews";

/**
 * The content shown in the landing page's card stack.
 *
 * Every card describes something the app actually does, and the preview beside
 * it is drawn from the same surface — the dosha split from the questionnaire,
 * the meal rows from Recipe Builder, the risk rows from Health Check. Keep it
 * that way: this is the first and often only description of Prakriva a visitor
 * reads, so a card promising a feature that doesn't exist is a support ticket
 * and a lost trust, not a marketing flourish.
 */
export interface FeatureCard {
  /** Stable key, and the figure printed on the card. */
  num: string;
  eyebrow: string;
  title: string;
  /** The one word set in italic serif inside `title`. Must appear in it. */
  accent: string;
  description: string;
  /** Two or three short proof points, rendered as chips. */
  points: string[];
  icon: ReactNode;
  preview: ReactNode;
}

// ── Cards ──────────────────────────────────────────────────────────────────

export const FEATURE_CARDS: FeatureCard[] = [
  {
    num: "01",
    eyebrow: "The assessment",
    title: "Her prakriti comes first",
    accent: "prakriti",
    description:
      "A one-time Ayurvedic assessment scores vata, pitta and kapha. Everything downstream — portions, meals, the notes her doctor reads — is built on that answer rather than on an average.",
    points: ["5-section questionnaire", "Asked once, not weekly"],
    icon: <Bloom animate={false} className="h-5 w-5" />,
    preview: <DoshaPreview />,
  },
  {
    num: "02",
    eyebrow: "Diet charts",
    title: "Generated, then signed off",
    accent: "signed off",
    description:
      "Recipe Builder composes a chart from her dosha, calorie target, conditions and allergies — and drops it on the same board her practitioner edits by hand. Nothing reaches a patient unreviewed.",
    points: ["Dosha-aware generation", "Drag-and-drop editing", "1200 kcal floor"],
    icon: <Plate animate={false} className="h-5 w-5" />,
    preview: <PlanPreview />,
  },
  {
    num: "03",
    eyebrow: "Tracking",
    title: "Only the tracking she needs",
    accent: "needs",
    description:
      "Cycle, weight, skin and lifestyle logs appear for the care tracks a patient is actually on, and nowhere else. Pregnancy takes precedence over every other track, as a safety rule.",
    points: ["Care-track adaptive tabs", "One daily check-in"],
    icon: <Cycle animate={false} className="h-5 w-5" />,
    preview: <TrackPreview />,
  },
  {
    num: "04",
    eyebrow: "Health Check",
    title: "Screening that names the next step",
    accent: "next step",
    description:
      "Trained models read anaemia, gestational diabetes, thyroid and pregnancy risk, then return the exercise plan matched to whatever was flagged. A score on its own is not an answer.",
    points: ["Per-condition risk", "Matched exercise plan", "Full history kept"],
    icon: <Expecting animate={false} className="h-5 w-5" />,
    preview: <ScreeningPreview />,
  },
  {
    num: "05",
    eyebrow: "Shared record",
    title: "Two sides, one record",
    accent: "one record",
    description:
      "What a patient logs is what her doctor opens. Adherence, trends and screening history land in Patient Analysis without a screenshot or a re-typed number in between.",
    points: ["No re-typing", "Trends across visits"],
    icon: <LineChart className="h-5 w-5" strokeWidth={1.5} />,
    preview: <RecordPreview />,
  },
  {
    num: "06",
    eyebrow: "Reach",
    title: "Read in her own language",
    accent: "own language",
    description:
      "The whole app translates into 25 languages, right-to-left included — not just the menus. Peer circles and a companion grounded in her own data sit behind the same login.",
    points: ["25 languages", "Moderated circles", "Companion chat"],
    icon: <Languages className="h-5 w-5" strokeWidth={1.5} />,
    preview: <LanguagePreview />,
  },
];
