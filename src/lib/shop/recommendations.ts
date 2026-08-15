import type { HealthTracks } from "@/lib/healthTrack";
import { HEALTH_TRACK_LABELS } from "@/lib/healthTrack";
import { LIFE_STAGES, resolveLifeStage } from "@/lib/lifeStage";
import type { ShopProduct } from "@/types/shop";

import { bestOffer } from "./search";

/**
 * What to suggest a patient buys, given where she is.
 *
 * Pure and dependency-free. The rules are deliberately conservative: this
 * surfaces *things people at this stage commonly need*, and says so in those
 * words. It is not a recommendation engine dressed up as clinical advice, and
 * nothing here should read as "you should take this" — see `reason` strings.
 */

export interface SuggestionContext {
  /** Raw life-stage value off the patient record; resolved internally. */
  lifeStage?: string | null;
  /** Pregnancy trimester as recorded ("1" | "2" | "3"), when there is one. */
  trimester?: string | null;
  /** Care pathways she is on. */
  tracks?: HealthTracks | null;
}

export interface Suggestion {
  product: ShopProduct;
  /** Why she is seeing this, phrased for her, never as a directive. */
  reason: string;
}

const TRIMESTER_WORD: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
};

/** "2" → 2; anything unparseable → undefined. */
const parseTrimester = (raw: string | null | undefined): 1 | 2 | 3 | undefined => {
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 ? n : undefined;
};

/** How a stage reads in "…" when it is the only thing we can say. */
const stageReason = (stage: ReturnType<typeof resolveLifeStage>): string =>
  stage === "not_applicable"
    ? "A general wellness staple"
    : `Common during ${LIFE_STAGES[stage].label.toLowerCase()}`;

/**
 * Relevance of one product to one patient, plus the sentence explaining it.
 * Returns `null` when the product has nothing to do with her.
 *
 * Scores accumulate across every signal that matches, but the *reason* is
 * whichever single signal is most specific — trimester, then care track, then
 * life stage. Telling a PCOS patient that inositol is "common during general
 * wellness" is true and useless; "suggested for PCOD / PCOS" is why it is
 * actually on her screen.
 */
const scoreFor = (
  product: ShopProduct,
  context: SuggestionContext,
): { score: number; reason: string } | null => {
  const stage = resolveLifeStage(context.lifeStage);
  const trimester = parseTrimester(context.trimester);
  const tracks = context.tracks ?? [];

  const matchesStage = product.stages.includes(stage);
  const matchedTrack = (product.tracks ?? []).find((t) => tracks.includes(t));

  if (!matchesStage && !matchedTrack) return null;

  let score = 0;
  // Reason candidates, least specific first; the last one set wins.
  let reason = "";

  if (matchesStage) {
    score += 40;
    reason = stageReason(stage);
  }

  if (matchedTrack) {
    score += 35;
    reason = `Suggested for ${HEALTH_TRACK_LABELS[matchedTrack]}`;
  }

  if (matchesStage && stage === "pregnancy" && trimester) {
    if (product.trimesters?.includes(trimester)) {
      score += 45;
      reason = `Often wanted in the ${TRIMESTER_WORD[trimester]} trimester`;
    } else if (product.trimesters) {
      // Relevant to pregnancy, but not to where she is right now.
      score -= 15;
    }
  }

  // Gentle nudges, never decisive: a well-reviewed item that is actually
  // buyable is a better suggestion than a highly-rated one that is not.
  score += (product.rating ?? 0) * 2;
  if (bestOffer(product)?.inStock) score += 5;

  return { score, reason };
};

/**
 * Ranked suggestions for the dashboard and the shop's landing state.
 *
 * At most one product per category, so a pregnant patient gets a pillow, a
 * cream and a pair of compression socks rather than four pillows — variety is
 * what makes a short list useful, and the categories are the axis she actually
 * shops along.
 */
export const recommendProducts = (
  catalogue: ShopProduct[],
  context: SuggestionContext,
  limit = 4,
): Suggestion[] => {
  const scored = catalogue
    .map((product) => {
      const match = scoreFor(product, context);
      return match ? { product, ...match } : null;
    })
    .filter((x): x is { product: ShopProduct; score: number; reason: string } => x !== null)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));

  const chosen: Suggestion[] = [];
  const usedCategories = new Set<string>();

  for (const entry of scored) {
    if (chosen.length >= limit) break;
    if (usedCategories.has(entry.product.category)) continue;
    usedCategories.add(entry.product.category);
    chosen.push({ product: entry.product, reason: entry.reason });
  }

  // If category diversity left us short (a narrow catalogue, a patient on an
  // unusual combination), backfill by score rather than returning a stub list.
  if (chosen.length < limit) {
    const already = new Set(chosen.map((c) => c.product.id));
    for (const entry of scored) {
      if (chosen.length >= limit) break;
      if (already.has(entry.product.id)) continue;
      chosen.push({ product: entry.product, reason: entry.reason });
    }
  }

  return chosen;
};

/**
 * The shelves the shop opens on, in the order a patient at this stage would
 * most likely want them. Purely presentational ordering — every category stays
 * reachable, nothing is hidden.
 */
export const suggestedCategoryOrder = (context: SuggestionContext): string[] => {
  const stage = resolveLifeStage(context.lifeStage);
  const byStage: Record<string, string[]> = {
    pregnancy: ["sleep-comfort", "maternity-wear", "skin-body", "supplements", "monitoring"],
    postpartum: ["nursing-feeding", "baby-essentials", "intimate-care", "skin-body", "supplements"],
    menopause: ["supplements", "sleep-comfort", "movement", "skin-body", "intimate-care"],
    not_applicable: ["supplements", "movement", "skin-body", "intimate-care", "monitoring"],
  };
  return byStage[stage] ?? byStage.not_applicable;
};
