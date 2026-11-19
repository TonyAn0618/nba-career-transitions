import { fga36 } from "./analysis.ts";
import type { SeasonRow } from "./types.ts";

export const STYLE_MIN_FGA = 200;
export const STYLE_WEIGHTS = { mix: 0.8, volume: 0.2 } as const;
export const PATH_LIMIT = 8;
export const CHANGE_THRESHOLD_PP = 2;
export type PathMetric = "share" | "rts" | "points";
export type ObservationStatus = "available" | "sample" | "missing" | "outside";

export function eligibleStyle(row: SeasonRow) {
  return (
    row.age != null &&
    Number.isFinite(row.age) &&
    (row.fga ?? 0) >= STYLE_MIN_FGA &&
    (fga36(row) ?? 0) > 0 &&
    row.shares.every((v) => v != null && Number.isFinite(v) && v >= 0) &&
    row.shares.reduce<number>((sum, v) => sum + (v ?? 0), 0) > 0
  );
}

export function styleSimilarity(a: SeasonRow, b: SeasonRow) {
  const normalize = (row: SeasonRow) => {
    const total = row.shares.reduce<number>((sum, n) => sum + (n ?? 0), 0);
    return row.shares.map((n) => (n ?? 0) / total);
  };
  const x = normalize(a),
    y = normalize(b);
  const mix = x.reduce((sum, n, i) => sum + Math.min(n, y[i]), 0);
  const volume =
    Math.min(fga36(a)!, fga36(b)!) / Math.max(fga36(a)!, fga36(b)!);
  return {
    mix,
    volume,
    score: 100 * (STYLE_WEIGHTS.mix * mix + STYLE_WEIGHTS.volume * volume),
  };
}

export interface StyleMatch {
  baseline: SeasonRow;
  similarity: ReturnType<typeof styleSimilarity>;
}

function roles(position: string) {
  return new Set(
    position
      .split(/[-/]/)
      .map((p) => (p === "PG" || p === "SG" ? "G" : p === "C" ? "C" : "F")),
  );
}

/** Only baseline information is used. Future outcomes and completeness never affect rank. */
export function matchStyles(
  anchor: SeasonRow,
  careers: ReadonlyMap<string, SeasonRow[]>,
  options: { ageTolerance?: number; sameRole?: boolean; limit?: number } = {},
) {
  const { ageTolerance = 0, sameRole = false, limit = PATH_LIMIT } = options;
  const matches: StyleMatch[] = [];
  if (!eligibleStyle(anchor)) return { matches, count: 0 };
  const targetRoles = roles(anchor.position);
  const compare = (a: StyleMatch, b: StyleMatch) =>
    b.similarity.score - a.similarity.score ||
    Math.abs(a.baseline.age! - anchor.age!) -
      Math.abs(b.baseline.age! - anchor.age!) ||
    b.baseline.season - a.baseline.season ||
    a.baseline.id.localeCompare(b.baseline.id);
  for (const [playerId, rows] of careers) {
    if (playerId === anchor.playerId) continue;
    const candidates = rows
      .filter(
        (r) =>
          r.season < anchor.season &&
          eligibleStyle(r) &&
          Math.abs(r.age! - anchor.age!) <= ageTolerance &&
          (!sameRole ||
            [...roles(r.position)].some((role) => targetRoles.has(role))),
      )
      .map((baseline) => ({
        baseline,
        similarity: styleSimilarity(anchor, baseline),
      }))
      .sort(compare);
    if (candidates[0]) matches.push(candidates[0]);
  }
  matches.sort(compare);
  return { count: matches.length, matches: matches.slice(0, limit) };
}

export interface PathObservation {
  year: number;
  offset: number;
  row?: SeasonRow;
  status: ObservationStatus;
}

/** Freeze all observations at the target reference season. Never expose later target records. */
export function pathObservation(
  base: SeasonRow,
  rows: readonly SeasonRow[],
  offset: number,
  asOf: number,
): PathObservation {
  const year = base.season + offset;
  if (year > asOf) return { year, offset, status: "outside" };
  const row = rows.find(
    (r) => r.playerId === base.playerId && r.season === year,
  );
  if (!row) return { year, offset, status: "missing" };
  return {
    row,
    year,
    offset,
    status: (row.fga ?? 0) < STYLE_MIN_FGA ? "sample" : "available",
  };
}

export function pathValue(
  row: SeasonRow | undefined,
  metric: PathMetric,
  band: number,
): number | null {
  if (!row) return null;
  const value =
    metric === "share"
      ? row.shares[band] == null
        ? null
        : row.shares[band]! * 100
      : metric === "rts"
        ? row.rts
        : row.points != null && (row.minutes ?? 0) > 0
          ? (row.points * 36) / row.minutes!
          : null;
  return value != null && Number.isFinite(value) ? value : null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function pathEvidence(
  anchor: SeasonRow,
  matches: StyleMatch[],
  careers: ReadonlyMap<string, SeasonRow[]>,
  offset: number,
  band: number,
) {
  return matches.map((match) => {
    const base = match.baseline;
    const observation = pathObservation(
      base,
      careers.get(base.playerId) ?? [],
      offset,
      anchor.season,
    );
    const change = (metric: PathMetric) => {
      const before = pathValue(base, metric, band),
        after = pathValue(observation.row, metric, band);
      return before == null || after == null ? null : after - before;
    };
    const share = change("share"),
      rts = change("rts"),
      points = change("points");
    const included = observation.status === "available" && share != null;
    const direction = !included
      ? "unknown"
      : share! > CHANGE_THRESHOLD_PP
        ? "up"
        : share! < -CHANGE_THRESHOLD_PP
          ? "down"
          : "steady";
    return { ...match, observation, share, rts, points, included, direction };
  });
}

export function evidenceGroups(evidence: ReturnType<typeof pathEvidence>) {
  return (["up", "steady", "down"] as const).map((direction) => {
    const cases = evidence.filter(
      (item) => item.included && item.direction === direction,
    );
    const efficiencies = cases.flatMap((r) => (r.rts == null ? [] : [r.rts]));
    const production = cases.flatMap((r) =>
      r.points == null ? [] : [r.points],
    );
    return {
      direction,
      cases,
      count: cases.length,
      rts: median(efficiencies),
      points: median(production),
      rtsN: efficiencies.length,
      pointsN: production.length,
    };
  });
}
