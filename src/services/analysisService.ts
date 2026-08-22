// src/services/analysisService.ts
// Client for the Gemini-backed analysis endpoints on the Flask backend.
//
// The Gemini API key deliberately does not exist on this side: a VITE_ variable
// is compiled into the bundle and readable in devtools, so the key lives in the
// backend environment and every call is proxied through Flask.

import type { StoredScreening } from "@/types/diseaseDetection";
import type { AcneRegion, AcneSeverity } from "@/lib/acneGuidance";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Thrown when the backend has no Gemini key, or Gemini itself failed. */
export class AnalysisUnavailableError extends Error {}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Cold starts
//
// The backend runs on Render's free plan, which stops the instance after about
// fifteen minutes of inactivity and boots it again on the next request. Render
// puts the cost at "50 seconds or more", and this service is at the slow end of
// that: it loads the dosha pickle and the XGBoost screening models at import.
//
// So the first request after an idle period was reliably losing the race with
// the 50s abort below, and surfacing `AbortError`'s uniquely unhelpful message
// — "signal is aborted without reason" — as though the backend were down.
//
// The fix is to tell a cold start apart from an outage instead of guessing:
// on a failed request, poll `/health` (cheap, and exempt from the rate limiter
// for exactly this reason) until the instance answers, then retry the real
// call with a full fresh budget. A backend that is genuinely down never
// answers the poll, and reports itself as down.
// ---------------------------------------------------------------------------

/** How long to keep waiting for a sleeping instance to boot. */
const WAKE_BUDGET_MS = 90_000;

/** Per-attempt budget for one `/health` poll while waking. */
const WAKE_PROBE_MS = 10_000;

/** Gap between polls, so waking costs a handful of requests rather than a flood. */
const WAKE_POLL_GAP_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

