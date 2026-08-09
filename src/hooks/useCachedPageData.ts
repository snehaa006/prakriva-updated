import { useQuery, type QueryKey } from "@tanstack/react-query";

/**
 * A page's data, loaded once and kept.
 *
 * Every page used to load itself from scratch in a `useEffect` with its own
 * `isLoading` starting at `true`, so *navigating between tabs* — not just the
 * first visit — put a full-page spinner over data that had been on screen a
 * second earlier. Routing unmounts the previous page, and the fresh mount
 * knew nothing about what the last one had already fetched.
 *
 * React Query's cache outlives the unmount (the client lives at the app root),
 * so this hook gives back the previous answer immediately and revalidates
 * underneath. `isFirstLoad` is the only state worth blocking on: it is true
 * when there is genuinely nothing to show yet, and false on every return
 * visit inside the cache window.
 *
 * @param key    cache key — include the user id, so one account never sees
 *               another's cached page.
 * @param load   fetches everything the page needs, as one snapshot.
 */
export function useCachedPageData<T>(
  key: QueryKey,
  load: () => Promise<T>,
  {
    enabled = true,
    // Matches the app-wide default in App.tsx. Long enough that tab switching
    // is free; short enough that a page left open still catches up.
    staleTime = 5 * 60 * 1000,
    /** Poll while the page is open, for data other people change. */
    refreshMs,
  }: { enabled?: boolean; staleTime?: number; refreshMs?: number } = {}
) {
  const query = useQuery({
    queryKey: key,
    queryFn: load,
    enabled,
    staleTime,
    refetchInterval: refreshMs,
  });

  return {
    data: query.data,
    /**
     * Nothing to show yet — the only case where a page should show a spinner.
     *
     * A query still waiting on `enabled` counts: callers disable it while a
     * prerequisite is resolving (the signed-in user id), and rendering the
     * page empty for that beat is the same flicker the cache exists to stop.
     */
    isFirstLoad: query.isPending,
    /** Revalidating underneath data that is already on screen. */
    isRefreshing: query.isFetching && !query.isPending,
    error: (query.error as Error | null) ?? null,
    /** Re-read after a write, so the page reflects what was just saved. */
    refresh: query.refetch,
  };
}

export default useCachedPageData;
