import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askChat,
  isAnalysisEnabled,
  resetBackendWakeState,
  wakeBackend,
} from "@/services/analysisService";

/**
 * The backend runs on Render's free plan, so it stops after ~15 minutes idle
 * and takes "50 seconds or more" to boot. These tests pin the behaviour that
 * fix is made of: a first request that times out must be treated as a cold
 * start and retried once the instance answers `/health` — not reported to the
 * patient as "Could not reach the backend (signal is aborted without reason)".
 */

/** What `fetch` rejects with when an AbortController fires. */
const abortError = () => {
  const error = new Error("signal is aborted without reason");
  error.name = "AbortError";
  return error;
};

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

/** The envelope `/assistant/chat` answers with. */
const chatOk = (answer: string) => okJson({ success: true, data: { answer } });

beforeEach(() => {
  resetBackendWakeState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetBackendWakeState();
});

describe("cold starts", () => {
  it("wakes the instance and retries when the first call times out", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(okJson({ status: "healthy" }))
      .mockResolvedValueOnce(chatOk("namaste"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askChat("hi", [], {})).resolves.toBe("namaste");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/health");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/assistant/chat");
  });

  it("concurrent calls share a single wake", async () => {
    let chatCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/health")) return Promise.resolve(okJson({ status: "healthy" }));
      // Every chat call fails once, then succeeds — so both callers hit the
      // cold-start path at the same time.
      return chatCalls++ < 2 ? Promise.reject(abortError()) : Promise.resolve(chatOk("ok"));
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([askChat("a", [], {}), askChat("b", [], {})]);

    const healthCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/health"),
    );
    expect(healthCalls).toHaveLength(1);
  });

  it("reports a real outage in words, once the instance never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError()));

    // Caught up front: the rejection lands while the timers are being run
    // forward, which is before any assertion could be attached to it.
    const failure = askChat("hi", [], {}).catch((error: unknown) => error);
    // Run out the wake budget rather than waiting ninety real seconds.
    await vi.advanceTimersByTimeAsync(120_000);

    const error = await failure;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Could not reach the backend/);
    // The bare AbortError message says nothing a user could act on.
    expect((error as Error).message).toMatch(/no response within \d+s/);
  });

  it("does not wake anything when the first call succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatOk("fine"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(askChat("hi", [], {})).resolves.toBe("fine");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("wakeBackend", () => {
  it("counts any answer as awake, including a non-2xx health check", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(wakeBackend()).resolves.toBe(true);
  });
});

describe("isAnalysisEnabled", () => {
  it("waits for a sleeping instance instead of hiding the AI panels", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(okJson({ status: "healthy" }))
      .mockResolvedValueOnce(okJson({ success: true, data: { enabled: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(isAnalysisEnabled()).resolves.toBe(true);
  });

  it("is false when the backend is genuinely unreachable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const answer = isAnalysisEnabled();
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(answer).resolves.toBe(false);
  });
});
