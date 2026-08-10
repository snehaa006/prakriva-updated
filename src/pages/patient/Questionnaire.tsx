import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { HEALTH_TRACK_LABELS } from "@/lib/healthTrack";

import {
  Leaf,
  User,
  Apple,
  HeartPulse,
  Target,
  Check,
  Sparkles,
  Circle,
  Utensils,
} from "lucide-react";

/**
 * The profile questionnaire only collects traits that stay the same over time.
 *
 * Anything that shifts week to week — stress, energy, sleep, hydration,
 * activity, cravings, current conditions, goals — is deliberately absent: it
 * belongs to the trackers, not to a one-off profile.
 */
interface FormData {
  // Personal Information
  name: string;
  dob: string;
  gender: string;
  location: string;
  heightCm: string;

  // Maternal (captured once; used by the pregnancy health check)
  lifeStage: string;
  dueDate: string;

  // Allergies & Food Avoidances
  allergies: string[];
  allergiesOther: string;
  foodAvoidances: string;

  // Long-standing dietary pattern
  dietaryPreferences: string;

  // Family History
  familyHistory: string[];
  familyHistoryOther: string;

  // Ayurvedic Constitutional Assessment (Prakriti — fixed at birth)
  bodyFrame: string;
  skinType: string;
  hairType: string;
  appetitePattern: string;
  personalityTraits: string[];
  weatherPreference: string;

  additionalNotes: string;
}

const AyurvedicHealthAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, setQuestionnaireCompleted, healthTracks } = useApp();
  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    dob: "",
    gender: "",
    location: "",
    heightCm: "",
    lifeStage: "",
    dueDate: "",
    allergies: [],
    allergiesOther: "",
    foodAvoidances: "",
    dietaryPreferences: "",
    familyHistory: [],
    familyHistoryOther: "",
    bodyFrame: "",
    skinType: "",
    hairType: "",
    appetitePattern: "",
    personalityTraits: [],
    weatherPreference: "",
    additionalNotes: "",
  });

  const [showModal, setShowModal] = useState(false);

  // Purely presentational: a gentle sense of progress as the form fills in.
  // Never gates anything — submission still only depends on the browser's own
  // `required` validation on the fields below.
  const progressPercent = useMemo(() => {
    const trackedFields: (keyof FormData)[] = [
      "name",
      "dob",
      "gender",
      "dietaryPreferences",
      "bodyFrame",
      "skinType",
      "hairType",
      "appetitePattern",
      "weatherPreference",
    ];
    const filled = trackedFields.filter((field) => {
      const value = formData[field];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length;
    return Math.round((filled / trackedFields.length) * 100);
  }, [formData]);

  /**
   * What signup already put in `assessment_data`, kept so the submit below can
   * merge into it rather than replace it.
   *
   * Signup writes the care tracks and their answers (`healthTracks`,
   * `lifeStage`, `dueDate`, the PCOD/PCOS fields) here before the patient ever
   * reaches this form. Saving `formData` straight over the column — which is
   * what this page used to do — would silently wipe every one of them and drop
   * her back onto general-adult nutrition targets.
   */
  const [existingAssessment, setExistingAssessment] = useState<
    Record<string, unknown>
  >({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadExisting = async () => {
      const { data } = await supabase
        .from("patients")
        .select("assessment_data")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const stored = (data?.assessment_data as Record<string, unknown>) ?? {};
      setExistingAssessment(stored);

      // Seed the fields signup already answered, so she is not asked twice and
      // a blank input cannot overwrite a real value.
      setFormData((prev) => ({
        ...prev,
        lifeStage: (stored.lifeStage as string) || prev.lifeStage,
        dueDate: (stored.dueDate as string) || prev.dueDate,
        heightCm: (stored.heightCm as string) || prev.heightCm,
      }));
    };

    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => {
      const currentArray = prev[name] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter((item) => item !== value)
        : [...currentArray, value];
      return { ...prev, [name]: newArray };
    });
  };

  const handleMutualExclusiveCheckbox = (
    name: keyof FormData,
    value: string,
    noneValue = "none"
  ) => {
    setFormData((prev) => {
      const currentArray = prev[name] as string[];

      if (value === noneValue) {
        return {
          ...prev,
          [name]: currentArray.includes(noneValue) ? [] : [noneValue],
        };
      } else {
        const withoutNone = currentArray.filter((item) => item !== noneValue);
        const newArray = withoutNone.includes(value)
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value];
        return { ...prev, [name]: newArray };
      }
    });
  };

  const handleRadioChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Pressing Enter inside a single-line field should not submit the whole
  // form. The assessment is long, so users often hit Enter after typing a
  // value (e.g. "Other family history") expecting to move on — not to finish.
  // Only the explicit Submit button should trigger submission. Textareas are
  // left alone so Enter still inserts a newline there.
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "Enter" && target.tagName === "INPUT") {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!user) {
      toast.error("User not found. Please log in again.");
      return;
    }
  
    setIsSubmitting(true);
  
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          questionnaire_completed: true,
          // Merged, never replaced — see `existingAssessment` above. An empty
          // answer also never wins over a stored one, so a field this form
          // does not ask about on her track survives untouched.
          assessment_data: {
            ...existingAssessment,
            ...Object.fromEntries(
              Object.entries(formData).filter(
                ([, value]) => value !== "" && value !== undefined
              )
            ),
          },
          assessment_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;


      // Update context state
      setQuestionnaireCompleted(true);
      
      toast.success("Assessment submitted successfully!");
      
      // Wait for state to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setShowModal(true);
  
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Failed to submit assessment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const closeModal = () => {
    setShowModal(false);
    navigate('/patient/dashboard');
  };
  interface RadioOption {
    value: string;
    label: string;
  }

  const RadioGroup: React.FC<{
    name: keyof FormData;
    options: RadioOption[];
    className?: string;
  }> = ({ name, options, className = "flex flex-wrap gap-2.5" }) => (
    <div className={className}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors ${
            formData[name] === option.value
              ? "border-primary/30 bg-accent-soft"
              : "border-border hover:bg-muted"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={formData[name] === option.value}
            onChange={(e) => handleRadioChange(name, e.target.value)}
            className="sr-only"
          />
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
              formData[name] === option.value
                ? "border-primary bg-primary"
                : "border-border-strong"
            }`}
          >
            {formData[name] === option.value && (
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground"></div>
            )}
          </div>
          <span
            className={`text-subhead ${
              formData[name] === option.value
                ? "font-semibold text-primary"
                : "text-foreground"
            }`}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );

  const CheckboxGroup: React.FC<{
    name: keyof FormData;
    options: RadioOption[];
    mutualExclusive?: boolean;
    className?: string;
  }> = ({
    name,
    options,
    mutualExclusive = false,
    className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5",
  }) => (
    <div className={className}>
      {options.map((option) => {
        const isChecked = (formData[name] as string[]).includes(option.value);

        return (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors ${
              isChecked ? "border-primary/30 bg-accent-soft" : "border-border hover:bg-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => {
                if (mutualExclusive) {
                  handleMutualExclusiveCheckbox(name, option.value);
                } else {
                  handleCheckboxChange(name, option.value);
                }
              }}
              className="sr-only"
            />
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                isChecked ? "border-primary bg-primary" : "border-border-strong"
              }`}
            >
              {isChecked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <span
              className={`text-footnote ${
                isChecked ? "font-semibold text-primary" : "text-foreground"
              }`}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-20">
        <header className="mb-8 text-center sm:mb-12">
          <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
            <Leaf className="h-7 w-7" />
          </span>
          <h1 className="text-title1 text-foreground">
            Let's get to know you
          </h1>
          <p className="mx-auto mt-4 max-w-md text-body text-foreground-secondary">
            Just a few minutes, once. We're only asking about what stays true
            about you — your constitution, allergies, and family history.
            Day-to-day things like sleep and energy live in your trackers instead.
          </p>

          <div className="mx-auto mt-8 max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-ios"
                style={{ width: `${Math.max(progressPercent, 6)}%` }}
              />
            </div>
            <p className="mt-2 text-caption1 text-foreground-tertiary">
              7 short sections — take your time
            </p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          onKeyDown={handleFormKeyDown}
          className="space-y-6"
        >
          {/* Personal Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <User className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                About you
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Location (City/State)
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="E.g., San Francisco, CA"
                />
              </div>
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Height (cm)
                </label>
                <input
                  type="number"
                  name="heightCm"
                  min={100}
                  max={220}
                  value={formData.heightCm}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="E.g., 160"
                />
                <p className="mt-1.5 text-caption1 text-foreground-tertiary">
                  Used with your weight to work out BMI in the health check.
                </p>
              </div>
              {/* The pregnancy question is only asked when signup did not
                  already answer it. A patient who ticked a care track at
                  signup has answered; re-asking here would let a blank answer
                  contradict it. */}
              {healthTracks !== null && healthTracks.length > 0 ? (
                <div>
                  <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                    Your care {healthTracks.length > 1 ? "tracks" : "track"}
                  </label>
                  <p className="rounded-xl border border-border bg-accent-soft/50 px-4 py-2.5 text-subhead text-foreground-secondary">
                    {healthTracks.map((t) => HEALTH_TRACK_LABELS[t]).join(" + ")} —
                    set up for you already, so we won't ask again here.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                    Are you currently pregnant?
                  </label>
                  <select
                    name="lifeStage"
                    value={formData.lifeStage}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="pregnancy">Yes, I am pregnant</option>
                    <option value="none">No</option>
                  </select>
                </div>
              )}
              {healthTracks?.length === 0 && formData.lifeStage === "pregnancy" && (
                <div>
                  <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                    Estimated due date
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1.5 text-caption1 text-foreground-tertiary">
                    We use this to work out how many weeks along you are.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Allergies & Food Avoidances */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Apple className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                Allergies & food avoidances
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Known food allergies (select all that apply)
                </label>
                <CheckboxGroup
                  name="allergies"
                  options={[
                    { value: "dairy", label: "Dairy / Lactose" },
                    { value: "gluten", label: "Gluten / Wheat" },
                    { value: "nuts", label: "Tree Nuts" },
                    { value: "peanuts", label: "Peanuts" },
                    { value: "soy", label: "Soy" },
                    { value: "eggs", label: "Eggs" },
                    { value: "shellfish", label: "Shellfish" },
                    { value: "fish", label: "Fish" },
                    { value: "none", label: "None" },
                  ]}
                  mutualExclusive
                />
                <div className="mt-2">
                  <input
                    type="text"
                    name="allergiesOther"
                    value={formData.allergiesOther}
                    onChange={handleInputChange}
                    placeholder="Other allergies (e.g., sesame, mustard)..."
                    className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Foods to avoid (religious, personal, or medical reasons)
                </label>
                <textarea
                  name="foodAvoidances"
                  value={formData.foodAvoidances}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="E.g., beef, pork, alcohol, caffeine..."
                />
              </div>
            </div>
          </div>

          {/* Dietary Pattern */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Utensils className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                Dietary pattern
              </h2>
            </div>

            <div>
              <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                Dietary preference
              </label>
              <RadioGroup
                name="dietaryPreferences"
                options={[
                  { value: "vegetarian", label: "Vegetarian" },
                  { value: "vegan", label: "Vegan" },
                  { value: "non-vegetarian", label: "Non-vegetarian" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
          </div>

          {/* Family History */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <HeartPulse className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                Family history
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Conditions that run in your family
                </label>
                <CheckboxGroup
                  name="familyHistory"
                  options={[
                    { value: "diabetes", label: "Diabetes" },
                    { value: "heart-disease", label: "Heart disease" },
                    { value: "thyroid", label: "Thyroid" },
                    { value: "none", label: "None" },
                  ]}
                  mutualExclusive
                />
                <div className="mt-2">
                  <input
                    type="text"
                    name="familyHistoryOther"
                    value={formData.familyHistoryOther}
                    onChange={handleInputChange}
                    placeholder="Other family history..."
                    className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Ayurvedic Constitutional Assessment */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Circle className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                Your constitution (Prakriti)
              </h2>
            </div>
            <p className="mb-6 pl-12 text-footnote text-foreground-secondary">
              There's no right answer here — pick whatever has felt true for most of your life.
            </p>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Body frame
                </label>
                <RadioGroup
                  name="bodyFrame"
                  options={[
                    { value: "thin", label: "Thin/Small frame" },
                    { value: "medium", label: "Medium frame" },
                    { value: "large", label: "Large/Heavy frame" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Skin type
                </label>
                <RadioGroup
                  name="skinType"
                  options={[
                    { value: "dry", label: "Dry, rough" },
                    { value: "oily", label: "Oily, warm" },
                    { value: "normal", label: "Smooth, cool" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Hair type
                </label>
                <RadioGroup
                  name="hairType"
                  options={[
                    { value: "dry", label: "Dry, brittle" },
                    { value: "fine", label: "Fine, early graying" },
                    { value: "thick", label: "Thick, lustrous" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Appetite pattern
                </label>
                <RadioGroup
                  name="appetitePattern"
                  options={[
                    { value: "variable", label: "Variable/irregular" },
                    { value: "strong", label: "Strong/sharp" },
                    { value: "slow", label: "Slow/steady" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Personality traits (select all that apply)
                </label>
                <CheckboxGroup
                  name="personalityTraits"
                  options={[
                    { value: "creative", label: "Creative" },
                    { value: "quick-thinking", label: "Quick thinking" },
                    { value: "anxious", label: "Anxious" },
                    { value: "ambitious", label: "Ambitious" },
                    { value: "focused", label: "Focused" },
                    { value: "irritable", label: "Irritable" },
                    { value: "calm", label: "Calm" },
                    { value: "steady", label: "Steady" },
                    { value: "slow-to-change", label: "Slow to change" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                  Weather preference
                </label>
                <RadioGroup
                  name="weatherPreference"
                  options={[
                    { value: "warm", label: "Prefer warm weather" },
                    { value: "cool", label: "Prefer cool weather" },
                    { value: "moderate", label: "Prefer moderate weather" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Target className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-headline text-foreground">
                Anything else worth knowing
              </h2>
            </div>

            <div>
              <label className="mb-2 block text-footnote font-medium text-foreground-secondary">
                Optional — anything else that is always true about you
              </label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-xl border border-border bg-background-elevated px-4 py-2.5 text-subhead text-foreground transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Long-standing intolerances, cultural food practices, anything a practitioner should always know..."
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-subhead font-semibold text-primary-foreground shadow-sm transition-all duration-200 ease-ios hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isSubmitting ? "Saving your profile…" : "Complete my profile"}</span>
            </button>
            <p className="mt-3 text-caption1 text-foreground-tertiary">
              You can always update these details later from your profile.
            </p>
          </div>
        </form>

        {/* Success Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-ios-spring">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Check className="h-7 w-7" />
              </span>
              <h3 className="text-headline text-foreground">
                You're all set
              </h3>
              <p className="mt-2 text-footnote text-foreground-secondary">
                Thank you for sharing this with us. Your personalized Ayurvedic
                profile is ready, built around what you just told us.
              </p>
              <button
                onClick={closeModal}
                className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-subhead font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Go to my dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AyurvedicHealthAssessment;
