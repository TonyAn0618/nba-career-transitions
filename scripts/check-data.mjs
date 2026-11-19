import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

const d = JSON.parse(await readFile("public/data/nba.json", "utf8"));
const manifest = JSON.parse(
  await readFile("data/source-manifest.json", "utf8"),
);
assert.deepEqual(d.metadata, manifest, "manifest matches the loaded dataset");
assert.equal(d.rows.length, 13987);
assert.equal(d.players.length, 2756);
assert.equal(
  new Set(d.rows.map((r) => r.id)).size,
  d.rows.length,
  "one row per player-season",
);
assert.equal(d.league.length, 29);
assert.ok(d.league.every((l) => l.verified && l.ts > 0.4 && l.ts < 0.7));
assert.equal(d.metadata.quality.unmatchedOrInvalid.length, 174);
const sourceRows = new Map();
for (const source of manifest.sources) {
  assert.ok(source.url.includes("/" + manifest.sourceCommit + "/"));
  const bytes = await readFile("data/cache/" + source.file);
  assert.equal(bytes.length, source.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
  sourceRows.set(
    source.file,
    parse(bytes, { columns: true, skip_empty_lines: true }),
  );
}
for (const r of d.rows) {
  assert.ok(r.season >= 1997 && r.season <= 2025);
  assert.ok(
    r.shares.every(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1),
    ),
    r.id,
  );
  assert.ok(
    r.fg.every((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1)),
    r.id,
  );
  if (r.ts != null) {
    assert.equal(r.ts, r.points / (2 * (r.fga + 0.44 * r.fta)), r.id);
    assert.equal(r.rts, (r.ts - r.leagueTs) * 100, r.id);
  }
  if (
    r.shares.every((v) => v != null) &&
    Math.abs(r.shares.reduce((s, v) => s + v, 0) - 1) > 0.005
  )
    assert.ok(r.dataFlags.includes("incomplete_distance_distribution"), r.id);
}
for (const league of d.league) {
  const teams = sourceRows
    .get("Team Totals.csv")
    .filter((r) => +r.season === league.season && r.team !== "League Average");
  assert.equal(teams.length, league.season < 2005 ? 29 : 30);
  const sum = (field) => teams.reduce((s, r) => s + Number(r[field]), 0);
  assert.equal(league.ts, sum("pts") / (2 * (sum("fga") + 0.44 * sum("fta"))));
  assert.deepEqual(
    league.playerTotals.slice(0, 3),
    league.teamTotals.slice(0, 3),
  );
  assert.equal(league.threeShare, sum("x3pa") / sum("fga"));
  assert.equal(league.threeFg, sum("x3p") / sum("x3pa"));
  assert.equal(league.threePointReconciled, league.season !== 2016);
  assert.equal(league.threeAttemptDifference, league.season === 2016 ? 1 : 0);
}
const curry = d.rows.find((r) => r.id === "curryst01:2016");
assert.equal(curry.threeMade, 402);
assert.equal(curry.threeAttempts, 886);
assert.equal(curry.fga, 1598);
assert.equal(curry.shares[4], 0.554);
const traded = d.rows.find((r) => r.id === "westbru01:2023");
const aggregate = sourceRows
  .get("Player Totals.csv")
  .find(
    (r) =>
      r.player_id === "westbru01" &&
      r.season === "2023" &&
      /^(TOT|\dTM)$/.test(r.team),
  );
assert.ok(aggregate, "source contains a traded-player full-season record");
assert.equal(traded.fga, Number(aggregate.fga));
assert.equal(d.rows.filter((r) => r.id === traded.id).length, 1);
assert.ok(
  d.rows.some((r) => r.shares[4] === 0),
  "genuine zero preserved",
);
assert.ok(
  d.rows.some((r) => r.shares[4] === null),
  "missing value preserved",
);
console.log(
  "Verified: 13,987 unique player-seasons, 2,756 players, 29 reconciled league baselines, pinned source hashes, source samples, traded-player deduplication, and missing/zero handling.",
);

assert.deepEqual(traded.teams, ["LAC", "LAL"]);
assert.equal(d.teams.length, 862);
