import type { ReactNode } from "react";

/**
 * The floating panels that sit on each landing-page scene.
 *
 * They are stills of real surfaces — the questionnaire's dosha split, a day of
 * a generated chart, a Health Check result — and deliberately carry no live
 * data, so none of them can put a number in front of a visitor that the app
 * would then have to stand behind. Change the copy here when the surface it
 * depicts changes, and keep it to shapes and labels rather than figures.
 *
 * They live apart from `featureCards.tsx` so that file exports data only, which
 * is what keeps fast refresh working across both.
 */

/** The white sheet the reference floats over each scene. */
const Panel = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="w-full rounded-2xl bg-background-elevated/95 p-4 shadow-lg backdrop-blur-sm">
    <div className="flex items-center gap-2">
      <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-secondary">
        {label}
      </span>
    </div>
    <div className="mt-3 flex flex-col gap-2">{children}</div>
  </div>
);

/** One row of the panel — a label on the left, a small figure on the right. */
const Row = ({ children, meta }: { children: ReactNode; meta?: string }) => (
  <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.07] pb-2 last:border-0 last:pb-0">
    <span className="min-w-0 truncate text-caption1 text-foreground">{children}</span>
    {meta ? <span className="shrink-0 font-mono text-[10px] text-foreground-tertiary">{meta}</span> : null}
  </div>
);

const DOSHA = [
  { label: "Vata", value: 46, bar: "bg-vata" },
  { label: "Pitta", value: 34, bar: "bg-pitta" },
  { label: "Kapha", value: 20, bar: "bg-kapha" },
];

export const DoshaPreview = () => (
  <Panel label="Prakriti">
    {DOSHA.map((dosha) => (
      <div key={dosha.label} className="flex items-center gap-2.5">
        <span className="w-11 shrink-0 text-caption1 text-foreground-secondary">{dosha.label}</span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <span className={`block h-full rounded-full ${dosha.bar}`} style={{ width: `${dosha.value}%` }} />
        </span>
        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-foreground-tertiary">
          {dosha.value}%
        </span>
      </div>
    ))}
  </Panel>
);

export const PlanPreview = () => (
  <Panel label="Day 3 of her chart">
    <Row meta="310 kcal">Vegetable poha</Row>
    <Row meta="480 kcal">Moong dal khichdi</Row>
    <Row meta="420 kcal">Lauki sabzi, 2 roti</Row>
  </Panel>
);

const TRACKS = [
  { track: "Pregnancy", unlocks: "Health Check" },
  { track: "PCOD / PCOS", unlocks: "Cycle & Skin" },
  { track: "Everyone", unlocks: "Lifestyle Tracker" },
];

export const TrackPreview = () => (
  <Panel label="Care tracks">
    {TRACKS.map((row) => (
      <div key={row.track} className="flex items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-soft-foreground">
          {row.track}
        </span>
        <span aria-hidden className="h-px flex-1 bg-foreground/[0.12]" />
        <span className="font-mono text-[10px] text-foreground-secondary">{row.unlocks}</span>
      </div>
    ))}
  </Panel>
);

const RISKS = [
  { condition: "Anaemia", level: "Low", dot: "bg-success" },
  { condition: "Gestational diabetes", level: "Moderate", dot: "bg-warning" },
  { condition: "Thyroid", level: "Low", dot: "bg-success" },
];

export const ScreeningPreview = () => (
  <Panel label="Last health check">
    {RISKS.map((risk) => (
      <div
        key={risk.condition}
        className="flex items-center justify-between gap-3 border-b border-foreground/[0.07] pb-2 last:border-0 last:pb-0"
      >
        <span className="min-w-0 truncate text-caption1 text-foreground">{risk.condition}</span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-foreground-secondary">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
          {risk.level}
        </span>
      </div>
    ))}
  </Panel>
);

const RECORD = [
  { hers: "Logged breakfast", his: "6 of 7 days" },
  { hers: "Weight, 14 days on", his: "Trend, not a reading" },
  { hers: "Screening answers", his: "Risk across visits" },
];

export const RecordPreview = () => (
  <Panel label="One record">
    <div className="grid grid-cols-2 gap-x-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-tertiary">She logs</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-tertiary">He reviews</span>
    </div>
    {RECORD.map((row) => (
      <div key={row.hers} className="grid grid-cols-2 items-center gap-x-3">
        <span className="truncate rounded-lg bg-secondary px-2 py-1.5 text-[11px] text-foreground-secondary">
          {row.hers}
        </span>
        <span className="truncate rounded-lg bg-primary/[0.09] px-2 py-1.5 text-[11px] text-foreground-secondary">
          {row.his}
        </span>
      </div>
    ))}
  </Panel>
);

const LANGUAGES = ["हिन्दी", "தமிழ்", "বাংলা", "मराठी", "ગુજરાતી", "اردو", "+19"];

export const LanguagePreview = () => (
  <Panel label="25 languages">
    <div className="flex flex-wrap gap-1.5">
      {LANGUAGES.map((language) => (
        <span
          key={language}
          className="rounded-full border border-foreground/[0.10] px-2 py-0.5 text-[11px] text-foreground-secondary"
        >
          {language}
        </span>
      ))}
    </div>
  </Panel>
);
