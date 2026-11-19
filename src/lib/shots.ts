import type { SeasonRow } from "./types.ts";
// Canonical feet: baseline y=0, basket (0,5.25). See shot-manifest.json.
export type Shot = [
  number,
  number,
  0 | 1,
  2 | 3,
  number,
  number,
  number | string,
  string,
  number,
  number,
  string,
  string,
  string,
];
export interface ShotCoverage {
  recordedAttempts: number;
  expectedAttempts: number | null;
  ratio: number | null;
  status: string;
  /** Present only when ratio is null because expected FGA is missing or zero. */
  ratioUnavailableReason?: "unknown_expected" | "zero_denominator";
}
export interface ShotEntry {
  nbaId: number;
  playerId: string | null;
  name: string;
  season: number;
  attempts: number;
  made: number;
  file: string;
  coverage: ShotCoverage;
  teams: {
    id: number;
    name: string;
    abbr: string;
    attempts: number;
    made: number;
  }[];
}
export interface ShotIndex {
  metadata: {
    schemaVersion: number;
    firstSeason: number;
    lastSeason: number;
    totalShots: number;
    playerCount: number;
    playerSeasonCount: number;
    sourceCommit: string;
  };
  playerSeasons: Record<string, ShotEntry>;
}
export interface ShotFile {
  schemaVersion: number;
  season: number;
  nbaId: number;
  playerId: string | null;
  name: string;
  shots: Shot[];
  coverage: ShotCoverage;
}
export type ShotMode = "points" | "frequency" | "accuracy";
export function shotZone(s: Shot) {
  return s[3] === 3 ? 4 : s[4] < 3 ? 0 : s[4] < 10 ? 1 : s[4] < 16 ? 2 : 3;
}
export function inCourt(s: Shot, full = false) {
  return s[0] >= -25 && s[0] <= 25 && s[1] >= 0 && s[1] <= (full ? 94 : 47);
}
export function cellId(s: Shot) {
  return `${Math.min(9, Math.max(0, Math.floor((s[0] + 25) / 5)))}:${Math.floor(s[1] / 5)}`;
}
export interface ShotCell {
  id: string;
  x: number;
  y: number;
  attempts: number;
  made: number;
  share: number;
  fg: number;
}
export function shotCells(shots: Shot[], full = false): ShotCell[] {
  const cells = new Map<string, ShotCell>();
  for (const s of shots) {
    if (!inCourt(s, full)) continue;
    const id = cellId(s),
      [col, row] = id.split(":").map(Number);
    const c = cells.get(id) ?? {
      id,
      x: col * 5 - 25,
      y: row * 5,
      attempts: 0,
      made: 0,
      share: 0,
      fg: 0,
    };
    c.attempts++;
    c.made += s[2];
    cells.set(id, c);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    share: c.attempts / shots.length,
    fg: c.made / c.attempts,
  }));
}
export function shotSummary(shots: Shot[]) {
  const made = shots.reduce((sum, s) => sum + s[2], 0);
  return {
    attempts: shots.length,
    made,
    fg: shots.length ? made / shots.length : null,
  };
}
export function entryFor(index: ShotIndex | null, row: SeasonRow) {
  return index
    ? (Object.values(index.playerSeasons).find(
        (e) => e.playerId === row.playerId && e.season === row.season,
      ) ?? null)
    : null;
}
