import { describe, expect, it } from "vitest";
import {
  calculateVerificationScore,
  emptyVerificationData,
  getLicenseFormatHint,
  getVerificationBadge,
  validateLicenseFormat,
  verifyLicense,
  type DoctorVerificationData,
} from "@/lib/licenseVerification";

/** Skip the simulated registry latency. */
const verify = (licenseNumber: string, council: string) =>
  verifyLicense(licenseNumber, council, 0);

describe("validateLicenseFormat", () => {
  it.each([
    ["MH12345678", "mci"],
    ["KA87654321", "mci"],
    ["NMC/2022001234", "nmc"],
    ["TN/987654", "state-council"],
    ["GJ/11223344", "state-council"],
    ["AYU/KA/789012", "ayush"],
  ])("accepts %s for %s", (licenseNumber, council) => {
    expect(validateLicenseFormat(licenseNumber, council)).toBe(true);
  });

  it.each([
    ["MH1234567", "mci", "one digit short"],
    ["mh12345678", "mci", "lower case state code"],
    ["MH12345678", "nmc", "right number, wrong council"],
    ["NMC/123", "nmc", "too few digits"],
    ["AYU/KA/78901", "ayush", "five digits"],
    ["TN/12345", "state-council", "below the six digit minimum"],
  ])("rejects %s for %s (%s)", (licenseNumber, council) => {
    expect(validateLicenseFormat(licenseNumber, council)).toBe(false);
  });

  it("rejects an unrecognised council rather than defaulting to valid", () => {
    expect(validateLicenseFormat("MH12345678", "not-a-council")).toBe(false);
    expect(validateLicenseFormat("MH12345678", "")).toBe(false);
  });
});

describe("getLicenseFormatHint", () => {
  it("returns the format for a known council", () => {
    expect(getLicenseFormatHint("mci")).toContain("AA12345678");
    expect(getLicenseFormatHint("ayush")).toContain("AYU/AA/123456");
  });

  it("prompts for a council when none is selected", () => {
    expect(getLicenseFormatHint("")).toBe("Select council to see format");
  });
});

describe("verifyLicense", () => {
  it("resolves a registered license to its council record", async () => {
    const result = await verify("AYU/MH/104627", "ayush");

    expect(result).toMatchObject({
      isValid: true,
      doctorName: "Dr. Rajesh Kumar",
      status: "active",
      council: "Maharashtra Council of Indian Medicine",
    });
  });

  it("resolves an AYUSH license", async () => {
    const result = await verify("AYU/KA/143852", "ayush");
    expect(result.isValid).toBe(true);
    expect(result.doctorName).toBe("Dr. Priya Sharma");
  });

  it("rejects a well-formed number whose registration has lapsed", async () => {
    const result = await verify("MH12345678", "mci");

    expect(result.isValid).toBe(false);
    expect(result.status).toBe("expired");
    expect(result.error).toContain("lapsed");
  });

  it("reports a format error before attempting the lookup", async () => {
    const result = await verify("BADNUMBER", "mci");

    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Invalid license number format for selected council");
  });

  it("reports a well-formed but unregistered license as not found", async () => {
    const result = await verify("ZZ00000000", "mci");

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not found in our database");
  });

  it("does not accept a registered number under the wrong council", async () => {
    // MH12345678 is real, but it is not shaped like an NMC number.
    const result = await verify("MH12345678", "nmc");

    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Invalid license number format for selected council");
  });
});

describe("calculateVerificationScore", () => {
  const withData = (overrides: Partial<DoctorVerificationData>) =>
    calculateVerificationScore({ ...emptyVerificationData(), ...overrides });

  it("scores an empty profile at zero", () => {
    expect(calculateVerificationScore(emptyVerificationData())).toBe(0);
  });

  it("weights a verified license at half the total", () => {
    expect(withData({ licenseNumber: "MH12345678", licenseVerified: true })).toBe(50);
  });

  it("gives an unverified license number only token credit", () => {
    expect(withData({ licenseNumber: "MH12345678", licenseVerified: false })).toBe(10);
  });

  it("only credits experience above five years", () => {
    expect(withData({ yearsOfExperience: "5" })).toBe(0);
    expect(withData({ yearsOfExperience: "6" })).toBe(5);
  });

  it("only credits languages beyond the first", () => {
    expect(withData({ languages: ["English"] })).toBe(0);
    expect(withData({ languages: ["English", "Hindi"] })).toBe(2);
  });

  it("accumulates profile detail on top of the license", () => {
    const score = withData({
      licenseVerified: true,
      medicalDegree: "bams",
      graduationYear: "2015",
      yearsOfExperience: "10",
      ayurvedicCertification: "Certificate in Ayurvedic Nutrition",
      traditionalTraining: "Gurukul training",
      ayurvedicSpecialization: ["Panchakarma"],
      clinicName: "Wellness Center",
      specialConditions: ["Obesity"],
      languages: ["English", "Hindi"],
      consultationModes: ["Video Call"],
      consultationFee: "500",
    });

    expect(score).toBe(100);
  });

  it("never exceeds 100", () => {
    const maxed = withData({
      licenseVerified: true,
      medicalDegree: "md",
      graduationYear: "2010",
      yearsOfExperience: "40",
      ayurvedicCertification: "cert",
      traditionalTraining: "training",
      ayurvedicSpecialization: ["Panchakarma", "Herbal Medicine"],
      clinicName: "Clinic",
      clinicAddress: "Address",
      specialConditions: ["Obesity", "Arthritis"],
      languages: ["English", "Hindi", "Tamil"],
      consultationModes: ["Video Call", "In-person"],
      consultationFee: "1200",
    });

    expect(maxed).toBeLessThanOrEqual(100);
  });
});

describe("getVerificationBadge", () => {
  it("awards expert status only with a verified license and a near-complete profile", () => {
    expect(getVerificationBadge(90, true)).toMatchObject({
      text: "Verified Ayurvedic Expert",
      tone: "expert",
    });
  });

  it("awards verified doctor in the middle band", () => {
    expect(getVerificationBadge(75, true).tone).toBe("verified");
  });

  it("falls back to license-only when the profile is thin", () => {
    expect(getVerificationBadge(55, true).tone).toBe("license");
  });

  it("never awards a verified badge without a verified license", () => {
    expect(getVerificationBadge(95, false).tone).toBe("pending");
    expect(getVerificationBadge(95, false).text).toBe("Pending Verification");
  });

  it("demands verification for an empty profile", () => {
    expect(getVerificationBadge(0, false).tone).toBe("required");
  });
});
