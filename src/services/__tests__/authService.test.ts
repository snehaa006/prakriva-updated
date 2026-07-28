import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { emptyVerificationData } from "@/lib/licenseVerification";

const mock = vi.hoisted(() => {
  // Imported lazily: vi.mock factories are hoisted above the import block.
  return { instance: null as ReturnType<typeof import("@/test/supabaseMock").createSupabaseMock> | null };
});

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mock.instance!.supabase;
  },
}));

const {
  EmailAlreadyRegisteredError,
  buildSignupMetadata,
  describeAuthError,
  getUserRole,
  resolveDashboardPath,
  signInUser,
  signUpUser,
} = await import("@/services/authService");

let supabaseMock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  supabaseMock = createSupabaseMock();
  mock.instance = supabaseMock;
});

const doctorVerification = () => ({
  ...emptyVerificationData(),
  licenseNumber: "MH12345678",
  medicalCouncil: "mci",
  graduationYear: "2015",
  medicalDegree: "bams",
  yearsOfExperience: "8",
  clinicName: "Wellness Center",
  licenseVerified: true,
  verificationDetails: {
    isValid: true,
    doctorName: "Dr. Rajesh Kumar",
    registrationDate: "2020-03-15",
    status: "active" as const,
    council: "Maharashtra Medical Council",
  },
});

describe("buildSignupMetadata", () => {
  it("sends only role and name for a patient", () => {
    const metadata = buildSignupMetadata({ role: "patient", name: "Asha Patel" });

    expect(metadata).toEqual({ role: "patient", name: "Asha Patel" });
  });

  it("ignores a stray verification payload on a patient signup", () => {
    const metadata = buildSignupMetadata({
      role: "patient",
      name: "Asha Patel",
      verification: doctorVerification(),
    });

    expect(metadata).toEqual({ role: "patient", name: "Asha Patel" });
    expect(metadata).not.toHaveProperty("licenseNumber");
  });

  it("carries the full verification payload for a doctor", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      verification: doctorVerification(),
    });

    expect(metadata).toMatchObject({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      licenseNumber: "MH12345678",
      medicalCouncil: "mci",
      medicalDegree: "bams",
      licenseVerified: true,
    });
  });

  it("parses numeric fields out of their form strings", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      verification: doctorVerification(),
    });

    expect(metadata.graduationYear).toBe(2015);
    expect(metadata.yearsOfExperience).toBe(8);
  });

  it("defaults unparseable numeric fields to 0 rather than NaN", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. X",
      verification: { ...doctorVerification(), graduationYear: "", yearsOfExperience: "" },
    });

    expect(metadata.graduationYear).toBe(0);
    expect(metadata.yearsOfExperience).toBe(0);
  });

  it("derives the verification score and badge from the payload", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      verification: doctorVerification(),
    });

    // 50 (verified licence) + 10 (degree) + 5 (grad year) + 5 (>5 yrs) + 5 (clinic)
    expect(metadata.verificationScore).toBe(75);
    expect(metadata.verificationBadge).toBe("Verified Doctor");
  });

  it("flattens the council response into the licence audit trail", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      verification: doctorVerification(),
    });

    expect(metadata.licenseVerificationDetails).toEqual({
      verifiedName: "Dr. Rajesh Kumar",
      registrationDate: "2020-03-15",
      councilStatus: "active",
      verifyingCouncil: "Maharashtra Medical Council",
      verificationMethod: "api_verification",
    });
  });

  it("nulls the audit trail when the licence was never checked", () => {
    const metadata = buildSignupMetadata({
      role: "doctor",
      name: "Dr. X",
      verification: { ...emptyVerificationData(), licenseNumber: "MH12345678" },
    });

    expect(metadata.licenseVerificationDetails).toBeNull();
    expect(metadata.licenseVerified).toBe(false);
  });
});

describe("signUpUser", () => {
  it("creates a patient account and reads back the assigned patient code", async () => {
    supabaseMock.setTable("patients", { data: { patient_code: "P007" } });

    const result = await signUpUser({
      role: "patient",
      name: "Asha Patel",
      email: "asha@example.com",
      password: "secret123",
    });

    expect(supabaseMock.signUp).toHaveBeenCalledWith({
      email: "asha@example.com",
      password: "secret123",
      options: { data: { role: "patient", name: "Asha Patel" } },
    });
    expect(result).toEqual({ userId: "user-1", hasSession: true, patientCode: "P007" });
  });

  it("reports a missing patient code as null instead of failing", async () => {
    supabaseMock.setTable("patients", { data: null });

    const result = await signUpUser({
      role: "patient",
      name: "Asha Patel",
      email: "asha@example.com",
      password: "secret123",
    });

    expect(result.patientCode).toBeNull();
  });

  it("skips the patient code read when email confirmation withholds the session", async () => {
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    } as never);

    const result = await signUpUser({
      role: "patient",
      name: "Asha Patel",
      email: "asha@example.com",
      password: "secret123",
    });

    expect(result).toEqual({ userId: "user-1", hasSession: false });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("never reads the patients table for a doctor signup", async () => {
    await signUpUser({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      verification: doctorVerification(),
    });

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("sends the doctor verification payload as signup metadata", async () => {
    await signUpUser({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      verification: doctorVerification(),
    });

    const [[call]] = supabaseMock.signUp.mock.calls as unknown as [
      [{ options: { data: Record<string, unknown> } }],
    ];
    expect(call.options.data).toMatchObject({
      role: "doctor",
      licenseNumber: "MH12345678",
      licenseVerified: true,
    });
  });

  it("raises a typed error for an already-registered email", async () => {
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("User already registered"),
    } as never);

    await expect(
      signUpUser({
        role: "patient",
        name: "Asha",
        email: "taken@example.com",
        password: "secret123",
      })
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("rethrows other signup failures untouched", async () => {
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Password should be at least 6 characters"),
    } as never);

    await expect(
      signUpUser({ role: "patient", name: "Asha", email: "a@example.com", password: "x" })
    ).rejects.toMatchObject(new Error("Password should be at least 6 characters"));
  });
});

describe("signInUser", () => {
  it("returns the authenticated user id", async () => {
    await expect(signInUser("asha@example.com", "secret123")).resolves.toBe("user-1");
    expect(supabaseMock.signInWithPassword).toHaveBeenCalledWith({
      email: "asha@example.com",
      password: "secret123",
    });
  });

  it("throws on bad credentials", async () => {
    supabaseMock.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials"),
    } as never);

    await expect(signInUser("asha@example.com", "wrong")).rejects.toMatchObject({
      message: "Invalid login credentials",
    });
  });
});

