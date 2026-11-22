export type Language = "en" | "zh";
export type Translate = (en: string, zh: string) => string;
export type Shares = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];
export interface SeasonRow {
  id: string;
  playerId: string;
  name: string;
  season: number;
  /** End year of the first NBA regular season with a game played in Player Totals. */
  debutSeason?: number | null;
  age: number | null;
  team: string;
  teams?: string[];
  position: string;
  games: number | null;
  minutes: number | null;
  fgm?: number | null;
  fga: number | null;
  fta: number | null;
  points: number | null;
  threeAttempts: number | null;
  threeMade: number | null;
  shares: Shares;
  fg: Shares;
  dataFlags: string[];
  ts: number | null;
  leagueTs: number | null;
  rts: number | null;
}
export interface Player {
  id: string;
  name: string;
  first: number;
  last: number;
}
export interface Source {
  file: string;
  url: string;
  bytes: number;
  sha256: string;
}
export interface Dataset {
  metadata: {
    schemaVersion: number;
    sourceCommit: string;
    retrievedAt: string;
    source: string;
    seasonType: string;
    firstSeason: number;
    lastSeason: number;
    rowCount: number;
    playerCount: number;
    seasonCount: number;
    sources: Source[];
    quality: {
      completeShares: number;
      reconciledLeagueSeasons: number;
      ambiguousShooting: string[];
      ambiguousTotals: string[];
      unmatchedOrInvalid: unknown[];
    };
  };
  players: Player[];
  rows: SeasonRow[];
  teams?: { season: number; abbr: string; name: string }[];
  league: {
    season: number;
    ts: number | null;
    threeShare?: number | null;
    threeFg?: number | null;
    verified: boolean;
    teams: number;
    reason: string | null;
  }[];
}
