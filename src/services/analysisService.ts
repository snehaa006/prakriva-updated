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
