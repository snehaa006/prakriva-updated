import { beforeEach, describe, expect, it } from "vitest";
import {
  readCache,
  writeCache,
  clearCache,
  clearCacheByPrefix,
} from "../localCache";

beforeEach(() => {
  window.localStorage.clear();
});

describe("readCache / writeCache", () => {
  it("round-trips a value", () => {
    writeCache("draft", { meals: ["rice"] });

    expect(readCache<{ meals: string[] }>("draft")).toEqual({ meals: ["rice"] });
  });

  it("returns null for a key that was never written", () => {
    expect(readCache("missing")).toBeNull();
  });

  it("namespaces keys so unrelated localStorage entries are ignored", () => {
    window.localStorage.setItem("draft", JSON.stringify({ value: 1 }));

    expect(readCache("draft")).toBeNull();
  });

  it("drops entries older than maxAgeMs", () => {
    writeCache("draft", "stale");

    expect(readCache("draft", -1)).toBeNull();
    // The expired entry is evicted rather than left behind.
    expect(readCache("draft")).toBeNull();
  });

  it("returns null rather than throwing on corrupted JSON", () => {
    window.localStorage.setItem("prakriva:draft", "{not json");

    expect(readCache("draft")).toBeNull();
  });
});

describe("clearCache", () => {
  it("removes a single entry", () => {
    writeCache("draft", 1);
    clearCache("draft");

    expect(readCache("draft")).toBeNull();
  });

  it("clears every entry sharing a prefix", () => {
    writeCache("plan:meals", 1);
    writeCache("plan:patient", 2);
    writeCache("other", 3);

    clearCacheByPrefix("plan:");

    expect(readCache("plan:meals")).toBeNull();
    expect(readCache("plan:patient")).toBeNull();
    expect(readCache("other")).toBe(3);
  });
});
