import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { supabase } from "@/lib/supabase";

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

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [consultationRequests, setConsultationRequests] = useState<
    ConsultationRequest[]
  >([]);

  useEffect(() => {
    const clearSession = () => {
      setUser(null);
      setDoctor(null);
      setConsultationRequests([]);
      setQuestionnaireCompleted(null);
    };

    const loadSession = async (authUser: { id: string; email?: string } | null) => {
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
          });
          setQuestionnaireCompleted(Boolean(data?.questionnaire_completed));
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
          setUser({ id: authUser.id, name, email: authUser.email || "", role: "doctor" });
          setQuestionnaireCompleted(null);

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

    supabase.auth.getSession().then(({ data }) => {
      void loadSession(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    doctor,
    setDoctor,
    consultationRequests,
    setConsultationRequests,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
