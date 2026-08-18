import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTranslatable,
  lookup,
  normalizeText,
  resetTranslationCache,
  translateTexts,
} from "@/services/translationService";

/** Shape one gtx response for `texts`, translating each to `prefix + text`. */
const googleResponse = (texts: string[], prefix = "»") => [
  texts.map((text, index) => [
    `${prefix}${text}${index === texts.length - 1 ? "" : "\n"}`,
    `${text}${index === texts.length - 1 ? "" : "\n"}`,
    null,
    null,
    3,
  ]),
  null,
  "en",
];

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

beforeEach(() => {
  localStorage.clear();
  resetTranslationCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("normalizeText", () => {
  it("collapses the whitespace JSX indentation leaves behind", () => {
    expect(normalizeText("\n   Meal   Logging \n")).toBe("Meal Logging");
  });
});

describe("isTranslatable", () => {
  it("accepts prose", () => {
    expect(isTranslatable("Health Check")).toBe(true);
  });

  it("rejects numbers, punctuation and single letters", () => {
    expect(isTranslatable("42")).toBe(false);
    expect(isTranslatable("—")).toBe(false);
    expect(isTranslatable("  ")).toBe(false);
    expect(isTranslatable("g")).toBe(false);
  });
});

describe("translateTexts", () => {
  it("translates a batch and caches it for the next call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const query = new URL(url).searchParams.get("q") ?? "";
      return okResponse(googleResponse(query.split("\n")));
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await translateTexts(["Dashboard", "Meal Logging"], "ta");
    expect(first.get("Dashboard")).toBe("»Dashboard");
    expect(first.get("Meal Logging")).toBe("»Meal Logging");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call is served from memory — no further requests.
    const second = await translateTexts(["Dashboard"], "ta");
    expect(second.get("Dashboard")).toBe("»Dashboard");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lookup("Dashboard", "ta")).toBe("»Dashboard");
  });

  it("returns nothing for English rather than calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateTexts(["Dashboard"], "en");
    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers the hand-written dictionary over a machine translation", async () => {
    const fetchMock = vi.fn(async () => okResponse(googleResponse(["Dashboard"])));
    vi.stubGlobal("fetch", fetchMock);

    // "Dashboard" is in the curated Hindi dictionary.
    const result = await translateTexts(["Dashboard"], "hi");
    expect(result.get("Dashboard")).toBe("डैशबोर्ड");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries phrase by phrase when the batch comes back misaligned", async () => {
    let call = 0;
    const fetchMock = vi.fn(async (url: string) => {
      call += 1;
      const query = new URL(url).searchParams.get("q") ?? "";
      // The first (batched) call merges two phrases into one segment, which is
      // exactly the case that would misalign the translations.
      if (call === 1) return okResponse(googleResponse(["Dashboard Meal Logging"]));
      return okResponse(googleResponse(query.split("\n")));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateTexts(["Dashboard", "Meal Logging"], "ta");
    expect(result.get("Dashboard")).toBe("»Dashboard");
    expect(result.get("Meal Logging")).toBe("»Meal Logging");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("leaves text untranslated when every provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );

    const result = await translateTexts(["Dashboard"], "ta");
    expect(result.size).toBe(0);
    expect(lookup("Dashboard", "ta")).toBeUndefined();
  });

  it("falls back to the backend when the public endpoint is unreachable", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("translate.googleapis.com")) throw new Error("blocked");
      expect(init?.method).toBe("POST");
      return okResponse({ translations: ["பலகை"] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateTexts(["Dashboard"], "ta");
    expect(result.get("Dashboard")).toBe("பலகை");
  });

  it("stops calling out for a while after a failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    await translateTexts(["Dashboard"], "ta");
    const callsAfterFirst = fetchMock.mock.calls.length;

    await translateTexts(["Community"], "ta");
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("persists translations so a reload starts warm", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        okResponse(googleResponse((new URL(url).searchParams.get("q") ?? "").split("\n")))
      )
    );

    await translateTexts(["Dashboard"], "ta");
    vi.advanceTimersByTime(2000);

    // A fresh process (cleared in-memory state) reads the persisted copy.
    resetTranslationCache();
    expect(lookup("Dashboard", "ta")).toBe("»Dashboard");
  });
});
