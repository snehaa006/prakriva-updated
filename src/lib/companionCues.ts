// src/lib/companionCues.ts
// What the wellness companion says when nobody asked it anything.
//
// The chat used to be purely reactive: it opened with one canned welcome and
// four fixed suggestion chips, and said nothing else until the patient typed.
// This module is the other half — it reads the same `PatientChatContext` the
// chat already assembles and works out what is worth raising *now*: a health
// report that just landed, meals logged today with no feedback against them,
// water behind its goal at 6pm, a short night's sleep.
//
// Deliberately pure and free of React, timers and Supabase: everything here is
// a function of (context, clock), so the whole conversational behaviour of the
// companion can be tested without rendering anything.

import type { PatientChatContext } from "@/services/chatAssistantService";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Icons a card option can carry. Mapped to Lucide icons by the chat UI. */
export type CueIcon =
  | "sparkles"
  | "leaf"
  | "heart"
  | "brain"
  | "target"
  | "book"
  | "sun"
  | "moon"
  | "droplet"
  | "utensils";

/** Which side of the palette an option paints itself in. */
export type CueTone = "primary" | "vata" | "pitta" | "kapha";

export interface CueOption {
  id: string;
  label: string;
  /** Sent to the assistant when this option is chosen. */
  value: string;
  icon: CueIcon;
  tone: CueTone;
  /**
   * The companion's immediate reaction to the choice, shown under the card
   * before the assistant's real answer. This is a wellness chat, not a quiz —
   * an answer is never "wrong", so this acknowledges rather than marks.
   */
  response: string;
}

export interface CueCard {
  /** Small label above the question — "Quick check", "Pick one", … */
  eyebrow: string;
  prompt: string;
  options: CueOption[];
}

/** A suggestion chip: a lead-up before the topic, or a follow-up after it. */
export interface CueSuggestion {
  label: string;
  value: string;
}

export interface CompanionCue {
  /**
   * Stable per cue *and* per day, so a nudge shown this morning isn't shown
   * again this afternoon but can come back tomorrow.
   */
  id: string;
  /** One line, shown in the popup beside the closed launcher. */
  teaser: string;
  /** What the companion says in the transcript when the cue is opened. */
  message: string;
  card?: CueCard;
  suggestions?: CueSuggestion[];
}

// ──────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const daysBetween = (isoA: string, isoB: string): number =>
  Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86_400_000);

/** "today" / "yesterday" / "on 3 Feb" — how a person would say the date. */
export const relativeDay = (iso: string, now: Date): string => {
  const diff = daysBetween(iso, isoDate(now));
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff} days ago`;
  return `on ${new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;
};

const partOfDay = (now: Date): "morning" | "afternoon" | "evening" => {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
};

export const greeting = (now: Date): string => `Good ${partOfDay(now)}`;

// ──────────────────────────────────────────────
// Opening lead-ups
// ──────────────────────────────────────────────

const GENERIC_LEAD_UPS: CueSuggestion[] = [
  { label: "Suggest a recipe", value: "Can you suggest a recipe I can make right now?" },
  { label: "How's my week going?", value: "How have I been doing over the last 7 days? Am I improving?" },
  { label: "Ayurvedic tips for me", value: "What Ayurvedic tips would help me right now?" },
  { label: "Something sweet, but healthy", value: "I'm craving something sweet. What can I make?" },
];

/**
 * The chips offered before the conversation has a topic — drawn from what this
 * patient actually has, so the first tap is about her, not about the product.
 */
export const buildLeadUps = (ctx: PatientChatContext | null): CueSuggestion[] => {
  if (!ctx) return GENERIC_LEAD_UPS.slice(0, 4);

  const out: CueSuggestion[] = [];

  if (ctx.activePlan) {
    out.push({ label: "What's on my plan today?", value: "What does my diet plan say I should eat today?" });
  }
  if (ctx.pantry.atHome.length > 0) {
    out.push({
      label: "Cook from my pantry",
      value: "What can I cook right now with what I already have at home?",
    });
  }
  if (ctx.screenings.length > 0) {
    out.push({
      label: "Explain my last health check",
      value: "Can you explain my most recent health check in plain language?",
    });
  }
  if (ctx.profile.primaryDosha) {
    out.push({
      label: `Eating for ${ctx.profile.primaryDosha}`,
      value: `How should I eat this week for my ${ctx.profile.primaryDosha} constitution?`,
    });
  }

  for (const generic of GENERIC_LEAD_UPS) {
    if (out.length >= 4) break;
    if (!out.some((s) => s.label === generic.label)) out.push(generic);
  }

  return out.slice(0, 4);
};

