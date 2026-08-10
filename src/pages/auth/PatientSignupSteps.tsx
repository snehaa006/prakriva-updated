// Patient signup, in two steps.
//
// The first step is the account itself; the second asks which care pathway she
// is here for and then asks only the questions that pathway needs. A pregnant
// patient is asked for a due date; a PCOD/PCOS patient is asked about her
// diagnosis, her cycle and what she wants tracked — questions that would be
// meaningless the other way round, which is why one shared form was never
// going to work.
//
// Everything collected here is a starting point, not a substitute for the
// onboarding questionnaire: it seeds `assessment_data` so the trackers and the
// diet plan have something to work with on day one.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Check, HeartPulse, Sparkles } from "lucide-react";
import AccountFields, { type AccountFormData } from "./AccountFields";
import {
  HEALTH_TRACK_DESCRIPTIONS,
  HEALTH_TRACK_LABELS,
  type HealthTrack,
} from "@/lib/healthTrack";
import type { TrackSignupDetails } from "@/services/healthTrackService";
import { PCOS_CONCERNS } from "./patientTrackOptions";

/** The pathways a patient can pick at signup, in the order they are shown. */
const TRACK_OPTIONS: { track: HealthTrack; icon: typeof Baby }[] = [
  { track: "pregnancy", icon: Baby },
  { track: "pcos", icon: HeartPulse },
  { track: "general", icon: Sparkles },
];

interface PatientSignupStepsProps {
  step: number;
  formData: AccountFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  track: HealthTrack | null;
  onTrackChange: (track: HealthTrack) => void;
  details: TrackSignupDetails;
  onDetailChange: (field: keyof TrackSignupDetails, value: string | string[]) => void;
  isLoading?: boolean;
}

const PatientSignupSteps = ({
  step,
  formData,
  onFormChange,
  track,
  onTrackChange,
  details,
  onDetailChange,
  isLoading = false,
}: PatientSignupStepsProps) => {
  if (step === 1) {
    return (
      <AccountFields
        values={formData}
        onChange={onFormChange}
        isSignup
        disabled={isLoading}
      />
    );
  }

  const toggleConcern = (value: string) => {
    const current = details.concerns ?? [];
    onDetailChange(
      "concerns",
      current.includes(value)
        ? current.filter((c) => c !== value)
        : [...current, value]
    );
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          What are you here for? *
        </legend>
        <div className="space-y-2">
          {TRACK_OPTIONS.map(({ track: option, icon: Icon }) => {
            const selected = track === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="healthTrack"
                  value={option}
                  checked={selected}
                  onChange={() => onTrackChange(option)}
                  className="sr-only"
                  disabled={isLoading}
                />
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    selected ? "text-primary" : "text-gray-400"
                  }`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${selected ? "font-semibold text-primary" : "font-medium"}`}
                  >
                    {HEALTH_TRACK_LABELS[option]}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {HEALTH_TRACK_DESCRIPTIONS[option]}
                  </span>
                </span>
                {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Asked of everyone: BMI needs both, and the weight log starts here. */}
      {track && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="heightCm">Height (cm)</Label>
            <Input
              id="heightCm"
              type="number"
              min={100}
              max={220}
              value={details.heightCm ?? ""}
              onChange={(e) => onDetailChange("heightCm", e.target.value)}
              placeholder="160"
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="weightKg">Current weight (kg)</Label>
            <Input
              id="weightKg"
              type="number"
              min={25}
              max={250}
              step="0.1"
              value={details.weightKg ?? ""}
              onChange={(e) => onDetailChange("weightKg", e.target.value)}
              placeholder="58"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {track === "pregnancy" && (
        <div>
          <Label htmlFor="dueDate">Estimated due date</Label>
          <Input
            id="dueDate"
            type="date"
            value={details.dueDate ?? ""}
            onChange={(e) => onDetailChange("dueDate", e.target.value)}
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            We use this to work out how many weeks along you are, and which
            trimester your nutrition targets should follow.
          </p>
        </div>
      )}

      {track === "pcos" && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="diagnosisStatus">Has a doctor diagnosed it? *</Label>
            <select
              id="diagnosisStatus"
              value={details.diagnosisStatus ?? ""}
              onChange={(e) => onDetailChange("diagnosisStatus", e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select...</option>
              <option value="diagnosed-pcos">Yes — diagnosed with PCOS</option>
              <option value="diagnosed-pcod">Yes — diagnosed with PCOD</option>
              <option value="suspected">Not yet — I suspect it</option>
              <option value="under-investigation">Under investigation</option>
            </select>
          </div>

          {(details.diagnosisStatus === "diagnosed-pcos" ||
            details.diagnosisStatus === "diagnosed-pcod") && (
            <div>
              <Label htmlFor="diagnosisYear">Year of diagnosis</Label>
              <Input
                id="diagnosisYear"
                type="number"
                min={1970}
                max={new Date().getFullYear()}
                value={details.diagnosisYear ?? ""}
                onChange={(e) => onDetailChange("diagnosisYear", e.target.value)}
                placeholder={String(new Date().getFullYear())}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="typicalCycleLength">Usual cycle length (days)</Label>
              <Input
                id="typicalCycleLength"
                type="number"
                min={15}
                max={120}
                value={details.typicalCycleLength ?? ""}
                onChange={(e) => onDetailChange("typicalCycleLength", e.target.value)}
                placeholder="28"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank if it is too irregular to say.
              </p>
            </div>
            <div>
              <Label htmlFor="lastPeriodStart">Last period started</Label>
              <Input
                id="lastPeriodStart"
                type="date"
                value={details.lastPeriodStart ?? ""}
                onChange={(e) => onDetailChange("lastPeriodStart", e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              What would you like tracked?
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PCOS_CONCERNS.map((concern) => {
                const checked = (details.concerns ?? []).includes(concern.value);
                return (
                  <label
                    key={concern.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleConcern(concern.value)}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                        checked ? "border-primary bg-primary" : "border-gray-300"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className={checked ? "font-semibold text-primary" : ""}>
                      {concern.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
};

export default PatientSignupSteps;
