import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { supabase } from "@/lib/supabase";
import type { HealthTracks } from "@/lib/healthTrack";
import {
  fetchHealthTracks,
  syncHealthTracksFromMetadata,
} from "@/services/healthTrackService";
import { resolveAvatar } from "@/services/avatarService";

/* ----------------------------- Type Definitions ----------------------------- */

export type UserRole = "doctor" | "patient" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  weight: number;
  height: number;
  bmi: number;
  primaryDosha: "vata" | "pitta" | "kapha";
  secondaryDosha?: "vata" | "pitta" | "kapha";
  conditions: string[];
  allergies: string[];
  adherenceScore: number;
  lastLogDate: string;
  dietPlan?: DietPlan;
  questionnaireCompleted: boolean;
}

export interface Food {
  id: string;
  name: string;
  category:
    | "grains"
    | "vegetables"
    | "fruits"
    | "proteins"
    | "dairy"
    | "spices"
    | "beverages";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ayurvedicProperties: {
    rasa: (
      | "sweet"
      | "sour"
      | "salty"
      | "pungent"
      | "bitter"
      | "astringent"
    )[];
    virya: "heating" | "cooling";
    vipaka: "sweet" | "sour" | "pungent";
    doshaEffect: {
      vata: "increases" | "decreases" | "neutral";
      pitta: "increases" | "decreases" | "neutral";
      kapha: "increases" | "decreases" | "neutral";
    };
  };
  seasonal: ("spring" | "summer" | "monsoon" | "autumn" | "winter")[];
  isVegetarian: boolean;
  isVegan: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: { foodId: string; quantity: number; unit: string }[];
  instructions: string[];
  servings: number;
  prepTime: number;
  cookTime: number;
  totalNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  ayurvedicBalance: {
    vata: number;
    pitta: number;
    kapha: number;
  };
  tags: string[];
}

export interface MealPlan {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  recipes: Recipe[];
  totalCalories: number;
  ayurvedicBalance: {
    vata: number;
    pitta: number;
    kapha: number;
  };
}

export interface DietPlan {
  id: string;
  patientId: string;
  startDate: string;
  endDate: string;
  meals: MealPlan[];
  objectives: string[];
  restrictions: string[];
  notes: string;
  generatedBy: string;
  aiReasoning?: string;
}

export interface ConsultationRequest {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  requestType: "consultation" | "follow-up" | "emergency";
  mode: "in-person" | "video-call" | "phone";
  urgency: "low" | "medium" | "high" | "emergency";
  message?: string;
  date: Date;
  status: "pending" | "accepted" | "rejected";
}

/* ----------------------------- Context Type ----------------------------- */

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  currentPatient: Patient | null;
  setCurrentPatient: (patient: Patient | null) => void;
  patients: Patient[];
  setPatients: (patients: Patient[]) => void;
  foods: Food[];
  recipes: Recipe[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  questionnaireCompleted: boolean | null;
  setQuestionnaireCompleted: (isCompleted: boolean) => void;
  /**
   * The signed-in patient's care pathways. Null while loading, and for
   * doctors; an empty array means general wellness. Decides which patient tabs
   * exist — see `src/lib/healthTrack.ts`.
   */
  healthTracks: HealthTracks | null;

  doctor: Doctor | null;
  setDoctor: (doctor: Doctor | null) => void;
  consultationRequests: ConsultationRequest[];
  setConsultationRequests: (requests: ConsultationRequest[]) => void;
}

