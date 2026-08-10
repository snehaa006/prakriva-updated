import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { I18nProvider } from "@/context/I18nContext";
import { FoodProvider } from "@/context/FoodContext";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import DoctorLayout from "./components/layout/DoctorLayout";
import PatientLayout from "./components/layout/PatientLayout";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import PatientDashboard from "./pages/patient/PatientDashboard";
import MealLogging from "./pages/patient/MealLogging";
import FoodCompatibility from "./pages/patient/FoodCompatibility";
import SymptomTracking from "./pages/patient/SymptomTracking";
import LifestyleTracker from "./pages/patient/LifestyleTracker";
import Community from "./pages/patient/Community";
import AddPatient from "./pages/doctor/AddPatient";
import Patients from "./pages/doctor/Patients";
import AppointmentScheduler from "./pages/doctor/AppointmentScheduler";
import PatientAlerts from "./pages/doctor/PatientAlerts";
import CommunicationPortal from "./pages/doctor/CommunicationPortal";
import PatientFeedback from "./pages/doctor/PatientFeedback";
import TeamManagement from "./pages/doctor/TeamManagement";
import FoodExplorer from "./pages/doctor/FoodExplorer";
import RecipeBuilder from "./pages/doctor/RecipeBuilder";
import DietChart from "./pages/doctor/DietChart";
import DiseaseDetection from "./pages/doctor/DiseaseDetection";
import HealthRisks from "./pages/patient/HealthRisks";
import NotFound from "./pages/NotFound";
import Questionnaire from "./pages/patient/Questionnaire";
import PeriodTracker from "./pages/patient/PeriodTracker";
import SkinTracker from "./pages/patient/SkinTracker";
import TrackerHub from "./pages/patient/TrackerHub";
import {
  requiresQuestionnaire,
  showsCycleTracking,
  showsDiseaseDetection,
  type HealthTracks,
} from "@/lib/healthTrack";
import PatientProfile from "./pages/patient/PatientProfile";
import Reminders from "./pages/patient/Reminders";
import Pantry from "./pages/patient/Pantry";
import Settings from "./pages/patient/Settings";
import DoctorProfile from "./pages/doctor/DoctorProfile";
import ConsultDoctor from "./components/ConsultDoctor";

// Shared cache for every `useQuery` in the app. The defaults matter: without
// them React Query refetches on every mount and window focus, which is what
// made lists appear to "reset" when moving between pages.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// --- Loading Component ---
const LoadingScreen = ({ message = "Loading..." }: { message?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
      <p className="mt-4 text-gray-600 text-lg">{message}</p>
    </div>
  </div>
);

// --- Protected Routes ---
const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "doctor" | "patient";
}) => {
  const { user, isLoading } = useApp();

  if (isLoading) return <LoadingScreen message="Verifying authentication..." />;
  if (!user) return <Navigate to="/" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const PatientProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, questionnaireCompleted, healthTracks, isLoading } = useApp();

  if (isLoading) return <LoadingScreen message="Loading your profile..." />;
  if (!user || user.role !== "patient") return <Navigate to="/" replace />;
  // Tracks decide whether the questionnaire is a gate at all, so a redirect
  // taken before they resolve would bounce a PCOD/PCOS patient to the very
  // form she is exempt from. Wait, as `TrackRoute` does.
  if (healthTracks === null) return <LoadingScreen message="Loading your profile..." />;
  if (requiresQuestionnaire(healthTracks) && !questionnaireCompleted)
    return <Navigate to="/patient/questionnaire" replace />;

  return <>{children}</>;
};

/**
 * A patient route that only exists on some care pathways.
 *
 * The sidebar already hides these, but a bookmarked or hand-typed URL would
 * otherwise still render them — a patient who is not pregnant landing on the
 * maternal health check would be screened for conditions her answers were
 * never about, which is worse than a redirect. Sends her to her dashboard
 * instead.
 */
const TrackRoute = ({
  allow,
  children,
}: {
  allow: (tracks: HealthTracks) => boolean;
  children: React.ReactNode;
}) => {
  const { healthTracks } = useApp();

  // Still resolving — show the loader rather than flashing the page or
  // bouncing a patient who does belong here.
  if (healthTracks === null) return <LoadingScreen message="Loading your profile..." />;
  if (!allow(healthTracks)) return <Navigate to="/patient/dashboard" replace />;

  return <>{children}</>;
};

