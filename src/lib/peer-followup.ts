import { careerShootingTotals } from "./career-peers.ts";
import { completeProfile } from "./transitions.ts";
import type { SeasonRow } from "./types.ts";

export interface FollowupPeriod {
  firstYear: number;
  lastYear: number;
  seasons: number;
  games: number | null;
  shares: (number | null)[];
  fg: (number | null)[];
  zoneAttempts: (number | null)[];
  zonePerGame: (number | null)[];
  ts: number | null;
  rts: number | null;
  ppg: number | null;
  mpg: number | null;
  fgaPerGame: number | null;
  points36: number | null;
}

export interface FollowupYear {
  year: number;
  season: number;
  stats: FollowupPeriod | null;
}

export function zoneShifts(pre: FollowupPeriod, post: FollowupPeriod) {
  return pre.shares
    .flatMap((v, i) => {
      const w = post.shares[i];
      return v == null || w == null ? [] : [{ zone: i, change: (w - v) * 100 }];
    })
    .sort((a, b) => b.change - a.change);
}

function total(
  rows: readonly SeasonRow[],
  get: (r: SeasonRow) => number | null,
) {
  let sum = 0;
  for (const row of rows) {
    const value = get(row);
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    sum += value;
  }
  return sum;
}

function ratio(n: number | null, d: number | null) {
  return n != null && d != null && d > 0 ? n / d : null;
}

function noTwos(row: SeasonRow) {
  return row.fga != null && (row.fga === 0 || row.fga === row.threeAttempts);
}

export function summarizeFollowupPeriod(
  rows: readonly SeasonRow[],
  debut: number,
): FollowupPeriod | null {
  if (!rows.length) return null;
  const profile = careerShootingTotals(rows, debut);
  const games = total(rows, (r) => r.games);
  const fga = total(rows, (r) => r.fga);
  const fta = total(rows, (r) => r.fta);
  const minutes = total(rows, (r) => r.minutes);
  const points = total(rows, (r) => r.points);
  const threeAttempts = total(rows, (r) => (r.fga === 0 ? 0 : r.threeAttempts));
  const threeMade = total(rows, (r) =>
    r.fga === 0 || r.threeAttempts === 0 ? 0 : r.threeMade,
  );
  // A missing two-point breakdown leaves that period's two-point volume unknown.
  // Rounded distance shares estimate the four two-point counts; threes use box scores.
  const completeTwos = rows.every(
    (r) =>
      noTwos(r) ||
      (completeProfile(r) &&
        r.shares.slice(0, 4).some((v) => v != null && v > 0)),
  );
  const zoneAttempts = profile.shares.map((share, i) => {
    if (i === 4) return threeAttempts;
    if (fga != null && (fga === 0 || fga === threeAttempts)) return 0;
    return completeTwos && share != null && fga != null ? share * fga : null;
  });
  const fg = zoneAttempts.map((n, i) => {
    if (i === 4) return ratio(threeMade, threeAttempts);
    if (n == null || n === 0) return null;
    const covered = rows.every((r) => {
      const rate = r.fg[i];
      return (
        noTwos(r) ||
        r.shares[i] === 0 ||
        (rate != null && rate >= 0 && rate <= 1)
      );
    });
    return covered ? profile.fg[i] : null;
  });
  const tsDenominator =
    fga != null && fta != null ? 2 * (fga + 0.44 * fta) : null;
  const leagueCovered = rows.every(
    (r) => r.rts != null || (r.fga === 0 && r.fta === 0),
  );
  return {
    firstYear: profile.firstSeason - debut + 1,
    lastYear: profile.lastSeason - debut + 1,
    seasons: rows.length,
    games,
    zoneAttempts,
    shares: zoneAttempts.map((n) => ratio(n, fga)),
    fg,
    zonePerGame: zoneAttempts.map((n) => ratio(n, games)),
    ts: ratio(points, tsDenominator),
    rts:
      tsDenominator != null && tsDenominator > 0 && leagueCovered
        ? profile.rts
        : null,
    ppg: ratio(points, games),
    mpg: ratio(minutes, games),
    fgaPerGame: ratio(fga, games),
    points36: ratio(points == null ? null : 36 * points, minutes),
  };
}

/** One player's observed regular seasons, split after the matching career year.
 * The two period summaries pool observations; the yearly series retains calendar gaps.
 */
export function peerFollowup(
  rows: readonly SeasonRow[],
  debut: number,
  matchYear: number,
) {
  const ordered = rows
    .filter((r) => r.season >= debut)
    .sort((a, b) => a.season - b.season);
  const cutoff = debut + matchYear - 1;
  const before = ordered.filter((r) => r.season <= cutoff);
  const later = ordered.filter((r) => r.season > cutoff);
  const bySeason = new Map(later.map((r) => [r.season, r]));
  const years: FollowupYear[] = [];
  const last = later.at(-1)?.season ?? cutoff;
  for (let season = cutoff + 1; season <= last; season++) {
    const row = bySeason.get(season);
    years.push({
      year: season - debut + 1,
      season,
      stats: row ? summarizeFollowupPeriod([row], debut) : null,
    });
  }
  return {
    pre: summarizeFollowupPeriod(before, debut),
    post: summarizeFollowupPeriod(later, debut),
    years,
  };
}