// ──────────────────────────────────────────────
// Follow-ups
// ──────────────────────────────────────────────

const FOLLOW_UPS_BY_TOPIC: { test: RegExp; suggestions: CueSuggestion[] }[] = [
  {
    test: /\b(recipe|cook|dish|meal|eat|snack|craving|hungry|breakfast|lunch|dinner)\b/i,
    suggestions: [
      { label: "Something lighter?", value: "Could you suggest a lighter version of that?" },
      { label: "What about dinner?", value: "And what should I have for dinner today?" },
      { label: "Is this right for my dosha?", value: "Is that a good choice for my constitution?" },
      { label: "How do I make it?", value: "Walk me through making that step by step." },
    ],
  },
  {
    test: /\b(report|screening|health check|risk|result|analysis)\b/i,
    suggestions: [
      { label: "What should I change?", value: "What should I change in my diet because of that?" },
      { label: "Is this getting better?", value: "Is that improving compared with my earlier checks?" },
      { label: "Should I see my doctor?", value: "Is that something I should raise with my doctor?" },
    ],
  },
  {
    test: /\b(sleep|tired|energy|fatigue|rest)\b/i,
    suggestions: [
      { label: "An evening routine", value: "What evening routine would help me sleep better?" },
      { label: "Foods that help", value: "Which foods would help my sleep and energy?" },
      { label: "Why am I so tired?", value: "Why might I be feeling this tired lately?" },
    ],
  },
  {
    test: /\b(water|hydrat|drink)\b/i,
    suggestions: [
      { label: "Warm or cold water?", value: "Should I be drinking warm or cold water for my constitution?" },
      { label: "Herbal options", value: "Which herbal drinks suit me?" },
      { label: "Remind me daily", value: "How do I set a daily water reminder?" },
    ],
  },
  {
    test: /\b(dosha|vata|pitta|kapha|ayurved|constitution)\b/i,
    suggestions: [
      { label: "Foods to favour", value: "Which foods should I favour for my constitution?" },
      { label: "Foods to avoid", value: "Which foods should I avoid right now?" },
      { label: "A daily routine", value: "What daily routine (dinacharya) would suit me?" },
    ],
  },
  {
    test: /\b(digest|bloat|acid|gut|stomach|heavy)\b/i,
    suggestions: [
      { label: "Why does this happen?", value: "Why does my digestion feel like that?" },
      { label: "Something soothing", value: "What could I eat that's soothing for my digestion?" },
      { label: "Spices that help", value: "Which spices would help my digestion?" },
    ],
  },
];

const DEFAULT_FOLLOW_UPS: CueSuggestion[] = [
  { label: "Tell me more", value: "Can you tell me a bit more about that?" },
  { label: "How does this apply to me?", value: "How does that apply to my own plan and history?" },
  { label: "What should I do today?", value: "What's one thing I should do differently today?" },
];

/**
 * Three or four things worth asking next, chosen from what the patient just
 * asked about. These take the place of the fixed chip row: after an answer
 * about sleep, the chips are about sleep.
 */
export const buildFollowUps = (userText: string, ctx?: PatientChatContext | null): CueSuggestion[] => {
  const topical = FOLLOW_UPS_BY_TOPIC.find((entry) => entry.test.test(userText));
  const base = topical ? [...topical.suggestions] : [...DEFAULT_FOLLOW_UPS];

  if (!topical && ctx?.activePlan) {
    base.push({ label: "Check it against my plan", value: "Does that fit the diet plan I'm following?" });
  }

  return base.slice(0, 4);
};

// ──────────────────────────────────────────────
// Proactive cues
// ──────────────────────────────────────────────

