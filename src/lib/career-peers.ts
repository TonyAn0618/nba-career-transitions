import { completeProfile } from "./transitions.ts";
import type { SeasonRow } from "./types.ts";

export const MIN_HISTORY_FGA = 200;
export const MIN_ZONE_FGA = 25;

export interface CareerProfile {
  firstSeason: number;
  lastSeason: number;
  firstAge: number | null;
  lastAge: number | null;
  debutSeason: number;
  careerYear: number;
  position: string;
  seasons: number;
  shotSeasons: number;
  attempts: number;
  shares: (number | null)[];
  fg: (number | null)[];
  fgAttempts: number[];
  fga36: number | null;
}

interface Components {
  mix: number;
  accuracy: number;
  volume: number;
}
export interface CareerPeer {
  baseline: SeasonRow;
  history: CareerProfile;
  alignedYears: number;
  components: Components;
  score: number;
}

export function primaryPosition(position: string) {
  const primary = position.toUpperCase().trim().split(/[-/]/)[0].trim();
  return ["PG", "SG", "SF", "PF", "C"].includes(primary) ? primary : "";
}

function knownDebut(row: SeasonRow) {
  const debut = row.debutSeason;
  return debut != null &&
    Number.isInteger(debut) &&
    debut > 0 &&
    debut <= row.season
    ? debut
    : null;
}

function observedPrefix(
  baseline: SeasonRow,
  rows: readonly SeasonRow[],
  debutSeason: number,
) {
  return rows
    .filter(
      (r) =>
        r.playerId === baseline.playerId &&
        r.season >= debutSeason &&
        r.season <= baseline.season,
    )
    .sort((a, b) => a.season - b.season);
}

function summarize(
  rows: readonly SeasonRow[],
  debutSeason: number,
  useBoxScoreThrees = false,
): CareerProfile {
  const attemptsByZone = [0, 0, 0, 0, 0],
    makes = [0, 0, 0, 0, 0],
    fgAttempts = [0, 0, 0, 0, 0];
  let minutes = 0,
    volumeAttempts = 0,
    attempts = 0,
    shotSeasons = 0;
  for (const row of rows) {
    const fga = row.fga;
    if (fga == null || fga < 0) continue;
    if (row.minutes != null && row.minutes > 0) {
      minutes += row.minutes;
      volumeAttempts += fga;
    }
    if (!fga || !completeProfile(row)) continue;
    shotSeasons++;
    attempts += fga;
    const totalShare = row.shares.reduce<number>((sum, v) => sum + v!, 0);
    const twoShare = totalShare - row.shares[4]!;
    const threes = useBoxScoreThrees ? row.threeAttempts : null;
    const knownThrees =
      threes != null &&
      threes >= 0 &&
      threes <= fga &&
      (twoShare > 0 || threes === fga);
    row.shares.forEach((v, i) => {
      let n = (v! / totalShare) * fga;
      if (knownThrees)
        n =
          i === 4
            ? threes
            : twoShare > 0
              ? (v! / twoShare) * (fga - threes)
              : 0;
      attemptsByZone[i] += n;
      if (
        knownThrees &&
        i === 4 &&
        row.threeMade != null &&
        row.threeMade >= 0 &&
        row.threeMade <= n
      ) {
        fgAttempts[i] += n;
        makes[i] += row.threeMade;
      } else if (row.fg[i] != null && row.fg[i] >= 0 && row.fg[i] <= 1) {
        fgAttempts[i] += n;
        makes[i] += n * row.fg[i];
      }
    });
  }
  const first = rows[0],
    last = rows[rows.length - 1];
  return {
    debutSeason,
    careerYear: last.season - debutSeason + 1,
    firstSeason: first.season,
    lastSeason: last.season,
    firstAge: first.age,
    lastAge: last.age,
    position: primaryPosition(last.position),
    seasons: rows.length,
    shotSeasons,
    attempts,
    fgAttempts,
    shares: attemptsByZone.map((n) => (attempts > 0 ? n / attempts : null)),
    fg: makes.map((n, i) => (fgAttempts[i] > 0 ? n / fgAttempts[i] : null)),
    fga36: minutes > 0 ? (36 * volumeAttempts) / minutes : null,
  };
}

export interface CareerShootingTotals extends CareerProfile {
  points36: number | null;
  rts: number | null;
}

/** Display totals cover each player's entire recorded career, independently of the matching cutoff. */
export function careerShootingTotals(
  rows: readonly SeasonRow[],
  debutSeason: number,
): CareerShootingTotals {
  const profile = summarize(rows, debutSeason, true);
  let points = 0,
    minutes = 0,
    tsAttempts = 0,
    relativeTSSum = 0;
  let fga = 0,
    threeAttempts = 0,
    threeMade = 0;
  let completeAttempts = true,
    completeMakes = true;
  for (const row of rows) {
    if (row.fga !== 0) {
      if (
        row.fga == null ||
        row.fga < 0 ||
        row.threeAttempts == null ||
        row.threeAttempts < 0 ||
        row.threeAttempts > row.fga
      )
        completeAttempts = false;
      else {
        fga += row.fga;
        threeAttempts += row.threeAttempts;
        if (
          row.threeMade != null &&
          row.threeMade >= 0 &&
          row.threeMade <= row.threeAttempts
        )
          threeMade += row.threeMade;
        else if (row.threeAttempts > 0) completeMakes = false;
      }
    }
    if (row.minutes != null && row.minutes > 0 && row.points != null) {
      points += row.points;
      minutes += row.minutes;
    }
    if (row.rts != null && row.fga != null && row.fta != null) {
      const weight = row.fga + 0.44 * row.fta;
      tsAttempts += weight;
      relativeTSSum += row.rts * weight;
    }
  }
  // Box scores can cover threes even in a season with an incomplete two-point breakdown.
  if (completeAttempts && fga > 0) {
    profile.shares = profile.shares.map((share, zone) => {
      if (zone === 4) return threeAttempts / fga;
      return share == null ? null : share * (profile.attempts / fga);
    });
    if (completeMakes) {
      profile.fgAttempts[4] = threeAttempts;
      profile.fg[4] = threeAttempts > 0 ? threeMade / threeAttempts : null;
    }
  }
  return {
    ...profile,
    points36: minutes ? (36 * points) / minutes : null,
    rts: tsAttempts ? relativeTSSum / tsAttempts : null,
  };
}

