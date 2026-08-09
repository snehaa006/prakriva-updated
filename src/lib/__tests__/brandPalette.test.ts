import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CHART_COLORS,
  CHART_RATING_SCALE,
  CHART_RISK,
  CHART_SERIES,
  seriesColor,
} from "../chartColors";

/**
 * Guards the pink palette against drift.
 *
 * The app went off-brand once already — a green badge here, a blue chart line
 * there, each one reasonable on its own. These tests fail the build the next
 * time that starts, which is cheaper than another 578-utility sweep.
 */

const SRC = join(process.cwd(), "src");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : walk(path);
    return /\.(tsx?|css)$/.test(path) ? [path] : [];
  });

const sourceFiles = walk(SRC);

/** Hue families that are not in the Prakriva palette. */
const OFF_BRAND = [
  "green",
  "emerald",
  "teal",
  "lime",
  "blue",
  "sky",
  "cyan",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "yellow",
  "amber",
  "orange",
];

describe("no off-brand Tailwind colors", () => {
  it.each(OFF_BRAND)("uses no %s utilities anywhere in src", (family) => {
    const pattern = new RegExp(`\\b[a-z-]*-${family}-\\d{2,3}\\b`);

    const offenders = sourceFiles
      .map((file) => ({ file, match: readFileSync(file, "utf8").match(pattern) }))
      .filter((r) => r.match)
      .map((r) => `${r.file.replace(process.cwd(), "")}: ${r.match?.[0]}`);

    expect(offenders).toEqual([]);
  });
});

describe("no hardcoded chart colors", () => {
  it("routes every chart color through src/lib/chartColors.ts", () => {
    // Six-digit hex literals in chart-bearing code are how the palette drifted
    // last time. Neutral black/white shorthand is fine.
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      if (file.endsWith("chartColors.ts")) continue;
      const contents = readFileSync(file, "utf8");
      for (const match of contents.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        if (/^#(fff|000)/i.test(match[0]) || /^#(ffffff|000000)$/i.test(match[0])) continue;
        offenders.push(`${file.replace(process.cwd(), "")}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("the chart palette itself", () => {
  const HSL = /^hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)$/;

  const hueOf = (color: string): number => {
    const match = color.match(HSL);
    if (!match) throw new Error(`not a plain hsl() color: ${color}`);
    return Number(match[1]);
  };

  /** Distance around the 360° wheel — 350° and 10° are 20° apart, not 340°. */
  const hueDistance = (a: number, b: number) => {
    const raw = Math.abs(a - b) % 360;
    return raw > 180 ? 360 - raw : raw;
  };

  const allColors = [
    ...CHART_SERIES,
    ...CHART_RATING_SCALE,
    ...Object.values(CHART_COLORS),
    ...Object.values(CHART_RISK),
  ];

  it("keeps every chart color inside the pink family", () => {
    for (const color of allColors) {
      const hue = hueDistance(hueOf(color), 345);
      // Everything within ~40° of the brand hue: plum 318 → red 0 → coral 12.
      expect(hue).toBeLessThanOrEqual(40);
    }
  });

  it("keeps adjacent categorical series distinguishable", () => {
    // Neighbours must differ in hue or lightness, or a pie chart turns to mush.
    for (let i = 1; i < CHART_SERIES.length; i++) {
      const [prev, next] = [CHART_SERIES[i - 1], CHART_SERIES[i]];
      const hueGap = hueDistance(hueOf(prev), hueOf(next));
      const lightnessGap = Math.abs(
        Number(prev.match(HSL)?.[3]) - Number(next.match(HSL)?.[3])
      );
      expect(hueGap > 15 || lightnessGap > 12).toBe(true);
    }
  });

  it("escalates risk-trend colors the way the risk badges do", () => {
    // Chart lines and badges must agree, or a trend contradicts the label
    // sitting next to it. Lightness falls as severity rises.
    const lightness = (c: string) => Number(c.match(HSL)?.[3]);
    expect(lightness(CHART_RISK.low)).toBeGreaterThan(lightness(CHART_RISK.moderate));
    expect(lightness(CHART_RISK.moderate)).toBeGreaterThan(lightness(CHART_RISK.high));
    expect(hueOf(CHART_RISK.high)).toBe(0);
  });

  it("escalates the rating scale from best to worst", () => {
    expect(CHART_RATING_SCALE).toHaveLength(5);
    // Ends on the destructive red so "very dissatisfied" still reads as alarm.
    expect(hueOf(CHART_RATING_SCALE[4])).toBe(0);
  });

  it("wraps series colors rather than running out", () => {
    expect(seriesColor(0)).toBe(CHART_SERIES[0]);
    expect(seriesColor(CHART_SERIES.length)).toBe(CHART_SERIES[0]);
    expect(seriesColor(CHART_SERIES.length + 2)).toBe(CHART_SERIES[2]);
  });
});
