import { fga36 } from "./analysis.ts";
import { completeProfile } from "./transitions.ts";
import type { SeasonRow } from "./types.ts";

export const MATCH_WEIGHTS = { shift: 0.6, start: 0.25, volume: 0.15 } as const;
export const MIN_MATCH_FGA = 200;

export interface TransitionProfile {
  start: number[];
  change: number[];
  volume: [number, number];
}

export function transitionProfile(
  a: SeasonRow,
  b: SeasonRow,
): TransitionProfile | null {
  if (
    a.playerId !== b.playerId ||
    a.season >= b.season ||
    a.age == null ||
    b.age == null ||
    [a, b].some(
      (row) => !completeProfile(row) || (row.fga ?? 0) < MIN_MATCH_FGA,
    )
  )
    return null;
  const startVolume = fga36(a),
    endVolume = fga36(b);
  if (
    startVolume == null ||
    endVolume == null ||
    startVolume <= 0 ||
    endVolume <= 0
  )
    return null;
  // Source shares are rounded independently. Close each valid composition before taking differences.
  const normalized = (row: SeasonRow) => {
    const total = row.shares.reduce<number>((sum, value) => sum + value!, 0);
    return row.shares.map((value) => value! / total);
  };
  const start = normalized(a);
  return {
    start,
    change: normalized(b).map((v, i) => v - start[i]),
    volume: [startVolume, endVolume],
  };
}

export function transitionScore(x: TransitionProfile, y: TransitionProfile) {
  let sharedChange = 0,
    totalChange = 0,
    start = 0;
  for (let i = 0; i < x.change.length; i++) {
    const u = x.change[i],
      v = y.change[i];
    totalChange += Math.abs(u) + Math.abs(v);
    if (u * v > 0) sharedChange += Math.min(Math.abs(u), Math.abs(v));
    start += Math.min(x.start[i], y.start[i]);
  }
  // Bray–Curtis similarity on separate gain and loss channels for each zone.
  const shift = totalChange < 1e-12 ? 1 : (2 * sharedChange) / totalChange;
  const ratios = x.volume.map(
    (v, i) => Math.min(v, y.volume[i]) / Math.max(v, y.volume[i]),
  );
  const volume = (ratios[0] + ratios[1]) / 2;
  const score =
    100 *
    (MATCH_WEIGHTS.shift * shift +
      MATCH_WEIGHTS.start * start +
      MATCH_WEIGHTS.volume * volume);
  return { shift, start, volume, score: Math.min(100, score) };
}

export interface HistoricalTransition {
  a: SeasonRow;
  b: SeasonRow;
  profile: TransitionProfile;
  similarity: ReturnType<typeof transitionScore>;
}

export function matchTransitions(
  a: SeasonRow,
  b: SeasonRow,
  careers: ReadonlyMap<string, SeasonRow[]>,
) {
  const anchor = transitionProfile(a, b);
  const matches: HistoricalTransition[] = [];
  if (!anchor) return { anchor, count: 0, matches };
  const span = b.season - a.season;
  for (const [player, rows] of careers) {
    if (player === b.playerId) continue;
    let best: HistoricalTransition | undefined;
    for (const end of rows) {
      if (end.age !== b.age || end.season >= b.season) continue;
      const begin = rows.find(
        (r) => r.age === a.age && r.season === end.season - span,
      );
      if (!begin) continue;
      const profile = transitionProfile(begin, end);
      if (!profile) continue;
      const similarity = transitionScore(anchor, profile);
      if (
        !best ||
        similarity.score > best.similarity.score ||
        (similarity.score === best.similarity.score &&
          end.season < best.b.season)
      ) {
        best = { a: begin, b: end, profile, similarity };
      }
    }
    if (best) matches.push(best);
  }
  matches.sort(
    (x, y) =>
      y.similarity.score - x.similarity.score ||
      x.b.season - y.b.season ||
      x.b.playerId.localeCompare(y.b.playerId),
  );
  return { anchor, count: matches.length, matches: matches.slice(0, 3) };
}

export function matchedFollowup(
  end: SeasonRow,
  rows: SeasonRow[],
  asOf: number,
) {
  return [0, 1, 2, 3].map((offset) => {
    const year = end.season + offset;
    const observable = year <= asOf;
    const row = observable
      ? rows.find((r) => r.playerId === end.playerId && r.season === year)
      : undefined;
    return { offset, year, observable, row };
  });
}
