import { vi } from "vitest";

export interface TableResponse {
  data: unknown;
  error?: unknown;
}

/**
 * A stand-in for the Supabase client covering the slice of the API the auth
 * code uses: `auth.signUp`, `auth.signInWithPassword`, and the
 * `from(...).select(...).eq(...).maybeSingle()` read chain.
 *
 * Queue per-table results with `setTable`; every builder method returns the
 * builder so chains of any length resolve to the queued response.
 */
export const createSupabaseMock = () => {
  const tableResponses = new Map<string, TableResponse>();

  const signUp = vi.fn(async () => ({
    data: { user: { id: "user-1" }, session: { access_token: "token" } },
    error: null,
  }));

  const signInWithPassword = vi.fn(async () => ({
    data: { user: { id: "user-1" }, session: { access_token: "token" } },
    error: null,
  }));

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.maybeSingle = vi.fn(async () => {
      const queued = tableResponses.get(table);
      return { data: queued?.data ?? null, error: queued?.error ?? null };
    });

    return builder;
  });

  return {
    supabase: {
      auth: { signUp, signInWithPassword },
      from,
    },
    signUp,
    signInWithPassword,
    from,
    setTable(table: string, response: TableResponse) {
      tableResponses.set(table, response);
    },
    reset() {
      tableResponses.clear();
      signUp.mockClear();
      signInWithPassword.mockClear();
      from.mockClear();
    },
  };
};

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
