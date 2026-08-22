import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import AccountFields, { type AccountFormData } from "./AccountFields";
import DoctorSignupSteps from "./DoctorSignupSteps";
import PatientSignupSteps from "./PatientSignupSteps";
import {
  PATIENT_SIGNUP_STEPS,
  PATIENT_STEP_LABELS,
  emptyTrackDetails,
} from "./patientTrackOptions";
import type { HealthTracks } from "@/lib/healthTrack";
import type { TrackSignupDetails } from "@/services/healthTrackService";
import {
  emptyVerificationData,
  verifyLicense,
  type DoctorVerificationData,
  type VerificationResult,
} from "@/lib/licenseVerification";
import {
  EmailAlreadyRegisteredError,
  describeAuthError,
  getUserRole,
  resolveDashboardPath,
  signInUser,
  signOutUser,
  signUpUser,
  type AuthRole,
} from "@/services/authService";

const TOTAL_DOCTOR_STEPS = 4;
const STEP_LABELS = ["Basic Info", "License", "Expertise", "Practice"];

const emptyFormData = (): AccountFormData => ({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
});

/**
 * Combined sign-in / sign-up screen for both roles, mounted at `/auth/:role`.
 *
 * Patients get a single form. Doctors get a four-step wizard that collects
 * credentials, license verification, Ayurvedic expertise and practice details.
 * The auth calls themselves live in `@/services/authService`, and the license
 * rules in `@/lib/licenseVerification`.
 */
const Login = () => {
  const { role } = useParams<{ role: AuthRole }>();
  const navigate = useNavigate();
  // Guards against a double submit landing two signup requests.
  const isSubmitting = useRef(false);

  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const [formData, setFormData] = useState<AccountFormData>(emptyFormData);
  const [verificationData, setVerificationData] =
    useState<DoctorVerificationData>(emptyVerificationData);

  // Which care pathways a patient is signing up for, and the answers those
  // pathways ask for. A set rather than one value — pregnancy and PCOS
  // routinely coexist. Null means she has not answered yet; an empty array is
  // an answer (general wellness). Doctors never see these.
  const [healthTracks, setHealthTracks] = useState<HealthTracks | null>(null);
  const [trackDetails, setTrackDetails] = useState<TrackSignupDetails>(emptyTrackDetails);

  const isDoctorSignup = isSignup && role === "doctor";
  const isPatientSignup = isSignup && role === "patient";
  const isWizard = isDoctorSignup || isPatientSignup;
  const totalSteps = isDoctorSignup ? TOTAL_DOCTOR_STEPS : PATIENT_SIGNUP_STEPS;
  const stepLabels = isDoctorSignup ? STEP_LABELS : PATIENT_STEP_LABELS;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTrackDetailChange = (
    field: keyof TrackSignupDetails,
    value: string | string[]
  ) => setTrackDetails((prev) => ({ ...prev, [field]: value }));

  const handleVerificationChange = (field: keyof DoctorVerificationData, value: unknown) => {
    setVerificationData((prev) => {
      const next = { ...prev, [field]: value };
      // Editing either half of the license identity invalidates the last check.
      if (field === "licenseNumber" || field === "medicalCouncil") {
        next.licenseVerified = false;
        next.verificationDetails = undefined;
      }
      return next;
    });

    if (field === "licenseNumber" || field === "medicalCouncil") {
      setVerificationResult(null);
    }
  };

  const handleArrayFieldChange = (
    field: keyof DoctorVerificationData,
    value: string,
    checked: boolean
  ) => {
    setVerificationData((prev) => {
      const current = prev[field] as string[];
      return {
        ...prev,
        [field]: checked ? [...current, value] : current.filter((item) => item !== value),
      };
    });
  };

  const handleVerifyLicense = async () => {
    if (!verificationData.licenseNumber || !verificationData.medicalCouncil) {
      toast.error("Please enter license number and select medical council");
      return;
    }

    setIsVerifyingLicense(true);
    setVerificationResult(null);

    try {
      const result = await verifyLicense(
        verificationData.licenseNumber,
        verificationData.medicalCouncil
      );

      setVerificationResult(result);
      setVerificationData((prev) => ({
        ...prev,
        licenseVerified: result.isValid,
        verificationDetails: result,
      }));

      if (result.isValid) {
        toast.success("License verified successfully!");
        // Prefill the name from the registry only if the doctor left it blank.
        if (result.doctorName && !formData.name) {
          setFormData((prev) => ({ ...prev, name: result.doctorName || "" }));
        }
      } else {
        toast.error(result.error || "License verification failed");
      }
    } catch {
      setVerificationResult({
        isValid: false,
        error: "Verification service temporarily unavailable. Please try again.",
      });
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsVerifyingLicense(false);
    }
  };

  /** Validate the current wizard step, reporting the first missing field. */
  const validateStep = (step: number): boolean => {
    if (isPatientSignup && step === 2) {
      if (healthTracks === null) {
        toast.error("Please choose what you're here for");
        return false;
      }
      if (healthTracks.includes("pcos") && !trackDetails.diagnosisStatus) {
        toast.error("Please tell us whether PCOD/PCOS has been diagnosed");
        return false;
      }
      return true;
    }

    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        toast.error("Please fill in all required fields");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords don't match");
        return false;
      }
      return true;
    }

    const requiredByStep: Record<number, (keyof DoctorVerificationData)[]> = {
      2: ["licenseNumber", "medicalCouncil", "graduationYear", "medicalDegree"],
      3: ["yearsOfExperience"],
      4: ["clinicName"],
    };

    for (const field of requiredByStep[step] ?? []) {
      if (!verificationData[field]) {
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return false;
      }
    }

    if (step === 2 && !verificationData.licenseVerified) {
      toast.error("Please verify your medical license before proceeding");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((step) => Math.min(step + 1, totalSteps));
    }
  };

  const handleBack = () => setCurrentStep((step) => Math.max(step - 1, 1));

  const resetForm = () => {
    setCurrentStep(1);
    setFormData(emptyFormData());
    setVerificationData(emptyVerificationData());
    setVerificationResult(null);
    setHealthTracks(null);
    setTrackDetails(emptyTrackDetails());
  };

  const handleSignup = async () => {
    const result = await signUpUser({
      role: role!,
      name: formData.name,
      email: formData.email,
      password: formData.password,
      verification: role === "doctor" ? verificationData : undefined,
      healthTracks: role === "patient" ? healthTracks ?? undefined : undefined,
      trackDetails: role === "patient" ? trackDetails : undefined,
    });

    if (!result.hasSession) {
      // Email confirmation is on, so there is no session to route with.
      toast.success("Account created! Check your email to confirm your address, then sign in.");
      setIsSignup(false);
      resetForm();
      return;
    }

    if (role === "doctor") {
      // Signing up never grants verified status — the licence claim still has
      // to be approved server-side before the account can take patients.
      toast.success(
        verificationData.licenseVerified
          ? "Account created! Your licence is pending review — you can accept patients once it is approved."
          : "Account created! Please complete license verification to accept patients."
      );
    } else {
      toast.success(
        result.patientCode
          ? `Patient account created successfully! Your Patient ID: ${result.patientCode}`
          : "Patient account created successfully!"
      );
    }

    // The tracks she just picked, so a PCOD/PCOS signup lands on her dashboard
    // rather than the questionnaire she has effectively just answered.
    navigate(
      resolveDashboardPath(
        role!,
        undefined,
        true,
        role === "patient" ? healthTracks : null
      ),
      { replace: true }
    );
  };

  const handleSignin = async () => {
    const userId = await signInUser(formData.email, formData.password);

    const {
      role: userRole,
      hasCompletedQuestionnaire,
      healthTracks: tracks,
    } = await getUserRole(userId!);

    if (!userRole) {
      await signOutUser();
      toast.error("Could not determine account type. Please contact support.");
      navigate("/", { replace: true });
      return;
    }

    // Reject a role mismatch: a doctor signing in on the patient page (or
    // vice versa) should not silently land on the other dashboard.
    if (role && userRole !== role) {
      await signOutUser();
      toast.error(
        userRole === "doctor"
          ? "This is a doctor account. Please sign in on the practitioner page."
          : "This is a patient account. Please sign in on the patient page.",
      );
      return;
    }

    toast.success("Welcome back!");
    navigate(resolveDashboardPath(userRole, hasCompletedQuestionnaire, false, tracks), {
      replace: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting.current) return;
    isSubmitting.current = true;

    if (isWizard && !validateStep(totalSteps)) {
      isSubmitting.current = false;
      return;
    }

    if (isSignup && formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      isSubmitting.current = false;
      return;
    }

    setIsLoading(true);

    try {
      if (isSignup) {
        await handleSignup();
      } else {
        await handleSignin();
      }
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        // Drop her on the sign-in form with her email already filled in, and
        // clear the password she picked for an account that was never created
        // — leaving it there invites her to submit it as her existing one.
        setIsSignup(false);
        setCurrentStep(1);
        setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
      }
      toast.error(describeAuthError(error));
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  };

  const toggleMode = () => {
    setIsSignup((prev) => !prev);
    resetForm();
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(700px 500px at 25% 30%, hsl(158, 38%, 28% / 0.06) 0%, transparent 55%), radial-gradient(500px 400px at 80% 65%, hsl(20, 90%, 52% / 0.04) 0%, transparent 50%)",
        }}
      />
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center mb-2">
            <span className="flex flex-col items-center gap-3 text-primary">
              <Logo size="lg" alt="" />
              <Logo variant="wordmark" alt="Prakriva" className="h-6" />
            </span>
          </CardTitle>
          <CardDescription>
            {isSignup ? "Create your account" : "Sign in to your account"} as a{" "}
            <span className="font-semibold capitalize text-primary">{role}</span>
            {/* A block element here would be invalid — CardDescription is a <p>. */}
            {isWizard && (
              <span className="mt-2 block text-caption1 text-muted-foreground">
                Step {currentStep} of {totalSteps}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isWizard && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-caption1 text-muted-foreground mb-2">
                  {stepLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-ios"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {isWizard ? (
              <>
                {isDoctorSignup ? (
                  <DoctorSignupSteps
                    step={currentStep}
                    formData={formData}
                    onFormChange={handleInputChange}
                    verificationData={verificationData}
                    onVerificationChange={handleVerificationChange}
                    onArrayFieldChange={handleArrayFieldChange}
                    onVerifyLicense={handleVerifyLicense}
                    isVerifyingLicense={isVerifyingLicense}
                    verificationResult={verificationResult}
                    isLoading={isLoading}
                  />
                ) : (
                  <PatientSignupSteps
                    step={currentStep}
                    formData={formData}
                    onFormChange={handleInputChange}
                    tracks={healthTracks}
                    onTracksChange={setHealthTracks}
                    details={trackDetails}
                    onDetailChange={handleTrackDetailChange}
                    isLoading={isLoading}
                  />
                )}

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isLoading}
                  >
                    Back
                  </Button>

                  {currentStep < totalSteps ? (
                    <Button type="button" onClick={handleNext} disabled={isLoading}>
                      Next
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <AccountFields
                  values={formData}
                  onChange={handleInputChange}
                  isSignup={isSignup}
                  disabled={isLoading}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isSignup ? "Creating Account..." : "Signing In..."}
                    </>
                  ) : isSignup ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </>
            )}

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-primary hover:text-primary/80 underline"
                disabled={isLoading}
              >
                {isSignup
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
