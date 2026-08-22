import type { ReactNode } from "react";

/**
 * The small mocked panels that sit beside each landing-page feature card.
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

const PreviewShell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex w-full flex-col rounded-[20px] border border-foreground/[0.07] bg-background/70 p-5">
    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground-tertiary">
      {label}
    </span>
    <div className="mt-4 flex flex-col gap-3">{children}</div>
  </div>
);

const DOSHA = [
  { label: "Vata", value: 46, bar: "bg-vata" },
  { label: "Pitta", value: 34, bar: "bg-pitta" },
  { label: "Kapha", value: 20, bar: "bg-kapha" },
];

export const DoshaPreview = () => (
  <PreviewShell label="Prakriti">
    {DOSHA.map((dosha) => (
      <div key={dosha.label} className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-caption1 text-foreground-secondary">{dosha.label}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
          <span className={`block h-full rounded-full ${dosha.bar}`} style={{ width: `${dosha.value}%` }} />
        </span>
        <span className="w-8 shrink-0 text-right text-caption1 tabular-nums text-foreground-tertiary">
          {dosha.value}%
        </span>
      </div>
    ))}
  </PreviewShell>
);

const MEALS = [
  { slot: "Breakfast", dish: "Vegetable poha", kcal: "310 kcal" },
  { slot: "Lunch", dish: "Moong dal khichdi", kcal: "480 kcal" },
  { slot: "Dinner", dish: "Lauki sabzi, 2 roti", kcal: "420 kcal" },
];

export const PlanPreview = () => (
  <PreviewShell label="Day 3 of her chart">
    {MEALS.map((meal) => (
      <div
        key={meal.slot}
        className="flex items-center justify-between gap-3 rounded-xl border border-foreground/[0.06] bg-card px-3 py-2.5"
      >
        <span className="min-w-0">
          <span className="block text-caption2 uppercase tracking-[0.12em] text-foreground-tertiary">
            {meal.slot}
          </span>
          <span className="block truncate text-caption1 text-foreground">{meal.dish}</span>
        </span>
        <span className="shrink-0 text-caption1 tabular-nums text-foreground-tertiary">{meal.kcal}</span>
      </div>
    ))}
  </PreviewShell>
);

const TRACKS = [
  { track: "Pregnancy", unlocks: "Health Check" },
  { track: "PCOD / PCOS", unlocks: "Cycle & Skin" },
  { track: "Everyone", unlocks: "Lifestyle Tracker" },
];

export const TrackPreview = () => (
  <PreviewShell label="Care tracks">
    {TRACKS.map((row) => (
      <div key={row.track} className="flex items-center gap-2.5">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-caption2 font-medium text-accent-soft-foreground">
          {row.track}
        </span>
        <span aria-hidden className="h-px flex-1 bg-foreground/[0.10]" />
        <span className="text-caption1 text-foreground-secondary">{row.unlocks}</span>
      </div>
    ))}
  </PreviewShell>
);

const RISKS = [
  { condition: "Anaemia", level: "Low", dot: "bg-success" },
  { condition: "Gestational diabetes", level: "Moderate", dot: "bg-warning" },
  { condition: "Thyroid", level: "Low", dot: "bg-success" },
];

export const ScreeningPreview = () => (
  <PreviewShell label="Last health check">
    {RISKS.map((risk) => (
      <div
        key={risk.condition}
        className="flex items-center justify-between gap-3 rounded-xl border border-foreground/[0.06] bg-card px-3 py-2.5"
      >
        <span className="min-w-0 truncate text-caption1 text-foreground">{risk.condition}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-caption1 text-foreground-secondary">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
          {risk.level}
        </span>
      </div>
    ))}
  </PreviewShell>
);

const RECORD = [
  { hers: "Logged breakfast", his: "Adherence 6 of 7 days" },
  { hers: "Weight, 14 days on", his: "Trend, not a single reading" },
  { hers: "Screening answers", his: "Risk across visits" },
];

export const RecordPreview = () => (
  <PreviewShell label="One record">
    <div className="grid grid-cols-2 gap-x-3 pb-1">
      <span className="text-caption2 uppercase tracking-[0.12em] text-foreground-tertiary">She logs</span>
      <span className="text-caption2 uppercase tracking-[0.12em] text-foreground-tertiary">He reviews</span>
    </div>
    {RECORD.map((row) => (
      <div key={row.hers} className="grid grid-cols-2 items-center gap-x-3">
        <span className="rounded-lg bg-card px-2.5 py-2 text-caption1 text-foreground-secondary">{row.hers}</span>
        <span className="rounded-lg bg-primary/[0.07] px-2.5 py-2 text-caption1 text-foreground-secondary">
          {row.his}
        </span>
      </div>
    ))}
  </PreviewShell>
);

const LANGUAGES = ["हिन्दी", "தமிழ்", "বাংলা", "मराठी", "ગુજરાતી", "اردو", "+19 more"];

export const LanguagePreview = () => (
  <PreviewShell label="25 languages">
    <div className="flex flex-wrap gap-2">
      {LANGUAGES.map((language) => (
        <span
          key={language}
          className="rounded-full border border-foreground/[0.08] bg-card px-3 py-1.5 text-caption1 text-foreground-secondary"
        >
          {language}
        </span>
      ))}
    </div>
  </PreviewShell>
);