// --- Auth Redirect ---
const AuthRedirect = () => {
  const { user, questionnaireCompleted, healthTracks, isLoading } = useApp();

  if (isLoading) return <LoadingScreen message="Setting up your dashboard..." />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "doctor") return <Navigate to="/doctor/dashboard" replace />;
  if (user.role === "patient") {
    if (healthTracks === null)
      return <LoadingScreen message="Setting up your dashboard..." />;
    if (requiresQuestionnaire(healthTracks) && !questionnaireCompleted)
      return <Navigate to="/patient/questionnaire" replace />;
    return <Navigate to="/patient/dashboard" replace />;
  }
  return <Navigate to="/" replace />;
};

// --- App Routes ---
const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/auth/:role" element={<Login />} />
    <Route path="/redirect" element={<AuthRedirect />} />

    {/* Doctor Routes */}
    <Route
      path="/doctor"
      element={
        <ProtectedRoute requiredRole="doctor">
          <DoctorLayout />
        </ProtectedRoute>
      }
    >
      <Route path="dashboard" element={<DoctorDashboard />} />
      <Route path="patients" element={<Patients />} />
      <Route path="add-patient" element={<AddPatient />} />
      <Route path="appointments" element={<AppointmentScheduler />} />
      <Route path="alerts" element={<PatientAlerts />} />
      <Route path="patient-analysis" element={<DiseaseDetection />} />
      {/* Legacy path kept so existing links/bookmarks still resolve. */}
      <Route path="disease-detection" element={<DiseaseDetection />} />
      <Route path="communication" element={<CommunicationPortal />} />
      <Route path="feedback" element={<PatientFeedback />} />
      <Route path="team" element={<TeamManagement />} />
      <Route path="food-explorer" element={<FoodExplorer />} />
      <Route path="recipes" element={<RecipeBuilder />} />
      <Route path="diet-charts" element={<DietChart />} />
      <Route path="personalized-diet" element={<Navigate to="/doctor/recipes" replace />} />
      <Route path="profile" element={<DoctorProfile />} />
      <Route path="consult-doctor" element={<ConsultDoctor />} />
      <Route path="settings" element={<div className="p-6">Settings - Coming Soon</div>} />
      <Route index element={<Navigate to="/doctor/dashboard" replace />} />
    </Route>

    {/* Patient Routes */}
    <Route path="/patient">
      {/* Questionnaire route accessible to any authenticated patient */}
      <Route
        path="questionnaire"
        element={
          <ProtectedRoute requiredRole="patient">
            <Questionnaire />
          </ProtectedRoute>
        }
      />

      {/* Other patient routes require completed questionnaire */}
      <Route
        element={
          <PatientProtectedRoute>
            <PatientLayout />
          </PatientProtectedRoute>
        }
      >
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="meal-logging" element={<MealLogging />} />
        <Route path="food-compatibility" element={<FoodCompatibility />} />
        {/* <Route path="symptom-tracking" element={<SymptomTracking />} /> */}
        <Route
          path="health-check"
          element={
            <TrackRoute allow={showsDiseaseDetection}>
              <HealthRisks />
            </TrackRoute>
          }
        />
        <Route
          path="period-tracker"
          element={
            <TrackRoute allow={showsCycleTracking}>
              <PeriodTracker />
            </TrackRoute>
          }
        />
        <Route
          path="skin-tracker"
          element={
            <TrackRoute allow={showsCycleTracking}>
              <SkinTracker />
            </TrackRoute>
          }
        />
        <Route path="tracker" element={<TrackerHub />} />
        {/* Kept as deep links (e.g. from Reminders); day-to-day nav now goes through the "Track" hub above. */}
        <Route path="lifestyle-tracker" element={<LifestyleTracker />} />
        <Route path="community" element={<Community />} />
        {/* Social Support was replaced by Community; keep old links working. */}
        <Route path="social-support" element={<Navigate to="/patient/community" replace />} />
        <Route path="consult-doctor" element={<ConsultDoctor />} />
        <Route path="doctor-profile/:doctorId" element={<div className="p-6">Doctor Profile - Coming Soon</div>} />
        <Route path="meal-plan" element={<div className="p-6">Meal Plan - Coming Soon</div>} />
        <Route path="progress" element={<div className="p-6">Progress Tracking - Coming Soon</div>} />
        <Route path="wellness" element={<div className="p-6">Wellness Tips - Coming Soon</div>} />
        <Route path="pantry" element={<Pantry />} />
        <Route path="shopping" element={<Navigate to="/patient/pantry" replace />} />
        <Route path="appointments" element={<AppointmentScheduler/>} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="profile" element={<PatientProfile />} />
        <Route path="settings" element={<Settings />} />
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
      </Route>
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// --- App ---
const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
        <TooltipProvider>
          <AppProvider>
            <FoodProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </FoodProvider>
          </AppProvider>
        </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
