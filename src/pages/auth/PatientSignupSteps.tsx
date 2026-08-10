// Patient signup, in two steps.
//
// The first step is the account itself; the second asks what she is here for
// and then asks only the questions those answers need. A pregnant patient is
// asked for a due date; a PCOD/PCOS patient is asked about her diagnosis, her
// cycle and what she wants tracked — questions that would be meaningless the
// other way round, which is why one shared form was never going to work.
//
// The tracks are **checkboxes, not a radio group**. Pregnancy and PCOS
// routinely coexist, and a form that forced a choice between them would make a
// pregnant PCOS patient pick which half of her care to give up. Ticking both
// shows both sets of questions.
//
// Everything collected here is a starting point, not a substitute for the
// onboarding questionnaire: it seeds `assessment_data` so the trackers and the
// diet plan have something to work with on day one.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Check, HeartPulse, Sparkles } from "lucide-react";
import AccountFields, { type AccountFormData } from "./AccountFields";
import {
  GENERAL_TRACK_DESCRIPTION,
  GENERAL_TRACK_LABEL,
  HEALTH_TRACKS,
  HEALTH_TRACK_DESCRIPTIONS,
  HEALTH_TRACK_LABELS,
  type HealthTrack,
  type HealthTracks,
} from "@/lib/healthTrack";
import type { TrackSignupDetails } from "@/services/healthTrackService";
import { PCOS_CONCERNS } from "./patientTrackOptions";

const TRACK_ICONS: Record<HealthTrack, typeof Baby> = {
  pregnancy: Baby,
  pcos: HeartPulse,
};

interface PatientSignupStepsProps {
  step: number;
  formData: AccountFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Null until she has answered; an empty array is "general wellness". */
  tracks: HealthTracks | null;
  onTracksChange: (tracks: HealthTracks) => void;
  details: TrackSignupDetails;
  onDetailChange: (field: keyof TrackSignupDetails, value: string | string[]) => void;
  isLoading?: boolean;
}

const PatientSignupSteps = ({
  step,
  formData,
  onFormChange,
  tracks,
  onTracksChange,
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

  const selected = tracks ?? [];
  const isGeneral = tracks !== null && tracks.length === 0;

  const toggleTrack = (track: HealthTrack) =>
    onTracksChange(
      selected.includes(track)
        ? selected.filter((t) => t !== track)
        : HEALTH_TRACKS.filter((t) => t === track || selected.includes(t))
    );

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
        <legend className="text-sm font-medium">What are you here for? *</legend>
        <p className="mb-2 text-xs text-gray-500">
          Tick everything that applies — many people are both pregnant and
          managing PCOD/PCOS.
        </p>
        <div className="space-y-2">
          {HEALTH_TRACKS.map((track) => {
            const Icon = TRACK_ICONS[track];
            const checked = selected.includes(track);
            return (
              <label
                key={track}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  name="healthTracks"
                  value={track}
                  checked={checked}
                  onChange={() => toggleTrack(track)}
                  className="sr-only"
                  disabled={isLoading}
                />
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                    checked ? "border-primary bg-primary" : "border-gray-300"
                  }`}
                  aria-hidden
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    checked ? "text-primary" : "text-gray-400"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${checked ? "font-semibold text-primary" : "font-medium"}`}
                  >
                    {HEALTH_TRACK_LABELS[track]}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {HEALTH_TRACK_DESCRIPTIONS[track]}
                  </span>
                </span>
              </label>
            );
          })}

          {/* "Neither" is its own control rather than an unticked state, so a
              patient who genuinely wants no condition tracking gives an answer
              instead of leaving the question blank. */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              isGeneral ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              name="healthTracks"
              value="general"
              checked={isGeneral}
              onChange={() => onTracksChange([])}
              className="sr-only"
              disabled={isLoading}
            />
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                isGeneral ? "border-primary bg-primary" : "border-gray-300"
              }`}
              aria-hidden
            >
              {isGeneral && <Check className="h-3 w-3 text-white" />}
            </span>
            <Sparkles
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                isGeneral ? "text-primary" : "text-gray-400"
              }`}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className={`block text-sm ${isGeneral ? "font-semibold text-primary" : "font-medium"}`}
              >
                {GENERAL_TRACK_LABEL}
              </span>
              <span className="block text-xs text-gray-500">
                {GENERAL_TRACK_DESCRIPTION}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {/* Asked of everyone who answered: BMI needs both, and the weight log
          starts here. */}
      {tracks !== null && (
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

      {selected.includes("pregnancy") && (
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

      {selected.includes("pcos") && (
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
              <Label htmlFor="lastPeriodStart">
                {selected.includes("pregnancy")
                  ? "Last period before pregnancy"
                  : "Last period started"}
              </Label>
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
                      aria-hidden
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

      {selected.includes("pregnancy") && selected.includes("pcos") && (
        <p className="rounded-lg border border-plum-100 bg-plum-50/50 p-3 text-xs text-plum-900">
          You'll get both: the maternal health check and your cycle, weight and
          skin trackers. Your nutrition follows pregnancy guidelines — those
          come first — with your PCOD/PCOS logs shaping what goes in the plan.
        </p>
      )}
    </div>
  );
};

export default PatientSignupSteps;