/** A reason worth showing a user, out of whatever `fetch` rejected with. */
const describeFetchError = (error: unknown, timeoutMs: number): string => {
  const name = (error as { name?: string } | null)?.name;
  if (name === "AbortError" || name === "TimeoutError") {
    return `no response within ${Math.round(timeoutMs / 1000)}s`;
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Resolves once the backend answers `/health`, or false if it never does.
 *
 * Shared between concurrent callers: a page that fires three analysis calls at
 * once should wake the instance once, not three times over.
 */
let wakeInFlight: Promise<boolean> | null = null;

export const wakeBackend = (): Promise<boolean> => {
  if (wakeInFlight) return wakeInFlight;

  const run = (async () => {
    const deadline = Date.now() + WAKE_BUDGET_MS;
    while (Date.now() < deadline) {
      try {
        const response = await fetchWithTimeout(`${API_BASE}/health`, {}, WAKE_PROBE_MS);
        // Any answer at all means the instance is up. A non-2xx health check
        // is a backend problem to report from the real call, not a reason to
        // keep waiting for a boot that has already happened.
        if (response.status > 0) return true;
      } catch {
        // Still booting, or genuinely unreachable — the deadline decides which.
      }
      await sleep(WAKE_POLL_GAP_MS);
    }
    return false;
  })();

  wakeInFlight = run;
  void run.catch(() => false).then(() => {
    if (wakeInFlight === run) wakeInFlight = null;
  });
  return run;
};

/** Drops any in-flight wake. Test seam — nothing in the app needs this. */
export const resetBackendWakeState = (): void => {
  wakeInFlight = null;
};

const post = async <T>(path: string, body: unknown, timeoutMs = 50_000): Promise<T> => {
  const attempt = () =>
    fetchWithTimeout(
      `${API_BASE}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs
    );

  let response: Response;
  try {
    response = await attempt();
  } catch (error) {
    // `fetch` rejects the same way for a sleeping instance, a backend that is
    // down, a wrong VITE_API_URL and a CORS rejection. Waking the instance
    // separates the first from the rest.
    const reason = describeFetchError(error, timeoutMs);
    if (!(await wakeBackend())) {
      // Name the URL that failed — the bare "Failed to fetch" says nothing a
      // user could act on.
      throw new Error(`Could not reach the backend at ${API_BASE} (${reason})`);
    }
    try {
      response = await attempt();
    } catch (retryError) {
      throw new Error(
        `Could not reach the backend at ${API_BASE} (${describeFetchError(
          retryError,
          timeoutMs
        )})`
      );
    }
  }

  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (response.status === 503) {
    throw new AnalysisUnavailableError(
      payload?.error ?? "The analysis service is not available right now."
    );
  }
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload.data;
};

/**
 * Whether the backend has Gemini configured.
 *
 * Used to hide the AI panels rather than show a button that can only fail.
 * Network problems read as "not enabled" for the same reason.
 */
export const isAnalysisEnabled = async (): Promise<boolean> => {
  const read = async (timeoutMs: number): Promise<boolean> => {
    const response = await fetchWithTimeout(`${API_BASE}/analysis/status`, {}, timeoutMs);
    if (!response.ok) return false;
    const payload = (await response.json()) as Envelope<{ enabled: boolean }>;
    return payload.data?.enabled === true;
  };

  try {
    return await read(8_000);
  } catch {
    // A sleeping instance cannot answer in eight seconds, and reading that as
    // "not enabled" hid the AI panels for the whole session — the user saw a
    // feature silently missing rather than one that was still waking up.
    try {
      return (await wakeBackend()) ? await read(15_000) : false;
    } catch {
      return false;
    }
  }
};

/** A written clinical read of a patient's screening history. */
export const analyseScreenings = async (
  screenings: StoredScreening[],
  rangeLabel: string
): Promise<string> => {
  const { analysis } = await post<{ analysis: string }>("/analysis/screening", {
    screenings,
    range_label: rangeLabel,
  });
  return analysis;
};

/** Screening fields a report can fill in. */
export type ExtractedValues = Partial<
  Record<
    | "hemoglobin"
    | "hba1c"
    | "hdl"
    | "triglycerides"
    | "tsh"
    | "t3"
    | "tt4"
    | "t4u"
    | "fti"
    | "fetal_weight_kg"
    | "amniotic_fluid_cm"
    | "bp_systolic"
    | "bp_diastolic",
    number
  >
>;

/** Largest file we will try to send, matching the backend's own limit. */
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

/** Read a File as bare base64 (without the `data:...;base64,` prefix). */
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });

/**
 * Read lab values off a photographed or scanned report.
 *
 * Returns only values the backend judged clinically plausible. The caller is
 * expected to show them for confirmation — OCR misreading a decimal point
 * (11.9 as 119) must not silently reach a risk model.
 */
export const extractReport = async (file: File): Promise<ExtractedValues> => {
  if (file.size > MAX_REPORT_BYTES) {
    throw new Error("That file is too large — try a photo under 8 MB.");
  }
  const { values } = await post<{ values: ExtractedValues }>(
    "/analysis/extract-report",
    { image: await toBase64(file), mime_type: file.type || "image/jpeg" }
  );
  return values;
};

/** What the vision model reports about a skin photo. */
export interface AcnePhotoAssessment {
  /** Null when the photo could not be judged — keep the patient's own rating. */
  severity: AcneSeverity | null;
  regions: AcneRegion[];
  observations: string;
}

/**
 * A second opinion on a skin photo, for the PCOD/PCOS skin tracker.
 *
 * Never authoritative: the patient's own severity rating wins, because she can
 * see her face in daylight and the model is looking at a phone photo. This is
 * offered alongside it so a trend has something objective in it, and the
 * backend returns no treatment advice at all — that stays in
 * `src/lib/acneGuidance.ts` where it can be reviewed.
 */
export const assessAcnePhoto = async (file: File): Promise<AcnePhotoAssessment> => {
  if (file.size > MAX_REPORT_BYTES) {
    throw new Error("That photo is too large — try one under 8 MB.");
  }
  return post<AcnePhotoAssessment>("/analysis/acne-photo", {
    image: await toBase64(file),
    mime_type: file.type || "image/jpeg",
  });
};

/** Answer a patient's question about her own results. */
export const askAssistant = async (
  question: string,
  screenings: StoredScreening[]
): Promise<string> => {
  const { answer } = await post<{ answer: string }>("/assistant/ask", {
    question,
    screenings,
  });
  return answer;
};

/** One turn of prior conversation, in the order Gemini expects. */
export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Open-ended chat backed by the patient's full context (diet plan, pantry,
 * tracking history, screenings — see `chatAssistantService.ts`), not just her
 * screening results. `context` is caller-assembled the same way `screenings`
 * is above: already scoped to her own rows by Supabase RLS before it ever
 * reaches this call.
 */
export const askChat = async (
  message: string,
  history: ChatTurn[],
  context: Record<string, unknown>
): Promise<string> => {
  const { answer } = await post<{ answer: string }>("/assistant/chat", {
    message,
    history,
    context,
  });
  return answer;
};
