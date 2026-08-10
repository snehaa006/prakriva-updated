/**
 * End-to-end-ish coverage of the `/auth/:role` screen for both roles.
 *
 * Supabase is mocked at the client boundary, so the real authService and
 * licenseVerification logic runs. Navigation is asserted through a mocked
 * `useNavigate`, and toasts through a mocked `sonner`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createSupabaseMock } from "@/test/supabaseMock";

const mock = vi.hoisted(() => ({
  instance: null as ReturnType<typeof import("@/test/supabaseMock").createSupabaseMock> | null,
  navigate: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mock.instance!.supabase;
  },
}));

vi.mock("sonner", () => ({ toast: mock.toast }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mock.navigate };
});

const Login = (await import("@/pages/auth/Login")).default;

let supabaseMock: ReturnType<typeof createSupabaseMock>;

const renderLogin = (role: "doctor" | "patient") =>
  render(
    <MemoryRouter
      initialEntries={[`/auth/${role}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/auth/:role" element={<Login />} />
      </Routes>
    </MemoryRouter>
  );

/** Flip the form from sign-in into sign-up mode. */
const switchToSignup = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /don't have an account\? sign up/i }));
};

const fillCredentials = async (
  user: ReturnType<typeof userEvent.setup>,
  { name, email, password, confirmPassword }: Partial<Record<string, string>>
) => {
  if (name !== undefined) await user.type(screen.getByLabelText(/full name/i), name);
  if (email !== undefined) await user.type(screen.getByLabelText(/^email/i), email);
  if (password !== undefined) await user.type(screen.getByLabelText(/^password/i), password);
  if (confirmPassword !== undefined)
    await user.type(screen.getByLabelText(/confirm password/i), confirmPassword);
};

/** Pick an option out of a Radix Select by its trigger label. */
const chooseFromSelect = async (
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionName: RegExp
) => {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
};

beforeEach(() => {
  supabaseMock = createSupabaseMock();
  mock.instance = supabaseMock;
  mock.navigate.mockClear();
  mock.toast.success.mockClear();
  mock.toast.error.mockClear();
});

describe("patient sign in", () => {
  it("renders the patient sign-in form", () => {
    renderLogin("patient");

    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByText("patient")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    // Sign-in must not ask for a name or a confirmation.
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });

  it("signs a patient in and routes them to their dashboard", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", { data: { questionnaire_completed: true } });

    renderLogin("patient");
    await fillCredentials(user, { email: "asha@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(supabaseMock.signInWithPassword).toHaveBeenCalledWith({
        email: "asha@example.com",
        password: "secret123",
      })
    );
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/patient/dashboard", { replace: true })
    );
    expect(mock.toast.success).toHaveBeenCalledWith("Welcome back!");
  });

  it("diverts a patient who has not completed the questionnaire", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", { data: { questionnaire_completed: false } });

    renderLogin("patient");
    await fillCredentials(user, { email: "asha@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/patient/questionnaire", { replace: true })
    );
  });

  // She answered the PCOD/PCOS form at signup; sending her to the Ayurvedic
  // questionnaire on every sign-in reads as being asked the same thing twice,
  // and stands between her and the trackers she actually came for.
  it("takes a PCOD/PCOS patient to her dashboard, questionnaire or not", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("profiles", { data: { role: "patient" } });
    supabaseMock.setTable("patients", {
      data: { questionnaire_completed: false, health_tracks: ["pcos"], assessment_data: null },
    });

    renderLogin("patient");
    await fillCredentials(user, { email: "asha@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/patient/dashboard", { replace: true })
    );
    expect(mock.navigate).not.toHaveBeenCalledWith("/patient/questionnaire", {
      replace: true,
    });
  });

  it("routes by the role on the account, not the role in the URL", async () => {
    const user = userEvent.setup();
    // A doctor signing in through the patient door still lands on /doctor.
    supabaseMock.setTable("profiles", { data: { role: "doctor" } });

    renderLogin("patient");
    await fillCredentials(user, { email: "rajesh@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/doctor/dashboard", { replace: true })
    );
  });

  it("surfaces a readable message for bad credentials", async () => {
    const user = userEvent.setup();
    // Supabase surfaces auth failures as AuthError instances, not plain objects.
    supabaseMock.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid login credentials"),
    } as never);

    renderLogin("patient");
    await fillCredentials(user, { email: "asha@example.com", password: "wrong" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mock.toast.error).toHaveBeenCalledWith(
        "Invalid credentials. Please check your email and password."
      )
    );
    expect(mock.navigate).not.toHaveBeenCalled();
  });

  it("reports an account whose role cannot be determined", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("profiles", { data: null });

    renderLogin("patient");
    await fillCredentials(user, { email: "ghost@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(
      () =>
        expect(mock.toast.error).toHaveBeenCalledWith(
          "Could not determine account type. Please contact support."
        ),
      { timeout: 10000 }
    );
    expect(mock.navigate).toHaveBeenCalledWith("/", { replace: true });
  }, 15000);
});

