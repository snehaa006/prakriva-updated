import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Supabase stub covering the chains this service uses:
 * `from(t).select().eq().order()`, `.in().eq().order()`, `.select().limit()`,
 * `.insert().select().single()`, `.update().eq().select().single()` and
 * `.delete().eq()`. Each builder resolves to whatever is queued for its table.
 */
const state = vi.hoisted(() => ({
  results: new Map<string, { data: unknown; error: unknown }>(),
  lastInsert: null as unknown,
  lastUpdate: null as unknown,
  lastDelete: null as string | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const result = () => state.results.get(table) ?? { data: [], error: null };

      const builder: Record<string, unknown> = {};
      const chain = () => builder;

      builder.select = chain;
      builder.eq = chain;
      builder.in = chain;
      builder.order = chain;
      builder.limit = () => Promise.resolve(result());
      builder.single = () => Promise.resolve(result());
      builder.insert = (row: unknown) => {
        state.lastInsert = row;
        return builder;
      };
      builder.update = (row: unknown) => {
        state.lastUpdate = row;
        return builder;
      };
      builder.delete = () => ({
        eq: (_column: string, value: string) => {
          state.lastDelete = value;
          return Promise.resolve({ error: result().error });
        },
      });

      // `.eq()` terminates the delete chain and the membership read alike, so
      // the builder itself has to be awaitable.
      builder.then = (resolve: (value: unknown) => unknown) => resolve(result());

      return builder;
    },
  },
}));

const {
  CommunityUnavailableError,
  decideRequest,
  fetchGroups,
  fetchMessages,
  fetchMyMemberships,
  fetchPendingRequests,
  leaveGroup,
  requestToJoin,
  sendMessage,
} = await import("../communityService");

const MISSING_TABLE = { data: null, error: { code: "42P01" } };

beforeEach(() => {
  state.results.clear();
  state.lastInsert = null;
  state.lastUpdate = null;
  state.lastDelete = null;
});

describe("fetchGroups", () => {
  it("maps the row shape onto the app's", async () => {
    state.results.set("community_groups", {
      data: [
        {
          id: "g1",
          slug: "pcos",
          name: "PCOS & PCOD Circle",
          description: "desc",
          who_its_for: "women with PCOS",
          matches: ["pcos"],
          member_count: 12,
        },
      ],
      error: null,
    });

    expect(await fetchGroups()).toEqual([
      {
        id: "g1",
        slug: "pcos",
        name: "PCOS & PCOD Circle",
        description: "desc",
        whoItsFor: "women with PCOS",
        matches: ["pcos"],
        memberCount: 12,
      },
    ]);
  });

  it("returns nothing rather than throwing when the tables are unapplied", async () => {
    state.results.set("community_groups", MISSING_TABLE);
    expect(await fetchGroups()).toEqual([]);
  });

  it("surfaces a real failure", async () => {
    state.results.set("community_groups", {
      data: null,
      error: { code: "500", message: "boom" },
    });
    await expect(fetchGroups()).rejects.toThrow("boom");
  });
});

describe("memberships", () => {
  const row = {
    id: "m1",
    group_id: "g1",
    patient_id: "p1",
    display_name: "Asha K.",
    intro: "28 weeks",
    status: "pending",
    requested_at: "2026-08-01T10:00:00Z",
    decided_at: null,
  };

  it("maps a patient's own memberships", async () => {
    state.results.set("community_memberships", { data: [row], error: null });

    expect(await fetchMyMemberships("p1")).toEqual([
      {
        id: "m1",
        groupId: "g1",
        patientId: "p1",
        displayName: "Asha K.",
        intro: "28 weeks",
        status: "pending",
        requestedAt: "2026-08-01T10:00:00Z",
        decidedAt: null,
      },
    ]);
  });

  it("skips the query entirely when she is in no circles", async () => {
    state.results.set("community_memberships", { data: [row], error: null });
    expect(await fetchPendingRequests([])).toEqual([]);
  });

  it("never sends a status on a join request — the database decides it", async () => {
    state.results.set("community_memberships", {
      data: { ...row, status: "approved" },
      error: null,
    });

    const membership = await requestToJoin({
      groupId: "g1",
      patientId: "p1",
      displayName: "Asha K.",
      intro: "  28 weeks  ",
    });

    expect(state.lastInsert).toEqual({
      group_id: "g1",
      patient_id: "p1",
      display_name: "Asha K.",
      intro: "28 weeks",
    });
    // Read back, so the UI shows whichever the trigger actually did.
    expect(membership.status).toBe("approved");
  });

  it("stores an empty intro as null rather than blank text", async () => {
    state.results.set("community_memberships", { data: row, error: null });
    await requestToJoin({
      groupId: "g1",
      patientId: "p1",
      displayName: "Asha K.",
      intro: "   ",
    });
    expect(state.lastInsert).toMatchObject({ intro: null });
  });

  it("tells the caller when the community has not been set up", async () => {
    state.results.set("community_memberships", MISSING_TABLE);
    await expect(
      requestToJoin({ groupId: "g1", patientId: "p1", displayName: "Asha K." })
    ).rejects.toBeInstanceOf(CommunityUnavailableError);
  });

  it("sends only the status when deciding on a request", async () => {
    state.results.set("community_memberships", {
      data: { ...row, status: "approved" },
      error: null,
    });
    await decideRequest("m1", "approved");
    expect(state.lastUpdate).toEqual({ status: "approved" });
  });

  it("leaves a circle by membership id", async () => {
    state.results.set("community_memberships", { data: null, error: null });
    await leaveGroup("m1");
    expect(state.lastDelete).toBe("m1");
  });
});

describe("messages", () => {
  const row = (id: string, createdAt: string) => ({
    id,
    group_id: "g1",
    author_id: "p2",
    author_name: "Priya S.",
    body: "hello",
    created_at: createdAt,
  });

  it("returns the latest messages oldest-first", async () => {
    // The query sorts newest-first so a busy circle returns its most recent
    // page; the service flips it back for display.
    state.results.set("community_messages", {
      data: [row("newest", "2026-08-03T10:00:00Z"), row("older", "2026-08-01T10:00:00Z")],
      error: null,
    });

    expect((await fetchMessages("g1")).map((m) => m.id)).toEqual(["older", "newest"]);
  });

  it("shows an empty chat instead of failing when the tables are unapplied", async () => {
    state.results.set("community_messages", MISSING_TABLE);
    expect(await fetchMessages("g1")).toEqual([]);
  });

  it("copies the author's display name onto the message", async () => {
    state.results.set("community_messages", {
      data: row("m1", "2026-08-03T10:00:00Z"),
      error: null,
    });

    const message = await sendMessage({
      groupId: "g1",
      authorId: "p2",
      authorName: "Priya S.",
      body: "hello",
    });

    expect(state.lastInsert).toEqual({
      group_id: "g1",
      author_id: "p2",
      author_name: "Priya S.",
      body: "hello",
    });
    expect(message.authorName).toBe("Priya S.");
  });
});