const mealFeedbackCard = (mealName: string): CueCard => ({
  eyebrow: "Quick check",
  prompt: `How did ${mealName} sit with you?`,
  options: [
    {
      id: "great",
      label: "Great",
      value: `${mealName} sat really well with me — light and easy. What does that tell you?`,
      icon: "sparkles",
      tone: "kapha",
      response: "Lovely — that's worth remembering. Let me tell you why it probably worked for you.",
    },
    {
      id: "okay",
      label: "Just okay",
      value: `${mealName} was just okay — nothing bad, nothing special. Any small tweaks?`,
      icon: "leaf",
      tone: "primary",
      response: "Fair enough. Small tweaks usually turn an 'okay' meal into a good one.",
    },
    {
      id: "heavy",
      label: "Felt heavy",
      value: `${mealName} felt heavy and slow to digest. What should I do differently?`,
      icon: "utensils",
      tone: "pitta",
      response: "Thanks for telling me — heaviness after a meal is a signal worth acting on.",
    },
    {
      id: "skipped",
      label: "I skipped it",
      value: `I ended up skipping ${mealName} today. What's the best way to make that up?`,
      icon: "target",
      tone: "vata",
      response: "That happens. Let's work out the kindest way to make it up.",
    },
  ],
});

const reportCard = (dayLabel: string): CueCard => ({
  eyebrow: "Pick one",
  prompt: `Your health check from ${dayLabel} is ready. Where should we start?`,
  options: [
    {
      id: "walk-through",
      label: "Walk me through it",
      value: "Walk me through my latest health check in plain language.",
      icon: "book",
      tone: "primary",
      response: "Let's go through it together, one finding at a time.",
    },
    {
      id: "eat",
      label: "What should I eat now?",
      value: "Given my latest health check, what should I be eating this week?",
      icon: "utensils",
      tone: "kapha",
      response: "Good instinct — food is the part of this you control every day.",
    },
    {
      id: "worry",
      label: "Anything to worry about?",
      value: "Is there anything in my latest health check I should be worried about?",
      icon: "heart",
      tone: "pitta",
      response: "Let's look at that honestly, without alarming you.",
    },
    {
      id: "trend",
      label: "Am I improving?",
      value: "How does my latest health check compare with my earlier ones?",
      icon: "brain",
      tone: "vata",
      response: "Trends say more than a single reading. Here's yours.",
    },
  ],
});

const dailyCheckCard = (): CueCard => ({
  eyebrow: "Pick one",
  prompt: "What would be most useful right now?",
  options: [
    {
      id: "today",
      label: "How's my day going?",
      value: "How is my day going so far — meals, water, sleep and activity?",
      icon: "sun",
      tone: "primary",
      response: "Here's the honest read on today.",
    },
    {
      id: "next-meal",
      label: "What's my next meal?",
      value: "What should my next meal be, based on my plan and what I've eaten today?",
      icon: "utensils",
      tone: "kapha",
      response: "Let's line the next meal up with what you've already had.",
    },
    {
      id: "week",
      label: "How was my week?",
      value: "Give me a short summary of how my last 7 days have gone.",
      icon: "brain",
      tone: "vata",
      response: "A week is enough to see a pattern. Here's yours.",
    },
    {
      id: "tip",
      label: "One tip for today",
      value: "Give me one small Ayurvedic thing I could do differently today.",
      icon: "leaf",
      tone: "pitta",
      response: "One small change, chosen for where you are today.",
    },
  ],
});

export interface CueClockOptions {
  now?: Date;
}

/**
 * Everything the companion could raise unprompted, most worth saying first.
 *
 * The caller decides how many to use and remembers which ids it has already
 * shown — this only decides what is *true* right now.
 */