/**
 * Walk a patient through step 1 of the signup wizard: credentials, then Next.
 *
 * Patients get a two-step form since the PCOD/PCOS tracks landed — step 2 is
 * where the care pathway and its track-specific questions live.
 */
const completePatientStepOne = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<string, string>> = {}
) => {
  await fillCredentials(user, {
    name: "Asha Patel",
    email: "asha@example.com",
    password: "secret123",
    confirmPassword: "secret123",
    ...overrides,
  });
  await user.click(screen.getByRole("button", { name: /^next$/i }));
};

describe("patient sign up", () => {
  it("shows the account fields on step 1 of its own two-step wizard", async () => {
    const user = userEvent.setup();
    renderLogin("patient");

    await switchToSignup(user);

    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    // Two steps, not the doctor's four.
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/step 1 of 4/i)).not.toBeInTheDocument();
  });

  it("asks which care pathway she is here for on step 2", async () => {
    const user = userEvent.setup();
    renderLogin("patient");

    await switchToSignup(user);
    await completePatientStepOne(user);

    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /pregnancy/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /pcod \/ pcos/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /general wellness/i })).toBeInTheDocument();
  });

  it("will not finish without a care pathway chosen", async () => {
    const user = userEvent.setup();
    renderLogin("patient");

    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mock.toast.error).toHaveBeenCalledWith(
        "Please choose what you're here for"
      )
    );
    expect(supabaseMock.signUp).not.toHaveBeenCalled();
  });

  // The diagnosis question is what separates a PCOS signup from a pregnancy
  // one; a blank answer would leave her plan with nothing to key off.
  it("requires the diagnosis answer on the PCOD/PCOS pathway", async () => {
    const user = userEvent.setup();
    renderLogin("patient");

    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /pcod \/ pcos/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mock.toast.error).toHaveBeenCalledWith(
        "Please tell us whether PCOD/PCOS has been diagnosed"
      )
    );
    expect(supabaseMock.signUp).not.toHaveBeenCalled();
  });

  it("creates a pregnancy-track patient and sends her to the questionnaire", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("patients", { data: { patient_code: "P007" } });

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /pregnancy/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(supabaseMock.signUp).toHaveBeenCalledWith({
        email: "asha@example.com",
        password: "secret123",
        options: {
          data: expect.objectContaining({
            role: "patient",
            name: "Asha Patel",
            healthTracks: ["pregnancy"],
          }),
        },
      })
    );
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/patient/questionnaire", { replace: true })
    );
    expect(mock.toast.success).toHaveBeenCalledWith(
      "Patient account created successfully! Your Patient ID: P007"
    );
  });

  it("carries the PCOD/PCOS answers into the signup metadata", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("patients", { data: { patient_code: "P008" } });

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /pcod \/ pcos/i }));
    await user.selectOptions(
      screen.getByLabelText(/has a doctor diagnosed it/i),
      "diagnosed-pcos"
    );
    await user.type(screen.getByLabelText(/usual cycle length/i), "45");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabaseMock.signUp).toHaveBeenCalled());
    const metadata = supabaseMock.signUp.mock.calls[0][0].options.data;
    expect(metadata.healthTracks).toEqual(["pcos"]);
    expect(metadata.healthTrackDetails).toMatchObject({
      diagnosisStatus: "diagnosed-pcos",
      typicalCycleLength: "45",
    });

    // And she goes straight to her dashboard — she has just answered a form,
    // and the questionnaire is offered from her profile rather than demanded.
    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/patient/dashboard", { replace: true })
    );
  });

  // Pregnancy and PCOS routinely coexist; forcing a choice between them would
  // make a pregnant PCOS patient give up half her care.
  it("lets a patient sign up as both pregnant and PCOD/PCOS", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("patients", { data: { patient_code: "P009" } });

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /pregnancy/i }));
    await user.click(screen.getByRole("checkbox", { name: /pcod \/ pcos/i }));

    // Both sets of questions are on screen at once.
    expect(screen.getByLabelText(/estimated due date/i)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(/has a doctor diagnosed it/i),
      "diagnosed-pcos"
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabaseMock.signUp).toHaveBeenCalled());
    expect(supabaseMock.signUp.mock.calls[0][0].options.data.healthTracks).toEqual([
      "pregnancy",
      "pcos",
    ]);
  });

  it("treats general wellness as an answer, not a blank", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("patients", { data: { patient_code: "P010" } });

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /general wellness/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabaseMock.signUp).toHaveBeenCalled());
    expect(supabaseMock.signUp.mock.calls[0][0].options.data.healthTracks).toEqual([]);
  });

  it("refuses to leave step 1 when the passwords do not match", async () => {
    const user = userEvent.setup();
    renderLogin("patient");

    await switchToSignup(user);
    await completePatientStepOne(user, { confirmPassword: "different" });

    await waitFor(() => expect(mock.toast.error).toHaveBeenCalledWith("Passwords don't match"));
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(supabaseMock.signUp).not.toHaveBeenCalled();
    expect(mock.navigate).not.toHaveBeenCalled();
  });

  it("holds the user at the form when email confirmation is required", async () => {
    const user = userEvent.setup();
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    } as never);

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user);
    await user.click(screen.getByRole("checkbox", { name: /pregnancy/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mock.toast.success).toHaveBeenCalledWith(
        "Account created! Check your email to confirm your address, then sign in."
      )
    );
    expect(mock.navigate).not.toHaveBeenCalled();
    // And it drops back to the sign-in form.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument()
    );
  });

  it("flips back to sign-in when the email is already registered", async () => {
    const user = userEvent.setup();
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("User already registered"),
    } as never);

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user, { email: "taken@example.com" });
    await user.click(screen.getByRole("checkbox", { name: /pregnancy/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument()
    );
    expect(mock.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("account with this email already exists")
    );
    expect(mock.navigate).not.toHaveBeenCalled();
  });

  // The reported bug, end to end. With email confirmation on, Supabase hides a
  // repeat signup behind a successful response, and the screen used to read it
  // as "confirmation email sent" — so a PCOD/PCOS patient was told her account
  // was created, then locked out of an account whose password she had never
  // set, with signing up again only repeating the promise.
  it("does not promise an account when a repeat signup is disguised as a success", async () => {
    const user = userEvent.setup();
    supabaseMock.signUp.mockResolvedValueOnce({
      data: { user: { id: "obfuscated-user", identities: [] }, session: null },
      error: null,
    } as never);

    renderLogin("patient");
    await switchToSignup(user);
    await completePatientStepOne(user, { email: "taken@example.com" });
    await user.click(screen.getByRole("checkbox", { name: /pcod \/ pcos/i }));
    await user.selectOptions(
      screen.getByLabelText(/has a doctor diagnosed it/i),
      "diagnosed-pcos"
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mock.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("account with this email already exists")
      )
    );
    expect(mock.toast.success).not.toHaveBeenCalled();
    expect(mock.navigate).not.toHaveBeenCalled();

    // She lands on sign-in with her email kept and the password she just chose
    // cleared — it was never set on the account she is about to sign in to.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/^email/i)).toHaveValue("taken@example.com");
    expect(screen.getByLabelText(/^password/i)).toHaveValue("");
  });
});

