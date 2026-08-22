import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase stub for the one chain contactService uses: `from(t).insert(row)`.
 *
 * `insertResult` is what the insert resolves to, so a test can make the table
 * missing, make the network fail, or let the write succeed.
 */
const state = vi.hoisted(() => ({
  insertResult: { error: null as unknown },
  insertThrows: null as Error | null,
  lastTable: "" as string,
  lastRow: null as unknown,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      state.lastTable = table;
      return {
        insert: async (row: unknown) => {
          state.lastRow = row;
          if (state.insertThrows) throw state.insertThrows;
          return state.insertResult;
        },
      };
    },
  },
}));

const {
  CONTACT_EMAIL,
  MESSAGE_MAX_LENGTH,
  buildMailtoHref,
  sendContactMessage,
  validateContact,
} = await import("../contactService");

const valid = {
  name: "Ananya Sharma",
  email: "Ananya@Example.COM",
  role: "patient" as const,
  message: "I am in my second trimester and would like to know if this suits me.",
};

beforeEach(() => {
  state.insertResult = { error: null };
  state.insertThrows = null;
  state.lastTable = "";
  state.lastRow = null;
});

describe("validateContact", () => {
  it("accepts a filled-in form", () => {
    expect(validateContact(valid)).toEqual({});
  });

  it("asks for a name, an address and a message", () => {
    const errors = validateContact({ name: "  ", email: "", role: "other", message: "" });
    expect(Object.keys(errors).sort()).toEqual(["email", "message", "name"]);
  });

  it("rejects an address with no domain", () => {
    expect(validateContact({ ...valid, email: "ananya@localhost" }).email).toBeTruthy();
  });

  it("accepts plus-addressing and a long TLD", () => {
    // The pattern is deliberately loose; over-strict validation locks real
    // people out of the only way to reach a person.
    expect(validateContact({ ...valid, email: "a+prakriva@sub.example.photography" }).email)
      .toBeUndefined();
  });

  it("rejects a message that is too short or too long", () => {
    expect(validateContact({ ...valid, message: "hi" }).message).toBeTruthy();
    expect(validateContact({ ...valid, message: "x".repeat(MESSAGE_MAX_LENGTH + 1) }).message)
      .toBeTruthy();
  });
});

describe("sendContactMessage", () => {
  it("writes a trimmed, lowercased row to contact_messages", async () => {
    const result = await sendContactMessage({ ...valid, name: "  Ananya Sharma  " });

    expect(result).toEqual({ status: "sent" });
    expect(state.lastTable).toBe("contact_messages");
    expect(state.lastRow).toEqual({
      name: "Ananya Sharma",
      // Addresses are case-insensitive; storing the typed casing would make
      // the same person look like two.
      email: "ananya@example.com",
      role: "patient",
      message: valid.message,
    });
  });

  it("reports invalid input without touching the database", async () => {
    const result = await sendContactMessage({ ...valid, email: "nope" });

    expect(result.status).toBe("invalid");
    expect(state.lastTable).toBe("");
  });

  it("falls back to mailto when the table is not provisioned", async () => {
    state.insertResult = { error: { code: "42P01", message: "relation does not exist" } };

    const result = await sendContactMessage(valid);

    // The whole point: a deployment without the SQL applied must still give
    // the visitor a way through, never a silent success.
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") throw new Error("expected unavailable");
    expect(result.mailtoHref).toContain(`mailto:${CONTACT_EMAIL}`);
    expect(result.reason).toMatch(/not set up/i);
  });

  it("falls back to mailto when the insert throws", async () => {
    state.insertThrows = new Error("Failed to fetch");

    const result = await sendContactMessage(valid);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toBe("Failed to fetch");
  });

  it("surfaces an unexpected database error rather than claiming success", async () => {
    state.insertResult = { error: { code: "23514", message: "check constraint violated" } };

    const result = await sendContactMessage(valid);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toBe("check constraint violated");
  });
});

describe("buildMailtoHref", () => {
  it("prefills the subject and the whole message", () => {
    const href = buildMailtoHref(valid);
    const body = decodeURIComponent(href.split("body=")[1]);

    expect(href).toContain(`mailto:${CONTACT_EMAIL}`);
    expect(body).toContain("Ananya Sharma");
    expect(body).toContain("I am a: patient");
    expect(body).toContain(valid.message);
  });
});
