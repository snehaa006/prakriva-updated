// Supabase access for the community circles (supabase/community.sql).
//
// As with disease screenings and lifestyle logs, a missing table degrades
// gracefully rather than erroring: the Community page shows an empty state and
// says the circles are not set up yet. That keeps a deploy where the SQL has
// not been applied from taking a patient's whole page down.
//
// The privacy rules are enforced in the database, not here — a patient can
// only read the chat of a circle she has been approved into. This module is
// row mapping and nothing more.

import { supabase } from "@/lib/supabase";
import type {
  CommunityGroup,
  CommunityMembership,
  CommunityMessage,
  MembershipStatus,
} from "@/types/community";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

/** Thrown for real failures, so the page can tell them apart from "no table". */
export class CommunityUnavailableError extends Error {
  constructor() {
    super("The community circles have not been set up in this project yet.");
    this.name = "CommunityUnavailableError";
  }
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  who_its_for: string;
  matches: string[] | null;
  member_count: number | null;
}

const toGroup = (row: GroupRow): CommunityGroup => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  whoItsFor: row.who_its_for,
  matches: row.matches ?? [],
  memberCount: row.member_count ?? 0,
});

interface MembershipRow {
  id: string;
  group_id: string;
  patient_id: string;
  display_name: string;
  intro: string | null;
  status: MembershipStatus;
  requested_at: string;
  decided_at: string | null;
}

const toMembership = (row: MembershipRow): CommunityMembership => ({
  id: row.id,
  groupId: row.group_id,
  patientId: row.patient_id,
  displayName: row.display_name,
  intro: row.intro,
  status: row.status,
  requestedAt: row.requested_at,
  decidedAt: row.decided_at,
});

interface MessageRow {
  id: string;
  group_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const toMessage = (row: MessageRow): CommunityMessage => ({
  id: row.id,
  groupId: row.group_id,
  authorId: row.author_id,
  authorName: row.author_name,
  body: row.body,
  createdAt: row.created_at,
});

const MEMBERSHIP_COLUMNS =
  "id, group_id, patient_id, display_name, intro, status, requested_at, decided_at";

/** Every active circle. Empty when the tables have not been created yet. */
export const fetchGroups = async (): Promise<CommunityGroup[]> => {
  const { data, error } = await supabase
    .from("community_groups")
    .select("id, slug, name, description, who_its_for, matches, member_count")
    .eq("is_active", true)
    .order("name");

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as GroupRow[]).map(toGroup);
};

/** This patient's own memberships and outstanding requests. */
export const fetchMyMemberships = async (
  patientId: string
): Promise<CommunityMembership[]> => {
  const { data, error } = await supabase
    .from("community_memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("patient_id", patientId);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as MembershipRow[]).map(toMembership);
};

/**
 * The pending requests in circles this patient belongs to.
 *
 * RLS returns rows only for circles she is an approved member of, so passing
 * her own group ids is a narrowing convenience rather than the access control.
 */
export const fetchPendingRequests = async (
  groupIds: string[]
): Promise<CommunityMembership[]> => {
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("community_memberships")
    .select(MEMBERSHIP_COLUMNS)
    .in("group_id", groupIds)
    .eq("status", "pending")
    .order("requested_at");

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as MembershipRow[]).map(toMembership);
};

/**
 * Ask to join a circle.
 *
 * The status the row ends up with is the database's call, not ours: the
 * founding member of an empty circle is admitted immediately, everyone else
 * waits for a member to approve them. The inserted row is read back so the UI
 * shows whichever actually happened.
 */
export const requestToJoin = async ({
  groupId,
  patientId,
  displayName,
  intro,
}: {
  groupId: string;
  patientId: string;
  displayName: string;
  intro?: string;
}): Promise<CommunityMembership> => {
  const { data, error } = await supabase
    .from("community_memberships")
    .insert({
      group_id: groupId,
      patient_id: patientId,
      display_name: displayName,
      intro: intro?.trim() || null,
    })
    .select(MEMBERSHIP_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error)) throw new CommunityUnavailableError();
    throw new Error(error.message);
  }

  return toMembership(data as MembershipRow);
};

/** Approve or decline someone else's request. Members only (enforced in SQL). */
export const decideRequest = async (
  membershipId: string,
  status: Extract<MembershipStatus, "approved" | "declined">
): Promise<CommunityMembership> => {
  const { data, error } = await supabase
    .from("community_memberships")
    .update({ status })
    .eq("id", membershipId)
    .select(MEMBERSHIP_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toMembership(data as MembershipRow);
};

/** Leave a circle, or withdraw a request that has not been decided. */
export const leaveGroup = async (membershipId: string): Promise<void> => {
  const { error } = await supabase
    .from("community_memberships")
    .delete()
    .eq("id", membershipId);

  if (error) throw new Error(error.message);
};

/**
 * The most recent messages in a circle, oldest first.
 *
 * Fetched newest-first and reversed so a busy circle returns its *latest*
 * `limit` messages rather than the oldest ones from the day it opened.
 */
export const fetchMessages = async (
  groupId: string,
  limit = 100
): Promise<CommunityMessage[]> => {
  const { data, error } = await supabase
    .from("community_messages")
    .select("id, group_id, author_id, author_name, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as MessageRow[]).map(toMessage).reverse();
};

/** Post to a circle. The author name is copied onto the message at send time. */
export const sendMessage = async ({
  groupId,
  authorId,
  authorName,
  body,
}: {
  groupId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<CommunityMessage> => {
  const { data, error } = await supabase
    .from("community_messages")
    .insert({
      group_id: groupId,
      author_id: authorId,
      author_name: authorName,
      body,
    })
    .select("id, group_id, author_id, author_name, body, created_at")
    .single();

  if (error) throw new Error(error.message);
  return toMessage(data as MessageRow);
};

/**
 * Live updates for a circle's chat.
 *
 * Returns an unsubscribe function. Realtime has to be enabled on
 * `community_messages` for this to fire (the SQL adds it to the
 * `supabase_realtime` publication); where it isn't, the chat still works — the
 * page just shows new messages on the next send or reload.
 */
export const subscribeToMessages = (
  groupId: string,
  onMessage: (message: CommunityMessage) => void
): (() => void) => {
  const channel = supabase
    .channel(`community:${groupId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "community_messages",
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => onMessage(toMessage(payload.new as MessageRow))
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
