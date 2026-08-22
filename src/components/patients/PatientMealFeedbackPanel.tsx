import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Activity, Smile, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchMealFeedback,
  summarizeMealFeedback,
  type MealFeedback,
} from "@/services/mealFeedbackService";

interface PatientMealFeedbackPanelProps {
  /** The `patients.id` UUID currently selected. Empty means "no patient yet". */
  patientId: string;
  patientName?: string;
  /** How many recent check-ins to read. */
  limit?: number;
  className?: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * 1–5 sliders: 4–5 is going well, 3 is neutral, 1–2 is the one a doctor has to
 * see. Same rule as `RISK_STYLES` — one hue family, escalating in intensity
 * rather than changing colour, with the value always spelled out beside it so
 * colour is only reinforcement.
 */
const ratingTone = (value: number | null) => {
  if (value === null) return "bg-gray-50 text-gray-500 border-gray-200";
  if (value <= 2) return "bg-red-600 text-white border-red-700";
  if (value === 3) return "bg-coral-100 text-coral-800 border-coral-300";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

const RATINGS: {
  key: "digestion" | "mood" | "energy";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "digestion", label: "Digestion", icon: Activity },
  { key: "mood", label: "Mood", icon: Smile },
  { key: "energy", label: "Energy", icon: Zap },
];

const RatingPill: React.FC<{
  label: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, icon: Icon }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
      ratingTone(value)
    )}
    title={`${label}: ${value === null ? "not rated" : `${value} of 5`}`}
  >
    <Icon className="w-3 h-3" />
    {label} {value === null ? "—" : `${value}/5`}
  </span>
);

const FeedbackRow: React.FC<{ entry: MealFeedback }> = ({ entry }) => (
  <div className="py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium text-gray-800">{entry.mealName}</span>
      <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
    </div>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {RATINGS.map(({ key, label, icon }) => (
        <RatingPill key={key} label={label} value={entry[key]} icon={icon} />
      ))}
    </div>
    {entry.notes.trim() && (
      <p className="mt-2 text-xs leading-relaxed text-gray-600 italic">
        “{entry.notes.trim()}”
      </p>
    )}
  </div>
);

/**
 * Doctor-side view of the meal feedback a patient writes in her Plan Hub —
 * how each meal sat with her digestion, mood and energy, plus anything she
 * wrote about it. Read-only: the feedback is her own statement, and the table
 * has no update policy.
 */
export const PatientMealFeedbackPanel: React.FC<
  PatientMealFeedbackPanelProps
> = ({ patientId, patientName, limit = 20, className }) => {
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["patient-meal-feedback", patientId, limit],
    queryFn: () => fetchMealFeedback(patientId, limit),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });

  const summary = summarizeMealFeedback(entries);

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <CardTitle className="text-sm">Meal Feedback</CardTitle>
          </div>
          {summary.count > 0 && (
            <Badge variant="outline" className="text-xs">
              {summary.count} check-in{summary.count === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          What {patientName || "this patient"} reported after eating the meals
          you planned
          {summary.latestDate ? `, latest ${formatDate(summary.latestDate)}` : ""}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!patientId ? (
          <p className="text-xs text-gray-500">
            Select a patient to see their meal feedback.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isError ? (
          <p className="text-xs text-rose-600">
            Couldn't load meal feedback. Try again in a moment.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-gray-500">
            No meal feedback yet — it appears here once the patient logs how a
            meal made them feel.
          </p>
        ) : (
          <>
            {/* Averages first: the one-line read on how the plan is landing. */}
            <div className="flex flex-wrap gap-1.5">
              {RATINGS.map(({ key, label, icon }) => (
                <RatingPill
                  key={key}
                  label={`Avg ${label.toLowerCase()}`}
                  value={summary[key]}
                  icon={icon}
                />
              ))}
            </div>
            <Separator />
            <ScrollArea className="max-h-72 pr-3">
              <div className="divide-y">
                {entries.map((entry) => (
                  <FeedbackRow key={entry.id} entry={entry} />
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientMealFeedbackPanel;
