import type { ReactNode } from "react";
import { Bloom, Cradle, Cycle, Expecting, Plate } from "@/components/illustrations/LineArt";
import { Languages } from "lucide-react";
import {
  DoshaPreview,
  LanguagePreview,
  PlanPreview,
  RecordPreview,
  ScreeningPreview,
  TrackPreview,
} from "@/components/landing/FeaturePreviews";

/**
 * The content shown in the landing page's feature reel.
 *
 * Every card describes something the app actually does, and the panel floating
 * on its scene is drawn from the same surface — the dosha split from the
 * questionnaire, the meal rows from Recipe Builder, the risk rows from Health
 * Check. Keep it that way: this is the first and often only description of
 * Prakriva a visitor reads, so a card promising a feature that doesn't exist is
 * a support ticket and a lost trust, not a marketing flourish.
 *
 * Copy runs short on purpose. The title is one line and the body is two, so a
 * reader takes both in during the beat a card holds still.
 */
export interface FeatureCard {
  /** Stable key, and the figure printed above the title. */
  num: string;
  title: string;
  /** The one word set in italic. Must appear in `title`. */
  accent: string;
  description: string;
  /** Which side of the reel the label sits on; they alternate down the list. */
  side: "left" | "right";
  /**
   * The scene behind the panel, as layered gradients.
   *
   * Each is mixed from the five brand colours, and no two neighbours share a
   * cast — a reader should be able to tell one card from the next out of the
   * corner of their eye, before reading a word of it.
   */
  scene: string;
  /** Drawn large and faint behind the panel, in the same line-art family as the app. */
  mark: ReactNode;
  panel: ReactNode;
}

/**
 * Shorthand for a scene: a light in the sky, a swell along the ground and a
 * wash between them. Three layers is enough to read as a place rather than a
 * colour block, and costs nothing to ship — there is no artwork to load, and
 * the whole thing recolours with the palette.
 */
const scene = (sky: string, ground: string, wash: string) =>
  `radial-gradient(90% 62% at 18% 2%, ${sky}, transparent 66%),` +
  `radial-gradient(140% 72% at 50% 116%, ${ground}, transparent 62%),` +
  `linear-gradient(170deg, ${wash})`;

export const FEATURE_CARDS: FeatureCard[] = [
  {
    num: "01",
    title: "Reads her prakriti first",
    accent: "prakriti",
    description:
      "A one-time Ayurvedic assessment scores vata, pitta and kapha — and every plan after it is built on that answer rather than on an average.",
    side: "left",
    scene: scene(
      "hsl(344 41% 62% / 0.55)",
      "hsl(29 36% 83% / 0.9)",
      "hsl(344 30% 48%), hsl(3 27% 58%)",
    ),
    mark: <Bloom animate={false} className="h-full w-full" />,
    panel: <DoshaPreview />,
  },
  {
    num: "02",
    title: "Builds the chart, then hands it over",
    accent: "hands it over",
    description:
      "Generated from her dosha, calorie target and allergies, then edited by her practitioner on the same board before it ever reaches her.",
    side: "right",
    scene: scene(
      "hsl(29 40% 88% / 0.85)",
      "hsl(359 31% 46% / 0.55)",
      "hsl(3 27% 58%), hsl(359 34% 40%)",
    ),
    mark: <Plate animate={false} className="h-full w-full" />,
    panel: <PlanPreview />,
  },
  {
    num: "03",
    title: "Shows only the tracking she needs",
    accent: "she needs",
    description:
      "Cycle, weight, skin and lifestyle logs appear for the care tracks she is on, and nowhere else. Pregnancy takes precedence, as a safety rule.",
    side: "left",
    scene: scene(
      "hsl(58 24% 46% / 0.6)",
      "hsl(29 36% 83% / 0.75)",
      "hsl(58 23% 26%), hsl(29 20% 52%)",
    ),
    mark: <Cycle animate={false} className="h-full w-full" />,
    panel: <TrackPreview />,
  },
  {
    num: "04",
    title: "Screens, and names the next step",
    accent: "next step",
    description:
      "Trained models read anaemia, gestational diabetes, thyroid and pregnancy risk, then return the exercise plan matched to whatever was flagged.",
    side: "right",
    scene: scene(
      "hsl(359 34% 52% / 0.6)",
      "hsl(58 22% 40% / 0.5)",
      "hsl(359 31% 40%), hsl(344 32% 34%)",
    ),
    mark: <Expecting animate={false} className="h-full w-full" />,
    panel: <ScreeningPreview />,
  },
  {
    num: "05",
    title: "Keeps one record, not two",
    accent: "one record",
    description:
      "What a patient logs is what her doctor opens. Adherence, trends and screening history, with nothing screenshotted or re-typed in between.",
    side: "left",
    scene: scene(
      "hsl(29 42% 92% / 0.8)",
      "hsl(344 38% 50% / 0.45)",
      "hsl(29 24% 58%), hsl(58 20% 34%)",
    ),
    mark: <Cradle animate={false} className="h-full w-full" />,
    panel: <RecordPreview />,
  },
  {
    num: "06",
    title: "Reads in her own language",
    accent: "own language",
    description:
      "The whole app translates into 25 languages, right-to-left included — not just the menus. Peer circles sit behind the same login.",
    side: "right",
    scene: scene(
      "hsl(3 30% 66% / 0.6)",
      "hsl(58 23% 32% / 0.55)",
      "hsl(344 34% 42%), hsl(29 24% 60%)",
    ),
    mark: <Languages className="h-full w-full" strokeWidth={1} />,
    panel: <LanguagePreview />,
  },
];
