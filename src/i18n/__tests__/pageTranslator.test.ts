import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A stand-in for the network layer: `translateTexts` "translates" by prefixing
 * with «, and remembers what it translated so `lookup` behaves like the real
 * cache does — synchronous hits for anything already seen.
 */
const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@/services/translationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/translationService")>();
  return {
    ...actual,
    primeLanguage: () => undefined,
    lookup: (text: string) => store.get(actual.normalizeText(text)),
    translateTexts: async (texts: string[]) => {
      const result = new Map<string, string>();
      texts.forEach((text) => {
        const normalized = actual.normalizeText(text);
        const translated = `«${normalized}`;
        store.set(normalized, translated);
        result.set(normalized, translated);
      });
      return result;
    },
  };
});

const { startPageTranslation } = await import("@/i18n/pageTranslator");

/** Long enough for the observer's debounce plus the fake "request". */
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

beforeEach(() => {
  store.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("startPageTranslation", () => {
  it("translates the text already on the page", async () => {
    document.body.innerHTML = `<h1>Health Check</h1><p>Log your meals</p>`;

    const handle = startPageTranslation("ta");
    await settle();

    expect(document.querySelector("h1")?.textContent).toBe("«Health Check");
    expect(document.querySelector("p")?.textContent).toBe("«Log your meals");
    handle.stop();
  });

  it("translates prose held in attributes", async () => {
    document.body.innerHTML = `<input placeholder="Search foods" aria-label="Food search" />`;

    const handle = startPageTranslation("ta");
    await settle();

    const input = document.querySelector("input");
    expect(input?.getAttribute("placeholder")).toBe("«Search foods");
    expect(input?.getAttribute("aria-label")).toBe("«Food search");
    handle.stop();
  });

  it("leaves opted-out content, code and bare numbers alone", async () => {
    document.body.innerHTML = `
      <span translate="no">Prakriva</span>
      <span class="notranslate">Vata</span>
      <code>npm run dev</code>
      <span>42</span>
    `;

    const handle = startPageTranslation("ta");
    await settle();

    expect(document.querySelector('[translate="no"]')?.textContent).toBe("Prakriva");
    expect(document.querySelector(".notranslate")?.textContent).toBe("Vata");
    expect(document.querySelector("code")?.textContent).toBe("npm run dev");
    expect(document.body.textContent).toContain("42");
    handle.stop();
  });

  it("translates content rendered after it started", async () => {
    document.body.innerHTML = `<div id="root"></div>`;

    const handle = startPageTranslation("ta");
    await settle();

    const paragraph = document.createElement("p");
    paragraph.textContent = "Your plan is ready";
    document.getElementById("root")?.appendChild(paragraph);
    await settle();

    expect(paragraph.textContent).toBe("«Your plan is ready");
    handle.stop();
  });

  it("re-translates text a re-render puts back in English", async () => {
    document.body.innerHTML = `<p>Meal Logging</p>`;

    const handle = startPageTranslation("ta");
    await settle();
    expect(document.querySelector("p")?.textContent).toBe("«Meal Logging");

    // What React does when it updates a text node it owns.
    document.querySelector("p")!.firstChild!.nodeValue = "Meal Logging";
    await settle();

    expect(document.querySelector("p")?.textContent).toBe("«Meal Logging");
    handle.stop();
  });

  it("restores the original English when stopped", async () => {
    document.body.innerHTML = `<h1>Health Check</h1><input placeholder="Search foods" />`;

    const handle = startPageTranslation("ta");
    await settle();
    expect(document.querySelector("h1")?.textContent).toBe("«Health Check");

    handle.stop();

    expect(document.querySelector("h1")?.textContent).toBe("Health Check");
    expect(document.querySelector("input")?.getAttribute("placeholder")).toBe("Search foods");
  });

  it("keeps the surrounding whitespace of the text it replaces", async () => {
    document.body.innerHTML = `<p>\n  Community\n</p>`;

    const handle = startPageTranslation("ta");
    await settle();

    expect(document.querySelector("p")?.firstChild?.nodeValue).toBe("\n  «Community\n");
    handle.stop();
  });

  it("does nothing at all for English", async () => {
    document.body.innerHTML = `<h1>Health Check</h1>`;

    const handle = startPageTranslation("en");
    await settle();

    expect(document.querySelector("h1")?.textContent).toBe("Health Check");
    handle.stop();
  });
});
