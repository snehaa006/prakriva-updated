import * as React from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CircleAlert,
  Droplets,
  Flame,
  Leaf,
  Moon,
  Sun,
  Utensils,
  Wind,
} from "lucide-react";

import { cn } from "@/lib/utils";

import ScrollReveal from "./ScrollReveal";

/**
 * The product demo: four screens of the real app, rebuilt at landing-page
 * scale inside a device frame.
 *
 * These are **representations, not screenshots and not the live app**. That is
 * a deliberate trade and worth naming: mounting the real `Today` page here
 * would drag the Supabase client, react-query and the whole patient layout
 * into the marketing bundle for a visitor who has not signed in, and it would
 * render empty because there is no patient to render. So the screens are
 * static markup built from the same tokens and the same shapes — and the
 * section says so on the page rather than implying live data.
 *
 * The tab strip auto-advances so the section is doing something when a
 * visitor arrives at it, and stops permanently the moment anyone clicks a tab:
 * a carousel that keeps moving under the person driving it is the single most
 * irritating pattern in this genre.
 */

const AUTOPLAY_MS = 5200;

type ScreenId = "today" | "plan" | "trackers" | "doctor";

const SCREENS: Array<{ id: ScreenId; label: string; caption: string }> = [
  { id: "today", label: "Today", caption: "The daily surface: what to eat, and how it sat." },
  { id: "plan", label: "Plan", caption: "The chart her practitioner approved, meal by meal." },
  { id: "trackers", label: "Trackers", caption: "Only the logs her care pathway calls for." },
  { id: "doctor", label: "Doctor", caption: "The same record, from the other side." },
];

