import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

const commit = "3981e43c07e963db539c527beb8a7b4b99ec8716";
const base =
  "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/" +
  commit +
  "/Data/";
const firstSeason = 1997;
const lastSeason = 2026;
const columns = ["0_3", "3_10", "10_16", "16_3p", "3p"];
const expectedHashes = {
  "Player Shooting.csv":
    "7cb9d90ddde154eda7ccadbc541e1119969959695fb5b29ca26fee67eb8f10a6",
  "Player Totals.csv":
    "2954bc4acb2651f6989304ab1a6d79f3ec710195b828c922510bc1250928b316",
  "Team Totals.csv":
    "b4caeb0cb52cdb4d5d88f340f05f7738a1cf2f35efebdca9000fc7f34d91fe35",
};
await mkdir("data/cache", { recursive: true });
await mkdir("public/data", { recursive: true });

async function source(name) {
  const path = "data/cache/" + name;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    const response = await fetch(base + encodeURIComponent(name), {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(name + ": HTTP " + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path, bytes);
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedHashes[name])
    throw new Error(
      name +
        ": source hash does not match the pinned snapshot. Check or remove this file in data/cache, then retry.",
    );
  const rows = parse(bytes, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
  return {
    rows,
    provenance: {
      file: name,
      url: base + encodeURIComponent(name),
      bytes: bytes.length,
      sha256: hash,
    },
  };
}

const [shooting, totals, teamTotals] = await Promise.all([
  source("Player Shooting.csv"),
  source("Player Totals.csv"),
  source("Team Totals.csv"),
]);
const number = (value) =>
  value == null ||
  value === "" ||
  value === "NA" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
const inScope = (r) =>
  r.lg === "NBA" && +r.season >= firstSeason && +r.season <= lastSeason;
const key = (r) => r.player_id + ":" + r.season;
function canonical(sourceRows) {
  const groups = new Map();
  for (const row of sourceRows.filter(inScope)) {
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  const selected = new Map();
  const ambiguous = [];
  for (const [id, group] of groups) {
    const aggregate = group.filter(
      (r) => r.team === "TOT" || /^\dTM$/.test(r.team),
    );
    if (aggregate.length === 1) selected.set(id, aggregate[0]);
    else if (group.length === 1) selected.set(id, group[0]);
    else ambiguous.push(id);
  }
  return { selected, ambiguous };
}
const shotRows = canonical(shooting.rows);
const totalRows = canonical(totals.rows);
const affiliations = new Map();
for (const r of totals.rows.filter(inScope)) {
  if (!/^[A-Z]{3}$/.test(r.team) || r.team === "TOT") continue;
  const teams = affiliations.get(key(r)) ?? new Set();
  teams.add(r.team);
  affiliations.set(key(r), teams);
}
// Preserve the aggregate rows above. Store team stints separately, keyed by
// player, season and team. The source has no transaction dates or stint order.
const tradedTotals = new Map(
  totals.rows
    .filter(
      (r) =>
        inScope(r) &&
        affiliations.get(key(r))?.size > 1 &&
        affiliations.get(key(r)).has(r.team),
    )
    .map((r) => [key(r) + ":" + r.team, r]),
);
const teamSplits = {};
for (const r of shooting.rows.filter(inScope)) {
  const id = key(r);
  const total = tradedTotals.get(id + ":" + r.team);
  if (!total) continue;
  const fga = number(total.fga),
    fta = number(total.fta),
    pts = number(total.pts);
  const denominator = fga !== null && fta !== null ? 2 * (fga + 0.44 * fta) : 0;
  (teamSplits[id] ??= []).push({
    team: r.team,
    games: number(total.g),
    fga,
    ts: denominator > 0 && pts !== null ? pts / denominator : null,
    shares: columns.map((zone) =>
      number(r["percent_fga_from_x" + zone + "_range"]),
    ),
    fg: columns.map((zone) => number(r["fg_percent_from_x" + zone + "_range"])),
  });
}
for (const stints of Object.values(teamSplits))
  stints.sort((a, b) => a.team.localeCompare(b.team));
const teamDirectory = teamTotals.rows
  .filter(
    (r) =>
      inScope(r) &&
      /^[A-Z]{3}$/.test(r.abbreviation) &&
      r.abbreviation !== "NBA" &&
      r.team !== "League Average",
  )
  .map((r) => ({
    season: +r.season,
    abbr: r.abbreviation,
    name: r.team.replace(/\*$/, ""),
  }));
const league = [];
for (let season = firstSeason; season <= lastSeason; season++) {
  const teams = teamTotals.rows.filter(
    (r) =>
      inScope(r) &&
      +r.season === season &&
      /^[A-Z]{3}$/.test(r.abbreviation) &&
      r.abbreviation !== "NBA" &&
      r.team !== "League Average",
  );
  const players = [...totalRows.selected.values()].filter(
    (r) => +r.season === season,
  );
  const sums = (rows) =>
    ["pts", "fga", "fta", "x3pa", "x3p"].map((field) =>
      rows.reduce((s, r) => s + (number(r[field]) ?? NaN), 0),
    );
  const teamSums = sums(teams);
  const playerSums = sums(players);
  const reconciled =
    teams.length === (season < 2005 ? 29 : 30) &&
    new Set(teams.map((t) => t.abbreviation)).size === teams.length &&
    teamSums
      .slice(0, 3)
      .every((n, i) => Number.isFinite(n) && n === playerSums[i]);
  const denominator = 2 * (teamSums[1] + 0.44 * teamSums[2]);
  league.push({
    season,
    teams: teams.length,
    ts: reconciled && denominator > 0 ? teamSums[0] / denominator : null,
    threePointReconciled:
      teamSums[3] === playerSums[3] && teamSums[4] === playerSums[4],
    threeAttemptDifference: playerSums[3] - teamSums[3],
    threeShare:
      reconciled && teamSums[1] > 0 ? teamSums[3] / teamSums[1] : null,
    threeFg: reconciled && teamSums[3] > 0 ? teamSums[4] / teamSums[3] : null,
    verified: reconciled,
    reason: reconciled
      ? null
      : "Player and team season totals do not reconcile.",
    playerTotals: playerSums,
    teamTotals: teamSums,
  });
}
const baselines = new Map(league.map((l) => [l.season, l]));
const rows = [];
const issues = [];
for (const [id, r] of shotRows.selected) {
  const t = totalRows.selected.get(id);
  if (!t) {
    issues.push({ id, issue: "missing_player_totals" });
    continue;
  }
  const shares = columns.map((zone) =>
    number(r["percent_fga_from_x" + zone + "_range"]),
  );
  const fg = columns.map((zone) =>
    number(r["fg_percent_from_x" + zone + "_range"]),
  );
  const dataFlags = [];
  const complete = shares.every(
    (v) => v !== null && Number.isFinite(v) && v >= 0 && v <= 1,
  );
  if (complete && Math.abs(shares.reduce((s, v) => s + v, 0) - 1) > 0.005) {
    issues.push({ id, issue: "incomplete_distance_distribution" });
    dataFlags.push("incomplete_distance_distribution");
  }
  if (!complete) dataFlags.push("missing_distance_data");
  const season = +r.season;
  const fga = number(t.fga),
    fta = number(t.fta),
    points = number(t.pts);
  const denominator = fga !== null && fta !== null ? 2 * (fga + 0.44 * fta) : 0;
  const ts = denominator > 0 && points !== null ? points / denominator : null;
  const baseline = baselines.get(season);
  rows.push({
    id,
    playerId: r.player_id,
    name: r.player,
    season,
    age: number(r.age),
    team: r.team,
    teams: [...(affiliations.get(id) ?? [])].sort(),
    position: r.pos,
    games: number(t.g),
    minutes: number(t.mp),
    fga,
    fta,
    points,
    threeAttempts: number(t.x3pa),
    threeMade: number(t.x3p),
    shares,
    fg,
    ts,
    dataFlags,
    leagueTs: baseline?.ts ?? null,
    rts: ts !== null && baseline?.ts != null ? (ts - baseline.ts) * 100 : null,
  });
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.season - b.season);
const playerGroups = new Map();
for (const row of rows) {
  if (!playerGroups.has(row.playerId))
    playerGroups.set(row.playerId, {
      id: row.playerId,
      name: row.name,
      first: row.season,
      last: row.season,
    });
  playerGroups.get(row.playerId).last = Math.max(
    playerGroups.get(row.playerId).last,
    row.season,
  );
}
const players = [...playerGroups.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
// Retain provenance when another checkout rebuilds the same pinned snapshot.
const previousManifest = await readFile("data/source-manifest.json", "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
const metadata = {
  schemaVersion: 1,
  sourceCommit: commit,
  retrievedAt:
    previousManifest?.sourceCommit === commit
      ? previousManifest.retrievedAt
      : new Date().toISOString(),
  source: "Basketball-Reference statistics compiled by Sumitro Datta",
  seasonType: "NBA regular season",
  firstSeason,
  lastSeason,
  rowCount: rows.length,
  playerCount: players.length,
  seasonCount: league.length,
  sources: [shooting.provenance, totals.provenance, teamTotals.provenance],
  quality: {
    ambiguousShooting: shotRows.ambiguous,
    ambiguousTotals: totalRows.ambiguous,
    unmatchedOrInvalid: issues,
    completeShares: rows.filter((r) => r.shares.every((v) => v != null)).length,
    reconciledLeagueSeasons: league.filter((l) => l.verified).length,
  },
};
await writeFile(
  "public/data/nba.json",
  JSON.stringify({ metadata, players, rows, league, teams: teamDirectory }),
);
await writeFile("public/data/team-splits.json", JSON.stringify(teamSplits));
await writeFile(
  "data/source-manifest.json",
  JSON.stringify(metadata, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      rows: rows.length,
      players: players.length,
      seasons: league.length,
      verifiedBaselines: metadata.quality.reconciledLeagueSeasons,
      issues: issues.length,
      ambiguousShooting: shotRows.ambiguous.length,
      ambiguousTotals: totalRows.ambiguous.length,
    },
    null,
    2,
  ),
);