export const buildProactiveCues = (
  ctx: PatientChatContext | null,
  { now = new Date() }: CueClockOptions = {},
): CompanionCue[] => {
  const today = isoDate(now);
  const cues: CompanionCue[] = [];
  if (!ctx) return cues;

  // 1. A health report that landed in the last week — the single most useful
  //    thing to raise, and the thing a patient is least likely to revisit.
  const latestScreening = ctx.screenings[ctx.screenings.length - 1];
  if (latestScreening && daysBetween(latestScreening.date, today) <= 7) {
    const dayLabel = relativeDay(latestScreening.date, now);
    cues.push({
      id: `report-${latestScreening.date}`,
      teaser: `Your health check from ${dayLabel} is ready — want me to walk you through it?`,
      message:
        `I had a look at your health check from ${dayLabel}. Overall it reads as ` +
        `${latestScreening.overallRisk.toLowerCase()} risk` +
        (latestScreening.conditions.length > 0
          ? `, with ${latestScreening.conditions
              .slice(0, 2)
              .map((c) => `${c.label} at ${c.riskLevel.toLowerCase()}`)
              .join(" and ")}.`
          : ".") +
        " We can take it apart however you like.",
      card: reportCard(dayLabel),
    });
  }

  // 2. Meals eaten today that nothing has been said about yet. Feedback is the
  //    input the rest of the app has least of, and it's easiest to give in the
  //    hour after eating.
  const todayAdherence = ctx.mealAdherence.days.find((d) => d.date === today);
  const hasFeedbackToday = ctx.mealFeedback.some((f) => f.date === today);
  if (todayAdherence && todayAdherence.eatenCount > 0 && !hasFeedbackToday) {
    const mealName = partOfDay(now) === "morning" ? "breakfast" : "your last meal";
    cues.push({
      id: `meal-feedback-${today}`,
      teaser: `You've logged ${todayAdherence.eatenCount} of ${todayAdherence.totalMeals} meals today — how did they feel?`,
      message:
        `You've ticked off ${todayAdherence.eatenCount} of ${todayAdherence.totalMeals} meals today. ` +
        "How a meal *feels* afterwards tells me more than whether it was eaten.",
      card: mealFeedbackCard(mealName),
    });
  }

  // 3. Water, but only once the day is far enough along that being behind
  //    actually means something.
  const todayLifestyle = ctx.lifestyle.days.find((d) => d.date === today);
  if (
    todayLifestyle &&
    now.getHours() >= 15 &&
    todayLifestyle.waterGoal > 0 &&
    todayLifestyle.waterGlasses < todayLifestyle.waterGoal * 0.6
  ) {
    const short = todayLifestyle.waterGoal - todayLifestyle.waterGlasses;
    cues.push({
      id: `water-${today}`,
      teaser: `You're ${short} glasses short on water today.`,
      message:
        `You're at ${todayLifestyle.waterGlasses} of ${todayLifestyle.waterGoal} glasses today — ` +
        `${short} to go. Warm water sipped through the evening counts, and it's gentler on digestion than a cold rush of it.`,
      suggestions: [
        { label: "Why warm water?", value: "Why is warm water better for me than cold?" },
        { label: "Herbal options", value: "Which herbal drinks would suit me in the evening?" },
        { label: "Remind me daily", value: "How can I set a daily water reminder in Prakriva?" },
      ],
    });
  }

  // 4. A short night, raised the following morning rather than at midnight.
  const yesterday = isoDate(new Date(now.getTime() - 86_400_000));
  const lastNight = ctx.lifestyle.days.find((d) => d.date === yesterday);
  if (lastNight?.sleepHours != null && lastNight.sleepHours < 6 && partOfDay(now) === "morning") {
    cues.push({
      id: `sleep-${yesterday}`,
      teaser: `Only ${lastNight.sleepHours}h of sleep last night — shall we plan around it?`,
      message:
        `You logged ${lastNight.sleepHours} hours last night. On a short night, Ayurveda leans warm, ` +
        "simple and cooked rather than raw and cold — it asks less of your digestion while you're running low.",
      suggestions: [
        { label: "What should I eat today?", value: "What should I eat today after a short night's sleep?" },
        { label: "An evening routine", value: "What evening routine would help me sleep better tonight?" },
        { label: "Is this a pattern?", value: "Has my sleep been getting worse over the last two weeks?" },
      ],
    });
  }

  // 5. A shopping list sitting unbought — cheap to mention, easy to act on.
  if (ctx.pantry.toBuy.length >= 3) {
    cues.push({
      id: `pantry-${today}`,
      teaser: `${ctx.pantry.toBuy.length} things are still on your kitchen list.`,
      message:
        `There are ${ctx.pantry.toBuy.length} ingredients still on your to-buy list, including ` +
        `${ctx.pantry.toBuy.slice(0, 3).join(", ")}. I can plan around what you already have instead, if it's easier.`,
      suggestions: [
        { label: "Cook without them", value: "What can I cook with only what I already have at home?" },
        { label: "What's worth buying first?", value: "Of my to-buy list, what should I prioritise buying?" },
      ],
    });
  }

  // 6. Nothing specific is true — still offer the daily read rather than
  //    opening with silence.
  cues.push({
    id: `daily-${today}`,
    teaser: "Want your daily read on how things are going?",
    message: `${greeting(now)}. I've been keeping an eye on your plan, your tracking and your last check.`,
    card: dailyCheckCard(),
  });

  return cues;
};

/** The first cue the patient hasn't already been shown. */
export const nextUnseenCue = (cues: CompanionCue[], seenIds: string[]): CompanionCue | null =>
  cues.find((cue) => !seenIds.includes(cue.id)) ?? null;
