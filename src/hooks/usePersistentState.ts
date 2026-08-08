import { useEffect, useRef, useState } from "react";
import { readCache, writeCache, ONE_DAY_MS } from "@/lib/localCache";

/**
 * `useState`, but the value is mirrored into localStorage so it survives a
 * page refresh. Falls back to `initialValue` when nothing (or something stale)
 * is cached.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  maxAgeMs: number = ONE_DAY_MS
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const cached = readCache<T>(key, maxAgeMs);
    return cached === null ? initialValue : cached;
  });

  // Skip the write on the very first render: it would only rewrite what we
  // just read, and it would clobber the cache when the initial value is empty.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    writeCache(key, value);
  }, [key, value]);

  return [value, setValue];
}

export default usePersistentState;
