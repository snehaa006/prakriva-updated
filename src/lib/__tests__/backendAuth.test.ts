import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAccessToken: auth.getAccessToken }));

import { backendAuthHeaders } from "@/lib/backendAuth";

describe("backendAuthHeaders", () => {
  beforeEach(() => {
    auth.getAccessToken.mockReset();
  });

  it("carries the session's access token as a bearer header", async () => {
    auth.getAccessToken.mockResolvedValue("abc.def.ghi");
    await expect(backendAuthHeaders()).resolves.toEqual({ Authorization: "Bearer abc.def.ghi" });
  });

  it("is empty when nobody is signed in", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    await expect(backendAuthHeaders()).resolves.toEqual({});
  });

  it("is empty, not a rejection, when the session cannot be read", async () => {
    auth.getAccessToken.mockRejectedValue(new Error("storage unavailable"));
    await expect(backendAuthHeaders()).resolves.toEqual({});
  });
});