function usableHistory(rows: readonly SeasonRow[], debutSeason: number) {
  if (!rows.length) return null;
  const history = summarize(rows, debutSeason);
  return history.attempts >= MIN_HISTORY_FGA &&
    history.fga36 != null &&
    history.fga36 > 0 &&
    history.position &&
    history.fgAttempts.some((n) => n >= MIN_ZONE_FGA)
    ? history
    : null;
}

export function careerProfile(baseline: SeasonRow, rows: readonly SeasonRow[]) {
  const debut = knownDebut(baseline);
  if (debut == null) return null;
  return usableHistory(observedPrefix(baseline, rows, debut), debut);
}

function stageProfiles(rows: readonly SeasonRow[], debutSeason: number) {
  return new Map(
    rows.map((row) => [
      row.season - debutSeason + 1,
      summarize([row], debutSeason),
    ]),
  );
}

function compare(a: CareerProfile, b: CareerProfile) {
  const mix =
    a.attempts && b.attempts
      ? a.shares.reduce<number>(
          (sum, share, i) => sum + Math.min(share!, b.shares[i]!),
          0,
        )
      : null;
  let weightedError = 0,
    totalWeight = 0;
  for (let i = 0; i < a.fg.length; i++) {
    const weight = Math.min(a.fgAttempts[i], b.fgAttempts[i]);
    const x = a.fg[i],
      y = b.fg[i];
    if (weight < MIN_ZONE_FGA || x == null || y == null) continue;
    weightedError += weight * Math.abs(x - y);
    totalWeight += weight;
  }
  const accuracy = totalWeight ? 1 - weightedError / totalWeight : null;
  const volume =
    a.fga36 != null && b.fga36 != null && Math.max(a.fga36, b.fga36) > 0
      ? Math.min(a.fga36, b.fga36) / Math.max(a.fga36, b.fga36)
      : null;
  return { mix, accuracy, volume };
}

const metrics = ["mix", "accuracy", "volume"] as const;

function compareHistories(
  target: CareerProfile,
  stages: ReadonlyMap<number, CareerProfile>,
  history: CareerProfile,
  rows: readonly SeasonRow[],
) {
  const pooled = compare(target, history);
  if (pooled.mix == null || pooled.accuracy == null || pooled.volume == null)
    return null;
  const sums = { mix: 0, accuracy: 0, volume: 0 };
  const weights = { mix: 0, accuracy: 0, volume: 0 };
  let alignedYears = 0;
  for (const [year, b] of stageProfiles(rows, history.debutSeason)) {
    const a = stages.get(year);
    if (!a) continue;
    // The smaller observed sample limits the evidence for the two seasons.
    const weight = Math.min(a.attempts, b.attempts);
    if (!weight) continue;
    alignedYears++;
    const values = compare(a, b);
    for (const key of metrics) {
      const value = values[key];
      if (value == null) continue;
      sums[key] += weight * value;
      weights[key] += weight;
    }
  }
  const components = { mix: 0, accuracy: 0, volume: 0 };
  for (const key of metrics) {
    const all = pooled[key]!;
    const aligned = weights[key] ? sums[key] / weights[key] : all;
    components[key] = Math.min(100, 50 * (aligned + all));
  }
  const score = (components.mix + components.accuracy + components.volume) / 3;
  return { history, alignedYears, components, score };
}

/** Score the two prefixes independently of every season that follows either reference season. */
export function rankCareerPeers(
  anchor: SeasonRow,
  careers: ReadonlyMap<string, SeasonRow[]>,
) {
  const matches: CareerPeer[] = [];
  const debut = knownDebut(anchor);
  if (debut == null) return { target: null, matches };
  const targetRows = observedPrefix(
    anchor,
    careers.get(anchor.playerId) ?? [anchor],
    debut,
  );
  const target = usableHistory(targetRows, debut);
  if (!target) return { target, matches };
  const stages = stageProfiles(targetRows, debut);
  for (const [id, rows] of careers) {
    if (id === anchor.playerId) continue;
    // Calendar time since the first NBA season preserves missed years and
    // remains anchored at the real debut for players active before 1996–97.
    const baseline = rows.find((row) => {
      const peerDebut = knownDebut(row);
      return (
        peerDebut != null &&
        peerDebut < debut &&
        row.season - peerDebut + 1 === target.careerYear &&
        primaryPosition(row.position) === target.position
      );
    });
    if (!baseline) continue;
    const peerDebut = baseline.debutSeason!;
    const prefix = observedPrefix(baseline, rows, peerDebut);
    const history = usableHistory(prefix, peerDebut);
    if (!history) continue;
    const match = compareHistories(target, stages, history, prefix);
    if (match) matches.push({ baseline, ...match });
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      b.alignedYears - a.alignedYears ||
      a.baseline.playerId.localeCompare(b.baseline.playerId),
  );
  return { target, matches };
}