describe("doctor sign in", () => {
  it("renders the doctor sign-in form without the wizard", () => {
    renderLogin("doctor");

    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByText("doctor")).toBeInTheDocument();
    expect(screen.queryByText(/step 1 of 4/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
  });

  it("signs a doctor in and routes them to the doctor dashboard", async () => {
    const user = userEvent.setup();
    supabaseMock.setTable("profiles", { data: { role: "doctor" } });

    renderLogin("doctor");
    await fillCredentials(user, { email: "rajesh@example.com", password: "secret123" });
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/doctor/dashboard", { replace: true })
    );
    // Doctors never get questionnaire-gated.
    expect(mock.navigate).not.toHaveBeenCalledWith(
      "/patient/questionnaire",
      expect.anything()
    );
  });
});

describe("doctor sign up wizard", () => {
  it("starts at step 1 of 4", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);

    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/basic information/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    // No submit button until the last step.
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
  });

  it("blocks step 1 until the required fields are filled", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(mock.toast.error).toHaveBeenCalledWith("Please fill in all required fields");
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it("blocks step 1 when the passwords do not match", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "different",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(mock.toast.error).toHaveBeenCalledWith("Passwords don't match");
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it("advances to license verification once step 1 is valid", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/license verification/i)).toBeInTheDocument();
  });

  it("will not leave step 2 while the license is unverified", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await chooseFromSelect(user, /medical council/i, /medical council of india/i);
    await user.type(screen.getByLabelText(/medical license number/i), "MH12345678");
    await chooseFromSelect(user, /medical degree/i, /^bams/i);
    await user.type(screen.getByLabelText(/graduation year/i), "2015");

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(mock.toast.error).toHaveBeenCalledWith(
      "Please verify your medical license before proceeding"
    );
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
  }, 20000);

  it("rejects a license number that does not match its council's format", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await chooseFromSelect(user, /medical council/i, /medical council of india/i);
    await user.type(screen.getByLabelText(/medical license number/i), "NOTALICENSE");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/license verification failed/i, {}, { timeout: 10000 }))
      .toBeInTheDocument();
    expect(mock.toast.error).toHaveBeenCalledWith(
      "Invalid license number format for selected council"
    );
  }, 20000);

  it("verifies a known license and prefills the doctor's name", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    // Leave the name blank so the registry can fill it in.
    await fillCredentials(user, {
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.type(screen.getByLabelText(/full name/i), "x");
    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), "Dr. Rajesh Kumar");
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await chooseFromSelect(user, /medical council/i, /ayush ministry/i);
    await user.type(screen.getByLabelText(/medical license number/i), "AYU/MH/104627");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(
      await screen.findByText(/license verified successfully/i, {}, { timeout: 10000 })
    ).toBeInTheDocument();
    expect(screen.getByText("Maharashtra Council of Indian Medicine")).toBeInTheDocument();
    expect(mock.toast.success).toHaveBeenCalledWith("License verified successfully!");
  }, 20000);

  it("creates a verified doctor account through the full wizard", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);

    // --- Step 1: credentials ---
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // --- Step 2: license ---
    await chooseFromSelect(user, /medical council/i, /ayush ministry/i);
    await user.type(screen.getByLabelText(/medical license number/i), "AYU/MH/104627");
    await user.click(screen.getByRole("button", { name: /verify/i }));
    await screen.findByText(/license verified successfully/i, {}, { timeout: 10000 });

    await chooseFromSelect(user, /medical degree/i, /^bams/i);
    await user.type(screen.getByLabelText(/graduation year/i), "2015");
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // --- Step 3: expertise ---
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/years of experience/i), "8");
    await user.click(screen.getByRole("checkbox", { name: /panchakarma/i }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    // --- Step 4: practice ---
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/clinic\/practice name/i), "Wellness Center");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabaseMock.signUp).toHaveBeenCalledTimes(1));

    const [[call]] = supabaseMock.signUp.mock.calls as unknown as [
      [{ email: string; password: string; options: { data: Record<string, unknown> } }],
    ];
    expect(call.email).toBe("rajesh@example.com");
    expect(call.options.data).toMatchObject({
      role: "doctor",
      name: "Dr. Rajesh Kumar",
      licenseNumber: "AYU/MH/104627",
      medicalCouncil: "ayush",
      medicalDegree: "bams",
      graduationYear: 2015,
      yearsOfExperience: 8,
      clinicName: "Wellness Center",
      ayurvedicSpecialization: ["Panchakarma"],
    });
    // Clearing the browser-side licence check must not assert verified status.
    expect(call.options.data).not.toHaveProperty("licenseVerified");

    await waitFor(() =>
      expect(mock.navigate).toHaveBeenCalledWith("/doctor/dashboard", { replace: true })
    );
    expect(mock.toast.success).toHaveBeenCalledWith(
      "Account created! Your licence is pending review — you can accept patients once it is approved."
    );
  }, 30000);

  it("resets the wizard when switching back to sign-in", async () => {
    const user = userEvent.setup();
    renderLogin("doctor");

    await switchToSignup(user);
    await fillCredentials(user, {
      name: "Dr. Rajesh Kumar",
      email: "rajesh@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /already have an account\? sign in/i })
    );
    await switchToSignup(user);

    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("");
  });
});
