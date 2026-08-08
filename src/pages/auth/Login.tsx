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

  const isDoctorSignup = isSignup && role === "doctor";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

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
      setCurrentStep((step) => Math.min(step + 1, TOTAL_DOCTOR_STEPS));
    }
  };

  const handleBack = () => setCurrentStep((step) => Math.max(step - 1, 1));

  const resetForm = () => {
    setCurrentStep(1);
    setFormData(emptyFormData());
    setVerificationData(emptyVerificationData());
    setVerificationResult(null);
  };

  const handleSignup = async () => {
    const result = await signUpUser({
      role: role!,
      name: formData.name,
      email: formData.email,
      password: formData.password,
      verification: role === "doctor" ? verificationData : undefined,
    });

    if (!result.hasSession) {
      // Email confirmation is on, so there is no session to route with.
      toast.success("Account created! Check your email to confirm your address, then sign in.");
      setIsSignup(false);
      resetForm();
      return;
    }

    if (role === "doctor") {
      toast.success(
        verificationData.licenseVerified
          ? "Verified doctor account created successfully!"
          : "Account created! Please complete license verification to accept patients."
      );
    } else {
      toast.success(
        result.patientCode
          ? `Patient account created successfully! Your Patient ID: ${result.patientCode}`
          : "Patient account created successfully!"
      );
    }

    navigate(resolveDashboardPath(role!, undefined, true), { replace: true });
  };

  const handleSignin = async () => {
    const userId = await signInUser(formData.email, formData.password);
    toast.success("Welcome back!");

    // Route by the role on the account, not the role in the URL — the same
    // credentials land in the same place whichever door they signed in through.
    const { role: userRole, hasCompletedQuestionnaire } = await getUserRole(userId!);

    if (!userRole) {
      toast.error("Could not determine account type. Please contact support.");
      navigate("/", { replace: true });
      return;
    }

    navigate(resolveDashboardPath(userRole, hasCompletedQuestionnaire), { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting.current) return;
    isSubmitting.current = true;

    if (isDoctorSignup && !validateStep(TOTAL_DOCTOR_STEPS)) {
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
        setIsSignup(false);
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center mb-2">
            <Logo size="xl" />
          </CardTitle>
          <CardDescription>
            {isSignup ? "Create your account" : "Sign in to your account"} as a{" "}
            <span className="font-semibold capitalize text-green-600">{role}</span>
            {/* A block element here would be invalid — CardDescription is a <p>. */}
            {isDoctorSignup && (
              <span className="mt-2 block text-xs text-gray-500">
                Step {currentStep} of {TOTAL_DOCTOR_STEPS}
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isDoctorSignup && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  {STEP_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / TOTAL_DOCTOR_STEPS) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {isDoctorSignup ? (
              <>
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

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isLoading}
                  >
                    Back
                  </Button>

                  {currentStep < TOTAL_DOCTOR_STEPS ? (
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
                className="text-sm text-green-600 hover:text-green-700 underline"
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