/* ----------------------------- Context Setup ----------------------------- */

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [foods] = useState<Food[]>([]);
  const [recipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState<
    boolean | null
  >(null);
  const [healthTracks, setHealthTracks] = useState<HealthTracks | null>(null);

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [consultationRequests, setConsultationRequests] = useState<
    ConsultationRequest[]
  >([]);

  useEffect(() => {
    // TEMPORARY DEV-ONLY PREVIEW BYPASS — auth is OFF by default while this
    // block is in place, so the redesign can be reviewed without a real
    // Supabase login. Never runs in a production build (`import.meta.env.DEV`
    // is false there). Remove this whole block once real login is needed
    // again. Defaults to a fake patient session; set
    // localStorage["prakriva_preview_bypass"] = "doctor" to preview as a
    // doctor instead, or "off" to fall through to the real auth flow below.
    const previewRole = import.meta.env.DEV
      ? localStorage.getItem("prakriva_preview_bypass") ?? "patient"
      : "off";
    if (previewRole === "patient") {
      setUser({
        id: "preview-patient",
        name: "Preview Patient",
        email: "preview@example.com",
        role: "patient",
        avatar: resolveAvatar("preview-patient"),
      });
      setQuestionnaireCompleted(true);
      // Both tracks on, not [] — a preview should surface every track-gated
      // feature (Health Check, Period Tracker, Skin & Acne) at once, not
      // just the general-wellness baseline. A real patient can genuinely be
      // on both tracks simultaneously, so this isn't even a fake state.
      setHealthTracks(["pregnancy", "pcos"]);
      setIsLoading(false);
      return;
    }
    if (previewRole === "doctor") {
      setUser({
        id: "preview-doctor",
        name: "Preview Doctor",
        email: "preview@example.com",
        role: "doctor",
        avatar: resolveAvatar("preview-doctor"),
      });
      setDoctor({ id: "preview-doctor", name: "Preview Doctor", email: "preview@example.com", specialization: "General Ayurveda" });
      setIsLoading(false);
      return;
    }

    const clearSession = () => {
      setUser(null);
      setDoctor(null);
      setConsultationRequests([]);
      setQuestionnaireCompleted(null);
      setHealthTracks(null);
    };

    const loadSession = async (
      authUser:
        | { id: string; email?: string; user_metadata?: Record<string, unknown> }
        | null
    ) => {
      setIsLoading(true);

      if (!authUser) {
        clearSession();
        setIsLoading(false);
        return;
      }

      try {
        // profiles tells us which role this account signed up as, so we only
        // hit the table that can actually have a row.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profile?.role === "patient") {
          const { data } = await supabase
            .from("patients")
            .select("name, questionnaire_completed")
            .eq("id", authUser.id)
            .maybeSingle();

          setUser({
            id: authUser.id,
            name: data?.name || profile.name || "Patient",
            email: authUser.email || "",
            role: "patient",
            // The photo lives in auth metadata when it was uploaded, and in
            // this device's cache when storage wasn't available.
            avatar: resolveAvatar(
              authUser.id,
              authUser.user_metadata?.avatar_url as string | undefined
            ),
          });
          setQuestionnaireCompleted(Boolean(data?.questionnaire_completed));

          // Back-fill the tracks from signup metadata for accounts created
          // before the column existed (or signed up with email confirmation
          // on, where there was no session to write them with).
          const synced = await syncHealthTracksFromMetadata(
            authUser.id,
            authUser.user_metadata
          );
          setHealthTracks(synced ?? (await fetchHealthTracks(authUser.id)).tracks);
        } else if (profile?.role === "doctor") {
          const { data } = await supabase
            .from("doctors")
            .select("name, ayurvedic_specialization")
            .eq("id", authUser.id)
            .maybeSingle();

          const name = data?.name || profile.name || "Doctor";
          setDoctor({
            id: authUser.id,
            name,
            email: authUser.email || "",
            specialization: data?.ayurvedic_specialization?.[0] || "",
          });
          setUser({
            id: authUser.id,
            name,
            email: authUser.email || "",
            role: "doctor",
            avatar: resolveAvatar(
              authUser.id,
              authUser.user_metadata?.avatar_url as string | undefined
            ),
          });
          setQuestionnaireCompleted(null);
          setHealthTracks(null);

          const { data: requests } = await supabase
            .from("consultation_requests")
            .select(
              "id, patient_id, patient_name, doctor_id, request_type, preferred_consultation_mode, urgency, message, requested_at, status"
            )
            .eq("doctor_id", authUser.id);

          setConsultationRequests(
            (requests ?? []).map((r) => ({
              id: r.id,
              patientId: r.patient_id,
              patientName: r.patient_name,
              doctorId: r.doctor_id,
              requestType: r.request_type,
              mode: r.preferred_consultation_mode,
              urgency: r.urgency,
              message: r.message ?? undefined,
              date: new Date(r.requested_at),
              status: r.status,
            })) as ConsultationRequest[]
          );
        } else {
          clearSession();
        }
      } catch (error) {
        console.error("Error fetching user or requests:", error);
        clearSession();
      }

      setIsLoading(false);
    };

    // Track the current user id so we can skip redundant reloads.
    let currentUid: string | null = null;

    supabase.auth.getSession().then(({ data }) => {
      currentUid = data.session?.user?.id ?? null;
      void loadSession(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUid = session?.user?.id ?? null;

      // Supabase fires TOKEN_REFRESHED every time the tab regains focus.
      // The session is the same user — skip the full reload that sets
      // isLoading=true, re-fetches every table and flashes the spinner.
      if (event === "TOKEN_REFRESHED" && newUid === currentUid) return;

      currentUid = newUid;
      void loadSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AppContextType = {
    user,
    setUser,
    currentPatient,
    setCurrentPatient,
    patients,
    setPatients,
    foods,
    recipes,
    isLoading,
    setIsLoading,
    questionnaireCompleted,
    setQuestionnaireCompleted,
    healthTracks,
    doctor,
    setDoctor,
    consultationRequests,
    setConsultationRequests,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
