// Exercise suggestions, rendered the same way everywhere they appear.
//
// Three surfaces show them and they must not drift apart: the Lifestyle
// Tracker (where minutes are logged against each exercise), the patient's own
// health-check results, and the doctor's Patient Analysis. The picks and the
// safety notes come from src/lib/exerciseRecommendations.ts; this file is only
// their presentation.

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Bike,
  CheckCircle2,
  Dumbbell,
  Footprints,
  Heart,
  Info,
  StretchHorizontal,
  Waves,
  Wind,
  Youtube,
} from "lucide-react";
import { RISK_STYLES } from "@/lib/riskLevels";
import {
  conditionsFromScreening,
  EXERCISE_DISCLAIMER,
  planExercises,
  planForCondition,
  recommendExercises,
  videoUrl,
  type ConditionInput,
  type Exercise,
  type ExerciseIcon,
  type ExercisePlan as ExercisePlanShape,
  type ExerciseRecommendation,
} from "@/lib/exerciseRecommendations";
import type { RiskLevel, ScreeningResult } from "@/types/diseaseDetection";

const EXERCISE_ICONS: Record<ExerciseIcon, typeof Activity> = {
  walk: Footprints,
  yoga: StretchHorizontal,
  breathing: Wind,
  strength: Dumbbell,
  swim: Waves,
  cycle: Bike,
  stretch: StretchHorizontal,
  heart: Heart,
};

// One ramp per intensity so the three stay tellable apart at a glance; the
// badge also spells the word out, so hue is never the only cue.
const INTENSITY_STYLES: Record<string, string> = {
  gentle: "bg-accent-soft text-accent-soft-foreground border-transparent",
  moderate: "bg-warning/10 text-warning border-warning/20",
  brisk: "bg-vata/10 text-vata border-vata/20",
};

interface ExerciseCardProps {
  exercise: Exercise;
  /** Marks the card as already done (the tracker's daily target being met). */
  isDone?: boolean;
  /** Optional controls under the card — the tracker's minute logging. */
  action?: React.ReactNode;
}

/** One exercise: what it is, how to do it, and a video to watch first. */
export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  isDone = false,
  action,
}) => {
  const Icon = EXERCISE_ICONS[exercise.icon] ?? Activity;

  return (
    <div
      className={cn(
        "rounded-xl border border-border p-4 transition-colors",
        isDone && "border-accent-soft-foreground/20 bg-accent-soft/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground-secondary" />
        <div className="min-w-0 flex-1">
          {isDone && (
            <CheckCircle2
              className="float-right h-5 w-5 shrink-0 text-primary"
              aria-label="Today's target met"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-subhead font-medium text-foreground">{exercise.name}</h4>
            <Badge variant="outline" className={INTENSITY_STYLES[exercise.intensity]}>
              {exercise.intensity}
            </Badge>
          </div>
          <p className="mt-1 text-footnote text-foreground-secondary">{exercise.how}</p>
          <p className="mt-1 text-caption1 text-foreground-tertiary">Target: {exercise.minutes} min/day</p>
          <a
            href={videoUrl(exercise)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-caption1 font-medium text-primary hover:underline"
          >
            <Youtube className="h-3.5 w-3.5" />
            Watch how to do it
          </a>
        </div>
      </div>
      {action}
    </div>
  );
};

/** The "avoid for now" block, shared by the merged and per-condition views. */
export const ExerciseAvoidList: React.FC<{ items: string[]; heading?: string }> = ({
  items,
  heading = "Avoid for now",
}) =>
  items.length === 0 ? null : (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h4 className="text-subhead font-medium text-destructive">{heading}</h4>
      </div>
      <ul className="mt-2 space-y-1 text-footnote text-destructive/90">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

interface ExerciseSuggestionsProps {
  recommendation: ExerciseRecommendation;
  /** Per-card controls, e.g. the tracker's +/- minute buttons. */
  renderAction?: (exercise: Exercise) => React.ReactNode;
  /** Whether a card should read as completed. */
  isDone?: (exercise: Exercise) => boolean;
}

/**
 * Every recommended exercise merged into one list, with the reasoning per
 * condition underneath. This is the Lifestyle Tracker's layout: the point
 * there is *what to do today*, so the same exercise asked for by two
 * conditions appears once.
 */
export const ExerciseSuggestions: React.FC<ExerciseSuggestionsProps> = ({
  recommendation,
  renderAction,
  isDone,
}) => (
  <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      {recommendation.exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          isDone={isDone?.(exercise)}
          action={renderAction?.(exercise)}
        />
      ))}
    </div>

    <div className="space-y-3">
      {recommendation.plans.map((plan) => (
        <div key={plan.key} className="rounded-xl border border-accent-soft-foreground/15 bg-accent-soft/40 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent-soft-foreground" />
            <h4 className="text-subhead font-medium text-accent-soft-foreground">Why this for {plan.label}</h4>
          </div>
          <p className="mt-1 text-footnote text-accent-soft-foreground/80">{plan.rationale}</p>
        </div>
      ))}
    </div>

    <ExerciseAvoidList items={recommendation.avoid} />
  </div>
);

/** One condition's own section: the risk, the reasoning, and its videos. */
const ConditionSection: React.FC<{
  label: string;
  riskLevel?: RiskLevel;
  plan: ExercisePlanShape;
  isPregnant: boolean;
}> = ({ label, riskLevel, plan, isPregnant }) => (
  <div className="space-y-3 rounded-xl border border-border p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-headline text-foreground">Exercise for {label}</h3>
      {riskLevel && (
        <Badge variant="outline" className={RISK_STYLES[riskLevel].badge}>
          {RISK_STYLES[riskLevel].label}
        </Badge>
      )}
    </div>

    <p className="text-footnote text-foreground-secondary">{plan.rationale}</p>

    <div className="grid gap-3 md:grid-cols-2">
      {planExercises(plan, isPregnant).map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} />
      ))}
    </div>

    <ExerciseAvoidList items={plan.avoid} heading={`Avoid with ${label.toLowerCase()}`} />
  </div>
);

/**
 * Exercise videos for the conditions a screening actually flagged.
 *
 * Grouped by condition rather than merged: on a results page the question is
 * "my thyroid risk came back moderate — now what?", and an undifferentiated
 * list of ten exercises does not answer it. Low-risk findings are left out,
 * because a low score is reassurance rather than something to train around.
 */
export const ScreeningExercisePlan: React.FC<{
  result: ScreeningResult;
  isPregnant?: boolean;
  /** Patients are addressed directly; the clinician copy stays third-person. */
  audience?: "patient" | "clinician";
}> = ({ result, isPregnant = false, audience = "patient" }) => {
  const flagged = conditionsFromScreening(result.conditions);

  const sections = flagged
    .map((finding: ConditionInput) => {
      const plan = planForCondition(finding.condition);
      if (!plan) return null;
      const label =
        result.conditions.find((c) => c.condition === finding.condition)?.label ?? plan.label;
      return { plan, label, riskLevel: finding.riskLevel as RiskLevel | undefined };
    })
    .filter((section): section is NonNullable<typeof section> => section !== null);

  // Nothing crossed moderate (or nothing we have a plan for): fall back to the
  // balanced week rather than showing an empty card.
  const fallback = sections.length === 0 ? recommendExercises({ conditions: [], isPregnant }) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
            <Activity className="h-4.5 w-4.5" />
          </span>
          {audience === "patient" ? "Exercise for your results" : "Suggested exercise plan"}
        </CardTitle>
        <CardDescription>
          {fallback
            ? audience === "patient"
              ? "Nothing in your results needs a special exercise plan, so here is a balanced week."
              : "No condition crossed the moderate threshold; the general balanced plan is shown."
            : audience === "patient"
              ? `Chosen for the conditions your check flagged — ${sections
                  .map((s) => s.label)
                  .join(", ")} — with a video for each.`
              : `Tailored to the flagged conditions — ${sections
                  .map((s) => s.label)
                  .join(", ")}. Each exercise links to a how-to video the patient can follow.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {fallback ? (
          <ExerciseSuggestions recommendation={fallback} />
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <ConditionSection
                key={section.plan.key}
                label={section.label}
                riskLevel={section.riskLevel}
                plan={section.plan}
                isPregnant={isPregnant}
              />
            ))}
          </div>
        )}

        <p className="text-caption1 text-foreground-tertiary">{EXERCISE_DISCLAIMER[audience]}</p>
      </CardContent>
    </Card>
  );
};
