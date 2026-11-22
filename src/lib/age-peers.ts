import { fga36 } from "./analysis.ts";
import { completeProfile } from "./transitions.ts";
import type { SeasonRow } from "./types.ts";

export const HORIZON = 5;
export const COHORT_SIZE = 10;
const WEIGHTS = [1, 1, 1, 1, 1, 0.5, 0.5];
const EPS = 1e-10;
export interface AgePeer {
  baseline: SeasonRow;
  score: number;
}

export function adequateSeason(row: SeasonRow) {
  return (row.minutes ?? 0) >= 500 || (row.fga ?? 0) >= 200;
}

export function profile(row: SeasonRow) {
  const shotsPer36 = fga36(row);
  if (
    row.age == null ||
    !adequateSeason(row) ||
    !completeProfile(row) ||
    shotsPer36 == null ||
    !Number.isFinite(shotsPer36) ||
    shotsPer36 <= 0 ||
    row.fga == null ||
    row.fta == null ||
    !Number.isFinite(row.fta) ||
    row.fta < 0
  )
    return null;
  const total = row.shares.reduce<number>((sum, n) => sum + n!, 0);
  return [...row.shares.map((n) => n! / total), shotsPer36, row.fta / row.fga];
}

export function rankAgePeers(
  anchor: SeasonRow,
  careers: ReadonlyMap<string, SeasonRow[]>,
) {
  const query = profile(anchor);
  const candidates: { baseline: SeasonRow; vector: number[] }[] = [];
  const matches: AgePeer[] = [];
  if (!query) return { matches, eligible: 0, hasProfile: false };

  for (const [id, rows] of careers) {
    if (id === anchor.playerId) continue;
    // Keep one player per rank. Prefer the earliest qualifying row in case an age repeats.
    let first: (typeof candidates)[number] | undefined;
    for (const row of rows) {
      if (
        row.age !== anchor.age ||
        row.season >= anchor.season ||
        (first && first.baseline.season <= row.season)
      )
        continue;
      const vector = profile(row);
      if (vector) first = { baseline: row, vector };
    }
    if (first) candidates.push(first);
  }
  const count = candidates.length;
  if (count < 2) return { matches, eligible: count, hasProfile: true };
  const means = query.map(
    (_, i) => candidates.reduce((sum, v) => sum + v.vector[i], 0) / count,
  );
  const sd = means.map((mean, i) =>
    Math.sqrt(
      candidates.reduce((sum, v) => sum + (v.vector[i] - mean) ** 2, 0) / count,
    ),
  );
  // sqrt(weight) on both vectors applies each feature weight once in the dot product.
  const scaled = (values: number[]) =>
    values.map((v, i) =>
      sd[i] > EPS ? ((v - means[i]) / sd[i]) * Math.sqrt(WEIGHTS[i]) : 0,
    );
  const x = scaled(query);
  const norm = Math.hypot(...x);
  if (norm > EPS) {
    for (const { baseline, vector } of candidates) {
      const y = scaled(vector);
      const yn = Math.hypot(...y);
      if (yn < EPS) continue;
      const value = x.reduce((sum, n, i) => sum + n * y[i], 0) / (norm * yn);
      matches.push({ baseline, score: Math.max(-1, Math.min(1, value)) });
    }
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.baseline.season - b.baseline.season ||
      a.baseline.playerId.localeCompare(b.baseline.playerId),
  );
  return { matches, eligible: count, hasProfile: true };
}

export function peerPath(
  baseline: SeasonRow,
  careers: ReadonlyMap<string, SeasonRow[]>,
  asOf: number,
) {
  const rows = careers.get(baseline.playerId) ?? [];
  return Array.from({ length: HORIZON + 1 }, (_, i) => {
    if (baseline.age == null || baseline.season + i > asOf) return null;
    if (i === 0) return baseline;
    return (
      rows.find(
        (r) =>
          r.season === baseline.season + i &&
          r.age === baseline.age! + i &&
          adequateSeason(r),
      ) ?? null
    );
  });
}

// Linear interpolation between adjacent ordered observations.
function quantile(sorted: number[], portion: number) {
  const index = (sorted.length - 1) * portion;
  const left = Math.floor(index);
  return (
    sorted[left] + (sorted[Math.ceil(index)] - sorted[left]) * (index - left)
  );
}

export function cohortOutlook(
  matches: AgePeer[],
  careers: ReadonlyMap<string, SeasonRow[]>,
  anchor: SeasonRow,
) {
  const paths = matches
    .slice(0, COHORT_SIZE)
    .map((m) => peerPath(m.baseline, careers, anchor.season));
  return Array.from({ length: HORIZON + 1 }, (_, i) => {
    const actual: number[] = [],
      changes: number[] = [];
    for (const path of paths) {
      const rts = path[i]?.rts,
        start = path[0]?.rts;
      if (rts == null || !Number.isFinite(rts)) continue;
      actual.push(rts);
      if (start != null && Number.isFinite(start)) changes.push(rts - start);
    }
    actual.sort((a, b) => a - b);
    changes.sort((a, b) => a - b);
    return {
      count: actual.length,
      median: actual.length ? quantile(actual, 0.5) : null,
      pairedCount: changes.length,
      prediction:
        changes.length >= 3 && anchor.rts != null
          ? anchor.rts + quantile(changes, 0.5)
          : null,
      scenario:
        changes.length >= 3 && anchor.rts != null
          ? [0.25, 0.75].map((q) => anchor.rts! + quantile(changes, q))
          : null,
    };
  });
}
