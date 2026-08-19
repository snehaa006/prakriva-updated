import { describe, expect, it } from "vitest";

import { parseChatMarkdown } from "@/lib/chatMarkdown";

describe("parseChatMarkdown", () => {
  it("keeps a plain reply as one paragraph", () => {
    expect(parseChatMarkdown("Try warm khichdi tonight.")).toEqual([
      { kind: "paragraph", text: "Try warm khichdi tonight." },
    ]);
  });

  it("joins the model's soft-wrapped lines into one paragraph", () => {
    expect(parseChatMarkdown("Try warm khichdi\ntonight.")).toEqual([
      { kind: "paragraph", text: "Try warm khichdi tonight." },
    ]);
  });

  it("reads headings, bullets and numbered steps", () => {
    const blocks = parseChatMarkdown(
      ["## Tonight", "", "- Warm khichdi", "- Ginger tea", "", "1. Soak the dal", "2. Cook it down"].join("\n"),
    );

    expect(blocks).toEqual([
      { kind: "heading", level: 2, text: "Tonight" },
      { kind: "list", ordered: false, items: ["Warm khichdi", "Ginger tea"] },
      { kind: "list", ordered: true, items: ["Soak the dal", "Cook it down"] },
    ]);
  });

  it("starts a new list rather than mixing markers", () => {
    const blocks = parseChatMarkdown(["- one", "1. two"].join("\n"));
    expect(blocks).toEqual([
      { kind: "list", ordered: false, items: ["one"] },
      { kind: "list", ordered: true, items: ["two"] },
    ]);
  });

  it("leaves inline emphasis for the renderer", () => {
    expect(parseChatMarkdown("Favour **warm** food")).toEqual([
      { kind: "paragraph", text: "Favour **warm** food" },
    ]);
  });
});
