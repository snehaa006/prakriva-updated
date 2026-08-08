// Pure streak math for the "No Junk Food Streak" feature. Kept free of
// Supabase/React so it is trivially testable — see
// src/lib/__tests__/junkFoodStreak.test.ts.

export interface JunkFoodLogEntry {
  /** Calendar date as "YYYY-MM-DD", in the patient's local time. */
  date: string;
  ateJunkFood: boolean;
}

/**
 * `isoDate` shifted by `delta` calendar days, as "YYYY-MM-DD".
 *
 * Deliberately works entirely in UTC-labelled arithmetic (`Date.UTC` /
 * `getUTC*`) so the date is treated as a plain calendar date with no
 * timezone attached — parsing `"${isoDate}T00:00:00"` instead would have JS
 * interpret it as local time, silently shifting the date by a day in any
 * timezone ahead of UTC (e.g. IST) once `toISOString()` converts it back.
 */
const addDays = (isoDate: string, delta: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

/** Today's date as "YYYY-MM-DD" in local time. */
export const todayIso = (): string => {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
};

/**
 * Consecutive clean days ending today.
 *
 * If today has not been logged yet, it is skipped rather than treated as a
 * break — she has not had the chance to log it. Any other missing day, or a
 * day logged as junk food, ends the streak.
 */
export const currentStreak = (
  entries: JunkFoodLogEntry[],
  today: string = todayIso()
): number => {
  const byDate = new Map(entries.map((e) => [e.date, e.ateJunkFood]));

  let count = 0;
  let cursor = today;
  let isToday = true;

  while (true) {
    const value = byDate.get(cursor);

    if (isToday && value === undefined) {
      // Today just hasn't been logged yet — don't count it, don't break.
      cursor = addDays(cursor, -1);
      isToday = false;
      continue;
    }

    if (value === false) {
      count++;
      cursor = addDays(cursor, -1);
      isToday = false;
      continue;
    }

    break; // value === true, or an unlogged day that wasn't today
  }

  return count;
};

/** The longest run of calendar-consecutive clean days in `entries`. */
export const longestStreak = (entries: JunkFoodLogEntry[]): number => {
  const cleanDates = entries
    .filter((e) => !e.ateJunkFood)
    .map((e) => e.date)
    .sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of cleanDates) {
    const isConsecutive = previous !== null && addDays(previous, 1) === date;
    run = isConsecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return longest;
};
