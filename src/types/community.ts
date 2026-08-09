// types/community.ts
// Mirrors the tables in supabase/community.sql. Keep the two in sync — the
// database is the authority on what a membership status can be.

/** A peer support circle patients can ask to join. */
export interface CommunityGroup {
  id: string;
  /** Stable handle; renaming a circle must not change who it suits. */
  slug: string;
  name: string;
  description: string;
  whoItsFor: string;
  /**
   * Condition keys and life stages this circle is for. Matched against the
   * patient's profile and screening in `src/lib/community.ts`.
   */
  matches: string[];
  memberCount: number;
}

/**
 * Where a join request has got to. `pending` means she has asked and an
 * existing member has not decided yet; the founding member of an empty circle
 * is admitted straight away (see `community_admit()` in the SQL).
 */
export type MembershipStatus = "pending" | "approved" | "declined";

export interface CommunityMembership {
  id: string;
  groupId: string;
  patientId: string;
  /** What she is called in the chat — not necessarily her real name. */
  displayName: string;
  intro: string | null;
  status: MembershipStatus;
  requestedAt: string;
  decidedAt: string | null;
}

export interface CommunityMessage {
  id: string;
  groupId: string;
  authorId: string;
  /** Copied at send time, so the thread reads correctly forever after. */
  authorName: string;
  body: string;
  createdAt: string;
}