describe("getUserRole", () => {
  const noWait = { retryDelayMs: 0 };

  it("resolves a doctor without touching the patients table", async () => {
    supabaseMock.setTable("profiles", { data: { role: "doctor" } });

    await expect(getUserRole("user-1", noWait)).resolves.toEqual({ role: "doctor" });
    expect(supabaseMock.from).not.toHaveBeenCalledWith("patients");
  });

  it("reports a patient who has finished the questionnaire", async () => {
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", { data: { questionnaire_completed: true } });

    await expect(getUserRole("user-1", noWait)).resolves.toEqual({
      role: "patient",
      hasCompletedQuestionnaire: true,
    });
  });

  it("reports a patient who has not finished the questionnaire", async () => {
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", { data: { questionnaire_completed: false } });

    await expect(getUserRole("user-1", noWait)).resolves.toEqual({
      role: "patient",
      hasCompletedQuestionnaire: false,
    });
  });

  it("treats a missing patients row as an unfinished questionnaire", async () => {
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", { data: null });

    await expect(getUserRole("user-1", noWait)).resolves.toEqual({
      role: "patient",
      hasCompletedQuestionnaire: false,
    });
  });

  it("gives up with a null role when no profile ever appears", async () => {
    supabaseMock.setTable("profiles", { data: null });

    await expect(getUserRole("user-1", { maxRetries: 2, retryDelayMs: 0 })).resolves.toEqual({
      role: null,
    });
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });

  it("retries past a transient read error", async () => {
    let attempt = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = vi.fn(chain);
      builder.eq = vi.fn(chain);
      builder.maybeSingle = vi.fn(async () => {
        if (table === "profiles") {
          attempt += 1;
          if (attempt === 1) return { data: null, error: new Error("network glitch") };
          return { data: { role: "doctor" }, error: null };
        }
        return { data: null, error: null };
      });
      return builder;
    });

    await expect(getUserRole("user-1", noWait)).resolves.toEqual({ role: "doctor" });
    expect(attempt).toBe(2);
  });
});

describe("resolveDashboardPath", () => {
  it("sends doctors to the doctor dashboard", () => {
    expect(resolveDashboardPath("doctor")).toBe("/doctor/dashboard");
  });

  it("sends a brand new patient to the questionnaire", () => {
    expect(resolveDashboardPath("patient", undefined, true)).toBe("/patient/questionnaire");
  });

  it("sends a returning patient with an unfinished questionnaire back to it", () => {
    expect(resolveDashboardPath("patient", false)).toBe("/patient/questionnaire");
  });

  it("sends a returning patient with a finished questionnaire to their dashboard", () => {
    expect(resolveDashboardPath("patient", true)).toBe("/patient/dashboard");
  });

  it("keeps a new doctor signup on the doctor dashboard", () => {
    expect(resolveDashboardPath("doctor", undefined, true)).toBe("/doctor/dashboard");
  });

  it("falls back to the landing page for an unknown role", () => {
    expect(resolveDashboardPath(null)).toBe("/");
  });
});

describe("describeAuthError", () => {
  const message = (text: string) => describeAuthError(new Error(text));

  it.each([
    ["Invalid login credentials", "Invalid credentials. Please check your email and password."],
    ["User already registered", "An account with this email already exists. Please sign in instead."],
    ["Password should be at least 6 characters", "Password should be at least 6 characters long."],
    ["Unable to validate email address", "Please enter a valid email address."],
    ["Email not confirmed", "Please confirm your email address before signing in."],
    ["Failed to fetch", "Network error. Please check your connection and try again."],
    ["Request rate limit reached", "Too many failed attempts. Please try again later."],
    ["User is banned", "This account has been disabled. Please contact support."],
  ])("maps %s to a readable message", (raw, expected) => {
    expect(message(raw)).toBe(expected);
  });

  it("passes an unrecognised message through unchanged", () => {
    expect(message("Something odd happened")).toBe("Something odd happened");
  });

  it("handles a non-Error rejection", () => {
    expect(describeAuthError("just a string")).toBe("An unexpected error occurred");
  });
});
