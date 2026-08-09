/**
 * Authentication for both roles (doctor and patient).
 *
 * Every Supabase auth call the login/signup screen makes lives here, along
 * with the two decisions that follow a successful call: which role the account
 * has, and which route that role lands on. Keeping them out of the component
 * means the rules are testable without rendering a form.
 *
 * Signup writes the role — and, for doctors, their claimed credentials — into
 * auth user metadata. The `on_auth_user_created` Postgres trigger reads that
 * metadata and creates `public.profiles` plus the matching `doctors`/`patients`
 * row, so the profile exists even when email confirmation means there is no
 * session yet.
 *
 * That metadata is entirely client-controlled, so it carries claims only. The
 * trigger deliberately ignores anything resembling a verification result and
 * starts every doctor at `pending`; see `supabase/doctor_verification.sql`.
 */
import { supabase } from "@/lib/supabase";
import type { DoctorVerificationData } from "@/lib/licenseVerification";

export type AuthRole = "doctor" | "patient";

export interface RoleLookupResult {
  role: AuthRole | null;
  hasCompletedQuestionnaire?: boolean;
}

export interface SignUpParams {
  role: AuthRole;
  name: string;
  email: string;
  password: string;
  /** Required for doctors, ignored for patients. */
  verification?: DoctorVerificationData;
}

export interface SignUpResult {
  userId: string | null;
  /** Null when email confirmation is on — there is nothing to route with yet. */
  hasSession: boolean;
  /** Patient code (P001, ...) assigned by the sequence default, when readable. */
  patientCode?: string | null;
}

/** Raised when signup hits an email that already has an account. */
export class EmailAlreadyRegisteredError extends Error {
  constructor(message = "An account with this email already exists.") {
    super(message);
    this.name = "EmailAlreadyRegisteredError";
  }
}

const isAlreadyRegistered = (message: string): boolean => {
  const msg = message.toLowerCase();
  return msg.includes("already registered") || msg.includes("already been registered");
};

/**
 * Build the auth metadata the `on_auth_user_created` trigger consumes.
 * Exported so tests can assert the doctor payload without a network call.
 *
 * Credentials the applicant states about themselves only. The browser-side
 * license lookup, its resulting score and its badge are deliberately *not*
 * sent: the database ignores them, and including them would suggest the client
 * has a say in whether an account is trusted. Verification is granted
 * server-side through `public.verify_doctor()`.
 */
export const buildSignupMetadata = ({
  role,
  name,
  verification,
}: Pick<SignUpParams, "role" | "name" | "verification">): Record<string, unknown> => {
  const metadata: Record<string, unknown> = { role, name };

  if (role !== "doctor" || !verification) return metadata;

  return {
    ...metadata,
    licenseNumber: verification.licenseNumber,
    medicalCouncil: verification.medicalCouncil,
    graduationYear: parseInt(verification.graduationYear, 10) || 0,
    medicalDegree: verification.medicalDegree,
    ayurvedicCertification: verification.ayurvedicCertification,
    ayurvedicSpecialization: verification.ayurvedicSpecialization,
    traditionalTraining: verification.traditionalTraining,
    clinicName: verification.clinicName,
    clinicAddress: verification.clinicAddress,
    yearsOfExperience: parseInt(verification.yearsOfExperience, 10) || 0,
    consultationFee: verification.consultationFee,
    languages: verification.languages,
    specialConditions: verification.specialConditions,
    consultationModes: verification.consultationModes,
  };
};

/**
 * Create an account for either role.
 *
 * Throws `EmailAlreadyRegisteredError` for a taken email so the caller can
 * flip the form back to sign-in rather than showing a generic failure.
 */
export const signUpUser = async ({
  role,
  name,
  email,
  password,
  verification,
}: SignUpParams): Promise<SignUpResult> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: buildSignupMetadata({ role, name, verification }) },
  });

  if (error) {
    if (isAlreadyRegistered(error.message)) {
      throw new EmailAlreadyRegisteredError(
        "An account with this email already exists. Please sign in instead or use a different email."
      );
    }
    throw error;
  }

  const userId = data.user?.id ?? null;
  const hasSession = Boolean(data.session);

  // Without a session the trigger's row is not readable yet, so skip the
  // patient-code read rather than reporting a missing code.
  if (role !== "patient" || !userId || !hasSession) {
    return { userId, hasSession };
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("patient_code")
    .eq("id", userId)
    .maybeSingle();

  return { userId, hasSession, patientCode: patientRow?.patient_code ?? null };
};

/** Sign in an existing account. Returns the auth user id. */
export const signInUser = async (email: string, password: string): Promise<string | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user?.id ?? null;
};

/**
 * Resolve an account's role from `public.profiles`, retrying because the
 * `on_auth_user_created` trigger can land just after the first read on a
 * fresh signup.
 */
export const getUserRole = async (
  uid: string,
  { maxRetries = 3, retryDelayMs = 1000 }: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<RoleLookupResult> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;

      if (profile?.role === "doctor") return { role: "doctor" };

      if (profile?.role === "patient") {
        const { data: patient } = await supabase
          .from("patients")
          .select("questionnaire_completed")
          .eq("id", uid)
          .maybeSingle();

        return {
          role: "patient",
          hasCompletedQuestionnaire: Boolean(patient?.questionnaire_completed),
        };
      }
    } catch (error) {
      console.error(`Error fetching user role (attempt ${attempt + 1}):`, error);
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * retryDelayMs));
    }
  }

  return { role: null };
};

/**
 * Where an authenticated user belongs. Patients must clear the questionnaire
 * before the rest of the app; a brand new signup never has.
 */
export const resolveDashboardPath = (
  role: AuthRole | null,
  hasCompletedQuestionnaire?: boolean,
  isNewSignup = false
): string => {
  if (role === "doctor") return "/doctor/dashboard";
  if (role === "patient") {
    return isNewSignup || !hasCompletedQuestionnaire
      ? "/patient/questionnaire"
      : "/patient/dashboard";
  }
  return "/";
};

/**
 * Turn a Supabase auth failure into something worth showing a user. Supabase
 * reports these as message text rather than stable error codes, so match on
 * the message.
 */
export const describeAuthError = (error: unknown): string => {
  if (!(error instanceof Error)) return "An unexpected error occurred";

  const msg = error.message.toLowerCase();

  if (msg.includes("invalid login credentials"))
    return "Invalid credentials. Please check your email and password.";
  if (isAlreadyRegistered(msg))
    return "An account with this email already exists. Please sign in instead.";
  if (msg.includes("password should be") || msg.includes("password is too short"))
    return "Password should be at least 6 characters long.";
  if (msg.includes("invalid email") || msg.includes("unable to validate email"))
    return "Please enter a valid email address.";
  if (msg.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (msg.includes("failed to fetch") || msg.includes("network"))
    return "Network error. Please check your connection and try again.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many failed attempts. Please try again later.";
  if (msg.includes("banned") || msg.includes("disabled"))
    return "This account has been disabled. Please contact support.";

  return error.message;
};