/** A small labelled figure, the shape the app's stat tiles use. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-lp-plum/45">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none text-lp-plum">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-lp-plum/50">{hint}</p>}
    </div>
  );
}

function TodayScreen() {
  const meals = [
    { icon: Sun, slot: "Breakfast", dish: "Ragi porridge, jaggery, ghee", done: true, note: "Grounding · vata" },
    { icon: Utensils, slot: "Lunch", dish: "Moong dal khichdi, ash gourd", done: true, note: "Light · tridoshic" },
    { icon: Leaf, slot: "Snack", dish: "Roasted makhana, cardamom", done: false, note: "Cooling · pitta" },
    { icon: Moon, slot: "Dinner", dish: "Bottle gourd soup, phulka", done: false, note: "Early · 7:30 PM" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-[1.35fr_1fr]">
      <div className="space-y-2.5">
        {meals.map((meal) => (
          <div
            key={meal.slot}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3.5 transition-colors",
              meal.done
                ? "border-lp-plum/15 bg-lp-blush/60"
                : "border-lp-cream-lo/50 bg-lp-cream-hi/70",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                meal.done ? "bg-lp-plum text-lp-cream-hi" : "bg-lp-blush text-lp-mauve",
              )}
            >
              {meal.done ? <Check className="h-4 w-4" /> : <meal.icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-lp-plum">{meal.slot}</span>
                <span className="truncate text-[11px] text-lp-plum/45">{meal.note}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-lp-plum/70">{meal.dish}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <Stat label="Today" value="1,840 kcal" hint="of 2,050 target · 2nd trimester" />
        <Stat label="Adherence" value="86%" hint="last 7 days" />
        <div className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-lp-plum/45">
            Dosha balance
          </p>
          <div className="mt-2.5 space-y-2">
            {[
              { icon: Wind, name: "Vata", pct: 46, bar: "bg-vata" },
              { icon: Flame, name: "Pitta", pct: 32, bar: "bg-pitta" },
              { icon: Leaf, name: "Kapha", pct: 22, bar: "bg-kapha" },
            ].map((dosha) => (
              <div key={dosha.name} className="flex items-center gap-2">
                <dosha.icon className="h-3 w-3 shrink-0 text-lp-plum/50" />
                <span className="w-10 shrink-0 text-[11px] text-lp-plum/60">{dosha.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-lp-blush">
                  <span
                    className={cn("block h-full rounded-full", dosha.bar)}
                    style={{ width: `${dosha.pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-lp-plum/50">
                  {dosha.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanScreen() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl text-lp-plum">Second trimester · week 3</p>
          <p className="text-xs text-lp-plum/50">Approved by Dr. A. Nair · 4 days ago</p>
        </div>
        <span className="rounded-full bg-lp-blush px-3 py-1 text-[11px] font-medium text-lp-plum">
          Practitioner-reviewed
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => (
          <div
            key={day}
            className={cn(
              "rounded-xl border px-1 py-2.5 text-center",
              i < 4
                ? "border-lp-plum/20 bg-lp-plum text-lp-cream-hi"
                : "border-lp-cream-lo/50 bg-lp-cream-hi/70 text-lp-plum/50",
            )}
          >
            <p className="text-[10px] uppercase tracking-wider opacity-70">{day}</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums">{i < 4 ? "✓" : "—"}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { name: "Iron", value: 78, note: "27mg target" },
          { name: "Protein", value: 92, note: "71g target" },
          { name: "Folate", value: 64, note: "600µg target" },
        ].map((nutrient) => (
          <div
            key={nutrient.name}
            className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/70 p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-lp-plum">{nutrient.name}</span>
              <span className="text-[11px] text-lp-plum/50">
                {nutrient.value}% · {nutrient.note}
              </span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-lp-blush">
              <span
                className="block h-full rounded-full bg-lp-mauve"
                style={{ width: `${nutrient.value}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackersScreen() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80 p-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-lp-mauve" />
          <p className="text-sm font-semibold text-lp-plum">Cycle</p>
        </div>
        <p className="mt-3 font-display text-3xl leading-none text-lp-plum">Day 19</p>
        <p className="mt-1 text-xs text-lp-plum/50">Last 3 cycles: 34, 41, 38 days</p>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-6 flex-1 rounded-sm",
                i < 5 ? "bg-lp-plum" : i === 18 ? "bg-lp-mauve" : "bg-lp-blush",
              )}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80 p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-lp-mauve" />
          <p className="text-sm font-semibold text-lp-plum">Weight trend</p>
        </div>
        <p className="mt-3 font-display text-3xl leading-none text-lp-plum">−2.4 kg</p>
        <p className="mt-1 text-xs text-lp-plum/50">Over 12 weeks · steady</p>
        <svg viewBox="0 0 120 34" className="mt-3 h-10 w-full" aria-hidden="true">
          <polyline
            points="0,6 15,9 30,8 45,14 60,13 75,19 90,22 105,26 120,28"
            fill="none"
            stroke="hsl(var(--lp-mauve))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80 p-4 sm:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-lp-plum">This week</p>
          <span className="text-[11px] text-lp-plum/45">Sleep · water · movement</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {[7.5, 6, 8, 7, 5.5, 8.5, 7].map((hours, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="flex h-16 w-full items-end rounded-lg bg-lp-blush">
                <span
                  className="w-full rounded-lg bg-lp-mauve/70"
                  style={{ height: `${(hours / 9) * 100}%` }}
                />
              </span>
              <span className="text-[10px] tabular-nums text-lp-plum/45">{hours}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoctorScreen() {
  const patients = [
    { name: "R. Sharma", track: "Pregnancy · T2", flag: null, adherence: "91%" },
    { name: "M. Iyer", track: "PCOD / PCOS", flag: "Cycle > 45 days", adherence: "64%" },
    { name: "S. Banerjee", track: "General wellness", flag: null, adherence: "88%" },
    { name: "P. Kaur", track: "Pregnancy · T1", flag: "Iron below target", adherence: "72%" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Patients" value="38" />
        <Stat label="Needs review" value="2" />
        <Stat label="Today" value="6 appts" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-lp-cream-lo/50 bg-lp-cream-hi/80">
        {patients.map((patient, i) => (
          <div
            key={patient.name}
            className={cn(
              "flex items-center gap-3 p-3.5",
              i > 0 && "border-t border-lp-cream-lo/40",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lp-blush text-[11px] font-semibold text-lp-plum">
              {patient.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-lp-plum">{patient.name}</span>
              <span className="block text-[11px] text-lp-plum/50">{patient.track}</span>
            </span>
            {patient.flag && (
              <span className="hidden items-center gap-1 rounded-full bg-lp-plum/10 px-2.5 py-1 text-[11px] font-medium text-lp-plum sm:inline-flex">
                <CircleAlert className="h-3 w-3" />
                {patient.flag}
              </span>
            )}
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-lp-plum/60">
              {patient.adherence}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCREEN_COMPONENTS: Record<ScreenId, () => JSX.Element> = {
  today: TodayScreen,
  plan: PlanScreen,
  trackers: TrackersScreen,
  doctor: DoctorScreen,
};

export function ProductDemo() {
  const [active, setActive] = React.useState<ScreenId>("today");
  const [autoplay, setAutoplay] = React.useState(true);

  React.useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => {
      const index = SCREENS.findIndex((screen) => screen.id === active);
      setActive(SCREENS[(index + 1) % SCREENS.length].id);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, autoplay]);

  const Screen = SCREEN_COMPONENTS[active];
  const caption = SCREENS.find((screen) => screen.id === active)?.caption;

  return (
    <section id="demo" className="lp-deep lp-grain relative isolate scroll-mt-20 overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-lp-petal/70">
            The product
          </p>
          <h2 className="mt-4 font-display text-4xl font-light leading-tight text-lp-cream-hi sm:text-5xl">
            Four screens, one record
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-lp-cream/60">
            What a patient logs is what her practitioner opens. Move through both sides
            of it below.
          </p>
        </ScrollReveal>

        <ScrollReveal index={1} className="mt-12">
          {/* Tab strip. `role="tablist"` and the arrow-key-free simple button
              set is deliberate: these are four buttons that swap a panel, and
              a full roving-tabindex implementation would be more code than the
              interaction warrants. Each button owns its panel via aria-controls. */}
          <div
            role="tablist"
            aria-label="Product screens"
            className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-1.5 rounded-full border border-lp-cream-hi/15 bg-lp-cream-hi/[0.06] p-1.5 backdrop-blur-md"
          >
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                type="button"
                role="tab"
                id={`demo-tab-${screen.id}`}
                aria-selected={active === screen.id}
                aria-controls={`demo-panel-${screen.id}`}
                onClick={() => {
                  setActive(screen.id);
                  // A visitor who has taken control keeps it.
                  setAutoplay(false);
                }}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-ios focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-petal",
                  active === screen.id
                    ? "bg-lp-cream-hi text-lp-plum-deep shadow-sm"
                    : "text-lp-cream/65 hover:bg-lp-cream-hi/10 hover:text-lp-cream-hi",
                )}
              >
                {screen.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal index={2} className="mt-8">
          {/* The frame. A browser-chrome bar rather than a phone bezel: this is
              a desktop product for practitioners and a responsive web app for
              patients, and a phone frame would misrepresent it. */}
          <div className="lp-card-dark overflow-hidden rounded-[28px] p-2 sm:p-3">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="flex gap-1.5" aria-hidden="true">
                {["opacity-40", "opacity-30", "opacity-20"].map((opacity) => (
                  <span key={opacity} className={cn("h-2.5 w-2.5 rounded-full bg-lp-cream-hi", opacity)} />
                ))}
              </span>
              <span className="mx-auto flex items-center gap-2 rounded-full bg-lp-cream-hi/10 px-3 py-1 text-[11px] text-lp-cream/55">
                prakriva.app/patient/{active === "doctor" ? "…" : active}
              </span>
            </div>

            <div className="rounded-[20px] bg-lp-cream-hi/95 p-4 sm:p-6">
              <div
                role="tabpanel"
                id={`demo-panel-${active}`}
                aria-labelledby={`demo-tab-${active}`}
                key={active}
                className="animate-lp-rise"
              >
                <Screen />
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal index={3} className="mt-6 text-center">
          <p className="text-sm text-lp-cream/55">{caption}</p>
          <p className="mt-2 text-xs text-lp-cream/35">
            Illustrative screens built from the product's own components — sample data,
            not a live account.
          </p>
          <a
            href="#how-it-works"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-lp-petal transition-colors hover:text-lp-cream-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-petal focus-visible:ring-offset-2"
          >
            See how a plan is built
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default ProductDemo;
