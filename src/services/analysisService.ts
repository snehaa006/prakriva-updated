// src/services/analysisService.ts
// Client for the Gemini-backed analysis endpoints on the Flask backend.
//
// The Gemini API key deliberately does not exist on this side: a VITE_ variable
// is compiled into the bundle and readable in devtools, so the key lives in the
// backend environment and every call is proxied through Flask.

import type { StoredScreening } from "@/types/diseaseDetection";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Thrown when the backend has no Gemini key, or Gemini itself failed. */
export class AnalysisUnavailableError extends Error {}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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
  try {
    const response = await fetch(`${API_BASE}/analysis/status`);
    if (!response.ok) return false;
    const payload = (await response.json()) as Envelope<{ enabled: boolean }>;
    return payload.data?.enabled === true;
  } catch {
    return false;
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
