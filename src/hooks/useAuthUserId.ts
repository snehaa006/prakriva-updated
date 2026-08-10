import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Shared cache key, so every caller reuses one answer rather than asking again. */
export const AUTH_USER_ID_KEY = ["auth-user-id"] as const;

/**
 * The signed-in user's id.
 *
 * `supabase.auth.getUser()` is a round trip to the auth server, and every page
 * used to make its own before it could start loading anything — so each tab
 * switch paid for an auth call before the first query even left. Going through
 * react-query means the answer is fetched once and shared by every page that
 * needs it (including `useDoctorPatients`, which owns the same key).
 *
 * Returns `null` while it is still resolving as well as when nobody is signed
 * in; callers gate their own queries on it, so both cases behave the same.
 */
export function useAuthUserId(): string | null {
  const { data } = useQuery({
    queryKey: AUTH_USER_ID_KEY,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  return data ?? null;
}

export default useAuthUserId;
