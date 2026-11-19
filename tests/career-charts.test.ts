import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cellId,
  inCourt,
  shotCells,
  shotSummary,
  shotZone,
  type Shot,
} from "../src/lib/shots.ts";
import { completeProfile, zoneChanges } from "../src/lib/transitions.ts";
import {
  detectCareerShifts,
  initialSeasons,
} from "../src/lib/career-shifts.ts";
import type { Dataset } from "../src/lib/types.ts";
const data = JSON.parse(
  readFileSync(new URL("../public/data/nba.json", import.meta.url), "utf8"),
) as Dataset;
const at = (id: string) => data.rows.find((r) => r.id === id)!;
const shot = (
  x = 0,
  y = 5.25,
  made: 0 | 1 = 1,
  points: 2 | 3 = 2,
  distance = 0,
): Shot => [
  x,
  y,
  made,
  points,
  distance,
  1610612744,
  "0021500001",
  "2015-10-27",
  1,
  720,
  "Restricted Area",
  "C",
  "Jump Shot",
];
test("court cells use recorded attempts including off-view shots as denominator", () => {
  const shots = [shot(0, 5.25), shot(1, 6, 0), shot(10, 60, 0, 3, 55)];
  const cells = shotCells(shots);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].attempts, 2);
  assert.equal(cells[0].fg, 0.5);
  assert.equal(cells[0].share, 2 / 3);
  assert.equal(shotCells(shots, true).length, 2);
  assert.equal(shotSummary(shots).fg, 1 / 3);
  assert.equal(shotSummary([]).fg, null);
});
test("court boundaries preserve baseline, sidelines and backcourt without inventing points", () => {
  assert.equal(inCourt(shot(-25, 0)), true);
  assert.equal(inCourt(shot(25, 47)), true);
  assert.equal(cellId(shot(25, 5.25)), "9:1");
  assert.equal(inCourt(shot(0, 47.1)), false);
  assert.equal(inCourt(shot(0, 94), true), true);
  assert.equal(inCourt(shot(0, 94.1), true), false);
  assert.equal(shotZone(shot(22, 6, 1, 3, 22)), 4);
  assert.equal(shotZone(shot(0, 8.25, 1, 2, 3)), 1);
});
test("league three-point rates are attempt-weighted and retain the documented source discrepancy", () => {
  const league = data.league.find((l) => l.season === 2016)!;
  assert.equal(league.threeShare, 59241 / 208049);
  assert.equal(league.threeFg, 20953 / 59241);
  assert.equal(league.verified, true);
});

test("player defaults use the highest detected shift and explicit seasons take precedence", () => {
  const career = data.rows
    .filter((r) => r.playerId === "lopezbr01")
    .sort((a, b) => a.season - b.season);
  const strongest = detectCareerShifts(career).shifts[0];
  assert.deepEqual(initialSeasons(career, strongest), { from: 2016, to: 2019 });
  assert.deepEqual(initialSeasons(career, strongest, 2017, 2016), {
    from: 2016,
    to: 2019,
  });
  assert.deepEqual(initialSeasons(career, strongest, 2016, 2017), {
    from: 2016,
    to: 2017,
  });
  const sparse = [career[0], career[3], career[6]];
  assert.deepEqual(
    initialSeasons(sparse, detectCareerShifts(sparse).shifts[0]),
    {
      from: sparse[0].season,
      to: sparse[2].season,
    },
  );
  const changes = zoneChanges(at("lopezbr01:2016"), at("lopezbr01:2017"));
  assert.deepEqual(
    changes.map((v) => v?.toFixed(1)),
    ["-9.5", "-2.5", "-8.1", "-11.5", "31.8"],
  );
});
test("incomplete career profiles are marked and an unrecorded band keeps a missing delta", () => {
  const before = at("lopezbr01:2012");
  assert.equal(before.shares[4], 0);
  assert.equal(completeProfile(before), true);
  const after = {
    ...before,
    shares: [...before.shares] as typeof before.shares,
  };
  after.shares[4] = null;
  assert.equal(completeProfile(after), false);
  assert.deepEqual(zoneChanges(before, after), [0, 0, 0, 0, null]);
});
