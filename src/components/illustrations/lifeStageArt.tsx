import type { LifeStageArt } from "@/lib/lifeStage";

import { Bloom, Cradle, Cycle, Expecting, type LineArtComponent } from "./LineArt";

/**
 * The one place a life stage becomes a drawing.
 *
 * Split from `src/lib/lifeStage.ts` on purpose: that module is pure domain
 * data and stays importable from tests and non-React code, while this side of
 * the mapping is the only part that pulls in components.
 */
export const LIFE_STAGE_ART: Record<LifeStageArt, LineArtComponent> = {
  expecting: Expecting,
  cradle: Cradle,
  cycle: Cycle,
  bloom: Bloom,
};
