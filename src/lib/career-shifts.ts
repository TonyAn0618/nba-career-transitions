import { transitionProfile } from "./transition-matches.ts";
import type { SeasonRow } from "./types.ts";

export const SHIFT_RULE = {
  maxSeasons: 4,
  extraSeasonCost: 5,
  minScore: 10,
  limit: 3,
} as const;

export interface CareerShift {
  first: SeasonRow;
  last: SeasonRow;
  distance: number;
  score: number;
  driver: number;
}

/** Total variation between five-zone compositions, expressed in percentage points. */
export function detectCareerShifts(career: SeasonRow[]) {
  const rows = [...career].sort((a, b) => a.season - b.season);
  const candidates: CareerShift[] = [];
  let examined = 0;
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i];
    for (
      let j = i + 1;
      j < Math.min(i + SHIFT_RULE.maxSeasons, rows.length);
      j++
    ) {
      const last = rows[j];
      if (last.season !== rows[j - 1].season + 1) break;
      const profile = transitionProfile(first, last);
      if (!profile) break; // An ineligible intermediate season breaks the whole run.
      examined++;
      const distance =
        50 * profile.change.reduce((sum, delta) => sum + Math.abs(delta), 0);
      const score =
        Math.round(
          (distance - SHIFT_RULE.extraSeasonCost * (j - i - 1)) * 1e6,
        ) / 1e6;
      if (score < SHIFT_RULE.minScore) continue;
      const driver = profile.change.reduce(
        (best, delta, k, changes) =>
          Math.abs(delta) > Math.abs(changes[best]) ? k : best,
        0,
      );
      candidates.push({ first, last, distance, score, driver });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.last.season - a.first.season - (b.last.season - b.first.season) ||
      a.first.season - b.first.season,
  );
  const shifts: CareerShift[] = [];
  for (const candidate of candidates) {
    if (
      shifts.every(
        (s) =>
          candidate.last.season < s.first.season ||
          candidate.first.season > s.last.season,
      )
    ) {
      shifts.push(candidate);
      if (shifts.length === SHIFT_RULE.limit) break;
    }
  }
  return { examined, shifts };
}

export function initialSeasons(
  rows: SeasonRow[],
  strongest: CareerShift | undefined,
  from?: number,
  to?: number,
) {
  if (
    from != null &&
    to != null &&
    from < to &&
    rows.some((r) => r.season === from) &&
    rows.some((r) => r.season === to)
  ) {
    return { from, to };
  }
  if (strongest)
    return { from: strongest.first.season, to: strongest.last.season };
  return { from: rows[0].season, to: rows[rows.length - 1].season };
}
