// Which community circles suit a given patient, and how she appears in them.
//
// Pure and dependency-free so it is unit testable (see
// src/lib/__tests__/community.test.ts); everything that touches Supabase lives
// in src/services/communityService.ts.
//
// The matching reuses the condition aliases from the exercise recommendations
// rather than a second list of spellings: "PCOD" in a profile has to reach the
// PCOS circle for the same reason it has to reach the PCOS exercise plan.

import { matchConditionKey } from "@/lib/exerciseRecommendations";
import type {
  CommunityGroup,
  CommunityMembership,
  MembershipStatus,
} from "@/types/community";

/** The profile fields the matching reads. Everything is optional. */
export interface CommunityProfileInput {
  /** Conditions the patient ticked or typed in her questionnaire. */
  conditions?: string[];
  /** Conditions her latest screening flagged (canonical keys). */
  screeningConditions?: string[];
  /** `patients.assessment_data.lifeStage`. */
  lifeStage?: string;
  /** `patients.assessment_data.isBreastfeeding` — "yes" / "no". */
  isBreastfeeding?: string;
}

/**
 * The keys a patient's circumstances match on: her condition keys plus her
 * life stage. `general` is always present — the open circle suits everyone.
 */
export const profileMatchKeys = ({
  conditions = [],
  screeningConditions = [],
  lifeStage,
  isBreastfeeding,
}: CommunityProfileInput): string[] => {
  const keys = new Set<string>(["general"]);

  for (const raw of [...screeningConditions, ...conditions]) {
    const key = matchConditionKey(raw);
    if (key) keys.add(key);
  }

  if (lifeStage === "pregnancy") keys.add("pregnancy");
  if (lifeStage === "postpartum") keys.add("postpartum");
  if (lifeStage === "menopause") keys.add("menopause");
  if (isBreastfeeding === "yes") keys.add("breastfeeding");

  return [...keys];
};

/**
 * Is this circle one we should point her at?
 *
 * The open circle (`general`) is deliberately *not* treated as a match: it
 * suits everyone, so badging it "recommended for you" would say nothing. A
 * circle only gets recommended on a real overlap.
 */
export const isRecommendedFor = (group: CommunityGroup, keys: string[]): boolean =>
  group.matches.some((match) => match !== "general" && keys.includes(match));

/**
 * Will she be let in on the spot, rather than waiting for a member to approve?
 *
 * Any overlap counts here, `general` included: the open circle is open to
 * everyone, so it admits outright even though it is never *recommended*.
 *
 * This only decides what the join dialog promises her — the database makes the
 * real call in `community_admit()` (supabase/community.sql) from her stored
 * record, which is why a browser cannot talk its way into a circle. The two
 * can also disagree harmlessly in her favour: the first patient into an empty
 * circle is admitted whether or not she matches it, so a request this returns
 * `false` for may still come back approved.
 */
export const willJoinImmediately = (
  group: CommunityGroup,
  keys: string[]
): boolean => group.matches.some((match) => keys.includes(match));

/**
 * A name to post under, from her account name: first name plus the initial of
 * the last. These are circles about miscarriage, mental health and PCOS — the
 * default should not be her full name, though she can type whatever she likes
 * over it.
 */
export const defaultDisplayName = (fullName?: string | null): string => {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Member";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

/** The membership for a circle, if she has one. */
export const membershipFor = (
  memberships: CommunityMembership[],
  groupId: string
): CommunityMembership | undefined => memberships.find((m) => m.groupId === groupId);

/** Her standing in a circle: joined, waiting, turned down, or not asked yet. */
export const membershipStatusFor = (
  memberships: CommunityMembership[],
  groupId: string
): MembershipStatus | "none" => membershipFor(memberships, groupId)?.status ?? "none";

/**
 * Browse order: circles that match her circumstances first, then the biggest,
 * then alphabetically so the list never reshuffles between renders.
 */
export const sortGroupsForPatient = (
  groups: CommunityGroup[],
  keys: string[]
): CommunityGroup[] =>
  [...groups].sort((a, b) => {
    const recommended = Number(isRecommendedFor(b, keys)) - Number(isRecommendedFor(a, keys));
    if (recommended !== 0) return recommended;
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    return a.name.localeCompare(b.name);
  });

/** Trimmed message text, or null when there is nothing worth sending. */
export const cleanMessageBody = (raw: string): string | null => {
  const body = raw.trim();
  if (body === "") return null;
  // Matches the length check on `community_messages.body`, so an over-long
  // message is caught before the round trip rather than as a 400.
  return body.slice(0, 2000);
};
