import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import {
  Leaf,
  User,
  Apple,
  HeartPulse,
  Target,
  Check,
  Sparkles,
  Circle,
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
  const { user, setQuestionnaireCompleted } = useApp();
  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    dob: "",
    gender: "",
    location: "",
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
          assessment_data: formData,
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
  }> = ({ name, options, className = "flex space-x-4" }) => (
    <div className={className}>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center space-x-2 cursor-pointer"
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
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              formData[name] === option.value
                ? "bg-primary border-primary"
                : "border-gray-300"
            }`}
          >
            {formData[name] === option.value && (
              <div className="w-full h-full rounded-full bg-white scale-50"></div>
            )}
          </div>
          <span
            className={
              formData[name] === option.value
                ? "font-semibold text-primary"
                : ""
            }
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
    className = "grid grid-cols-2 md:grid-cols-3 gap-2",
  }) => (
    <div className={className}>
      {options.map((option) => {
        const isChecked = (formData[name] as string[]).includes(option.value);

        return (
          <label
            key={option.value}
            className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
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
              className={`w-4 h-4 rounded border-2 transition-all ${
                isChecked ? "bg-primary border-primary" : "border-gray-300"
              }`}
            >
              {isChecked && <Check className="w-3 h-3 text-white" />}
            </div>
            <span
              className={`text-sm ${
                isChecked ? "font-semibold text-primary" : ""
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
    <div className="bg-gray-100 font-sans leading-normal tracking-normal min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Leaf className="w-12 h-12 text-primary" />
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800">
              Personalized Ayurvedic Profile
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            This is a one-time profile, so we only ask for the things about you
            that stay the same — your constitution (Prakriti), allergies and
            family history. Day-to-day things like sleep, stress and hydration
            are recorded in your trackers instead.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Personal Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (City/State)
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="E.g., San Francisco, CA"
                />
              </div>
            </div>
          </div>

          {/* Allergies & Food Avoidances */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Apple className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Allergies & Food Avoidances
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foods to avoid (religious, personal, or medical reasons)
                </label>
                <textarea
                  name="foodAvoidances"
                  value={formData.foodAvoidances}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="E.g., beef, pork, alcohol, caffeine..."
                />
              </div>
            </div>
          </div>

          {/* Dietary Pattern */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Apple className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Dietary Pattern
              </h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <HeartPulse className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Family History
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Ayurvedic Constitutional Assessment */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Circle className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Ayurvedic Constitutional Assessment
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Target className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-gray-800">
                Additional Notes
              </h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anything else that is always true about you
              </label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Long-standing intolerances, cultural food practices, anything a practitioner should always know..."
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
              </div>
            </button>
          </div>
        </form>

        {/* Success Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-accent mb-4">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Assessment Submitted Successfully!
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Thank you for completing the Ayurvedic health assessment. Your
                  personalized profile will be generated based on your
                  responses.
                </p>
                <button
                  onClick={closeModal}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AyurvedicHealthAssessment;
