/**
 * Doctor license verification and profile scoring.
 *
 * This is the domain layer behind the doctor signup flow: license number
 * formats per medical council, the (currently mocked) registry lookup, and
 * the profile completeness score that drives the verification badge.
 *
 * There is no real council API yet — `verifyLicense` resolves against
 * `MOCK_LICENSE_REGISTRY`. When a real integration lands, only this file
 * changes; the signup UI already treats it as an async lookup that can fail.
 *
 * **Nothing here confers verified status.** Everything in this module runs in
 * the browser, so a result from `verifyLicense` is a claim the applicant is
 * making, not evidence. `supabase/doctor_verification.sql` ignores whatever
 * the client reports and starts every new doctor at `pending`; only
 * `public.verify_doctor()`, called with the service role after a real council
 * check, can flip a doctor to verified. Treat these helpers as form
 * validation and a completeness hint — never as authorisation.
 *
 * `calculateVerificationScore` / `getVerificationBadge` are mirrored in SQL as
 * `public.doctor_profile_score()` / `public.doctor_badge()`, which compute the
 * values actually stored. Change the weights in both places or the badge a
 * patient sees will drift from the one the form previews.
 */

export type MedicalCouncil = "mci" | "nmc" | "state-council" | "ayush";

export interface VerificationResult {
  isValid: boolean;
  doctorName?: string;
  registrationDate?: string;
  status?: "active" | "suspended" | "expired";
  council?: string;
  error?: string;
}

export interface DoctorVerificationData {
  licenseNumber: string;
  medicalCouncil: string;
  graduationYear: string;
  medicalDegree: string;
  ayurvedicCertification: string;
  ayurvedicSpecialization: string[];
  traditionalTraining: string;
  clinicName: string;
  clinicAddress: string;
  yearsOfExperience: string;
  consultationFee: string;
  languages: string[];
  specialConditions: string[];
  consultationModes: string[];
  licenseVerified: boolean;
  verificationDetails?: VerificationResult;
}

/** A blank doctor verification payload — used to seed and to reset the form. */
export const emptyVerificationData = (): DoctorVerificationData => ({
  licenseNumber: "",
  medicalCouncil: "",
  graduationYear: "",
  medicalDegree: "",
  ayurvedicCertification: "",
  ayurvedicSpecialization: [],
  traditionalTraining: "",
  clinicName: "",
  clinicAddress: "",
  yearsOfExperience: "",
  consultationFee: "",
  languages: [],
  specialConditions: [],
  consultationModes: [],
  licenseVerified: false,
});

/** How long the mocked registry lookup pretends to take. */
export const SIMULATED_VERIFICATION_LATENCY_MS = 2000;

const LICENSE_PATTERNS: Record<MedicalCouncil, RegExp> = {
  mci: /^[A-Z]{2}\d{8}$/,
  nmc: /^NMC\/\d{10}$/,
  "state-council": /^[A-Z]{2}\/\d{6,8}$/,
  ayush: /^AYU\/[A-Z]{2}\/\d{6}$/,
};

const LICENSE_FORMAT_HINTS: Record<MedicalCouncil, string> = {
  mci: "Format: AA12345678 (State code + 8 digits)",
  nmc: "Format: NMC/1234567890",
  "state-council": "Format: AA/123456 (State code/6-8 digits)",
  ayush: "Format: AYU/AA/123456 (AYU/State/6 digits)",
};

export const MEDICAL_COUNCILS: { value: MedicalCouncil; label: string }[] = [
  { value: "mci", label: "Medical Council of India (MCI)" },
  { value: "nmc", label: "National Medical Commission (NMC)" },
  { value: "state-council", label: "State Medical Council" },
  { value: "ayush", label: "AYUSH Ministry" },
];

export const MEDICAL_DEGREES: { value: string; label: string }[] = [
  { value: "mbbs", label: "MBBS" },
  { value: "bams", label: "BAMS (Bachelor of Ayurvedic Medicine)" },
  { value: "md", label: "MD" },
  { value: "ms", label: "MS" },
  { value: "bums", label: "BUMS" },
  { value: "bhms", label: "BHMS" },
];

/**
 * Stand-in for the council registries. Keyed by license number; the council
 * only decides which format the number has to match.
 *
 * The AYUSH entries mirror the seeded demo doctors in
 * `supabase/demo_doctors.sql` so the signup flow can be exercised end to end.
 * All of them are fictional practitioners: the councils and registration
 * formats are real, the people and numbers are not.
 *
 * Ayurvedic practitioners (BAMS/MD) register under the Ministry of AYUSH and
 * their state Board of Indian Medicine, so those are the AYU/… entries. The
 * MCI and NMC formats below cover an applicant holding an allopathic
 * registration and exist mainly to exercise the other format branches.
 */
