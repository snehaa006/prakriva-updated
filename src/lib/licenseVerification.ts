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
 */
export const MOCK_LICENSE_REGISTRY: Record<string, VerificationResult> = {
  MH12345678: {
    isValid: true,
    doctorName: "Dr. Rajesh Kumar",
    registrationDate: "2020-03-15",
    status: "active",
    council: "Maharashtra Medical Council",
  },
  KA87654321: {
    isValid: true,
    doctorName: "Dr. Priya Sharma",
    registrationDate: "2018-07-22",
    status: "active",
    council: "Karnataka Medical Council",
  },
  TN98765432: {
    isValid: true,
    doctorName: "Dr. Meera Nair",
    registrationDate: "2017-05-20",
    status: "active",
    council: "Tamil Nadu Medical Council",
  },
  GJ11223344: {
    isValid: true,
    doctorName: "Dr. Arjun Patel",
    registrationDate: "2021-01-12",
    status: "active",
    council: "Gujarat Medical Council",
  },
  UP55667788: {
    isValid: true,
    doctorName: "Dr. Sita Gupta",
    registrationDate: "2016-11-08",
    status: "active",
    council: "Uttar Pradesh Medical Council",
  },
  RJ99887766: {
    isValid: true,
    doctorName: "Dr. Vikram Singh",
    registrationDate: "2019-08-25",
    status: "active",
    council: "Rajasthan Medical Council",
  },
  "AYU/KA/789012": {
    isValid: true,
    doctorName: "Dr. Lakshmi Rao",
    registrationDate: "2020-04-18",
    status: "active",
    council: "AYUSH Ministry - Karnataka",
  },
  "NMC/2022001234": {
    isValid: true,
    doctorName: "Dr. Rohit Joshi",
    registrationDate: "2022-02-14",
    status: "active",
    council: "National Medical Commission",
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
    return { text: "Verified Ayurvedic Expert", color: "bg-green-600", tone: "expert" };
  }
  if (licenseVerified && score >= 70) {
    return { text: "Verified Doctor", color: "bg-blue-600", tone: "verified" };
  }
  if (licenseVerified) {
    return { text: "License Verified", color: "bg-green-500", tone: "license" };
  }
  if (score >= 50) {
    return { text: "Pending Verification", color: "bg-yellow-600", tone: "pending" };
  }
  return { text: "Verification Required", color: "bg-red-600", tone: "required" };
};
