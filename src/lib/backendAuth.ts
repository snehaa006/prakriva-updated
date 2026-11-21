// src/lib/backendAuth.ts
// The headers that identify the signed-in user to the Flask backend.
//
// The backend holds the Supabase service-role key, which bypasses row level
// security, so it cannot lean on RLS to know who is asking: every route that
// reads patient data or spends Gemini quota checks a bearer token instead.

import { getAccessToken } from "@/lib/supabase";

/**
 * `{ Authorization: "Bearer <token>" }` for the current session, or `{}` when
 * signed out.
 *
 * Never throws. A request without the header still goes out and comes back as
 * a readable 401 from the backend, which is a better failure than one thrown
 * here before the request was even made.
 */
export const backendAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    // getSession refreshes an expired access token before handing it over.
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};