export const MOCK_LICENSE_REGISTRY: Record<string, VerificationResult> = {
  "AYU/MH/104627": {
    isValid: true,
    doctorName: "Dr. Rajesh Kumar",
    registrationDate: "2013-09-12",
    status: "active",
    council: "Maharashtra Council of Indian Medicine",
  },
  "AYU/KA/143852": {
    isValid: true,
    doctorName: "Dr. Priya Sharma",
    registrationDate: "2011-08-19",
    status: "active",
    council: "Karnataka Ayurvedic and Unani Practitioners' Board",
  },
  "AYU/KL/207431": {
    isValid: true,
    doctorName: "Dr. Meera Nair",
    registrationDate: "2012-07-05",
    status: "active",
    council: "Kerala Ayurveda Medical Council",
  },
  "GJ/224180": {
    isValid: true,
    doctorName: "Dr. Anita Desai",
    registrationDate: "2015-02-27",
    status: "active",
    council: "Gujarat Board of Ayurvedic and Unani Systems of Medicine",
  },
  "NMC/2022001234": {
    isValid: true,
    doctorName: "Dr. Rohit Joshi",
    registrationDate: "2022-02-14",
    status: "active",
    council: "National Medical Commission",
  },
  // Resolves, but not to a usable registration — exercises the rejected path.
  MH12345678: {
    isValid: false,
    doctorName: "Dr. Sunil Rao",
    registrationDate: "2009-06-30",
    status: "expired",
    council: "Maharashtra Medical Council",
    error: "This registration has lapsed. Renew it with the council before applying.",
  },
};

/** Does this license number match the shape its council issues? */
export const validateLicenseFormat = (licenseNumber: string, council: string): boolean => {
  const pattern = LICENSE_PATTERNS[council as MedicalCouncil];
  return pattern ? pattern.test(licenseNumber) : false;
};

export const getLicenseFormatHint = (council: string): string =>
  LICENSE_FORMAT_HINTS[council as MedicalCouncil] ?? "Select council to see format";

/**
 * Look a license up in the registry. Rejects on format before hitting the
 * lookup, so a typo reads as a format error rather than "not found".
 */
export const verifyLicense = async (
  licenseNumber: string,
  council: string,
  latencyMs: number = SIMULATED_VERIFICATION_LATENCY_MS
): Promise<VerificationResult> => {
  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
  }

  if (!validateLicenseFormat(licenseNumber, council)) {
    return {
      isValid: false,
      error: "Invalid license number format for selected council",
    };
  }

  return (
    MOCK_LICENSE_REGISTRY[licenseNumber] ?? {
      isValid: false,
      error:
        "License number not found in our database. Please verify the number or contact support.",
    }
  );
};

/**
 * Profile completeness, 0-100. A verified license is worth half the score on
 * its own; the rest rewards a filled-out Ayurvedic and practice profile.
 */
export const calculateVerificationScore = (data: DoctorVerificationData): number => {
  let score = 0;

  if (data.licenseVerified) score += 50;
  else if (data.licenseNumber) score += 10;

  if (data.medicalDegree) score += 10;
  if (data.graduationYear) score += 5;
  if (parseInt(data.yearsOfExperience, 10) > 5) score += 5;

  if (data.ayurvedicCertification) score += 8;
  if (data.traditionalTraining) score += 4;
  if (data.ayurvedicSpecialization.length > 0) score += 3;

  if (data.clinicName) score += 5;
  if (data.specialConditions.length > 0) score += 3;
  if (data.languages.length > 1) score += 2;

  if (data.consultationModes.length > 0) score += 3;
  if (data.consultationFee) score += 2;

  return Math.min(score, 100);
};

export type VerificationBadgeTone = "expert" | "verified" | "license" | "pending" | "required";

export interface VerificationBadge {
  text: string;
  /** Tailwind background class for the badge. */
  color: string;
  tone: VerificationBadgeTone;
}

export const getVerificationBadge = (
  score: number,
  licenseVerified: boolean
): VerificationBadge => {
  if (licenseVerified && score >= 85) {
    return { text: "Verified Ayurvedic Expert", color: "bg-rose-600", tone: "expert" };
  }
  if (licenseVerified && score >= 70) {
    return { text: "Verified Doctor", color: "bg-plum-600", tone: "verified" };
  }
  if (licenseVerified) {
    return { text: "License Verified", color: "bg-rose-500", tone: "license" };
  }
  if (score >= 50) {
    return { text: "Pending Verification", color: "bg-coral-600", tone: "pending" };
  }
  return { text: "Verification Required", color: "bg-red-600", tone: "required" };
};
