import { describe, expect, it } from "vitest";
import {
  cleanMessageBody,
  defaultDisplayName,
  isRecommendedFor,
  membershipFor,
  membershipStatusFor,
  profileMatchKeys,
  sortGroupsForPatient,
} from "../community";
import type { CommunityGroup, CommunityMembership } from "@/types/community";

const group = (
  slug: string,
  matches: string[],
  memberCount = 0,
  name = slug
): CommunityGroup => ({
  id: `id-${slug}`,
  slug,
  name,
  description: "",
  whoItsFor: "",
  matches,
  memberCount,
});

const membership = (
  groupId: string,
  status: CommunityMembership["status"]
): CommunityMembership => ({
  id: `m-${groupId}`,
  groupId,
  patientId: "p1",
  displayName: "Asha K.",
  intro: null,
  status,
  requestedAt: "2026-08-01T10:00:00Z",
  decidedAt: null,
});

describe("profileMatchKeys", () => {
  it("matches the spellings patients actually use for their conditions", () => {
    expect(profileMatchKeys({ conditions: ["PCOD", "Hypothyroidism"] })).toEqual(
      expect.arrayContaining(["pcos", "thyroid"])
    );
  });

  it("picks up screening findings as well as self-reported conditions", () => {
    const keys = profileMatchKeys({
      conditions: ["Anemia"],
      screeningConditions: ["gdm"],
    });
    expect(keys).toEqual(expect.arrayContaining(["anaemia", "gdm"]));
  });

  it("turns the life stage into its own key", () => {
    expect(profileMatchKeys({ lifeStage: "pregnancy" })).toContain("pregnancy");
    expect(profileMatchKeys({ lifeStage: "postpartum" })).toContain("postpartum");
    expect(profileMatchKeys({ lifeStage: "menopause" })).toContain("menopause");
    expect(profileMatchKeys({ isBreastfeeding: "yes" })).toContain("breastfeeding");
  });

  it("always includes the open circle, and never duplicates a key", () => {
    const keys = profileMatchKeys({ conditions: ["PCOS", "pcod", "polycystic ovaries"] });
    expect(keys).toContain("general");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("drops conditions it does not recognise rather than guessing", () => {
    expect(profileMatchKeys({ conditions: ["purple spots"] })).toEqual(["general"]);
  });
});

describe("isRecommendedFor", () => {
  it("recommends a circle on a real overlap", () => {
    expect(isRecommendedFor(group("pcos", ["pcos"]), ["general", "pcos"])).toBe(true);
  });

  it("does not recommend the open circle to everyone", () => {
    // It suits everybody, so badging it "for you" would say nothing.
    expect(isRecommendedFor(group("womens-wellness", ["general"]), ["general"])).toBe(
      false
    );
  });

  it("leaves unrelated circles unrecommended", () => {
    expect(isRecommendedFor(group("thyroid", ["thyroid"]), ["general", "pcos"])).toBe(
      false
    );
  });
});

describe("sortGroupsForPatient", () => {
  it("puts the circles that match her circumstances first", () => {
    const groups = [
      group("womens-wellness", ["general"], 500, "Wellness"),
      group("thyroid", ["thyroid"], 10, "Thyroid"),
      group("pcos", ["pcos"], 3, "PCOS"),
    ];

    const sorted = sortGroupsForPatient(groups, profileMatchKeys({ conditions: ["PCOD"] }));
    expect(sorted[0].slug).toBe("pcos");
    // Then the busiest of the rest.
    expect(sorted[1].slug).toBe("womens-wellness");
  });

  it("is stable and does not mutate the input", () => {
    const groups = [group("b", [], 1, "B"), group("a", [], 1, "A")];
    const sorted = sortGroupsForPatient(groups, ["general"]);
    expect(sorted.map((g) => g.slug)).toEqual(["a", "b"]);
    expect(groups.map((g) => g.slug)).toEqual(["b", "a"]);
  });
});

describe("defaultDisplayName", () => {
  it("shortens a full name to a first name and an initial", () => {
    expect(defaultDisplayName("Asha Kulkarni")).toBe("Asha K.");
    expect(defaultDisplayName("  priya  sharma ")).toBe("priya S.");
  });

  it("handles a single name and a missing one", () => {
    expect(defaultDisplayName("Asha")).toBe("Asha");
    expect(defaultDisplayName("")).toBe("Member");
    expect(defaultDisplayName(undefined)).toBe("Member");
  });
});

describe("membership lookups", () => {
  const memberships = [membership("g1", "approved"), membership("g2", "pending")];

  it("reports where she stands in each circle", () => {
    expect(membershipStatusFor(memberships, "g1")).toBe("approved");
    expect(membershipStatusFor(memberships, "g2")).toBe("pending");
    expect(membershipStatusFor(memberships, "g3")).toBe("none");
    expect(membershipFor(memberships, "g3")).toBeUndefined();
  });
});

describe("cleanMessageBody", () => {
  it("refuses whitespace-only messages", () => {
    expect(cleanMessageBody("   \n ")).toBeNull();
    expect(cleanMessageBody("")).toBeNull();
  });

  it("trims and caps at the length the database accepts", () => {
    expect(cleanMessageBody("  hello  ")).toBe("hello");
    expect(cleanMessageBody("x".repeat(2500))).toHaveLength(2000);
  });
});
